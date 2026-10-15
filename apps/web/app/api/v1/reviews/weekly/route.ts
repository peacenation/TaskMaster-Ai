import { apiRoute, json } from "@/lib/server/api";
import { loadWeeklyReview } from "@/lib/server/reviews";

export const dynamic = "force-dynamic";

// Choose what deserves next week: goal progress, deadlines, postponements
// and a few insights.
export const GET = apiRoute(async ({ userId, timeZone }) => {
  const review = await loadWeeklyReview(userId, timeZone);
  return json({
    startDate: review.startDate,
    endDate: review.lastDate,
    goals: review.goals.map((g) => ({ id: g.id, title: g.title, completed: g.completed })),
    deadlines: review.upcoming.map((t) => ({
      id: t.id,
      title: t.title,
      dueAt: t.dueAt?.toISOString() ?? null,
    })),
    postponed: review.postponed.map((e) => ({ id: e.taskId, title: e.title, times: e.times })),
    insights: review.insights.map((i) => ({ kind: i.kind, message: i.message })),
  });
});
