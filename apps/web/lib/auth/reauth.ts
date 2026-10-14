import type { AuthSession } from "@/lib/server/session";

// Sensitive actions (deleting the account) need proof it's really you. With a
// password, that's the password. A Google-only account has none, so it must
// have authenticated within this window instead — "Confirm with Google" in
// Settings signs in again. `signedInAt` comes from the access token's `amr`
// claim, which a token refresh doesn't move.
export const REAUTH_WINDOW_MS = 10 * 60 * 1000;

export function isRecentSignIn(signedInAt: Date | null, now = Date.now()): boolean {
  return !!signedInAt && now - signedInAt.getTime() < REAUTH_WINDOW_MS;
}

/** Which ways the signed-in user can sign in: password and/or Google. */
export function signInMethods(session: AuthSession) {
  return {
    hasPassword: session.user.providers.includes("email"),
    googleLinked: session.user.providers.includes("google"),
  };
}
