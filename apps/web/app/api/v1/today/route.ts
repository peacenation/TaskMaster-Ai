import { after } from "next/server";
import { syncStaleFeeds } from "@/lib/calendar/sync";
import { apiRoute, json, toTaskDto } from "@/lib/server/api";
import { greeting, loadToday } from "@/lib/server/today-view";

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

// Today for the mobile app: the same plan app/page.tsx renders, as JSON,
// including the decisions it asks for: missed blocks to recover, a
// Reality Check when the day is overloaded, and repeatedly postponed work.
export const GET = apiRoute(async ({ userId, timeZone, profile }) => {
  const view = await loadToday(userId, timeZone, {}, profile);
  // Calendars refresh after the response, so Today never waits on them.
  after(() => syncStaleFeeds(userId).catch(() => undefined));
  // Not onboarded yet: still greet them, so the app can offer a Brain Dump.
  if (!view.onboarded)
    return json({
      onboarded: false,
      greeting: greeting(new Date(), timeZone),
      firstName: profile.name.trim().split(/\s+/)[0] ?? "",
    });
  const { now, plan, recommendation, records, projectNames, today } = view;
  const byId = new Map(records.map((task) => [task.id, task]));
  const task = (id: string) => {
    const record = byId.get(id);
    return record ? toTaskDto(record, projectNames) : null;
  };
  return json({
    onboarded: true,
    date: view.date,
    greeting: greeting(now, timeZone),
    firstName: view.firstName,
    stats: view.stats,
    recommendation: recommendation && {
      task: task(recommendation.task.id),
      message: recommendation.message,
      reasons: recommendation.reasons.map((r) => r.text),
      overridden: today.overridden,
    },
    plan: plan.items.flatMap((item) => {
      const dto = task(item.task.id);
      if (!dto) return [];
      return [
        {
          task: dto,
          position: item.position,
          minutes: item.minutes,
          estimateIsDefault: item.estimateIsDefault,
          protected: item.protected,
          scheduledStart: item.scheduledStart?.toISOString() ?? null,
          scheduledEnd: item.scheduledEnd?.toISOString() ?? null,
        },
      ];
    }),
    capacity: {
      plannedMinutes: plan.capacity.plannedMinutes,
      availableMinutes: plan.capacity.availableMinutes,
      usableMinutes: plan.capacity.usableMinutes,
      overloaded: plan.capacity.overloaded,
    },
    projects: view.projectProgress.map(({ id, name, done, total }) => ({
      id,
      name,
      done,
      total,
    })),
    settings: {
      dayMinutes: view.settings.dayMinutes,
      availableMinutes: view.settings.availableMinutes ?? null,
      energy: view.settings.energy ?? null,
    },
    recovery: view.recovery.map((item) => ({
      id: item.id,
      taskId: item.taskId,
      title: item.title,
      scheduledEnd: item.scheduledEnd?.toISOString() ?? null,
    })),
    realityCheck: view.realityCheck && {
      ...view.realityCheck,
      // Deadline-critical work (due within a day) the user can move or drop.
      tasks: today.ranked
        .filter(
          (item) => item.task.dueAt && item.task.dueAt.getTime() <= now.getTime() + DAY_MS
        )
        .map((item) => ({
          id: item.task.id,
          title: item.task.title,
          minutes: item.task.estimatedMinutes ?? 30,
        })),
    },
    procrastination: view.procrastinationCandidates,
    meetingMinutes: view.meetingMinutes,
    events: view.events.map((event) => ({
      title: event.title,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      allDay: event.allDay,
    })),
    attention: {
      recovery: view.recovery.length,
      realityCheck: view.realityCheck !== null,
    },
  });
});
