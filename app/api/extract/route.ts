import { NextResponse } from "next/server";
import { z } from "zod";
import { createClaudeExtractor, hasClaudeCredentials } from "@/lib/ai/client";
import { extractWithFallback } from "@/lib/capture/extract-with-fallback";
import { systemClock } from "@/lib/domain/clock";
import { withRepositories } from "@/lib/repo";
import { getCurrentUserId, getTimeZone } from "@/lib/server/session";

// POST /api/extract — server-side AI proxy (Phase 5 work item 2). The
// Brain Dump is already saved (app/actions/capture.ts saveBrainDump) before
// this is called, so nothing here can lose the user's words.

const bodySchema = z.object({ brainDumpId: z.string().uuid() });

export async function POST(request: Request) {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Expected { brainDumpId: uuid }" }, { status: 400 });
  }
  const { brainDumpId } = body.data;

  const userId = await getCurrentUserId();
  const timeZone = await getTimeZone();

  const dump = await withRepositories(userId, async (repos) => {
    const found = await repos.brainDumps.get(brainDumpId);
    if (found) await repos.brainDumps.setStatus(found.id, "processing");
    return found;
  });
  if (!dump) return NextResponse.json({ error: "Brain dump not found" }, { status: 404 });

  const outcome = await extractWithFallback(dump.rawText, {
    clock: systemClock,
    timeZone,
    // Switched off, or no credentials: the heuristic runs, labelled "AI
    // organising isn't set up". AI_EXTRACTION=off is the kill switch (and
    // what the e2e server sets, so tests never make paid calls).
    ai:
      process.env.AI_EXTRACTION !== "off" && hasClaudeCredentials()
        ? createClaudeExtractor()
        : null,
    signal: request.signal,
  });

  await withRepositories(userId, (repos) =>
    repos.brainDumps.saveProposal(dump.id, outcome.proposal)
  );

  if (outcome.fallbackReason) {
    // ADR-010: identifiers and outcomes only — never the dump's text.
    console.warn("extraction.fallback", {
      brainDumpId: dump.id,
      reason: outcome.fallbackReason,
      items: outcome.proposal.items.length,
    });
  }

  return NextResponse.json(outcome);
}
