import { zonedTimeToUtc } from "@/lib/domain/dates";
import { weeklyInsights } from "@/lib/domain/insights";
import { localDate } from "@/lib/execution/date";
import { withRepositories } from "@/lib/repo";

// Daily and weekly reviews, loaded once. The web pages (app/reviews/*) and
// the mobile API (app/api/v1/reviews/*) both render from these.

export function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekStart(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function dayBoundary(value: string, timeZone: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return zonedTimeToUtc({ year, month, day }, 0, 0, timeZone);
}

export async function loadDailyReview(userId: string, timeZone: string) {
  const today = localDate(new Date(), timeZone);
  const start = dayBoundary(today, timeZone);
  const end = dayBoundary(shiftDate(today, 1), timeZone);
  const { events, tasks, missed } = await withRepositories(userId, async (repos) => ({
    events: await repos.execution.eventsBetween(start, end),
    tasks: await repos.tasks.list(),
    missed: await repos.execution.recovery(new Date()),
  }));
  const completed = events.filter((event) => event.eventType === "completed");
  const changed = events.filter(
    (event) => !["completed", "created"].includes(event.eventType)
  );
  const carried = tasks.filter(
    (task) =>
      task.source !== "recurrence" &&
      task.createdAt < start &&
      ["todo", "in_progress", "postponed"].includes(task.status)
  );
  return { date: today, events, completed, changed, carried, missed };
}

export async function loadWeeklyReview(userId: string, timeZone: string) {
  const startDate = weekStart(localDate(new Date(), timeZone));
  const endDate = shiftDate(startDate, 7);
  const start = dayBoundary(startDate, timeZone);
  const end = dayBoundary(endDate, timeZone);
  const data = await withRepositories(userId, async (repos) => ({
    goals: await repos.goals.list(),
    tasks: await repos.tasks.list(),
    events: await repos.execution.eventsBetween(start, end),
  }));
  const completedIds = new Set(
    data.events.filter((event) => event.eventType === "completed").map((event) => event.taskId)
  );
  const upcoming = data.tasks.filter(
    (task) =>
      task.source !== "recurrence" && task.dueAt && task.dueAt >= start && task.dueAt < end
  );
  // One row per task, however many times it moved.
  const postponed = [
    ...data.events
      .filter((event) => event.eventType === "postponed")
      .reduce((byTask, event) => {
        const seen = byTask.get(event.taskId);
        return byTask.set(event.taskId, { ...event, times: (seen?.times ?? 0) + 1 });
      }, new Map<string, (typeof data.events)[number] & { times: number }>())
      .values(),
  ];
  const goals = data.goals.map((goal) => {
    const goalTasks = data.tasks.filter(
      (task) => task.goalId === goal.id && task.status !== "dropped"
    );
    const completed = goalTasks.filter((task) => completedIds.has(task.id)).length;
    return { ...goal, goalTasks, completed };
  });
  const insights = weeklyInsights({
    goals: data.goals,
    tasks: data.tasks.filter((task) => task.source !== "recurrence"),
    events: data.events,
    now: new Date(),
    timeZone,
  });
  return {
    startDate,
    lastDate: shiftDate(endDate, -1),
    empty: !data.goals.length && !data.tasks.length,
    goals,
    upcoming,
    postponed,
    insights,
  };
}
