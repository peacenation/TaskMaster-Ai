import { z } from "zod";
import { organiseSavedDump } from "@/lib/capture/organise-server";
import { FALLBACK_MESSAGES } from "@/lib/capture/organise";
import { withRepositories } from "@/lib/repo";
import { ApiError, apiRoute, json, readJson } from "@/lib/server/api";

export const dynamic = "force-dynamic";
// Claude can take a while; the built-in rules answer if it doesn't.
export const maxDuration = 60;

const bodySchema = z.object({ text: z.string().trim().min(1).max(20_000) });

// Brain Dump from the phone: the text is saved first (nothing typed is
// lost), then organised exactly as on the web. Nothing becomes a task until
// the person reviews and commits (POST /api/v1/dumps/{id}/commit).
export const POST = apiRoute(async ({ userId, timeZone }, request) => {
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) throw new ApiError(400, "Write something to organise.");
  const dump = await withRepositories(userId, (repos) =>
    repos.brainDumps.create(parsed.data.text)
  );
  const outcome = await organiseSavedDump({
    userId,
    timeZone,
    dumpId: dump.id,
    signal: request.signal,
  });
  if (!outcome) throw new ApiError(500, "Couldn't organise that. Your text is saved.");
  return json(
    {
      dumpId: dump.id,
      engine: outcome.proposal.engine,
      notice: outcome.fallbackReason ? FALLBACK_MESSAGES[outcome.fallbackReason] : null,
      items: outcome.proposal.items,
    },
    201
  );
});
