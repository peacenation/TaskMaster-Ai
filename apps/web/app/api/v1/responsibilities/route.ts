import { localDate } from "@/lib/execution/date";
import { withRepositories } from "@/lib/repo";
import { apiRoute, json } from "@/lib/server/api";
import { shiftDate } from "@/lib/server/reviews";

export const dynamic = "force-dynamic";

// Recurring responsibilities with their next 30 days of instances —
// generated here as on the web, so they exist before they're shown.
export const GET = apiRoute(async ({ userId, timeZone }) => {
  const today = localDate(new Date(), timeZone);
  const rules = await withRepositories(userId, async (repos) => {
    await repos.recurrenceRules.generateThrough(today, shiftDate(today, 30));
    const all = await repos.recurrenceRules.list();
    return Promise.all(
      all.map(async (rule) => ({
        ...rule,
        occurrences: await repos.recurrenceRules.occurrences(rule.id),
      }))
    );
  });
  return json({
    responsibilities: rules.map((rule) => ({
      id: rule.id,
      title: rule.title,
      frequency: rule.frequency,
      intervalCount: rule.intervalCount,
      timesPerPeriod: rule.timesPerPeriod,
      endDate: rule.endDate,
      stopped: rule.stoppedAt !== null,
      upcoming: rule.stoppedAt
        ? []
        : rule.occurrences
            .filter((item) => item.occurrenceDate !== null && item.occurrenceDate >= today)
            .map((item) => ({
              id: item.id,
              title: item.title,
              status: item.status,
              date: item.occurrenceDate,
            })),
    })),
  });
});
