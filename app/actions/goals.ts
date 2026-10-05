"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withRepositories } from "@/lib/repo";
import { getCurrentUserId } from "@/lib/server/session";

const goalSchema = z.object({
  title: z.string().trim().min(1, "Add a goal title").max(500),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional()
    .transform((value) => (value === "" || value === null || value === undefined ? null : value)),
});

export async function saveGoal(formData: FormData) {
  const parsed = goalSchema.safeParse({
    title: formData.get("title"),
    targetDate: formData.get("targetDate"),
  });

  if (!parsed.success) {
    redirect("/goals");
  }

  const userId = await getCurrentUserId();
  await withRepositories(userId, (repos) =>
    repos.goals.findOrCreate({
      title: parsed.data.title,
      targetDate: parsed.data.targetDate,
    })
  );

  revalidatePath("/goals");
  redirect("/goals");
}
