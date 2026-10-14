import { revalidatePath } from "next/cache";
import { z } from "zod";
import { changeStatus, executionStatusSchema } from "@/lib/execution/operations";
import { withRepositories } from "@/lib/repo";
import { ApiError, apiRoute, json, readJson } from "@/lib/server/api";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ status: executionStatusSchema });

// Start, complete, postpone or drop — the same transition the web's task
// actions use, so history and focus tracking stay consistent.
export const POST = apiRoute(
  async ({ userId }, request, { params }: { params: Promise<{ id: string }> }) => {
    const id = z
      .string()
      .uuid()
      .safeParse((await params).id);
    const body = bodySchema.safeParse(await readJson(request));
    if (!id.success || !body.success) throw new ApiError(400, "Invalid task action.");
    await withRepositories(userId, async (repos) => {
      if (!(await repos.tasks.get(id.data))) throw new ApiError(404, "Task not found.");
      await changeStatus(repos, id.data, body.data.status, new Date());
    });
    revalidatePath("/", "layout");
    return json({ ok: true });
  }
);
