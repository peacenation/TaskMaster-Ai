"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withRepositories } from "@/lib/repo";
import { getCurrentUserId } from "@/lib/server/session";

export async function stopRecurrenceRule(id: string): Promise<void> {
  const ruleId = z.string().uuid().parse(id);
  const userId = await getCurrentUserId();
  await withRepositories(userId, (repos) => repos.recurrenceRules.stop(ruleId));
  revalidatePath("/responsibilities");
}
