import Link from "next/link";
import { chooseNext, overridePriority } from "@/app/actions/planning";
import { Badge, Button, Select } from "@/components/ui";
import type { ScoredTask } from "@/lib/domain/prioritize";
import { formatDue } from "@/lib/server/views";

export function TaskRow({
  item,
  timeZone,
  project,
  reason,
  chosen,
}: {
  item: ScoredTask;
  timeZone: string;
  project?: string;
  reason?: string;
  chosen?: boolean;
}) {
  const { task } = item;
  return (
    <li className="today-task">
      <div>
        <Link href={`/tasks/${task.id}`} className="today-task-title">
          {task.title}
        </Link>
        <p className="field-hint">
          {task.dueAt ? `Due ${formatDue(task.dueAt, timeZone)}` : "No deadline"} ·{" "}
          {task.estimatedMinutes !== null
            ? `${task.estimatedMinutes} min`
            : "30 min suggested"}
          {project ? ` · ${project}` : ""}
        </p>
        {task.priority !== null && (
          <Badge tone="success">Your priority: {task.priority}/5</Badge>
        )}
        {chosen && <Badge tone="success">Your next action</Badge>}
        {reason && <p className="field-hint">{reason}</p>}
        <details>
          <summary>Why this ranking · score {Math.round(item.score * 10) / 10}</summary>
          {item.reasons.length ? (
            <ul>
              {item.reasons.map((r) => (
                <li key={r.code}>
                  {r.text} ({r.weight > 0 ? "+" : ""}
                  {r.weight})
                </li>
              ))}
            </ul>
          ) : (
            <p>With no priority signals, earlier deadlines and older tasks come first.</p>
          )}
        </details>
      </div>
      <div className="today-task-controls">
        <form action={overridePriority.bind(null, task.id)} className="priority-control">
          <label htmlFor={`priority-${task.id}`}>Your priority</label>
          <Select
            id={`priority-${task.id}`}
            name="priority"
            defaultValue={task.priority ?? ""}
          >
            <option value="">Unset</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
                {n === 1 ? " — low" : n === 5 ? " — high" : ""}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="secondary">
            Save priority
          </Button>
        </form>
        <form action={chooseNext.bind(null, task.id)}>
          <Button type="submit" variant="secondary">
            Choose next
          </Button>
        </form>
      </div>
    </li>
  );
}
