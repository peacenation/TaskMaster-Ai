import { z } from "zod";

// Goal Breakdown (PRD §3.1, P1): turn a goal into its first few concrete
// steps. Claude suggests them when available; these rules always can.
// Suggestions only — nothing is created until the person saves them.

export const goalStepsSchema = z.object({
  /** One short, encouraging sentence about the approach. */
  reply: z.string(),
  steps: z.array(
    z.object({
      title: z.string(),
      estimatedMinutes: z.number().int().nullable(),
    })
  ),
});
export type GoalSteps = z.infer<typeof goalStepsSchema>;

export const MAX_STEPS = 6;

export const GOAL_STEPS_SYSTEM_PROMPT = `You help people start on a longer-term goal inside TaskMasterAi, a calm personal planning app.
Given a goal (and optionally its target date and the steps already planned), suggest the next 3 to 5 concrete steps.

Rules:
- Each step is one action someone could finish in a single sitting (15–120 minutes), phrased as an imperative ("Book a trial lesson", not "Lessons").
- Start with the smallest useful first step; order steps so each makes the next easier.
- Don't repeat steps already planned.
- Give a realistic estimate in minutes, or null if it genuinely can't be estimated.
- Keep "reply" to one short, encouraging sentence about the approach. No lists in it.`;

/** Normalise model or rules output: trim, drop empties and duplicates, cap. */
export function cleanSteps(
  steps: GoalSteps["steps"],
  existing: string[] = []
): GoalSteps["steps"] {
  const seen = new Set(existing.map((s) => s.trim().toLowerCase()));
  const out: GoalSteps["steps"] = [];
  for (const step of steps) {
    const title = step.title.trim().replace(/\s+/g, " ").slice(0, 200);
    const key = title.toLowerCase();
    if (!title || seen.has(key)) continue;
    seen.add(key);
    const minutes = step.estimatedMinutes;
    out.push({
      title,
      estimatedMinutes:
        minutes === null || !Number.isFinite(minutes)
          ? null
          : Math.min(240, Math.max(5, Math.round(minutes))),
    });
    if (out.length >= MAX_STEPS) break;
  }
  return out;
}

const step = (title: string, estimatedMinutes: number | null) => ({ title, estimatedMinutes });

/** Templates by kind of goal; a sensible generic plan otherwise. */
export function rulesGoalSteps(goal: string): GoalSteps {
  const g = goal.toLowerCase();
  const learn = /\b(?:learn|study|master|get better at|practi[cs]e)\s+(.+)/i.exec(goal);
  if (/\b(run|marathon|10k|5k|half marathon|race|cycle|swim|triathlon)\b/.test(g))
    return {
      reply: "Build up gradually — consistency beats intensity.",
      steps: [
        step("Pick a training plan that fits your current level", 30),
        step("Schedule three runs for this week", 15),
        step("Do your first easy run", 30),
        step("Sign up for the event so it's real", 15),
      ],
    };
  if (/\b(lose weight|get fit|fitness|gym|strength|healthier|health)\b/.test(g))
    return {
      reply: "Start small and make it a routine before making it harder.",
      steps: [
        step("Decide what you'll measure each week", 15),
        step("Plan three short workouts for this week", 20),
        step("Do the first workout", 45),
        step("Plan next week's meals", 30),
      ],
    };
  if (/\b(save|saving|savings|budget|debt|pay off|money)\b/.test(g))
    return {
      reply: "Know your numbers first, then automate the habit.",
      steps: [
        step("List this month's income and fixed costs", 30),
        step("Set a monthly savings amount", 15),
        step("Set up an automatic transfer on payday", 15),
        step("Cancel one subscription you don't use", 15),
      ],
    };
  if (/\b(job|career|promot|interview|cv|resume|hired)\b/.test(g))
    return {
      reply: "Make your progress visible and ask for what you want.",
      steps: [
        step("Write down what you want next and by when", 20),
        step("Update your CV with this year's wins", 60),
        step("Book a conversation with your manager or a mentor", 15),
        step("Pick one skill to build this month", 20),
      ],
    };
  if (/\b(write|book|novel|blog|thesis|dissertation)\b/.test(g))
    return {
      reply: "Small daily sessions add up faster than waiting for long ones.",
      steps: [
        step("Outline the main sections", 45),
        step("Schedule four short writing sessions this week", 15),
        step("Write the first 500 words", 45),
      ],
    };
  if (learn)
    return {
      reply: `A little ${learn[1].trim()} often will take you further than occasional long sessions.`,
      steps: [
        step(`Choose one course or book for ${learn[1].trim()}`, 30),
        step("Block three 30-minute practice sessions this week", 15),
        step("Do the first practice session", 30),
        step("Find someone to practise with or report progress to", 20),
      ],
    };
  return {
    reply: "Define done, then take one small step this week.",
    steps: [
      step(`Write down what "done" looks like for "${goal.trim()}"`, 15),
      step("List what you need to get started", 20),
      step("Pick the smallest first step and schedule it", 15),
      step("Set a weekly check-in on progress", 10),
    ],
  };
}
