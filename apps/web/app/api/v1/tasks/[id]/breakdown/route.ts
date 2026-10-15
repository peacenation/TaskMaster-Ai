import { revalidatePath } from "next/cache";
import { z } from "zod";
import { breakdownInputSchema, commitBreakdown } from "@/lib/execution/operations";
import { withRepositories } from "@/lib/repo";
import { ApiError, apiRoute, json, readJson } from "@/lib/server/api";

export const dynamic = "force-dynamic";

// Save the reviewed steps for a large or vague task (Task Breakdown).
export const POST = apiRoute(
  async ({ userId }, request, { params }: { params: Promise<{ id: string }> }) => {
    const body = (await readJson(request)) as { steps?: unknown } | null;
    const parsed = breakdownInputSchema.safeParse({
      taskId: z.string().parse((await params).id),
      steps: body?.steps,
    });
    if (!parsed.success) throw new ApiError(400, "Check the step titles and estimates.");
    try {
      await withRepositories(userId, (repos) => commitBreakdown(repos, parsed.data));
    } catch {
      throw new ApiError(409, "Could not save the steps. They may already exist; refresh.");
    }
    revalidatePath("/", "layout");
    return json({ ok: true }, 201);
  }
);
