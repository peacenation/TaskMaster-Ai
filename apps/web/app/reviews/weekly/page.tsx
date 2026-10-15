import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { loadWeeklyReview } from "@/lib/server/reviews";
import { getCurrentUserId, getTimeZone } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export default async function WeeklyReviewPage() {
  const userId = await getCurrentUserId();
  const timeZone = await getTimeZone();
  const {
    startDate,
    lastDate,
    empty,
    goals: activeGoals,
    upcoming,
    postponed,
    insights,
  } = await loadWeeklyReview(userId, timeZone);

  return (
    <div className="wrap">
      <header className="hero">
        <p className="eyebrow">Weekly review</p>
        <h1>Choose what deserves next week</h1>
        <p>
          {startDate} to {lastDate}
        </p>
      </header>
      {empty ? (
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
                {postponed.map((event) => (
                  <li className="review-item" key={event.taskId}>
                    <Link href={`/tasks/${event.taskId}`}>{event.title}</Link>
                    {event.times > 1 && (
                      <span className="field-hint"> · moved {event.times} times</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="field-hint">No postponements recorded.</p>
            )}
          </section>
          {insights.length > 0 && (
            <section aria-labelledby="suggestions-heading">
              <h2 id="suggestions-heading">Worth a look</h2>
              <ul className="review-list">
                {insights.map((insight) => (
                  <li className="review-item" key={insight.kind}>
                    <span className="review-item-text">{insight.message}</span>
                    <Link href={insight.href} className="btn btn-secondary">
                      {insight.actionLabel}
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
