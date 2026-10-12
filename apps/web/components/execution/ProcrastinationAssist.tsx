import Link from "next/link";

export function ProcrastinationAssist({
  candidates,
}: {
  candidates: Array<{ taskId: string; title: string }>;
}) {
  if (candidates.length === 0) return null;
  return (
    <section aria-labelledby="procrastination-heading">
      <p className="eyebrow">A pattern worth noticing</p>
      <h2 id="procrastination-heading">A task has moved three times</h2>
      <p>That can mean the next step, scope, timing, or priority needs a second look.</p>
      <ul className="review-list">
        {candidates.map((candidate) => (
          <li className="review-item" key={candidate.taskId}>
            <span className="review-item-text">{candidate.title}</span>
            <div className="button-row">
              <Link className="btn btn-secondary" href={`/tasks/${candidate.taskId}`}>
                Break it down or clarify the next step
              </Link>
              <Link className="btn btn-secondary" href={`/tasks/${candidate.taskId}`}>
                Revisit scope, timing, or priority
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
