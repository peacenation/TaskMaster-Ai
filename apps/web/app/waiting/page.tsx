import Link from "next/link";
import { followUpLater, stopWaiting } from "@/app/actions/waiting";
import { EmptyState } from "@/components/ui";
import { isFollowUpDue } from "@/lib/domain/waiting";
import { withRepositories } from "@/lib/repo";
import { getCurrentUserId, getTimeZone } from "@/lib/server/session";
import { isOpenTask } from "@/lib/server/today-view";
import { formatDue } from "@/lib/server/views";

export const dynamic = "force-dynamic";

// Waiting On (PRD §4.1): work whose next step is someone else's. It stays
// out of Today's plan until its follow-up date, then comes back to chase.
export default async function WaitingPage() {
  const userId = await getCurrentUserId();
  const timeZone = await getTimeZone();
  const now = new Date();
  const tasks = (await withRepositories(userId, (repos) => repos.tasks.list()))
    .filter((task) => isOpenTask(task) && task.waitingOn)
    .sort((a, b) => (a.followUpAt?.getTime() ?? 0) - (b.followUpAt?.getTime() ?? 0));

  return (
    <div className="wrap">
      <header className="hero">
        <p className="eyebrow">Waiting on</p>
        <h1>What other people owe you</h1>
        <p>These stay out of your plan until it’s time to follow up.</p>
      </header>
      {tasks.length === 0 ? (
        <EmptyState
          title="Nothing waiting on anyone"
          description="When a task needs someone else first — a reply, a sign-off, a delivery — mark it “Waiting on” from the task."
        />
      ) : (
        <ul className="review-list">
          {tasks.map((task) => {
            const due = isFollowUpDue(task, now);
            return (
              <li className="review-item" key={task.id}>
                <span className="review-item-text">
                  <Link href={`/tasks/${task.id}`}>{task.title}</Link>
                  <span className="field-hint">
                    {" "}
                    · waiting on {task.waitingOn}
                    {task.waitingSince && ` since ${formatDue(task.waitingSince, timeZone)}`}
                  </span>
                  {task.followUpAt && (
                    <span className={due ? "badge badge-danger" : "field-hint"}>
                      {" "}
                      {due
                        ? "Follow up now"
                        : `Follow up ${formatDue(task.followUpAt, timeZone)}`}
                    </span>
                  )}
                </span>
                <div className="button-row">
                  <form action={stopWaiting.bind(null, task.id)}>
                    <button className="btn btn-secondary" type="submit">
                      It’s arrived
                    </button>
                  </form>
                  <form action={followUpLater.bind(null, task.id, 3)}>
                    <button className="btn btn-secondary" type="submit">
                      Chased · remind me in 3 days
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
