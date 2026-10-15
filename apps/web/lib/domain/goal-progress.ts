import type { TaskStatus } from "@/lib/domain/task";

// How a goal is doing, from the tasks linked to it (PRD §3.1 Goals and
// Goal Alignment). Shared by the web Goals page and the mobile API.

export type GoalNudge = "unlinked" | "stalled" | null;

export interface GoalProgress {
  linked: number;
  active: number;
  completed: number;
  /** unlinked: nothing moves it yet; stalled: only postponed work left. */
  nudge: GoalNudge;
}

export function goalProgress(
  goalId: string,
  tasks: ReadonlyArray<{ goalId: string | null; status: TaskStatus }>
): GoalProgress {
  const linked = tasks.filter((task) => task.goalId === goalId && task.status !== "dropped");
  const active = linked.filter((task) => ["todo", "in_progress"].includes(task.status)).length;
  const completed = linked.filter((task) => task.status === "completed").length;
  const nudge: GoalNudge =
    linked.length === 0
      ? "unlinked"
      : active === 0 && completed < linked.length
        ? "stalled"
        : null;
  return { linked: linked.length, active, completed, nudge };
}

export const NUDGE_TEXT: Record<Exclude<GoalNudge, null>, string> = {
  unlinked: "No action is linked yet; connect one task to move this goal forward.",
  stalled: "Nothing active is moving this goal; review postponed work.",
};
