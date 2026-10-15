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

export interface BusyTime {
  start: Date;
  end: Date;
}

/** Minutes of meetings still ahead today (overlaps counted once). */
export function busyMinutesAhead(busy: ReadonlyArray<BusyTime>, now: Date): number {
  const ahead = busy
    .map((b) => ({ start: Math.max(b.start.getTime(), now.getTime()), end: b.end.getTime() }))
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start - b.start);
  let total = 0;
  let reach = -Infinity;
  for (const block of ahead) {
    const from = Math.max(block.start, reach);
    if (block.end > from) total += block.end - from;
    reach = Math.max(reach, block.end);
  }
  return Math.round(total / 60_000);
}

export function buildToday(
  tasks: PlannableTask[],
  context: PlanningContext,
  dayMinutes: number,
  chosenId: string | null,
  /** Today's timed calendar events: their time comes out of the day, and blocks go around them. */
  busy: ReadonlyArray<BusyTime> = []
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
  const meetingMinutes = busyMinutesAhead(busy, context.now);
  const plan = buildPlan(actionable, context, {
    mode: "scheduled",
    availableMinutes: Math.max(0, dayMinutes - meetingMinutes),
    busy,
  });
  return {
    recommendation,
    automatic,
    overridden: !!chosen,
    plan,
    ranked: prioritize(actionable, context),
    blocked: candidates.filter((task) => blockedIds.has(task.id)),
    meetingMinutes,
    bufferMinutes:
      (plan.capacity.availableMinutes ?? dayMinutes) -
      (plan.capacity.usableMinutes ?? dayMinutes),
    gapMinutes: PLAN_DEFAULTS.gapMinutes,
  };
}
