import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withRepositories } from "@/lib/repo";
import { ApiError, apiRoute, json, readJson } from "@/lib/server/api";

export const dynamic = "force-dynamic";

// "Choose next": the user's pick replaces the Next Best Action until they
// clear it (taskId null) — AI recommends, the user decides.
export const PUT = apiRoute(async ({ userId }, request) => {
  const parsed = z
    .object({ taskId: z.string().uuid().nullable() })
    .safeParse(await readJson(request));
  if (!parsed.success) throw new ApiError(400, "Invalid task.");
  const { taskId } = parsed.data;
  await withRepositories(userId, async (repos) => {
    if (taskId) {
      const task = await repos.tasks.get(taskId);
      if (!task || !["todo", "in_progress"].includes(task.status))
        throw new ApiError(409, "Only active tasks can be chosen as next.");
    }
    await repos.users.chooseNext(taskId);
  });
  revalidatePath("/");
  return json({ ok: true });
});
