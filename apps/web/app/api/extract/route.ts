import { NextResponse } from "next/server";
import { z } from "zod";
import { organiseSavedDump } from "@/lib/capture/organise-server";
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
  const userId = await getCurrentUserId();
  const timeZone = await getTimeZone();
  const outcome = await organiseSavedDump({
    userId,
    timeZone,
    dumpId: body.data.brainDumpId,
    signal: request.signal,
  });
  if (!outcome) return NextResponse.json({ error: "Brain dump not found" }, { status: 404 });
  return NextResponse.json(outcome);
}
