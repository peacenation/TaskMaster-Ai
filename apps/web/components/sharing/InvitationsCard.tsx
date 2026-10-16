import { answerInvite } from "@/app/actions/sharing";

// Invitations to your email address, waiting for an answer.
export function InvitationsCard({
  invites,
}: {
  invites: Array<{ id: string; projectName: string; inviterName: string }>;
}) {
  if (invites.length === 0) return null;
  return (
    <section className="dash-card" aria-labelledby="invitations-heading">
      <p className="eyebrow">Shared with you</p>
      <h2 id="invitations-heading">
        {invites.length === 1 ? "An invitation" : `${invites.length} invitations`}
      </h2>
      <ul className="review-list">
        {invites.map((invite) => (
          <li className="review-item" key={invite.id}>
            <span className="review-item-text">
              <strong>{invite.inviterName || "Someone"}</strong> invited you to{" "}
              <strong>{invite.projectName}</strong>
            </span>
            <div className="button-row">
              <form action={answerInvite.bind(null, invite.id, true)}>
                <button className="btn btn-primary" type="submit">
                  Join
                </button>
              </form>
              <form action={answerInvite.bind(null, invite.id, false)}>
                <button className="btn btn-secondary" type="submit">
                  Decline
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
