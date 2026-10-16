"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  saveGoalSteps,
  saveStepsSchema,
  suggestGoalSteps,
  type StepSuggestion,
} from "@/lib/goals/suggest-server";
import { getCurrentUserId } from "@/lib/server/session";

export async function suggestSteps(goalId: string): Promise<StepSuggestion | null> {
  const id = z.string().uuid().parse(goalId);
  return suggestGoalSteps(await getCurrentUserId(), id);
}

export async function saveSteps(
  goalId: string,
  input: unknown
): Promise<{ ok: boolean; message?: string }> {
  const id = z.string().uuid().parse(goalId);
  const parsed = saveStepsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the step titles." };
  const saved = await saveGoalSteps(await getCurrentUserId(), id, parsed.data.steps);
  if (saved === null) return { ok: false, message: "That goal no longer exists." };
  revalidatePath("/", "layout");
  return { ok: true };
}
