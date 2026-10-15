"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { waitingPatch } from "@/lib/domain/waiting";
import { withRepositories } from "@/lib/repo";
import { getCurrentUserId } from "@/lib/server/session";

const DAY_MS = 86_400_000;

/** It arrived (or you'll do it yourself): the task is yours again. */
export async function stopWaiting(id: string): Promise<void> {
  const taskId = z.string().uuid().parse(id);
  const userId = await getCurrentUserId();
  await withRepositories(userId, (repos) =>
    repos.tasks.update(taskId, waitingPatch(null, null, new Date()))
  );
  revalidatePath("/", "layout");
}

/** Chased, still waiting: check again in a few days. */
export async function followUpLater(id: string, days: number): Promise<void> {
  const taskId = z.string().uuid().parse(id);
  const wait = z.number().int().min(1).max(30).parse(days);
  const userId = await getCurrentUserId();
  await withRepositories(userId, async (repos) => {
    const task = await repos.tasks.get(taskId);
    if (!task?.waitingOn) return;
    await repos.tasks.update(taskId, { followUpAt: new Date(Date.now() + wait * DAY_MS) });
  });
  revalidatePath("/", "layout");
}
