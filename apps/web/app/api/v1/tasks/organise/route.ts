import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withRepositories } from "@/lib/repo";
import { ApiError, apiRoute, json, readJson } from "@/lib/server/api";

export const dynamic = "force-dynamic";

const organiseSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  project: z.string().trim().max(200).nullable().optional(),
});

// Inbox triage: move captured items onto the list, optionally into a
// project (new names create one) — the web Inbox's batch action.
export const POST = apiRoute(async ({ userId }, request) => {
  const parsed = organiseSchema.safeParse(await readJson(request));
  if (!parsed.success) throw new ApiError(400, "Choose at least one item.");
  const { ids, project } = parsed.data;
  const moved = await withRepositories(userId, async (repos) => {
    const projectRecord = project ? await repos.projects.findOrCreate(project) : null;
    let count = 0;
    for (const id of ids) {
      const before = await repos.tasks.get(id);
      if (!before || before.status !== "inbox") continue;
      await repos.tasks.update(id, {
        status: "todo",
        ...(projectRecord ? { projectId: projectRecord.id } : {}),
      });
      await repos.taskEvents.record({
        taskId: id,
        eventType: "status_changed",
        fromStatus: "inbox",
        toStatus: "todo",
      });
      count++;
    }
    return count;
  });
  revalidatePath("/", "layout");
  return json({ moved });
});
