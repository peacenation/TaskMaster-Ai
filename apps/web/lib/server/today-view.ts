import type { z } from "zod";
import { zonedTimeToUtc } from "@/lib/domain/dates";
import { localDate } from "@/lib/execution/date";
import { buildToday, todaySettingsSchema } from "@/lib/planning/today";
import { realityCheckSummary } from "@/lib/domain/reality-check";
import { isFollowUpDue } from "@/lib/domain/waiting";
import { withRepositories, type Repositories } from "@/lib/repo";
import type { TaskRecord } from "@/lib/repo/task-repository";
import { toPlannable } from "@/lib/server/views";

// Everything Today shows, loaded once. The web page (app/page.tsx) and the
// mobile API (app/api/v1/today) both render from this, so the plan a user
// sees is the same on every device.

const PROJECTS_SHOWN = 4;

export function greeting(now: Date, timeZone: string) {
  const hour = Number(
    now.toLocaleString("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" })
  );
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export function isOpenTask(task: TaskRecord) {
  return task.source !== "recurrence" && ["todo", "in_progress"].includes(task.status);
}

/** The user's local day as a UTC range, for calendar events. */
export function dayRange(date: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const start = zonedTimeToUtc({ year, month, day }, 0, 0, timeZone);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const end = zonedTimeToUtc(
    { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() },
    0,
    0,
    timeZone
  );
  return { start, end };
}

/** Timed events block time; all-day ones (holidays, offsites) are shown but don't. */
export function busyFrom(
  events: ReadonlyArray<{ startsAt: Date; endsAt: Date; allDay: boolean }>
) {
  return events.filter((e) => !e.allDay).map((e) => ({ start: e.startsAt, end: e.endsAt }));
}

type Profile = NonNullable<Awaited<ReturnType<Repositories["users"]["profile"]>>>;

/**
 * One transaction for the whole page: every query here is a database round
 * trip, and on serverless hosts far from the database each one costs
 * ~100ms, so they share one BEGIN/COMMIT. Pass the profile when the caller
 * already has it (getCurrentProfile) to skip re-reading it.
 */
export async function loadToday(
  userId: string,
  timeZone: string,
  query: Record<string, string | string[] | undefined> = {},
  knownProfile?: Profile
) {
  const now = new Date();
  const date = localDate(now, timeZone);
  const loaded = await withRepositories(userId, async (repos) => {
    const profile = knownProfile ?? (await repos.users.profile());
    if (!profile?.preferences.onboardingCompleted) return null;
    const records = await repos.tasks.list();
    const dependencies = await repos.tasks.dependencies();
    const projects = await repos.projects.list();
    const procrastinationCandidates = await repos.taskEvents.procrastinationCandidates();
    const { start: dayStart, end: dayEnd } = dayRange(date, timeZone);
    const events = await repos.calendar.eventsBetween(dayStart, dayEnd);
    const next = profile.preferences.nextTaskId;
    const chosenId = typeof next === "string" ? next : null;
    const settings = todaySettingsSchema.parse({
      dayMinutes: profile.preferences.dayMinutes ?? 240,
      availableMinutes: profile.preferences.availableMinutes ?? undefined,
      energy: profile.preferences.energy ?? undefined,
      ...query,
    });
    const today = buildToday(
      toPlannable(records, dependencies),
      {
        now,
        timeZone,
        availableMinutes: settings.availableMinutes,
        energy: settings.energy,
      },
      settings.dayMinutes,
      chosenId,
      busyFrom(events)
    );
    let saved = await repos.execution.plan(date);
    if (!saved) {
      await repos.execution.savePlan(date, today.plan, false);
      saved = await repos.execution.plan(date);
    }
    const recovery = await repos.execution.recovery(now);
    return {
      profile,
      records,
      projects,
      chosenId,
      procrastinationCandidates,
      settings,
      today,
      saved,
      recovery,
      events,
    };
  });
  if (!loaded) return { onboarded: false as const };
  const {
    profile,
    records,
    projects,
    chosenId,
    procrastinationCandidates,
    settings,
    today,
    saved,
    recovery,
    events,
  } = loaded;
  const { plan, recommendation } = today;
  const realityCheck = realityCheckSummary(
    plan.capacity.mustDoMinutes,
    plan.capacity.usableMinutes ?? settings.dayMinutes
  );
  if (saved) {
    const scored = new Map(today.ranked.map((item) => [item.task.id, item]));
    plan.items = saved.items.flatMap((item) => {
      const current = scored.get(item.taskId);
      if (!current) return [];
      return [
        {
          task: current.task,
          score: current.score,
          reasons: current.reasons,
          position: item.position,
          minutes: current.task.estimatedMinutes ?? 30,
          estimateIsDefault: current.task.estimatedMinutes === null,
          protected: item.recommendationReason?.includes("protected") ?? false,
          scheduledStart: item.scheduledStart,
          scheduledEnd: item.scheduledEnd,
        },
      ];
    });
    plan.deferred = today.ranked.filter(
      (item) => !plan.items.some((planned) => planned.task.id === item.task.id)
    );
    plan.capacity.availableMinutes = saved.availableMinutes;
    plan.capacity.usableMinutes = Math.floor(
      (saved.availableMinutes ?? Math.max(0, settings.dayMinutes - today.meetingMinutes)) * 0.8
    );
    plan.capacity.plannedMinutes = plan.items.reduce((total, item) => total + item.minutes, 0);
    plan.capacity.overloaded = plan.capacity.mustDoMinutes > plan.capacity.usableMinutes;
  }

  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const projectProgress = projects
    .map((project) => {
      const tasks = records.filter(
        (task) =>
          task.projectId === project.id &&
          task.source !== "recurrence" &&
          !["dropped", "inbox"].includes(task.status)
      );
      return {
        id: project.id,
        name: project.name,
        done: tasks.filter((task) => task.status === "completed").length,
        total: tasks.length,
        open: tasks.filter(isOpenTask).length,
      };
    })
    .filter((project) => project.open > 0)
    .sort((a, b) => b.open - a.open)
    .slice(0, PROJECTS_SHOWN);

  return {
    onboarded: true as const,
    now,
    date,
    profile,
    settings,
    records,
    today,
    plan,
    recommendation,
    chosenId,
    recovery,
    realityCheck,
    procrastinationCandidates,
    events,
    meetingMinutes: today.meetingMinutes,
    // Waiting on someone, and it's time to chase.
    followUps: records.filter((task) => isOpenTask(task) && isFollowUpDue(task, now)),
    projectNames,
    projectProgress,
    firstName: profile.name.trim().split(/\s+/)[0] ?? "",
    stats: {
      active: records.filter(isOpenTask).length,
      dueToday: records.filter(
        (task) => isOpenTask(task) && task.dueAt && localDate(task.dueAt, timeZone) === date
      ).length,
      completedToday: records.filter(
        (task) => task.completedAt && localDate(task.completedAt, timeZone) === date
      ).length,
      inbox: records.filter((task) => task.status === "inbox").length,
    },
  };
}

export class RecoveryPendingError extends Error {}

/**
 * Rebuild today's plan with new settings (available time, energy, day
 * length) and remember them. Missed blocks must be resolved first, so a
 * rebuild never silently drops them.
 */
export async function rebuildToday(
  userId: string,
  timeZone: string,
  settings: z.infer<typeof todaySettingsSchema>
) {
  const now = new Date();
  await withRepositories(userId, async (repos) => {
    if ((await repos.execution.recovery(now)).length) throw new RecoveryPendingError();
    const { start, end } = dayRange(localDate(now, timeZone), timeZone);
    const today = buildToday(
      toPlannable(await repos.tasks.list(), await repos.tasks.dependencies()),
      { now, timeZone, availableMinutes: settings.availableMinutes, energy: settings.energy },
      settings.dayMinutes,
      await repos.users.nextTaskId(),
      busyFrom(await repos.calendar.eventsBetween(start, end))
    );
    await repos.users.savePreferences(timeZone, {
      dayMinutes: settings.dayMinutes,
      availableMinutes: settings.availableMinutes ?? null,
      energy: settings.energy ?? null,
    });
    await repos.execution.savePlan(localDate(now, timeZone), today.plan, true);
  });
}
