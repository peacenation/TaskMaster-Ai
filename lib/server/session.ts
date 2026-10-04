import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { isValidTimeZone } from "@/lib/domain/dates";
import { getAuth } from "@/lib/auth/server";
import { withRepositories } from "@/lib/repo";

export const getSession = cache(async () => getAuth().api.getSession({ headers: await headers() }));
export async function getCurrentUserId(): Promise<string> {
  const session = await getSession();
  if (!session) redirect("/signin");
  // Also repairs a profile if a previous registration hook was interrupted.
  await withRepositories(session.user.id, (repos) => repos.users.ensure({ name: session.user.name, email: session.user.email, authId: session.user.id }));
  return session.user.id;
}
export const TIME_ZONE_COOKIE = "tz";
export async function getTimeZone(): Promise<string> {
  const session = await getSession();
  if (session) {
    const profile = await withRepositories(session.user.id, (repos) => repos.users.profile());
    if (profile && isValidTimeZone(profile.timezone) && profile.preferences.timezoneSet) return profile.timezone;
  }
  const value = (await cookies()).get(TIME_ZONE_COOKIE)?.value;
  return value && isValidTimeZone(value) ? value : "UTC";
}
