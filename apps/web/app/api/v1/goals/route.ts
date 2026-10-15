import { revalidatePath } from "next/cache";
import { z } from "zod";
import { goalProgress } from "@/lib/domain/goal-progress";
import { withRepositories } from "@/lib/repo";
import { ApiError, apiRoute, json, readJson, toTaskDto } from "@/lib/server/api";

export const dynamic = "force-dynamic";

// Goals with their linked work and a nudge when nothing is moving them.
export const GET = apiRoute(async ({ userId }) => {
  const { goals, tasks, projects } = await withRepositories(userId, async (repos) => ({
    goals: await repos.goals.list(),
    tasks: await repos.tasks.list({
      statuses: ["todo", "in_progress", "postponed", "completed"],
    }),
    projects: await repos.projects.list(),
  }));
  const names = new Map(projects.map((p) => [p.id, p.name]));
  return json({
    goals: goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      targetDate: goal.targetDate,
      ...goalProgress(goal.id, tasks),
      tasks: tasks
        .filter((task) => task.goalId === goal.id)
        .map((task) => toTaskDto(task, names)),
    })),
  });
});

const goalSchema = z.object({
  title: z.string().trim().min(1).max(500),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export const POST = apiRoute(async ({ userId }, request) => {
  const parsed = goalSchema.safeParse(await readJson(request));
  if (!parsed.success) throw new ApiError(400, "Add a goal title.");
  const goal = await withRepositories(userId, (repos) =>
    repos.goals.findOrCreate({
      title: parsed.data.title,
      targetDate: parsed.data.targetDate ?? null,
    })
  );
  revalidatePath("/goals");
  return json({ goal: { id: goal.id, title: goal.title } }, 201);
});
