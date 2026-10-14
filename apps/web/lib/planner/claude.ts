import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AiExtractionError } from "@/lib/ai/client";
import { PLANNER_SYSTEM_PROMPT } from "./plan";
import { plannerOutputSchema, type PlannerOutput } from "./schema";

// Claude-backed day planning for the AI Planner (mobile AI tab). Server-side
// only. Same request shape as Brain Dump extraction (lib/ai/client.ts):
// structured output, refusal fallbacks, cached system prompt.

/** A code constant, not an env var: effort and fallbacks are model-specific. */
export const PLANNER_MODEL = "claude-opus-5-5";
const TIMEOUT_MS = 45_000;

export type AiPlanner = (input: {
  prompt: string;
  signal?: AbortSignal;
}) => Promise<PlannerOutput>;

export function createClaudePlanner(client: Anthropic = new Anthropic()): AiPlanner {
  return async ({ prompt, signal }) => {
    const response = await client.beta.messages.parse(
      {
        model: PLANNER_MODEL,
        max_tokens: 16_000,
        // Refusal fallback: on a safety-classifier decline the API re-runs
        // the request on a fallback model it chooses, inside the same call.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: [
          { type: "text", text: PLANNER_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        ],
        messages: [{ role: "user", content: prompt }],
        output_config: {
          // Ordering a day is light reasoning; medium keeps replies quick.
          effort: "medium",
          format: betaZodOutputFormat(plannerOutputSchema),
        },
      },
      { timeout: TIMEOUT_MS, maxRetries: 0, signal }
    );
    if (response.stop_reason === "refusal") {
      throw new AiExtractionError("refused", "The model declined this request.");
    }
    if (response.stop_reason === "max_tokens" || response.parsed_output === null) {
      throw new AiExtractionError("invalid_response", "The model's plan was unusable.");
    }
    return response.parsed_output;
  };
}
