import type { PlannerOutput } from "./schema";

// The AI Planner's rules, kept pure so they're unit-tested: what Claude is
// given, how its answer is checked, and the rules-only fallback.
// Guardrails (docs/MOBILE_AND_PLATFORM_PLAN.md, M3): the planner schedules
// the user's existing tasks; it can't create, drop or rename them, and
// nothing changes until the user applies the plan.

export interface PlannerTask {
  id: string;
  title: string;
  project: string | null;
  minutes: number;
  /** Local "YYYY-MM-DD HH:MM", or null. */
  due: string | null;
  priority: number | null;
  inTodaysPlan: boolean;
}

export interface PlannerBlock {
  kind: "task" | "break" | "event";
  taskId: string | null;
  title: string;
  project: string | null;
  /** Local HH:MM. */
  start: string;
  minutes: number;
}

export interface PlannerTurn {
  role: "user" | "assistant";
  text: string;
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const MAX_BLOCKS = 20;

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Keeps only what can be trusted: task blocks for the user's own tasks
 * (titles from the database, not the model), valid times and durations,
 * each task once, sorted by start time.
 */
export function validateBlocks(output: PlannerOutput, tasks: PlannerTask[]): PlannerBlock[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const seen = new Set<string>();
  const blocks: PlannerBlock[] = [];
  for (const block of output.blocks) {
    if (!HHMM.test(block.start)) continue;
    const minutes = Math.round(block.minutes);
    if (!(minutes >= 5 && minutes <= 480)) continue;
    if (block.kind === "task") {
      const task = block.taskId ? byId.get(block.taskId) : undefined;
      if (!task || seen.has(task.id)) continue;
      seen.add(task.id);
      blocks.push({
        kind: "task",
        taskId: task.id,
        title: task.title,
        project: task.project,
        start: block.start,
        minutes,
      });
    } else {
      const label = block.label.trim().slice(0, 80);
      if (!label) continue;
      blocks.push({
        kind: block.kind,
        taskId: null,
        title: label,
        project: null,
        start: block.start,
        minutes,
      });
    }
  }
  return blocks.sort((a, b) => toMinutes(a.start) - toMinutes(b.start)).slice(0, MAX_BLOCKS);
}

export const FALLBACK_REPLIES = {
  not_configured:
    "AI planning isn't set up, so here's the plan TaskMaster's rules built for today.",
  quota:
    "You've used this hour's AI planning, so here's the plan TaskMaster's rules built. It's available again within the hour.",
  unavailable:
    "AI planning didn't work this time, so here's the plan TaskMaster's rules built for today.",
} as const;

export function buildPlannerPrompt(input: {
  request: string;
  history: PlannerTurn[];
  nowLocal: string;
  date: string;
  timeZone: string;
  usableMinutes: number | null;
  tasks: PlannerTask[];
}): string {
  return JSON.stringify(
    {
      now: input.nowLocal,
      date: input.date,
      timeZone: input.timeZone,
      usableMinutesToday: input.usableMinutes,
      tasks: input.tasks,
      conversation: input.history.slice(-6),
      request: input.request,
    },
    null,
    2
  );
}

export const PLANNER_SYSTEM_PROMPT = `You are the day planner inside TaskMasterAi, a calm personal planning app.
You receive the person's open tasks and a request such as "plan my day around my 2pm meeting".
Return a realistic timeline for the rest of today plus a short, warm reply (one or two sentences) explaining the shape of the plan.

Rules:
- Schedule only tasks from the provided list, referencing them by their exact "id" with kind "task". Never invent, rename, merge or split tasks.
- Use kind "event" for fixed commitments the person mentions (meetings, appointments), with a short label and no taskId.
- Use kind "break" for short breaks or meals where they help; label them ("Lunch", "Break").
- Start times are local 24-hour HH:MM, today only, not before "now", without overlaps.
- Use each task's "minutes" as its duration unless the request clearly says otherwise.
- Respect "usableMinutesToday" when given: leave work out rather than overfilling the day, and mention in the reply what was left for later.
- Put work with the earliest deadlines and highest priorities first, and protect focus time when the person asks for it.
- If the request is unrelated to planning the day, return the best plan for today and say briefly that you can only help with planning.`;
