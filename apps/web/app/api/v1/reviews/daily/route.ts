import { apiRoute, json } from "@/lib/server/api";
import { loadDailyReview } from "@/lib/server/reviews";

export const dynamic = "force-dynamic";

const item = (task: { id: string; title: string }) => ({ id: task.id, title: task.title });

// Close the day: what got done, what was missed, what carries forward.
export const GET = apiRoute(async ({ userId, timeZone }) => {
  const review = await loadDailyReview(userId, timeZone);
  return json({
    date: review.date,
    completed: review.completed.map((e) => ({ id: e.taskId, title: e.title })),
    missed: review.missed.map((m) => ({ id: m.taskId, title: m.title })),
    carried: review.carried.map((t) => ({ ...item(t), status: t.status })),
    changed: review.changed.map((e) => ({ id: e.taskId, title: e.title, type: e.eventType })),
  });
});
