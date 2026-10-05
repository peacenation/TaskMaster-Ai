import Link from "next/link";
import { saveGoal } from "@/app/actions/goals";
import { withRepositories } from "@/lib/repo";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const userId = await getCurrentUserId();
  const { goals, tasks } = await withRepositories(userId, async (repos) => ({
    goals: await repos.goals.list(),
    tasks: await repos.tasks.list({ statuses: ["todo", "in_progress", "postponed", "completed"] }),
  }));

  return (
    <div className="wrap">
      <header className="hero">
        <p className="eyebrow">Goals</p>
        <h1>Longer-term direction</h1>
      </header>

      <section>
        <h2>New goal</h2>
        <form action={saveGoal} className="task-form">
          <div className="form-grid">
            <label className="field" htmlFor="title">
              <span>Goal title</span>
              <input id="title" name="title" type="text" required maxLength={500} />
            </label>
            <label className="field" htmlFor="targetDate">
              <span>Target date</span>
              <input id="targetDate" name="targetDate" type="date" />
            </label>
          </div>
          <div className="button-row">
            <button className="btn btn-primary" type="submit">
              Save goal
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2>Current goals</h2>
        {goals.length === 0 ? (
          <p className="field-hint">No goals yet. Add one to anchor your work.</p>
        ) : (
          <ul className="review-list">
            {goals.map((goal) => {
              const linked = tasks.filter((task) => task.goalId === goal.id);
              return (
                <li key={goal.id} className="review-item">
                  <span className="review-item-text">
                    <strong>{goal.title}</strong>
                    {goal.targetDate && <span className="field-hint"> · target {goal.targetDate}</span>}
                    <span className="field-hint"> · {linked.length} linked task{linked.length === 1 ? "" : "s"}</span>
                  </span>
                  <Link href="/tasks/new" className="review-item-remove">
                    Add task
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
