import { z } from "zod";
import { actualMinutes } from "@/lib/domain/learning";
import type { Repositories } from "@/lib/repo";

export const executionStatusSchema = z.enum([
  "todo",
  "in_progress",
  "completed",
  "postponed",
  "dropped",
]);
export async function changeStatus(
  repos: Repositories,
  taskId: string,
  status: z.infer<typeof executionStatusSchema>,
  now: Date
) {
  const before = await repos.tasks.get(taskId);
  if (!before) throw new Error("Task not found");
  if (before.status === status) return;
  if (status === "in_progress") {
    const tasks = await repos.tasks.list();
    const dependencies = await repos.tasks.dependencies();
    if (
      dependencies.some(
        (d) =>
          d.taskId === taskId &&
          tasks.some(
            (t) => t.id === d.dependsOnTaskId && !["completed", "dropped"].includes(t.status)
          )
      )
    )
      throw new Error("Finish the dependencies before starting this task.");
  }
  // Learned estimates: a task started and then completed records how long
  // it really took (from the last time it was started).
  let actual: number | null = null;
  if (status === "completed" && before.status === "in_progress") {
    const started = (await repos.execution.events(taskId))
      .filter((e) => e.toStatus === "in_progress")
      .at(-1)?.occurredAt;
    actual = actualMinutes(started ?? null, now);
  }
  await repos.tasks.update(taskId, {
    status,
    completedAt: status === "completed" ? now : null,
    ...(actual !== null ? { actualMinutes: actual } : {}),
  });
  await trackStatus(repos, taskId, status);
  await repos.taskEvents.record({
    taskId,
    eventType:
      status === "completed"
        ? "completed"
        : status === "postponed"
          ? "postponed"
          : "status_changed",
    fromStatus: before.status,
    toStatus: status,
  });
}
const STATUS_EVENTS = {
  in_progress: "task_started",
  completed: "task_completed",
  postponed: "task_postponed",
  dropped: "task_dropped",
} as const;

/** Product event for a status change (ids only, never the title). */
export async function trackStatus(repos: Repositories, taskId: string, status: string) {
  const name = STATUS_EVENTS[status as keyof typeof STATUS_EVENTS];
  if (name) await repos.events.track(name, { task_id: taskId });
}

export const breakdownInputSchema = z.object({
  taskId: z.string().uuid(),
  steps: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(500),
        estimatedMinutes: z.number().int().min(1).max(1440).nullable(),
      })
    )
    .min(1)
    .max(20),
});
export async function commitBreakdown(
  repos: Repositories,
  input: z.infer<typeof breakdownInputSchema>
) {
  const parent = await repos.tasks.get(input.taskId);
  if (!parent || !["todo", "in_progress", "inbox"].includes(parent.status))
    throw new Error("Task is not active");
  // A transaction-scoped lock prevents two concurrent submissions from duplicating steps.
  if ((await repos.execution.children(parent.id)).length)
    throw new Error("This task already has steps.");
  for (const step of input.steps) {
    const child = await repos.tasks.create({
      title: step.title,
      estimatedMinutes: step.estimatedMinutes,
      parentTaskId: parent.id,
      projectId: parent.projectId,
      goalId: parent.goalId,
      importance: parent.importance,
      dueAt: parent.dueAt,
      status: "todo",
    });
    await repos.execution.linkChild(parent.id, child.id);
    await repos.taskEvents.record({
      taskId: child.id,
      eventType: "created",
      toStatus: "todo",
    });
  }
}
export const recoveryInputSchema = z
  .array(z.object({ id: z.string().uuid(), choice: z.enum(["keep", "postpone", "drop"]) }))
  .min(1)
  .max(200);
export async function recover(
  repos: Repositories,
  input: z.infer<typeof recoveryInputSchema>,
  now: Date
) {
  const affected = await repos.execution.recovery(now);
  for (const decision of input) {
    const item = affected.find((row) => row.id === decision.id);
    if (!item)
      throw new Error("This recovery item has already changed. Refresh and try again.");
    if (decision.choice !== "keep")
      await changeStatus(
        repos,
        item.taskId,
        decision.choice === "postpone" ? "postponed" : "dropped",
        now
      );
    await repos.execution.reviewRecovery(item.id, now);
  }
  const count = (choice: string) => input.filter((d) => d.choice === choice).length;
  await repos.events.track("recovery_resolved", {
    items: input.length,
    kept: count("keep"),
    postponed: count("postpone"),
    dropped: count("drop"),
  });
}
