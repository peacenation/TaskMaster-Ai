import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AiExtractionError } from "@/lib/ai/client";
import { PLANNER_MODEL } from "@/lib/planner/claude";
import { GOAL_STEPS_SYSTEM_PROMPT, goalStepsSchema, type GoalSteps } from "./steps";

// Claude-backed Goal Breakdown. Same request shape as the AI Planner
// (lib/planner/claude.ts): structured output, refusal fallbacks, cached
// system prompt. A short suggestion list is light work, so effort is low.

const TIMEOUT_MS = 30_000;

export type AiGoalSteps = (input: {
  prompt: string;
  signal?: AbortSignal;
}) => Promise<GoalSteps>;

export function createClaudeGoalSteps(client: Anthropic = new Anthropic()): AiGoalSteps {
  return async ({ prompt, signal }) => {
    const response = await client.beta.messages.parse(
      {
        model: PLANNER_MODEL,
        max_tokens: 16_000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: [
          {
            type: "text",
            text: GOAL_STEPS_SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: prompt }],
        output_config: { effort: "low", format: betaZodOutputFormat(goalStepsSchema) },
      },
      { timeout: TIMEOUT_MS, maxRetries: 0, signal }
    );
    if (response.stop_reason === "refusal")
      throw new AiExtractionError("refused", "The model declined this request.");
    if (response.stop_reason === "max_tokens" || response.parsed_output === null)
      throw new AiExtractionError("invalid_response", "The model's steps were unusable.");
    return response.parsed_output;
  };
}
