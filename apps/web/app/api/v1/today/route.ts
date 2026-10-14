import { apiRoute, json, toTaskDto } from "@/lib/server/api";
import { greeting, loadToday } from "@/lib/server/today-view";

export const dynamic = "force-dynamic";

// Today for the mobile app: the same plan app/page.tsx renders, as JSON.
// Recovery and Reality Check decisions stay web-only for now; the app is
// told they are pending (`attention`) so it can point the user there.
export const GET = apiRoute(async ({ userId, timeZone, profile }) => {
  const view = await loadToday(userId, timeZone, {}, profile);
  if (!view.onboarded) return json({ onboarded: false });
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
    attention: {
      recovery: view.recovery.length,
      realityCheck: view.realityCheck !== null,
    },
  });
});
