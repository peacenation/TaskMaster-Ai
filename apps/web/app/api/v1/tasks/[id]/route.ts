import { revalidatePath } from "next/cache";
import { z } from "zod";
import { breakdownTask } from "@/lib/domain/breakdown";
import { waitingPatch } from "@/lib/domain/waiting";
import { withRepositories } from "@/lib/repo";
import { ApiError, apiRoute, json, readJson, toTaskDto } from "@/lib/server/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function taskId({ params }: Params) {
  const id = z
    .string()
    .uuid()
    .safeParse((await params).id);
  if (!id.success) throw new ApiError(404, "Task not found.");
  return id.data;
}

// One task with everything the phone's task screen shows: details, its
// steps (or suggested steps when it has none), history, and the project
// and goal names it can be moved to.
export const GET = apiRoute(async ({ userId }, _request, context: Params) => {
  const id = await taskId(context);
  const data = await withRepositories(userId, async (repos) => {
    const task = await repos.tasks.get(id);
    if (!task) throw new ApiError(404, "Task not found.");
    return {
      task,
      projects: await repos.projects.list(),
      goals: await repos.goals.list(),
      children: await repos.execution.children(id),
      events: await repos.execution.events(id),
    };
  });
  const { task, projects, goals, children, events } = data;
  const names = new Map(projects.map((p) => [p.id, p.name]));
  const goal = goals.find((g) => g.id === task.goalId);
  const canBreakDown =
    children.length === 0 && ["todo", "in_progress", "inbox"].includes(task.status);
  return json({
    task: {
      ...toTaskDto(task, names),
      description: task.description,
      importance: task.importance,
      urgency: task.urgency,
      energy: task.energy,
      goal: goal ? { id: goal.id, title: goal.title } : null,
      parentTaskId: task.parentTaskId,
    },
    steps: children.map((child) => ({
      id: child.id,
      title: child.title,
      status: child.status,
    })),
    suggestedSteps: canBreakDown ? breakdownTask(task.title, task.estimatedMinutes).steps : [],
    canBreakDown,
    history: events.map((event) => ({
      type: event.eventType,
      toStatus: event.toStatus,
      at: event.occurredAt.toISOString(),
    })),
    projects: projects.map((p) => ({ id: p.id, name: p.name })),
    goals: goals.map((g) => ({ id: g.id, title: g.title })),
  });
});

const score = z.number().int().min(1).max(5).nullable();

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    description: z.string().trim().max(5000).nullable(),
    dueAt: z.iso.datetime({ offset: true }).nullable(),
    estimatedMinutes: z.number().int().min(1).max(1440).nullable(),
    priority: score,
    importance: score,
    urgency: score,
    energy: z.enum(["low", "medium", "high"]).nullable(),
    // By name, like the web form: a new name creates the project or goal.
    project: z.string().trim().max(200).nullable(),
    goal: z.string().trim().max(200).nullable(),
    // Waiting On: who the next step belongs to (null: it's yours again),
    // and when to chase (defaults to three days).
    waitingOn: z.string().trim().max(200).nullable(),
    followUpAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .partial();

// Edit a task. Status changes go through /tasks/{id}/status so history and
// focus tracking stay consistent.
export const PATCH = apiRoute(async ({ userId }, request, context: Params) => {
  const id = await taskId(context);
  const parsed = patchSchema.safeParse(await readJson(request));
  if (!parsed.success) throw new ApiError(400, "Check the task details and try again.");
  const { project, goal, dueAt, description, waitingOn, followUpAt, ...fields } = parsed.data;
  const { task, names } = await withRepositories(userId, async (repos) => {
    const before = await repos.tasks.get(id);
    if (!before) throw new ApiError(404, "Task not found.");
    const followUp =
      followUpAt === undefined ? undefined : followUpAt === null ? null : new Date(followUpAt);
    const waiting =
      waitingOn !== undefined
        ? before.waitingOn && waitingOn
          ? // Still waiting (maybe on someone else): keep when it started.
            { waitingOn, followUpAt: followUp ?? before.followUpAt }
          : waitingPatch(waitingOn, followUp, new Date())
        : followUp !== undefined && before.waitingOn
          ? { followUpAt: followUp }
          : {};
    const projectRecord = project ? await repos.projects.findOrCreate(project) : null;
    const goalRecord = goal ? await repos.goals.findOrCreate({ title: goal }) : null;
    const updated = await repos.tasks.update(id, {
      ...fields,
      ...(description !== undefined ? { description: description || null } : {}),
      ...(dueAt !== undefined ? { dueAt: dueAt ? new Date(dueAt) : null } : {}),
      ...(project !== undefined ? { projectId: projectRecord?.id ?? null } : {}),
      ...(goal !== undefined ? { goalId: goalRecord?.id ?? null } : {}),
      ...waiting,
    });
    if (waitingOn && !before.waitingOn)
      await repos.events.track("waiting_marked", { task_id: id });
    const projects = await repos.projects.list();
    return { task: updated, names: new Map(projects.map((p) => [p.id, p.name])) };
  });
  revalidatePath("/", "layout");
  return json({ task: task ? toTaskDto(task, names) : null });
});

export const DELETE = apiRoute(async ({ userId }, _request, context: Params) => {
  const id = await taskId(context);
  await withRepositories(userId, async (repos) => {
    if (!(await repos.tasks.get(id))) throw new ApiError(404, "Task not found.");
    await repos.tasks.remove(id);
  });
  revalidatePath("/", "layout");
  return json({ ok: true });
});
