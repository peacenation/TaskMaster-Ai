import { z } from "zod";
import { getSession } from "@/lib/server/session";
import { isRecentSignIn, signInMethods } from "@/lib/auth/reauth";
import { withRepositories } from "@/lib/repo";
import { supabaseAdmin, supabaseStateless } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  const parsed = z
    .object({
      confirmation: z.literal("DELETE"),
      password: z.string().min(1).max(128).optional(),
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "Type DELETE to confirm." }, { status: 400 });

  // Proof it's really you: the password, or (Google-only accounts) a
  // sign-in from the last few minutes.
  const { hasPassword } = signInMethods(session);
  if (hasPassword) {
    if (!parsed.data.password)
      return Response.json({ error: "Enter your password." }, { status: 400 });
    const { error } = await supabaseStateless().auth.signInWithPassword({
      email: session.user.email,
      password: parsed.data.password,
    });
    if (error)
      return Response.json(
        { error: "Could not delete the account. Check your password and try again." },
        { status: 400 }
      );
  } else if (!isRecentSignIn(session.signedInAt)) {
    return Response.json(
      { error: "For your security, confirm with Google again, then delete." },
      { status: 403 }
    );
  }

  try {
    // Data first: every app table cascades from public.users, so this one
    // row takes everything with it. If removing the login then fails, the
    // person can retry; the reverse order could orphan data with no login.
    await withRepositories(session.user.id, (repos) => repos.account.deleteAll());
    const { error } = await supabaseAdmin().auth.admin.deleteUser(session.user.id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { error: "Could not delete the account. Try again." },
      { status: 500 }
    );
  }
}
