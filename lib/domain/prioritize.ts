import { zonedParts } from "./dates";
import { isBlocked, isOpen, type PlannableTask, type PlanningContext } from "./task";

// The scoring engine for PRD_v2.md §2.3. The model in prose, with every
// weight and the reasoning behind it: docs/SCORING.md. Keep the two in
// step — a weight changed here without changing it there is a bug.
//
// Every point of score comes with a reason. That's not a nice-to-have:
// §1.11 Explainability and §2.3's "recommend with a reason" both depend on
// it, and bolting explanations onto a score after the fact is the
// expensive way round (IMPLEMENTATION_PLAN.md Phase 4, work item 4).

export interface Reason {
  /** Stable machine-readable code, for tests and analytics. */
  code: string;
  /** Plain-English fragment, written to follow "Do X next —". */
  text: string;
  weight: number;
}

export interface ScoredTask {
  task: PlannableTask;
  score: number;
  reasons: Reason[];
  blocked: boolean;
}

export const WEIGHTS = {
  priorityPerPoint: 10,
  importancePerPoint: 8,
  urgencyPerPoint: 6,
  overdue: 40,
  dueToday: 30,
  dueTomorrow: 25,
  dueWithin3Days: 18,
  dueWithinWeek: 10,
  dueWithinMonth: 4,
  perDependent: 8,
  maxDependents: 3,
  goal: 5,
  focusProject: 6,
  inProgress: 5,
  // Anti-crowding (PRD_v2.md §7.5 item 8). Deliberately a modest nudge: it
  // lifts stale long-term work above idle tasks, but not above equally
  // important work due within days. The hard guarantee is the planner's
  // protected slot (lib/domain/plan.ts). See docs/SCORING.md.
  neglectGraceDays: 7,
  neglectPerDay: 1,
  neglectMax: 10,
  // Available time / energy.
  doesNotFit: -30,
  fits: 10,
  quickWinMax: 6,
  energyMismatchHigh: -25,
  energyMismatchMedium: -8,
  energyMatchLow: 5,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

function weekdayName(date: Date, timeZone: string): string {
  return date.toLocaleDateString("en-GB", { weekday: "long", timeZone });
}

/** Callers only ever pass n ≥ 2 (dependents handles 1 itself; neglect starts after the grace period). */
function plural(n: number, word: string): string {
  return `${n} ${word}s`;
}

/** Whole calendar days between two instants, as seen in `timeZone`. */
function calendarDaysBetween(from: Date, to: Date, timeZone: string): number {
  const a = zonedParts(from, timeZone);
  const b = zonedParts(to, timeZone);
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / DAY_MS
  );
}

function deadlineReason(task: PlannableTask, now: Date, timeZone: string): Reason | null {
  if (!task.dueAt) return null;
  const msLeft = task.dueAt.getTime() - now.getTime();
  const calendarDays = calendarDaysBetween(now, task.dueAt, timeZone);

  // Buckets are calendar days in the user's timezone, not elapsed hours:
  // Thursday 5pm seen from Monday 9am is "due on Thursday", even though
  // it's 3 days and 8 hours away.
  if (msLeft < 0) return { code: "overdue", text: "it's overdue", weight: WEIGHTS.overdue };
  if (calendarDays === 0)
    return { code: "due_today", text: "it's due today", weight: WEIGHTS.dueToday };
  if (calendarDays === 1)
    return { code: "due_tomorrow", text: "it's due tomorrow", weight: WEIGHTS.dueTomorrow };
  if (calendarDays <= 3)
    return {
      code: "due_soon",
      text: `it's due on ${weekdayName(task.dueAt, timeZone)}`,
      weight: WEIGHTS.dueWithin3Days,
    };
  if (calendarDays <= 7)
    return {
      code: "due_this_week",
      text: "it's due within a week",
      weight: WEIGHTS.dueWithinWeek,
    };
  if (calendarDays <= 31)
    return {
      code: "due_this_month",
      text: "it's due this month",
      weight: WEIGHTS.dueWithinMonth,
    };
  return null;
}

/**
 * Anti-crowding: important, not-urgent work that hasn't been touched in a
 * while earns a growing, capped boost. Without this, anything with a
 * deadline would outscore a long-term goal forever — exactly what PRD §7.5
 * item 8 forbids. It's a named component with its own reason, not a side
 * effect of tuning other weights, so it can be seen, tested, and turned
 * up or down deliberately.
 */
export function neglectReason(task: PlannableTask, now: Date): Reason | null {
  const longTerm =
    task.goalId !== null || ((task.importance ?? 0) >= 4 && task.dueAt === null);
  if (!longTerm) return null;
  const since = task.lastProgressAt ?? task.createdAt;
  const days = Math.floor((now.getTime() - since.getTime()) / DAY_MS);
  const overdueDays = days - WEIGHTS.neglectGraceDays;
  if (overdueDays <= 0) return null;
  return {
    code: "neglected",
    text: `you haven't made progress on it in ${plural(days, "day")}`,
    weight: Math.min(WEIGHTS.neglectMax, overdueDays * WEIGHTS.neglectPerDay),
  };
}

export function scoreTask(
  task: PlannableTask,
  context: PlanningContext,
  all: PlannableTask[] = [task]
): ScoredTask {
  const reasons: Reason[] = [];
  const add = (reason: Reason | null) => {
    if (reason && reason.weight !== 0) reasons.push(reason);
  };
  const byId = new Map(all.map((t) => [t.id, t]));

  if (task.priority !== null) {
    const delta = (task.priority - 3) * WEIGHTS.priorityPerPoint;
    add({
      code: "user_priority",
      text: delta > 0 ? "you marked it high priority" : "you marked it low priority",
      weight: delta,
    });
  }

  if (task.importance !== null && task.importance !== 3) {
    const delta = (task.importance - 3) * WEIGHTS.importancePerPoint;
    add({
      code: "importance",
      text: delta > 0 ? "it's marked important" : "it's marked as less important",
      weight: delta,
    });
  }

  if (task.urgency !== null && task.urgency !== 3) {
    const delta = (task.urgency - 3) * WEIGHTS.urgencyPerPoint;
    add({
      code: "urgency",
      text: delta > 0 ? "it's marked urgent" : "it isn't urgent",
      weight: delta,
    });
  }

  add(deadlineReason(task, context.now, context.timeZone ?? "UTC"));

  const dependents = all.filter((t) => isOpen(t) && t.dependsOn.includes(task.id)).length;
  if (dependents > 0) {
    add({
      code: "unblocks",
      text:
        dependents === 1
          ? "another task depends on it"
          : `${plural(dependents, "other task")} depend on it`,
      weight: Math.min(dependents, WEIGHTS.maxDependents) * WEIGHTS.perDependent,
    });
  }

  if (task.goalId !== null) {
    add({ code: "goal", text: "it moves a goal forward", weight: WEIGHTS.goal });
  }

  if (context.focusProjectId && task.projectId === context.focusProjectId) {
    add({
      code: "focus_project",
      text: "it's in the project you're focusing on",
      weight: WEIGHTS.focusProject,
    });
  }

  if (task.status === "in_progress") {
    add({
      code: "in_progress",
      text: "you've already started it",
      weight: WEIGHTS.inProgress,
    });
  }

  add(neglectReason(task, context.now));

  if (context.availableMinutes !== undefined && task.estimatedMinutes !== null) {
    if (task.estimatedMinutes > context.availableMinutes) {
      add({
        code: "does_not_fit",
        text: `it needs about ${task.estimatedMinutes} minutes and you have ${context.availableMinutes}`,
        weight: WEIGHTS.doesNotFit,
      });
    } else {
      add({
        code: "fits",
        text: `it fits in the ${context.availableMinutes} minutes you have`,
        weight: WEIGHTS.fits,
      });
      // Under a time limit, prefer what can actually be *finished*.
      const quickWin =
        (1 - task.estimatedMinutes / context.availableMinutes) * WEIGHTS.quickWinMax;
      add({ code: "quick_win", text: "it's quick", weight: Math.round(quickWin * 10) / 10 });
    }
  }

  if (context.energy && task.energy) {
    if (context.energy === "low" && task.energy === "high") {
      add({
        code: "energy_mismatch",
        text: "it needs more energy than you have right now",
        weight: WEIGHTS.energyMismatchHigh,
      });
    } else if (context.energy === "low" && task.energy === "medium") {
      add({
        code: "energy_mismatch",
        text: "it needs more energy than you have right now",
        weight: WEIGHTS.energyMismatchMedium,
      });
    } else if (context.energy === "low" && task.energy === "low") {
      add({
        code: "energy_match",
        text: "it suits your energy right now",
        weight: WEIGHTS.energyMatchLow,
      });
    }
  }

  const score = reasons.reduce((sum, r) => sum + r.weight, 0);
  return { task, score, reasons, blocked: isBlocked(task, byId) };
}

/** Deterministic ordering: score, then earliest deadline, then oldest, then id. */
function compareScored(a: ScoredTask, b: ScoredTask): number {
  if (b.score !== a.score) return b.score - a.score;
  const dueA = a.task.dueAt?.getTime() ?? Infinity;
  const dueB = b.task.dueAt?.getTime() ?? Infinity;
  if (dueA !== dueB) return dueA - dueB;
  const created = a.task.createdAt.getTime() - b.task.createdAt.getTime();
  if (created !== 0) return created;
  return a.task.id < b.task.id ? -1 : a.task.id > b.task.id ? 1 : 0;
}

/** Scores every open task; blocked tasks are kept but sorted after actionable ones. */
export function prioritize(tasks: PlannableTask[], context: PlanningContext): ScoredTask[] {
  return tasks
    .filter(isOpen)
    .map((task) => scoreTask(task, context, tasks))
    .sort((a, b) => Number(a.blocked) - Number(b.blocked) || compareScored(a, b));
}
