import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ApiError, apiRoute, json, readJson } from "@/lib/server/api";
import { RecoveryPendingError, rebuildToday } from "@/lib/server/today-view";

export const dynamic = "force-dynamic";

const settingsSchema = z.object({
  dayMinutes: z.number().int().min(1).max(1440),
  availableMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  energy: z.enum(["low", "medium", "high"]).nullable().optional(),
});

// "I have 90 minutes and low energy": rebuild today's plan around it.
export const PUT = apiRoute(async ({ userId, timeZone }, request) => {
  const parsed = settingsSchema.safeParse(await readJson(request));
  if (!parsed.success) throw new ApiError(400, "Use minutes between 1 and 1440.");
  const { dayMinutes, availableMinutes, energy } = parsed.data;
  try {
    await rebuildToday(userId, timeZone, {
      dayMinutes,
      availableMinutes: availableMinutes ?? undefined,
      energy: energy ?? undefined,
    });
  } catch (error) {
    if (error instanceof RecoveryPendingError)
      throw new ApiError(409, "Decide what to do with missed work before rebuilding.");
    throw error;
  }
  revalidatePath("/", "layout");
  return json({ ok: true });
});
