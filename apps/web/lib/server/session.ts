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

export async function getCurrentUserId(): Promise<string> {
  const session = await getSession();
  if (!session) redirect("/signin");
  // Creates the profile on first sign-in (and repairs one if a previous
  // attempt was interrupted).
  await withRepositories(session.user.id, (repos) =>
    repos.users.ensure({
      name: session.user.name,
      email: session.user.email,
      authId: session.user.id,
    })
  );
  return session.user.id;
}
export const TIME_ZONE_COOKIE = "tz";
export async function getTimeZone(): Promise<string> {
  const session = await getSession();
  if (session) {
    const profile = await withRepositories(session.user.id, (repos) => repos.users.profile());
    if (profile && isValidTimeZone(profile.timezone) && profile.preferences.timezoneSet)
      return profile.timezone;
  }
  const value = (await cookies()).get(TIME_ZONE_COOKIE)?.value;
  return value && isValidTimeZone(value) ? value : "UTC";
}
