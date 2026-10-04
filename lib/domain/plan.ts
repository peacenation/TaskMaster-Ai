import { prioritize, type Reason, type ScoredTask } from "./prioritize";
import type { PlannableTask, PlanningContext } from "./task";

// The daily planner (PRD_v2.md §2.2 Daily Plan, Flexible Plan View, Basic
// Scheduled View, Basic Capacity Warning). Two rules the PRD is explicit
// about and this module treats as hard constraints, not tuning:
//
// - Realistic, not full: a plan never fills every available minute (§1.5
//   "Realistic Planning"). A buffer is held back.
// - Urgent work doesn't permanently crowd out long-term work (§7.5 item 8).
//   One slot is protected for it when the ranking alone would leave none.

export type PlanMode = "flexible" | "scheduled";

export interface PlanOptions {
  mode: PlanMode;
  /** Minutes available today. Without it, the plan is capped by item count instead. */
  availableMinutes?: number;
  /** Share of available time held back as buffer. */
  bufferRatio?: number;
  /** Used for tasks with no estimate — and flagged, so the UI can say so. */
  defaultEstimateMinutes?: number;
  /** Item cap when availableMinutes isn't known. */
  maxItems?: number;
  /** Scheduled mode: gap between blocks. */
  gapMinutes?: number;
  /** Scheduled mode: first block's start. Defaults to now, rounded up to 15 minutes. */
  startAt?: Date;
}

export interface PlanItem {
  task: PlannableTask;
  score: number;
  reasons: Reason[];
  position: number;
  minutes: number;
  /** True when `minutes` is the default guess, not the task's own estimate. */
  estimateIsDefault: boolean;
  /** True when this item is in the plan because of the anti-crowding rule. */
  protected: boolean;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
}

export interface Capacity {
  availableMinutes: number | null;
  usableMinutes: number | null;
  plannedMinutes: number;
  /** Minutes of work due today or already overdue. */
  mustDoMinutes: number;
  /** True when today's must-do work alone is more than fits. */
  overloaded: boolean;
}

export interface Plan {
  mode: PlanMode;
  items: PlanItem[];
  deferred: ScoredTask[];
  blocked: ScoredTask[];
  capacity: Capacity;
}

export const PLAN_DEFAULTS = {
  bufferRatio: 0.2,
  defaultEstimateMinutes: 30,
  maxItems: 5,
  gapMinutes: 10,
  /** The protected slot never displaces work due within this many days. */
  protectedDeadlineHorizonDays: 7,
} as const;

const MINUTE = 60_000;
const DAY_MS = 24 * 60 * MINUTE;

export const PROTECTED_REASON: Reason = {
  code: "protected",
  text: "it's protected so urgent work doesn't crowd out your longer-term goal",
  weight: 0,
};

function isLongTerm(task: PlannableTask): boolean {
  return task.goalId !== null || ((task.importance ?? 0) >= 4 && task.dueAt === null);
}

function roundUpTo15(date: Date): Date {
  const step = 15 * MINUTE;
  return new Date(Math.ceil(date.getTime() / step) * step);
}

function mustDoHorizon(now: Date): number {
  // "Must do" for the capacity warning: due within the next 24 hours, or
  // already overdue. Deliberately simple — this only decides whether to
  // *warn*, never what gets dropped.
  return now.getTime() + DAY_MS;
}

export function buildPlan(
  tasks: PlannableTask[],
  context: PlanningContext,
  options: PlanOptions
): Plan {
  const bufferRatio = options.bufferRatio ?? PLAN_DEFAULTS.bufferRatio;
  const defaultEstimate =
    options.defaultEstimateMinutes ?? PLAN_DEFAULTS.defaultEstimateMinutes;
  const maxItems = options.maxItems ?? PLAN_DEFAULTS.maxItems;
  const gap =
    options.mode === "scheduled" ? (options.gapMinutes ?? PLAN_DEFAULTS.gapMinutes) : 0;

  // The day's plan isn't "what fits in the next 20 minutes" — score without
  // the in-the-moment time/energy constraints.
  const ranked = prioritize(tasks, {
    now: context.now,
    timeZone: context.timeZone,
    focusProjectId: context.focusProjectId,
  });
  const actionable = ranked.filter((s) => !s.blocked);
  const blocked = ranked.filter((s) => s.blocked);

  const minutesOf = (s: ScoredTask) => s.task.estimatedMinutes ?? defaultEstimate;
  const usable =
    options.availableMinutes !== undefined
      ? Math.floor(options.availableMinutes * (1 - bufferRatio))
      : null;
  const cost = (items: ScoredTask[]) =>
    items.reduce((sum, s) => sum + minutesOf(s), 0) + gap * items.length;

  const chosen: ScoredTask[] = [];
  for (const scored of actionable) {
    if (usable === null) {
      if (chosen.length < maxItems) chosen.push(scored);
    } else if (cost([...chosen, scored]) <= usable) {
      chosen.push(scored);
    }
  }

  // Anti-crowding: if the ranking left no long-term work in today's plan,
  // protect a slot for the best long-term candidate — by displacing the
  // lowest-ranked items that aren't close to a deadline, never ones that are.
  let protectedId: string | null = null;
  if (!chosen.some((s) => isLongTerm(s.task))) {
    const candidate = actionable.find((s) => isLongTerm(s.task) && !chosen.includes(s));
    if (candidate) {
      const horizon =
        context.now.getTime() + PLAN_DEFAULTS.protectedDeadlineHorizonDays * DAY_MS;
      const displaceable = (s: ScoredTask) =>
        s.task.dueAt === null || s.task.dueAt.getTime() > horizon;
      const trial = [...chosen];
      const fits = () =>
        usable === null ? trial.length < maxItems : cost([...trial, candidate]) <= usable;
      while (!fits()) {
        const index = trial.map(displaceable).lastIndexOf(true);
        if (index === -1) break;
        trial.splice(index, 1);
      }
      if (fits()) {
        chosen.length = 0;
        chosen.push(...trial, candidate);
        protectedId = candidate.task.id;
      }
    }
  }

  chosen.sort((a, b) => actionable.indexOf(a) - actionable.indexOf(b));

  let cursor =
    options.mode === "scheduled" ? (options.startAt ?? roundUpTo15(context.now)) : null;
  const items: PlanItem[] = chosen.map((scored, position) => {
    const minutes = minutesOf(scored);
    let scheduledStart: Date | null = null;
    let scheduledEnd: Date | null = null;
    if (cursor) {
      scheduledStart = cursor;
      scheduledEnd = new Date(cursor.getTime() + minutes * MINUTE);
      cursor = new Date(scheduledEnd.getTime() + gap * MINUTE);
    }
    const isProtected = scored.task.id === protectedId;
    return {
      task: scored.task,
      score: scored.score,
      reasons: isProtected ? [...scored.reasons, PROTECTED_REASON] : scored.reasons,
      position,
      minutes,
      estimateIsDefault: scored.task.estimatedMinutes === null,
      protected: isProtected,
      scheduledStart,
      scheduledEnd,
    };
  });

  const bound = mustDoHorizon(context.now);
  const mustDoMinutes = actionable
    .filter((s) => s.task.dueAt !== null && s.task.dueAt.getTime() <= bound)
    .reduce((sum, s) => sum + minutesOf(s), 0);

  return {
    mode: options.mode,
    items,
    deferred: actionable.filter((s) => !chosen.includes(s)),
    blocked,
    capacity: {
      availableMinutes: options.availableMinutes ?? null,
      usableMinutes: usable,
      plannedMinutes: items.reduce((sum, i) => sum + i.minutes, 0),
      mustDoMinutes,
      overloaded: usable !== null && mustDoMinutes > usable,
    },
  };
}
