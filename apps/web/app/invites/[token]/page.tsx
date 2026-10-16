import Link from "next/link";
import { answerInvite } from "@/app/actions/sharing";
import { withRepositories } from "@/lib/repo";
import { getCurrentProfile } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// The link in an invitation. Signed out, the proxy sends you to sign in
// and back here. It only works for the email it was sent to.
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { session, profile } = await getCurrentProfile();
  const { invite, mine } = await withRepositories(session.user.id, async (repos) => ({
    invite: /^[\w-]{20,64}$/.test(token) ? await repos.sharing.byToken(token) : null,
    mine: await repos.sharing.mine(),
  }));
  const details = invite && mine.find((m) => m.id === invite.id);
  return (
    <div className="wrap">
      <header className="hero">
        <p className="eyebrow">Invitation</p>
        {details ? (
          <>
            <h1>Join {details.projectName}?</h1>
            <p>
              {details.inviterName || "Someone"} invited you to share this project: you&apos;ll
              see its tasks, can add and complete them, and can be assigned work.
            </p>
            <div className="button-row">
              <form action={answerInvite.bind(null, details.id, true)}>
                <button className="btn btn-primary" type="submit">
                  Join project
                </button>
              </form>
              <form action={answerInvite.bind(null, details.id, false)}>
                <button className="btn btn-secondary" type="submit">
                  Decline
                </button>
              </form>
            </div>
          </>
        ) : invite ? (
          <>
            <h1>This invitation is for someone else</h1>
            <p>
              It was sent to {invite.email}. You&apos;re signed in as {profile.email} — sign in
              with that address to accept it.
            </p>
          </>
        ) : (
          <>
            <h1>This invitation can&apos;t be used</h1>
            <p>It may have expired, been withdrawn or already been answered.</p>
            <p>
              <Link href="/projects">Go to your projects</Link>
            </p>
          </>
        )}
      </header>
    </div>
  );
}
