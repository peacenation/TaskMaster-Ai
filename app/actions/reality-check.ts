"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withRepositories } from "@/lib/repo";
import { getCurrentUserId } from "@/lib/server/session";

export async function confirmRealityDecision(formData: FormData): Promise<void> {
  const { taskId, decision } = z
    .object({
      taskId: z.string().uuid(),
      decision: z.enum(["postpone", "drop"]),
    })
    .parse({
      taskId: formData.get("taskId"),
      decision: formData.get("decision"),
    });
  const userId = await getCurrentUserId();
  await withRepositories(userId, async (repos) => {
    const before = await repos.tasks.get(taskId);
    if (!before || !["todo", "in_progress"].includes(before.status)) return;
    const status = decision === "postpone" ? "postponed" : "dropped";
    await repos.tasks.update(taskId, {
      status,
      completedAt: null,
    });
    await repos.taskEvents.record({
      taskId,
      eventType: decision === "postpone" ? "postponed" : "status_changed",
      fromStatus: before.status,
      toStatus: status,
    });
  });
  revalidatePath("/", "layout");
}
