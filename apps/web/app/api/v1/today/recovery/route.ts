import { revalidatePath } from "next/cache";
import { recover, recoveryInputSchema } from "@/lib/execution/operations";
import { withRepositories } from "@/lib/repo";
import { ApiError, apiRoute, json, readJson } from "@/lib/server/api";

export const dynamic = "force-dynamic";

// Missed plan blocks: keep, postpone or drop each one — the web's
// recovery check-in on Today.
export const POST = apiRoute(async ({ userId }, request) => {
  const body = (await readJson(request)) as { decisions?: unknown } | null;
  const parsed = recoveryInputSchema.safeParse(body?.decisions);
  if (!parsed.success) throw new ApiError(400, "Choose what should happen to each item.");
  try {
    await withRepositories(userId, (repos) => recover(repos, parsed.data, new Date()));
  } catch {
    throw new ApiError(409, "These items have changed. Refresh and try again.");
  }
  revalidatePath("/", "layout");
  return json({ ok: true });
});
