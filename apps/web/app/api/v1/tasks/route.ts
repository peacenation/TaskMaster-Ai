import { revalidatePath } from "next/cache";
import { z } from "zod";
import { localDate } from "@/lib/execution/date";
import { withRepositories } from "@/lib/repo";
import { ApiError, apiRoute, json, readJson, toTaskDto } from "@/lib/server/api";
import { isOpenTask } from "@/lib/server/today-view";

export const dynamic = "force-dynamic";

const viewSchema = z.enum(["today", "upcoming", "all", "inbox", "waiting"]).default("today");

// My Tasks. today: open work due today or overdue; upcoming: due later;
// all: every open task; inbox: captured, not yet organised; waiting: open
// work whose next step is someone else's.
export const GET = apiRoute(async ({ userId, timeZone }, request) => {
  const parsed = viewSchema.safeParse(
    new URL(request.url).searchParams.get("view") ?? undefined
  );
  if (!parsed.success)
    throw new ApiError(400, "view must be today, upcoming, all, inbox or waiting.");
  const view = parsed.data;
  const { records, projects } = await withRepositories(userId, async (repos) => ({
    records: await repos.tasks.list(),
    projects: await repos.projects.list(),
  }));
  const names = new Map(projects.map((p) => [p.id, p.name]));
  const date = localDate(new Date(), timeZone);
  const due = (task: (typeof records)[number]) =>
    task.dueAt ? localDate(task.dueAt, timeZone) : null;
  const tasks = records
    .filter((task) => {
      if (view === "inbox") return task.status === "inbox";
      if (!isOpenTask(task)) return false;
      if (view === "waiting") return task.waitingOn !== null;
      const day = due(task);
      if (view === "today") return day !== null && day <= date;
      if (view === "upcoming") return day !== null && day > date;
      return true;
    })
    .sort(
      (a, b) =>
        (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity) ||
        a.createdAt.getTime() - b.createdAt.getTime()
    );
  return json({ view, tasks: tasks.map((task) => toTaskDto(task, names)) });
});

const createSchema = z.object({
  title: z.string().trim().min(1).max(500),
  dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  goalId: z.string().uuid().nullable().optional(),
});

// Quick Add from the phone: lands in the Inbox, like the web's Quick Add.
// Added from a project screen (projectId), it goes straight into that
// project (or for a goal) as a to-do, since it's already organised.
export const POST = apiRoute(async ({ userId }, request) => {
  const parsed = createSchema.safeParse(await readJson(request));
  if (!parsed.success) throw new ApiError(400, "Give the task a title.");
  const { title, dueAt, projectId, goalId } = parsed.data;
  const { task, names } = await withRepositories(userId, async (repos) => {
    const project = projectId
      ? (await repos.projects.list()).find((p) => p.id === projectId)
      : undefined;
    if (projectId && !project) throw new ApiError(404, "Project not found.");
    const goal = goalId ? (await repos.goals.list()).find((g) => g.id === goalId) : undefined;
    if (goalId && !goal) throw new ApiError(404, "Goal not found.");
    const status = project || goal ? "todo" : "inbox";
    const created = await repos.tasks.create({
      title,
      dueAt: dueAt ? new Date(dueAt) : null,
      source: "quick_add",
      status,
      projectId: project?.id ?? null,
      goalId: goal?.id ?? null,
    });
    await repos.taskEvents.record({
      taskId: created.id,
      eventType: "created",
      toStatus: status,
    });
    return {
      task: created,
      names: new Map(project ? [[project.id, project.name]] : []),
    };
  });
  revalidatePath("/", "layout");
  return json({ task: toTaskDto(task, names) }, 201);
});
