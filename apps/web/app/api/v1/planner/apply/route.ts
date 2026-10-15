import { revalidatePath } from "next/cache";
import { z } from "zod";
import { localDate } from "@/lib/execution/date";
import { zonedTimeToUtc } from "@/lib/domain/dates";
import type { Plan, PlanItem } from "@/lib/domain/plan";
import { MAX_BLOCKS, toMinutes } from "@/lib/planner/plan";
import { withRepositories } from "@/lib/repo";
import { ApiError, apiRoute, json, readJson } from "@/lib/server/api";
import { toPlannable } from "@/lib/server/views";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  blocks: z
    .array(
      z.object({
        taskId: z.string().uuid(),
        start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
        minutes: z.number().int().min(5).max(480),
      })
    )
    .min(1)
    .max(MAX_BLOCKS),
});

// Apply a proposed timeline as today's plan, replacing the current one.
// Only task blocks are saved (breaks and events are suggestions); every
// task must be one of the person's own open tasks.
export const POST = apiRoute(async ({ userId, timeZone, profile }, request) => {
  const body = bodySchema.safeParse(await readJson(request));
  if (!body.success) throw new ApiError(400, "That plan isn't valid.");
  const now = new Date();
  const date = localDate(now, timeZone);
  const [year, month, day] = date.split("-").map(Number);

  const saved = await withRepositories(userId, async (repos) => {
    const records = await repos.tasks.list({ statuses: ["todo", "in_progress"] });
    const plannable = new Map(
      toPlannable(records, await repos.tasks.dependencies()).map((task) => [task.id, task])
    );
    const blocks = [...body.data.blocks].sort(
      (a, b) => toMinutes(a.start) - toMinutes(b.start)
    );
    const items: PlanItem[] = [];
    for (const [position, block] of blocks.entries()) {
      const task = plannable.get(block.taskId);
      if (!task)
        throw new ApiError(404, "One of those tasks isn't open any more. Ask for a new plan.");
      const [hour, minute] = block.start.split(":").map(Number);
      const scheduledStart = zonedTimeToUtc({ year, month, day }, hour, minute, timeZone);
      items.push({
        task,
        score: 0,
        reasons: [{ code: "ai_planner", text: "Scheduled with the AI Planner", weight: 0 }],
        position,
        minutes: block.minutes,
        estimateIsDefault: task.estimatedMinutes === null,
        protected: false,
        scheduledStart,
        scheduledEnd: new Date(scheduledStart.getTime() + block.minutes * 60_000),
      });
    }
    const available =
      Number(profile.preferences.availableMinutes) ||
      Number(profile.preferences.dayMinutes) ||
      240;
    const plan: Plan = {
      mode: "scheduled",
      items,
      deferred: [],
      blocked: [],
      capacity: {
        availableMinutes: available,
        usableMinutes: Math.floor(available * 0.8),
        plannedMinutes: items.reduce((total, item) => total + item.minutes, 0),
        mustDoMinutes: 0,
        overloaded: false,
      },
    };
    await repos.execution.savePlan(date, plan, true);
    await repos.events.track("planner_applied", { blocks: items.length });
    return items.length;
  });
  revalidatePath("/", "layout");
  return json({ ok: true, scheduled: saved });
});
