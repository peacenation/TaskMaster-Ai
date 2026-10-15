import { entitlementsFor } from "@/lib/billing/plans";
import { aiOrganisingEnabled, createClaudeExtractor } from "@/lib/ai/client";
import {
  extractWithFallback,
  type ExtractionOutcome,
} from "@/lib/capture/extract-with-fallback";
import { systemClock } from "@/lib/domain/clock";
import { withRepositories } from "@/lib/repo";

// Organise a saved Brain Dump into a proposal: Claude when configured and
// within the per-account quota, otherwise the built-in rules (ADR-007).
// Shared by the web (/api/extract) and the mobile API (/api/v1/dumps), so
// both get the same engine, quota and fallback behaviour.

// Per-user cap on Claude calls (PRD v2 §1.11 cost control; Phase 11
// security review). Over it, the built-in rules organise instead — the
// user still gets a proposal, just not an AI one.
const HOUR_MS = 60 * 60 * 1000;

/** Claims one AI call from the user's hourly quota; false when AI is off or used up. */
export async function claimAiCall(userId: string): Promise<boolean> {
  if (!aiOrganisingEnabled()) return false;
  return withRepositories(userId, async (repos) => {
    const plan = (await repos.users.profile())?.plan ?? "free";
    return repos.aiUsage.claim(
      entitlementsFor(plan).aiPerHour,
      new Date(Date.now() - HOUR_MS)
    );
  });
}

/** Null when the dump doesn't exist (or isn't this user's). */
export async function organiseSavedDump(input: {
  userId: string;
  timeZone: string;
  dumpId: string;
  signal?: AbortSignal;
}): Promise<ExtractionOutcome | null> {
  const { userId, timeZone, dumpId, signal } = input;
  const dump = await withRepositories(userId, async (repos) => {
    const found = await repos.brainDumps.get(dumpId);
    if (found) await repos.brainDumps.setStatus(found.id, "processing");
    return found;
  });
  if (!dump) return null;

  // Switched off, or no credentials: the heuristic runs, labelled "AI
  // organising isn't set up". AI_EXTRACTION=off is the kill switch (and
  // what the e2e server sets, so tests never make paid calls).
  const aiConfigured = aiOrganisingEnabled();
  const withinQuota = aiConfigured && (await claimAiCall(userId));

  const outcome = await extractWithFallback(dump.rawText, {
    clock: systemClock,
    timeZone,
    ai: withinQuota ? createClaudeExtractor() : null,
    skipReason: aiConfigured ? "quota" : "not_configured",
    signal,
  });

  await withRepositories(userId, async (repos) => {
    await repos.brainDumps.saveProposal(dump.id, outcome.proposal);
    await repos.events.track("brain_dump_organised", {
      engine: outcome.fallbackReason ? "rules" : "ai",
      fallback: outcome.fallbackReason,
      items: outcome.proposal.items.length,
    });
  });

  if (outcome.fallbackReason) {
    // ADR-010: identifiers and outcomes only — never the dump's text.
    console.warn("extraction.fallback", {
      brainDumpId: dump.id,
      reason: outcome.fallbackReason,
      items: outcome.proposal.items.length,
    });
  }
  return outcome;
}
