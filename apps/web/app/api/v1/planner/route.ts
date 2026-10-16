import { z } from "zod";
import { aiOrganisingEnabled, classifyError } from "@/lib/ai/client";
import { claimAiCall } from "@/lib/capture/organise-server";
import { localDate } from "@/lib/execution/date";
import {
  buildPlannerPrompt,
  FALLBACK_REPLIES,
  validateBlocks,
  type PlannerBlock,
  type PlannerTask,
} from "@/lib/planner/plan";
import { createClaudePlanner } from "@/lib/planner/claude";
import { plannedMinutes } from "@/lib/domain/learning";
import { ApiError, apiRoute, json, readJson } from "@/lib/server/api";
import { loadToday } from "@/lib/server/today-view";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  message: z.string().trim().min(1).max(1000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(2000) }))
    .max(20)
    .default([]),
});

const MAX_TASKS = 40;

// AI Planner: "plan my day around my 2pm meeting" → a proposed timeline.
// Nothing is saved here; POST /api/v1/planner/apply does that, when the
// person chooses to. Claude when available, otherwise today's rules plan.
export const POST = apiRoute(async ({ userId, timeZone, profile }, request) => {
  const body = bodySchema.safeParse(await readJson(request));
  if (!body.success) throw new ApiError(400, "Tell the planner what you'd like.");
  const view = await loadToday(userId, timeZone, {}, profile);
  if (!view.onboarded)
    throw new ApiError(409, "Start with a Brain Dump so there's something to plan.");

  const now = view.now;
  const hhmm = (d: Date) =>
    d.toLocaleTimeString("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" });
  const stamp = (d: Date) => `${localDate(d, timeZone)} ${hhmm(d)}`;
  const inPlan = new Set(view.plan.items.map((item) => item.task.id));
  const candidates = [...view.plan.items, ...view.plan.deferred]
    .filter((item, i, all) => all.findIndex((x) => x.task.id === item.task.id) === i)
    .slice(0, MAX_TASKS);
  const tasks: PlannerTask[] = candidates.map(({ task }) => ({
    id: task.id,
    title: task.title,
    project: view.projectNames.get(task.projectId ?? "") ?? null,
    minutes: plannedMinutes(task.estimatedMinutes, view.learned),
    due: task.dueAt ? stamp(task.dueAt) : null,
    priority: task.priority,
    inTodaysPlan: inPlan.has(task.id),
  }));

  // Today's meetings still ahead, from the connected calendars.
  const meetings = view.events.filter((e) => !e.allDay && e.endsAt > now);

  // Rules plan: what Today already shows, as a timeline, with meetings.
  const rulesBlocks = (): PlannerBlock[] =>
    [
      ...view.plan.items
        .filter((item) => item.scheduledStart)
        .map((item) => ({
          kind: "task" as const,
          taskId: item.task.id,
          title: item.task.title,
          project: view.projectNames.get(item.task.projectId ?? "") ?? null,
          start: hhmm(item.scheduledStart!),
          minutes: item.minutes,
        })),
      ...meetings.map((e) => ({
        kind: "event" as const,
        taskId: null,
        title: e.title,
        project: null,
        start: hhmm(e.startsAt > now ? e.startsAt : now),
        minutes: Math.max(
          1,
          Math.round(
            (e.endsAt.getTime() - Math.max(e.startsAt.getTime(), now.getTime())) / 60_000
          )
        ),
      })),
    ].sort((a, b) => a.start.localeCompare(b.start));

  const aiConfigured = aiOrganisingEnabled();
  if (!aiConfigured || !(await claimAiCall(userId))) {
    return json({
      engine: "rules",
      reply: aiConfigured ? FALLBACK_REPLIES.quota : FALLBACK_REPLIES.not_configured,
      blocks: rulesBlocks(),
    });
  }
  try {
    const output = await createClaudePlanner()({
      prompt: buildPlannerPrompt({
        request: body.data.message,
        history: body.data.history,
        nowLocal: hhmm(now),
        date: view.date,
        timeZone,
        usableMinutes: view.plan.capacity.usableMinutes,
        tasks,
        calendar: meetings.map((e) => ({
          title: e.title,
          start: hhmm(e.startsAt),
          end: hhmm(e.endsAt),
        })),
      }),
      signal: request.signal,
    });
    return json({
      engine: "ai",
      reply: output.reply.trim().slice(0, 600),
      blocks: validateBlocks(output, tasks),
    });
  } catch (error) {
    // ADR-010: outcome only — never the request text or task titles.
    console.warn(JSON.stringify({ event: "planner.fallback", reason: classifyError(error) }));
    return json({
      engine: "rules",
      reply: FALLBACK_REPLIES.unavailable,
      blocks: rulesBlocks(),
    });
  }
});
