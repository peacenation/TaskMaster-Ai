import { revalidatePath } from "next/cache";
import { z } from "zod";
import { commitAndOnboard, reviewedItemSchema } from "@/lib/capture/commit";
import { withRepositories } from "@/lib/repo";
import { ApiError, apiRoute, json, readJson } from "@/lib/server/api";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ items: z.array(reviewedItemSchema).min(1).max(200) });

// Save the reviewed Brain Dump: every item is created in one transaction,
// or none are, and the first commit completes onboarding (unlocks Today).
export const POST = apiRoute(
  async ({ userId, timeZone }, request, { params }: { params: Promise<{ id: string }> }) => {
    const id = z
      .string()
      .uuid()
      .safeParse((await params).id);
    const body = bodySchema.safeParse(await readJson(request));
    if (!id.success || !body.success)
      throw new ApiError(400, "Something in the review isn't valid — check titles and dates.");
    const summary = await withRepositories(userId, async (repos) => {
      const dump = await repos.brainDumps.get(id.data);
      if (!dump) throw new ApiError(404, "Brain Dump not found.");
      return commitAndOnboard(
        repos,
        { dumpId: dump.id, rawText: dump.rawText, timeZone, items: body.data.items },
        new Date()
      );
    });
    revalidatePath("/", "layout");
    return json({ summary }, 201);
  }
);
