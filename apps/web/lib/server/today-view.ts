import { localDate } from "@/lib/execution/date";
import { buildToday, todaySettingsSchema } from "@/lib/planning/today";
import { realityCheckSummary } from "@/lib/domain/reality-check";
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
      chosenId
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
      (saved.availableMinutes ?? settings.dayMinutes) * 0.8
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
