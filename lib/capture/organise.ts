import type { AiFailureReason } from "@/lib/ai/client";
import type { ExtractionProposal } from "@/lib/domain/proposal";

// The browser side of a Brain Dump (PRD §1.11 Recoverability, a named
// §2.10 acceptance criterion: failed AI processing must never lose the
// user's words). Dependencies are injected so the network-failure paths
// are tested directly rather than by inspection (Phase 5 exit criterion).
//
// Order matters: the raw text is saved *before* extraction is requested,
// so a request that dies mid-flight leaves the dump safely stored. If even
// the save fails, the text stays in the composer and the heuristic — which
// runs locally, needing no network — still produces something to review.

export type OrganiseFailure = AiFailureReason | "offline";

export interface OrganiseDeps {
  saveDump(rawText: string): Promise<{ id: string }>;
  requestExtraction(
    dumpId: string
  ): Promise<{ proposal: ExtractionProposal; fallbackReason: AiFailureReason | null }>;
  extractLocally(rawText: string): ExtractionProposal;
}

export interface OrganiseResult {
  /** Null when the dump couldn't be saved; the composer still holds the text. */
  dumpId: string | null;
  proposal: ExtractionProposal;
  fallbackReason: OrganiseFailure | null;
}

export async function organiseBrainDump(
  rawText: string,
  deps: OrganiseDeps
): Promise<OrganiseResult> {
  let dumpId: string;
  try {
    dumpId = (await deps.saveDump(rawText)).id;
  } catch {
    return { dumpId: null, proposal: deps.extractLocally(rawText), fallbackReason: "offline" };
  }

  try {
    const { proposal, fallbackReason } = await deps.requestExtraction(dumpId);
    return { dumpId, proposal, fallbackReason };
  } catch {
    // Saved, but the organiser was unreachable: organise here instead.
    return { dumpId, proposal: deps.extractLocally(rawText), fallbackReason: "offline" };
  }
}

export const FALLBACK_MESSAGES: Record<OrganiseFailure, string> = {
  not_configured: "Organised by TaskMaster's built-in rules — AI organising isn't set up.",
  timeout: "AI organising took too long, so TaskMaster's built-in rules were used instead.",
  rate_limited:
    "AI organising is busy right now, so TaskMaster's built-in rules were used instead.",
  network:
    "AI organising couldn't be reached, so TaskMaster's built-in rules were used instead.",
  refused:
    "AI organising declined this one, so TaskMaster's built-in rules were used instead.",
  invalid_response:
    "AI organising returned something unusable, so TaskMaster's built-in rules were used instead.",
  error: "AI organising failed, so TaskMaster's built-in rules were used instead.",
  offline: "Couldn't reach TaskMaster, so this was organised on your device instead.",
};
