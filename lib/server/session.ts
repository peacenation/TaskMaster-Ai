import { cookies } from "next/headers";
import { isValidTimeZone } from "@/lib/domain/dates";
import { withRepositories } from "@/lib/repo";

// Who and where the current request is. No authentication exists yet
// (ADR-003: Better Auth arrives in Phase 8); until then there is exactly
// one local user, and this is the single seam Phase 8 replaces.

export const LOCAL_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "You",
  email: "local@taskmaster.local",
} as const;

export async function getCurrentUserId(): Promise<string> {
  // Idempotent, and cheap enough per request — not cached, because the
  // seed script and DB tests truncate users in local development.
  await withRepositories(LOCAL_USER.id, (repos) =>
    repos.users.ensure({ name: LOCAL_USER.name, email: LOCAL_USER.email })
  );
  return LOCAL_USER.id;
}

export const TIME_ZONE_COOKIE = "tz";

/** The browser's timezone, from the cookie components/shell/TimeZoneCookie sets. */
export async function getTimeZone(): Promise<string> {
  const value = (await cookies()).get(TIME_ZONE_COOKIE)?.value;
  return value && isValidTimeZone(value) ? value : "UTC";
}
