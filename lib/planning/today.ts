import { z } from "zod";
import { nextBestAction, type Recommendation } from "@/lib/domain/nextBestAction";
import { buildPlan, PLAN_DEFAULTS } from "@/lib/domain/plan";
import { prioritize } from "@/lib/domain/prioritize";
import type { PlannableTask, PlanningContext } from "@/lib/domain/task";

const minutes = z.coerce.number().int().min(1).max(1440);
export const todaySettingsSchema = z.object({
  dayMinutes: minutes.catch(240),
  availableMinutes: z.preprocess(
    (v) => (v === "" ? undefined : v),
    minutes.optional().catch(undefined)
  ),
  energy: z.enum(["low", "medium", "high"]).optional().catch(undefined),
});

export function buildToday(
  tasks: PlannableTask[],
  context: PlanningContext,
  dayMinutes: number,
  chosenId: string | null
) {
  // Inbox and postponed work can block dependencies, but aren't candidates for today.
  const blockers = new Set(
    tasks
      .filter((task) => task.status !== "completed" && task.status !== "dropped")
      .map((task) => task.id)
  );
  const candidates = tasks.filter(
    (task) => task.status === "todo" || task.status === "in_progress"
  );
  const blockedIds = new Set(
    candidates
      .filter((task) => task.dependsOn.some((id) => blockers.has(id)))
      .map((task) => task.id)
  );
  const actionable = candidates.filter((task) => !blockedIds.has(task.id));
  const automatic = nextBestAction(actionable, context);
  const chosen = actionable.find((task) => task.id === chosenId);
  const scored = chosen
    ? prioritize(actionable, context).find((item) => item.task.id === chosen.id)!
    : null;
  const recommendation: Recommendation | null =
    chosen && scored
      ? {
          task: chosen,
          score: scored.score,
          reasons: scored.reasons,
          message: `${chosen.title} next — you chose this task. Your choice stays in effect until you clear it or the task leaves your active list.`,
          displaced: automatic?.task.id !== chosen.id ? (automatic?.task ?? null) : null,
        }
      : automatic;
  // Schedule once on the server. Flexible mode presents precisely these same items.
  const plan = buildPlan(actionable, context, {
    mode: "scheduled",
    availableMinutes: dayMinutes,
  });
  return {
    recommendation,
    automatic,
    overridden: !!chosen,
    plan,
    ranked: prioritize(actionable, context),
    blocked: candidates.filter((task) => blockedIds.has(task.id)),
    bufferMinutes: dayMinutes - (plan.capacity.usableMinutes ?? dayMinutes),
    gapMinutes: PLAN_DEFAULTS.gapMinutes,
  };
}
