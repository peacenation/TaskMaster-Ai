import { zonedParts } from "@/lib/domain/dates";
import type { PlannableTask } from "@/lib/domain/task";
import type { TaskDependency, TaskRecord } from "@/lib/repo/task-repository";

// Small server-side adapters between stored records and what pages render.

export function toPlannable(
  records: TaskRecord[],
  dependencies: TaskDependency[]
): PlannableTask[] {
  const dependsOn = new Map<string, string[]>();
  for (const { taskId, dependsOnTaskId } of dependencies) {
    dependsOn.set(taskId, [...(dependsOn.get(taskId) ?? []), dependsOnTaskId]);
  }
  return records
    .filter((record) => record.source !== "recurrence")
    .map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      priority: r.priority,
      urgency: r.urgency,
      importance: r.importance,
      dueAt: r.dueAt,
      estimatedMinutes: r.estimatedMinutes,
      energy: r.energy,
      projectId: r.projectId,
      goalId: r.goalId,
      dependsOn: dependsOn.get(r.id) ?? [],
      // Not tracked yet; the neglect rule falls back to createdAt (docs/SCORING.md).
      lastProgressAt: null,
      createdAt: r.createdAt,
    }));
}

/** e.g. "Thu 8 Oct, 17:00", in the user's timezone. */
export function formatDue(date: Date, timeZone: string): string {
  return date.toLocaleString("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** A stored instant as an <input type="datetime-local"> value in the user's timezone. */
export function toLocalInput(date: Date | null, timeZone: string): string {
  if (!date) return "";
  const p = zonedParts(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}
