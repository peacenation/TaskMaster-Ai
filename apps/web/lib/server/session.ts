import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { isValidTimeZone } from "@/lib/domain/dates";
import { supabaseServer, supabaseStateless } from "@/lib/supabase/server";
import { withRepositories } from "@/lib/repo";

export interface AuthSession {
  user: {
    id: string;
    email: string;
    name: string;
    /** Sign-in methods on the account, e.g. ["email", "google"]. */
    providers: string[];
  };
  /** Most recent time the person actually authenticated (not a token refresh). */
  signedInAt: Date | null;
}

/** Postgres unique_violation (23505), however the driver wraps it. */
function isUniqueViolation(error: unknown): boolean {
  for (
    let e: unknown = error;
    e && typeof e === "object";
    e = (e as { cause?: unknown }).cause
  )
    if ((e as { code?: unknown }).code === "23505") return true;
  return false;
}

/** JWT payload, read only after the Auth server has accepted the token. */
function claims(token: string): { amr?: { method: string; timestamp: number }[] } {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
  } catch {
    return {};
  }
}

/**
 * The signed-in user, verified by the Supabase Auth server on every request
 * (getUser), so a signed-out, revoked or deleted session is refused at once
 * (PRD §1.11). Web pages use the session cookie; the mobile app sends the
 * same access token as `Authorization: Bearer` (ADR-013).
 */
export const getSession = cache(async (): Promise<AuthSession | null> => {
  const bearer = (await headers()).get("authorization");
  let token: string | undefined;
  if (bearer?.startsWith("Bearer ")) {
    token = bearer.slice("Bearer ".length).trim();
  } else {
    const supabase = await supabaseServer();
    token = (await supabase.auth.getSession()).data.session?.access_token;
  }
  if (!token) return null;
  const { data, error } = await supabaseStateless().auth.getUser(token);
  if (error || !data.user?.email) return null;
  const user = data.user;
  const amr = claims(token).amr ?? [];
  const latest = Math.max(0, ...amr.map((entry) => entry.timestamp));
  const name =
    (user.user_metadata?.name as string | undefined) ??
    (user.user_metadata?.full_name as string | undefined) ??
    user.email!.split("@")[0];
  return {
    user: {
      id: user.id,
      email: user.email!,
      name,
      providers:
        (user.app_metadata?.providers as string[] | undefined) ??
        (user.identities ?? []).map((identity) => identity.provider),
    },
    signedInAt: latest ? new Date(latest * 1000) : null,
  };
});

/**
 * The signed-in user and their profile, loaded once per request (React
 * cache) in one transaction: pages call getCurrentUserId() and
 * getTimeZone(), and each used to cost its own database round trips. The
 * profile is created on first sign-in (and its auth link repaired if a
 * previous attempt was interrupted) — otherwise this is a single read.
 */
export const getCurrentProfile = cache(async () => {
  const session = await getSession();
  if (!session) redirect("/signin");
  let profile;
  try {
    profile = await withRepositories(session.user.id, async (repos) => {
      const existing = await repos.users.profile();
      if (existing?.authId) return existing;
      await repos.users.ensure({
        name: session.user.name,
        email: session.user.email,
        authId: session.user.id,
      });
      return repos.users.profile();
    });
  } catch (error) {
    // Another account's profile already has this email (e.g. a second login
    // created before an existing account was moved to Supabase Auth). Explain
    // instead of failing with a 500.
    if (isUniqueViolation(error)) redirect("/signin?error=account_conflict");
    throw error;
  }
  if (!profile) throw new Error("Profile could not be created.");
  return { session, profile };
});

export async function getCurrentUserId(): Promise<string> {
  return (await getCurrentProfile()).session.user.id;
}
export const TIME_ZONE_COOKIE = "tz";
export async function getTimeZone(): Promise<string> {
  const session = await getSession();
  if (session) {
    // Same cached profile the page already loaded: no extra round trip.
    const { profile } = await getCurrentProfile();
    if (isValidTimeZone(profile.timezone) && profile.preferences.timezoneSet)
      return profile.timezone;
  }
  const value = (await cookies()).get(TIME_ZONE_COOKIE)?.value;
  return value && isValidTimeZone(value) ? value : "UTC";
}
