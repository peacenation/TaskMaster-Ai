"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withRepositories } from "@/lib/repo";
import { getCurrentUserId } from "@/lib/server/session";

export async function chooseNext(id: string | null) {
  const taskId = z.string().uuid().nullable().parse(id);
  const userId = await getCurrentUserId();
  await withRepositories(userId, async (repos) => {
    if (taskId) {
      const task = await repos.tasks.get(taskId);
      if (!task || !["todo", "in_progress"].includes(task.status)) return;
    }
    await repos.users.chooseNext(taskId);
  });
  revalidatePath("/");
}

export async function overridePriority(id: string, formData: FormData) {
  const taskId = z.string().uuid().parse(id);
  const raw = formData.get("priority");
  const priority = raw === "" ? null : z.coerce.number().int().min(1).max(5).parse(raw);
  const userId = await getCurrentUserId();
  await withRepositories(userId, async (repos) => {
    const task = await repos.tasks.get(taskId);
    if (task) await repos.tasks.update(taskId, { priority });
  });
  revalidatePath("/", "layout");
}
