import { ZodError } from "zod";
import { classifyError, type AiExtractor, type AiFailureReason } from "@/lib/ai/client";
import { toProposal } from "@/lib/ai/schema";
import type { Clock } from "@/lib/domain/clock";
import { extract } from "@/lib/domain/extract";
import type { ExtractionProposal } from "@/lib/domain/proposal";

// ADR-007's fallback orchestration: try Claude; on any failure — missing
// credentials, timeout, rate limit, network, refusal, or a response that
// fails our schema — use the heuristic instead. The user always gets a
// reviewable proposal, and is told which engine produced it (PRD §2.6).

export interface ExtractionOutcome {
  proposal: ExtractionProposal;
  /** Why the heuristic ran instead of Claude; null when Claude's proposal was used. */
  fallbackReason: AiFailureReason | null;
}

export interface ExtractWithFallbackOptions {
  clock: Clock;
  timeZone: string;
  /** null when AI extraction is switched off entirely. */
  ai: AiExtractor | null;
  signal?: AbortSignal;
}

export async function extractWithFallback(
  rawText: string,
  { clock, timeZone, ai, signal }: ExtractWithFallbackOptions
): Promise<ExtractionOutcome> {
  const heuristic = (reason: AiFailureReason): ExtractionOutcome => ({
    proposal: extract(rawText, { clock, timeZone }),
    fallbackReason: reason,
  });

  if (!ai) return heuristic("not_configured");

  try {
    const output = await ai({ rawText, now: clock.now(), timeZone, signal });
    return { proposal: toProposal(output), fallbackReason: null };
  } catch (error) {
    // A malformed response is rejected here and never reaches storage.
    if (error instanceof ZodError) return heuristic("invalid_response");
    return heuristic(classifyError(error));
  }
}
