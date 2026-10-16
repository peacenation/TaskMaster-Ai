import { revalidatePath } from "next/cache";
import { z } from "zod";
import { saveGoalSteps, saveStepsSchema, suggestGoalSteps } from "@/lib/goals/suggest-server";
import { ApiError, apiRoute, json, readJson } from "@/lib/server/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function goalId({ params }: Params) {
  const id = z
    .string()
    .uuid()
    .safeParse((await params).id);
  if (!id.success) throw new ApiError(404, "Goal not found.");
  return id.data;
}

// Suggested next steps for a goal (Claude, or built-in rules). Nothing is saved.
export const GET = apiRoute(async ({ userId }, request, context: Params) => {
  const suggestion = await suggestGoalSteps(userId, await goalId(context), request.signal);
  if (!suggestion) throw new ApiError(404, "Goal not found.");
  return json(suggestion);
});

// Save the reviewed steps as to-dos linked to the goal.
export const POST = apiRoute(async ({ userId }, request, context: Params) => {
  const id = await goalId(context);
  const parsed = saveStepsSchema.safeParse(await readJson(request));
  if (!parsed.success) throw new ApiError(400, "Check the step titles.");
  const saved = await saveGoalSteps(userId, id, parsed.data.steps);
  if (saved === null) throw new ApiError(404, "Goal not found.");
  revalidatePath("/", "layout");
  return json({ saved }, 201);
});
