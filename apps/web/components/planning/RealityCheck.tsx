import Link from "next/link";
import { confirmRealityDecision } from "@/app/actions/reality-check";
import type { RealityCheckSummary } from "@/lib/domain/reality-check";

export interface RealityCheckTask {
  id: string;
  title: string;
  minutes: number;
}

export function RealityCheck({
  summary,
  tasks,
}: {
  summary: RealityCheckSummary;
  tasks: RealityCheckTask[];
}) {
  return (
    <section className="reality-check" aria-labelledby="reality-check-heading">
      <p className="eyebrow">Reality Check</p>
      <h2 id="reality-check-heading">Something needs to move</h2>
      <p>
        You have about {summary.workMinutes} minutes of deadline-critical work and roughly{" "}
        {summary.usableMinutes} usable minutes. That leaves {summary.excessMinutes} minutes to
        resolve. You decide; nothing changes until you confirm a choice.
      </p>
      {tasks.length === 0 ? (
        <p className="field-hint">
          Review your active estimates or available time to make a plan.
        </p>
      ) : (
        <ul className="review-list">
          {tasks.map((task) => (
            <li className="review-item reality-check-item" key={task.id}>
              <div className="review-item-text">
                <strong>{task.title}</strong>
                <p className="field-hint">Estimated {task.minutes} minutes</p>
              </div>
              <div className="button-row">
                <form action={confirmRealityDecision}>
                  <input type="hidden" name="taskId" value={task.id} />
                  <input type="hidden" name="decision" value="postpone" />
                  <button className="btn btn-secondary" type="submit">
                    Confirm postpone
                  </button>
                </form>
                <Link href={`/tasks/${task.id}`} className="btn btn-secondary">
                  Simplify in task
                </Link>
                <button
                  className="btn btn-secondary"
                  type="button"
                  disabled
                  title="Delegation is not available yet"
                >
                  Delegate unavailable
                </button>
                <form action={confirmRealityDecision}>
                  <input type="hidden" name="taskId" value={task.id} />
                  <input type="hidden" name="decision" value="drop" />
                  <button className="btn btn-danger" type="submit">
                    Confirm drop
                  </button>
                </form>
              </div>
              <p className="field-hint">
                Postpone: the task leaves today&apos;s plan. Simplify: edit its scope and
                estimate. Delegate: requires another account. Drop: removes it from active
                work.
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
