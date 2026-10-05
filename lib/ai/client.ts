import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { buildExtractionUserMessage, EXTRACTION_SYSTEM_PROMPT } from "./prompts";
import { aiExtractionSchema } from "./schema";

// Claude-backed Brain Dump extraction (PRD_v2.md §2.7.2, ADR-011).
// Server-side only: imported by app/api/extract/route.ts, never by a
// client component, so ANTHROPIC_API_KEY never reaches the browser.

/** A code constant, not an env var: effort and fallbacks below are model-specific. */
export const EXTRACTION_MODEL = "claude-opus-5-5";

/** Capture should feel quick, and the heuristic is always there to fall back on. */
const TIMEOUT_MS = 30_000;

export type AiFailureReason =
  | "not_configured"
  | "timeout"
  | "rate_limited"
  | "quota"
  | "network"
  | "refused"
  | "invalid_response"
  | "error";

export class AiExtractionError extends Error {
  constructor(
    readonly reason: AiFailureReason,
    message: string
  ) {
    super(message);
    this.name = "AiExtractionError";
  }
}

export interface AiExtractionRequest {
  rawText: string;
  now: Date;
  timeZone: string;
  signal?: AbortSignal;
}

/** Returns the model's raw structured output; validation is the caller's job. */
export type AiExtractor = (request: AiExtractionRequest) => Promise<unknown>;

/** Most specific first: APIConnectionTimeoutError extends APIConnectionError extends APIError. */
export function classifyError(error: unknown): AiFailureReason {
  if (error instanceof AiExtractionError) return error.reason;
  if (error instanceof Anthropic.APIConnectionTimeoutError) return "timeout";
  if (error instanceof Anthropic.APIUserAbortError) return "timeout";
  if (error instanceof Anthropic.APIConnectionError) return "network";
  if (error instanceof Anthropic.RateLimitError) return "rate_limited";
  if (error instanceof Anthropic.AuthenticationError) return "not_configured";
  return "error";
}

/**
 * Whether any credential source the SDK resolves is present: an API key,
 * an auth token, a named or default `ant auth login` profile, or workload
 * identity federation. Checked up front because with none, the SDK throws
 * a plain Error with no typed class to classify — so "not set up" would
 * otherwise be reported as a generic failure.
 */
/** AI_EXTRACTION=off is the kill switch; otherwise on whenever credentials exist. */
export function aiOrganisingEnabled(): boolean {
  return process.env.AI_EXTRACTION !== "off" && hasClaudeCredentials();
}

export function hasClaudeCredentials(
  env: Record<string, string | undefined> = process.env,
  home: string = homedir()
): boolean {
  if (env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN || env.ANTHROPIC_PROFILE) return true;
  if (env.ANTHROPIC_FEDERATION_RULE_ID) return true;
  return existsSync(join(home, ".config", "anthropic"));
}

export function createClaudeExtractor(client: Anthropic = new Anthropic()): AiExtractor {
  return async ({ rawText, now, timeZone, signal }) => {
    const response = await client.beta.messages.parse(
      {
        model: EXTRACTION_MODEL,
        max_tokens: 16_000,
        // Refusal fallback: on a safety-classifier decline the API re-runs
        // the request on a fallback model it chooses, inside the same call.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: [
          {
            type: "text",
            text: EXTRACTION_SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          { role: "user", content: buildExtractionUserMessage(rawText, now, timeZone) },
        ],
        output_config: {
          // High-volume structured extraction, not open-ended reasoning.
          effort: "low",
          format: betaZodOutputFormat(aiExtractionSchema),
        },
      },
      { timeout: TIMEOUT_MS, maxRetries: 0, signal }
    );

    if (response.stop_reason === "refusal") {
      throw new AiExtractionError("refused", "The model declined this request.");
    }
    if (response.stop_reason === "max_tokens") {
      throw new AiExtractionError("invalid_response", "The model's output was cut off.");
    }
    if (response.parsed_output === null) {
      throw new AiExtractionError(
        "invalid_response",
        "The model's output didn't match the schema."
      );
    }
    return response.parsed_output;
  };
}
