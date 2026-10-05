import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { zonedTimeToUtc } from "@/lib/domain/dates";
import { localDate } from "@/lib/execution/date";
import { withRepositories } from "@/lib/repo";
import { getCurrentUserId, getTimeZone } from "@/lib/server/session";

export const dynamic = "force-dynamic";

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayBoundary(value: string, timeZone: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return zonedTimeToUtc({ year, month, day }, 0, 0, timeZone);
}

export default async function DailyReviewPage() {
  const userId = await getCurrentUserId();
  const timeZone = await getTimeZone();
  const today = localDate(new Date(), timeZone);
  const start = dayBoundary(today, timeZone);
  const end = dayBoundary(shiftDate(today, 1), timeZone);
  const { events, tasks, missed } = await withRepositories(userId, async (repos) => ({
    events: await repos.execution.eventsBetween(start, end),
    tasks: await repos.tasks.list(),
    missed: await repos.execution.recovery(new Date()),
  }));
  const completed = events.filter((event) => event.eventType === "completed");
  const changed = events.filter(
    (event) => !["completed", "created"].includes(event.eventType)
  );
  const carried = tasks.filter(
    (task) =>
      task.source !== "recurrence" &&
      task.createdAt < start &&
      ["todo", "in_progress", "postponed"].includes(task.status)
  );

  return (
    <div className="wrap">
      <header className="hero">
        <p className="eyebrow">Daily review</p>
        <h1>Close the day, quickly</h1>
        <p>
          {completed.length} completed · {changed.length} changed · {carried.length} carried
          forward
        </p>
      </header>
      {events.length === 0 && carried.length === 0 && missed.length === 0 ? (
        <EmptyState title="A clear day" description="There is nothing to review here yet." />
      ) : (
        <>
          <section aria-labelledby="completed-heading">
            <h2 id="completed-heading">Completed</h2>
            {completed.length ? (
              <ul className="review-list">
                {completed.map((event, index) => (
                  <li className="review-item" key={`${event.taskId}-${index}`}>
                    <Link href={`/tasks/${event.taskId}`}>{event.title}</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="field-hint">Nothing marked complete today.</p>
            )}
          </section>
          <section aria-labelledby="missed-heading">
            <h2 id="missed-heading">Missed plan blocks</h2>
            {missed.length ? (
              <ul className="review-list">
                {missed.map((item) => (
                  <li className="review-item" key={item.id}>
                    <Link href={`/tasks/${item.taskId}`}>{item.title}</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="field-hint">No missed blocks need a decision.</p>
            )}
          </section>
          <section aria-labelledby="carry-heading">
            <h2 id="carry-heading">Still active</h2>
            {carried.length ? (
              <ul className="review-list">
                {carried.map((task) => (
                  <li className="review-item" key={task.id}>
                    <Link href={`/tasks/${task.id}`}>{task.title}</Link>
                    <span className="field-hint"> · {task.status.replaceAll("_", " ")}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="field-hint">No active work carried over.</p>
            )}
          </section>
          {changed.length > 0 && (
            <section aria-labelledby="changed-heading">
              <h2 id="changed-heading">Changed today</h2>
              <ul className="review-list">
                {changed.map((event, index) => (
                  <li
                    className="review-item"
                    key={`${event.taskId}-${event.eventType}-${index}`}
                  >
                    <Link href={`/tasks/${event.taskId}`}>{event.title}</Link>
                    <span className="field-hint">
                      {" "}
                      · {event.eventType.replaceAll("_", " ")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      <p>
        <Link href="/reviews/weekly">Open weekly review</Link>
      </p>
    </div>
  );
}
