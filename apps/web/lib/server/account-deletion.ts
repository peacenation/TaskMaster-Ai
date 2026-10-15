import { z } from "zod";
import { isRecentSignIn, signInMethods } from "@/lib/auth/reauth";
import { withRepositories } from "@/lib/repo";
import type { AuthSession } from "@/lib/server/session";
import { supabaseAdmin, supabaseStateless } from "@/lib/supabase/server";

// Permanent account deletion, shared by Settings on the web
// (app/api/account/delete) and the mobile app (DELETE /api/v1/me).

export const deletionSchema = z.object({
  confirmation: z.literal("DELETE"),
  password: z.string().min(1).max(128).optional(),
});

export type DeletionResult = { ok: true } | { ok: false; status: number; error: string };

export async function deleteAccount(
  session: AuthSession,
  input: z.infer<typeof deletionSchema>
): Promise<DeletionResult> {
  // Proof it's really you: the password, or (Google-only accounts) a
  // sign-in from the last few minutes.
  const { hasPassword } = signInMethods(session);
  if (hasPassword) {
    if (!input.password) return { ok: false, status: 400, error: "Enter your password." };
    const { error } = await supabaseStateless().auth.signInWithPassword({
      email: session.user.email,
      password: input.password,
    });
    if (error)
      return {
        ok: false,
        status: 400,
        error: "Could not delete the account. Check your password and try again.",
      };
  } else if (!isRecentSignIn(session.signedInAt)) {
    return {
      ok: false,
      status: 403,
      error: "For your security, sign in with Google again, then delete.",
    };
  }

  try {
    // Data first: every app table cascades from public.users, so this one
    // row takes everything with it. If removing the login then fails, the
    // person can retry; the reverse order could orphan data with no login.
    await withRepositories(session.user.id, (repos) => repos.account.deleteAll());
    const { error } = await supabaseAdmin().auth.admin.deleteUser(session.user.id);
    if (error) throw error;
    return { ok: true };
  } catch {
    return { ok: false, status: 500, error: "Could not delete the account. Try again." };
  }
}
