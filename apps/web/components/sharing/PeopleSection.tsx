import { removeFromProject, withdrawInvite } from "@/app/actions/sharing";
import type { Person } from "@/lib/repo/sharing-repository";
import { InviteForm } from "./InviteForm";

// A project's people: everyone sees who's on it; the owner invites and
// removes people; a member can leave.
export function PeopleSection({
  projectId,
  people,
  pending,
  me,
  isOwner,
}: {
  projectId: string;
  people: Person[];
  pending: Array<{ id: string; email: string }>;
  me: string;
  isOwner: boolean;
}) {
  return (
    <section aria-labelledby="people-heading">
      <h2 id="people-heading">People</h2>
      {people.length <= 1 && pending.length === 0 && (
        <p className="field-hint">
          Just you so far. Invite someone to share this project&apos;s tasks and assign work to
          each other.
        </p>
      )}
      <ul className="review-list">
        {people.map((person) => (
          <li className="review-item" key={person.userId}>
            <span className="review-item-text">
              <strong>{person.name}</strong>
              {person.userId === me && <span className="field-hint"> (you)</span>}
              <span className="field-hint"> · {person.isOwner ? "owner" : "member"}</span>
            </span>
            {!person.isOwner && (isOwner || person.userId === me) && (
              <form action={removeFromProject.bind(null, projectId, person.userId)}>
                <button type="submit" className="review-item-remove">
                  {person.userId === me ? "Leave project" : "Remove"}
                </button>
              </form>
            )}
          </li>
        ))}
        {pending.map((invite) => (
          <li className="review-item" key={invite.id}>
            <span className="review-item-text">
              {invite.email} <span className="field-hint">· invited</span>
            </span>
            <form action={withdrawInvite.bind(null, projectId, invite.id)}>
              <button type="submit" className="review-item-remove">
                Withdraw
              </button>
            </form>
          </li>
        ))}
      </ul>
      {isOwner && <InviteForm projectId={projectId} />}
    </section>
  );
}
