import { localDateString } from "./dates";
import type { TaskStatus } from "./task";

// First insights (IMPLEMENTATION_PLAN.md Phase 10, work item 6; PRD v2
// §3.1 P2). A few patterns from the week, each phrased as a suggestion with
// one next action — never a bare statistic. Pure: the weekly review page
// gathers the records and renders whatever comes back.

export const MAX_INSIGHTS = 3;
const OPEN: TaskStatus[] = ["inbox", "todo", "in_progress", "postponed"];

export interface InsightInput {
  goals: Array<{ id: string; title: string }>;
  tasks: Array<{
    id: string;
    title: string;
    status: TaskStatus;
    goalId: string | null;
    dueAt: Date | null;
  }>;
  /** This week's task events. */
  events: Array<{ taskId: string; eventType: string }>;
  now: Date;
  timeZone: string;
}

export interface Insight {
  kind: "repeated_postponement" | "neglected_goal" | "deadline_cluster";
  message: string;
  actionLabel: string;
  href: string;
}

const times = (n: number) => (n === 2 ? "twice" : `${n} times`);

function repeatedPostponements({ tasks, events }: InsightInput): Insight[] {
  const counts = new Map<string, number>();
  for (const event of events)
    if (event.eventType === "postponed")
      counts.set(event.taskId, (counts.get(event.taskId) ?? 0) + 1);
  return tasks
    .filter((task) => OPEN.includes(task.status) && (counts.get(task.id) ?? 0) >= 2)
    .sort((a, b) => counts.get(b.id)! - counts.get(a.id)!)
    .map((task) => ({
      kind: "repeated_postponement",
      message: `You moved "${task.title}" ${times(counts.get(task.id)!)} this week. A smaller first step may make it easier to start — or it may be time to drop it.`,
      actionLabel: "Break it down",
      href: `/tasks/${task.id}`,
    }));
}

function neglectedGoals({ goals, tasks, events }: InsightInput): Insight[] {
  const completed = new Set(
    events.filter((event) => event.eventType === "completed").map((event) => event.taskId)
  );
  return goals
    .filter((goal) => {
      const goalTasks = tasks.filter((task) => task.goalId === goal.id);
      return (
        goalTasks.some((task) => OPEN.includes(task.status)) &&
        !goalTasks.some((task) => completed.has(task.id))
      );
    })
    .map((goal) => ({
      kind: "neglected_goal",
      message: `Nothing moved on "${goal.title}" this week. One small action next week keeps it alive.`,
      actionLabel: "Choose an action",
      href: "/goals",
    }));
}

function deadlineClusters({ tasks, now, timeZone }: InsightInput): Insight[] {
  const horizon = now.getTime() + 7 * 24 * 60 * 60 * 1000;
  const byDay = new Map<string, InsightInput["tasks"]>();
  for (const task of tasks) {
    if (!task.dueAt || !OPEN.includes(task.status)) continue;
    const due = task.dueAt.getTime();
    if (due < now.getTime() || due >= horizon) continue;
    const day = localDateString(task.dueAt, timeZone);
    byDay.set(day, [...(byDay.get(day) ?? []), task]);
  }
  return [...byDay.values()]
    .filter((dayTasks) => dayTasks.length >= 3)
    .map((dayTasks) => {
      const label = dayTasks[0].dueAt!.toLocaleDateString("en-GB", {
        timeZone,
        weekday: "long",
        day: "numeric",
        month: "short",
      });
      const first = [...dayTasks].sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime())[0];
      return {
        kind: "deadline_cluster",
        message: `${dayTasks.length} deadlines land on ${label}. Starting "${first.title}" earlier spreads the load.`,
        actionLabel: `Open "${first.title}"`,
        href: `/tasks/${first.id}`,
      };
    });
}

/**
 * At most one insight of each kind, most actionable first, so the review
 * stays short (PRD v2 §1.5: insight, not administration).
 */
export function weeklyInsights(input: InsightInput): Insight[] {
  return [repeatedPostponements(input), deadlineClusters(input), neglectedGoals(input)]
    .flatMap((found) => found.slice(0, 1))
    .slice(0, MAX_INSIGHTS);
}
