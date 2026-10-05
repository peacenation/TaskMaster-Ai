import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { zonedTimeToUtc } from "@/lib/domain/dates";
import { localDate } from "@/lib/execution/date";
import { withRepositories } from "@/lib/repo";
import { getCurrentUserId, getTimeZone } from "@/lib/server/session";

export const dynamic = "force-dynamic";

function weekStart(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayBoundary(value: string, timeZone: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return zonedTimeToUtc({ year, month, day }, 0, 0, timeZone);
}

export default async function WeeklyReviewPage() {
  const userId = await getCurrentUserId();
  const timeZone = await getTimeZone();
  const startDate = weekStart(localDate(new Date(), timeZone));
  const endDate = shiftDate(startDate, 7);
  const start = dayBoundary(startDate, timeZone);
  const end = dayBoundary(endDate, timeZone);
  const data = await withRepositories(userId, async (repos) => ({
    goals: await repos.goals.list(),
    tasks: await repos.tasks.list(),
    events: await repos.execution.eventsBetween(start, end),
  }));
  const completedIds = new Set(
    data.events.filter((event) => event.eventType === "completed").map((event) => event.taskId)
  );
  const upcoming = data.tasks.filter(
    (task) =>
      task.source !== "recurrence" && task.dueAt && task.dueAt >= start && task.dueAt < end
  );
  const postponed = data.events.filter((event) => event.eventType === "postponed");
  const activeGoals = data.goals.map((goal) => {
    const goalTasks = data.tasks.filter(
      (task) => task.goalId === goal.id && task.status !== "dropped"
    );
    const completed = goalTasks.filter((task) => completedIds.has(task.id)).length;
    return { ...goal, goalTasks, completed };
  });
  const neglected = activeGoals.filter(
    (goal) => goal.goalTasks.length > 0 && goal.completed === 0
  );

  return (
    <div className="wrap">
      <header className="hero">
        <p className="eyebrow">Weekly review</p>
        <h1>Choose what deserves next week</h1>
        <p>
          {startDate} to {shiftDate(endDate, -1)}
        </p>
      </header>
      {!data.goals.length && !data.tasks.length ? (
        <EmptyState
          title="Nothing to review yet"
          description="Capture a few tasks or goals to begin."
        />
      ) : (
        <>
          <section aria-labelledby="goal-progress-heading">
            <h2 id="goal-progress-heading">Goal progress</h2>
            {activeGoals.length ? (
              <ul className="review-list">
                {activeGoals.map((goal) => (
                  <li className="review-item" key={goal.id}>
                    <span className="review-item-text">
                      <strong>{goal.title}</strong>
                      <span className="field-hint">
                        {" "}
                        · {goal.completed} task{goal.completed === 1 ? "" : "s"} completed this
                        week
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="field-hint">No active goals yet.</p>
            )}
          </section>
          <section aria-labelledby="deadlines-heading">
            <h2 id="deadlines-heading">Deadlines this week</h2>
            {upcoming.length ? (
              <ul className="review-list">
                {upcoming.map((task) => (
                  <li className="review-item" key={task.id}>
                    <Link href={`/tasks/${task.id}`}>{task.title}</Link>
                    <span className="field-hint">
                      {" "}
                      · {task.dueAt?.toLocaleDateString("en-GB", { timeZone })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="field-hint">No task deadlines in this week.</p>
            )}
          </section>
          <section aria-labelledby="postponed-heading">
            <h2 id="postponed-heading">Postponed this week</h2>
            {postponed.length ? (
              <ul className="review-list">
                {postponed.map((event, index) => (
                  <li className="review-item" key={`${event.taskId}-${index}`}>
                    <Link href={`/tasks/${event.taskId}`}>{event.title}</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="field-hint">No postponements recorded.</p>
            )}
          </section>
          {neglected.length > 0 && (
            <section aria-labelledby="suggestions-heading">
              <h2 id="suggestions-heading">A useful next move</h2>
              <ul className="review-list">
                {neglected.map((goal) => (
                  <li className="review-item" key={goal.id}>
                    <span className="review-item-text">
                      Choose one small action for <strong>{goal.title}</strong> next week.
                    </span>
                    <Link href="/goals" className="btn btn-secondary">
                      Review goal tasks
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      <p>
        <Link href="/reviews/daily">Open daily review</Link>
      </p>
    </div>
  );
}
