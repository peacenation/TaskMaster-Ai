"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withRepositories } from "@/lib/repo";
import { getCurrentUserId } from "@/lib/server/session";

const projectOutcomeSchema = z.object({
  id: z.string().uuid(),
  description: z.string().trim().max(2000).nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

export async function saveProjectOutcome(formData: FormData): Promise<void> {
  const data = projectOutcomeSchema.parse({
    id: formData.get("id"),
    description: formData.get("description") || null,
    dueDate: formData.get("dueDate") || null,
  });
  const userId = await getCurrentUserId();
  await withRepositories(userId, (repos) =>
    repos.projects.updateOutcome(data.id, data.description, data.dueDate)
  );
  revalidatePath("/projects");
  revalidatePath(`/projects/${data.id}`);
}