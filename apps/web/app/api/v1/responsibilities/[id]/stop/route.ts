import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withRepositories } from "@/lib/repo";
import { ApiError, apiRoute, json } from "@/lib/server/api";

export const dynamic = "force-dynamic";

// Stop future instances; past ones stay in history.
export const POST = apiRoute(
  async ({ userId }, _request, { params }: { params: Promise<{ id: string }> }) => {
    const id = z
      .string()
      .uuid()
      .safeParse((await params).id);
    if (!id.success) throw new ApiError(404, "Responsibility not found.");
    await withRepositories(userId, (repos) => repos.recurrenceRules.stop(id.data));
    revalidatePath("/responsibilities");
    return json({ ok: true });
  }
);
