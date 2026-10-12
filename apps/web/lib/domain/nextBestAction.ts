import { prioritize, type Reason, type ScoredTask } from "./prioritize";
import type { PlannableTask, PlanningContext } from "./task";

// PRD_v2.md §2.3: recommend one task, with a short plain-English reason —
// "Work on the client proposal next. It is due tomorrow, is marked
// important, and two other tasks depend on it."

export interface Recommendation {
  task: PlannableTask;
  score: number;
  reasons: Reason[];
  message: string;
  /**
   * What would have been recommended without the time/energy constraint,
   * when the constraint changed the answer. The UI uses this to say "come
   * back to X later" instead of silently dropping it (PRD §1.5 "Challenge,
   * don't control").
   */
  displaced: PlannableTask | null;
}

const MAX_REASONS_IN_MESSAGE = 3;

export function joinAnd(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function positiveReasons(scored: ScoredTask): string[] {
  return scored.reasons
    .filter((r) => r.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_REASONS_IN_MESSAGE)
    .map((r) => r.text);
}

function constraintLabel(scored: ScoredTask): string {
  const time = scored.reasons.some((r) => r.code === "does_not_fit");
  const energy = scored.reasons.some((r) => r.code === "energy_mismatch");
  if (time && energy) return "time or energy";
  if (energy) return "energy";
  return "time";
}

function actionable(tasks: PlannableTask[], context: PlanningContext): ScoredTask[] {
  return prioritize(tasks, context).filter((s) => !s.blocked);
}

export function nextBestAction(
  tasks: PlannableTask[],
  context: PlanningContext
): Recommendation | null {
  const ranked = actionable(tasks, context);
  const top = ranked[0];
  if (!top) return null;

  const constrained = context.availableMinutes !== undefined || context.energy !== undefined;
  let displaced: ScoredTask | null = null;
  if (constrained) {
    const unconstrained = actionable(tasks, {
      now: context.now,
      timeZone: context.timeZone,
      focusProjectId: context.focusProjectId,
    })[0];
    if (unconstrained.task.id !== top.task.id) {
      // Re-find it in the constrained ranking to learn *why* it lost. Always
      // present: time and energy never change which tasks are blocked.
      displaced = ranked.find((s) => s.task.id === unconstrained.task.id) as ScoredTask;
    }
  }

  const why = positiveReasons(top);
  const reasonClause = why.length ? ` — ${joinAnd(why)}` : "";

  let message: string;
  if (displaced) {
    const other = displaced.task.title;
    message =
      `You don't have enough ${constraintLabel(displaced)} for meaningful progress on ` +
      `"${other}" right now. ${top.task.title} now${reasonClause}. ` +
      `Come back to "${other}" when you have a longer stretch.`;
  } else {
    message = `${top.task.title} next${reasonClause}.`;
  }

  return {
    task: top.task,
    score: top.score,
    reasons: top.reasons,
    message,
    displaced: displaced?.task ?? null,
  };
}
