import { z } from "zod";
import { aiOrganisingEnabled, classifyError } from "@/lib/ai/client";
import { claimAiCall } from "@/lib/capture/organise-server";
import { withRepositories } from "@/lib/repo";
import { createClaudeGoalSteps } from "./claude";
import { cleanSteps, rulesGoalSteps, type GoalSteps } from "./steps";

// Suggest and save a goal's next steps — shared by the web Goals page and
// the mobile API. Suggestions are never saved on their own.

export interface StepSuggestion extends GoalSteps {
  engine: "ai" | "rules";
}

/** Null when the goal doesn't exist (or isn't this user's). */
export async function suggestGoalSteps(
  userId: string,
  goalId: string,
  signal?: AbortSignal
): Promise<StepSuggestion | null> {
  const loaded = await withRepositories(userId, async (repos) => {
    const goal = (await repos.goals.list()).find((g) => g.id === goalId);
    if (!goal) return null;
    const tasks = await repos.tasks.list({
      statuses: ["todo", "in_progress", "postponed", "completed"],
    });
    return { goal, planned: tasks.filter((t) => t.goalId === goalId).map((t) => t.title) };
  });
  if (!loaded) return null;
  const { goal, planned } = loaded;
  const rules = (): StepSuggestion => {
    const fallback = rulesGoalSteps(goal.title);
    return {
      engine: "rules",
      reply: fallback.reply,
      steps: cleanSteps(fallback.steps, planned),
    };
  };
  if (!aiOrganisingEnabled() || !(await claimAiCall(userId))) return rules();
  try {
    const output = await createClaudeGoalSteps()({
      prompt: JSON.stringify({
        goal: goal.title,
        targetDate: goal.targetDate,
        alreadyPlanned: planned,
      }),
      signal,
    });
    const steps = cleanSteps(output.steps, planned);
    return steps.length
      ? { engine: "ai", reply: output.reply.trim().slice(0, 300), steps }
      : rules();
  } catch (error) {
    // ADR-010: outcome only — never the goal's text.
    console.warn(
      JSON.stringify({ event: "goal_steps.fallback", reason: classifyError(error) })
    );
    return rules();
  }
}

export const saveStepsSchema = z.object({
  steps: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        estimatedMinutes: z.number().int().min(1).max(1440).nullable(),
      })
    )
    .min(1)
    .max(10),
});

/** Create the reviewed steps as to-dos linked to the goal. Null if no such goal. */
export async function saveGoalSteps(
  userId: string,
  goalId: string,
  steps: z.infer<typeof saveStepsSchema>["steps"]
): Promise<number | null> {
  return withRepositories(userId, async (repos) => {
    if (!(await repos.goals.list()).some((g) => g.id === goalId)) return null;
    for (const s of steps) {
      const task = await repos.tasks.create({
        title: s.title,
        estimatedMinutes: s.estimatedMinutes,
        goalId,
        status: "todo",
        source: "manual",
      });
      await repos.taskEvents.record({
        taskId: task.id,
        eventType: "created",
        toStatus: "todo",
      });
    }
    await repos.events.track("goal_steps_saved", { goal_id: goalId, steps: steps.length });
    return steps.length;
  });
}
