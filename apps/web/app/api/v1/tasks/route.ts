import { revalidatePath } from "next/cache";
import { z } from "zod";
import { localDate } from "@/lib/execution/date";
import { withRepositories } from "@/lib/repo";
import { ApiError, apiRoute, json, readJson, toTaskDto } from "@/lib/server/api";
import { isOpenTask } from "@/lib/server/today-view";

export const dynamic = "force-dynamic";

const viewSchema = z.enum(["today", "upcoming", "all", "inbox"]).default("today");

// My Tasks. today: open work due today or overdue; upcoming: due later;
// all: every open task; inbox: captured, not yet organised.
export const GET = apiRoute(async ({ userId, timeZone }, request) => {
  const parsed = viewSchema.safeParse(
    new URL(request.url).searchParams.get("view") ?? undefined
  );
  if (!parsed.success) throw new ApiError(400, "view must be today, upcoming, all or inbox.");
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
});

// Quick Add from the phone: lands in the Inbox, like the web's Quick Add.
export const POST = apiRoute(async ({ userId }, request) => {
  const parsed = createSchema.safeParse(await readJson(request));
  if (!parsed.success) throw new ApiError(400, "Give the task a title.");
  const task = await withRepositories(userId, async (repos) => {
    const created = await repos.tasks.create({
      title: parsed.data.title,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      source: "quick_add",
      status: "inbox",
    });
    await repos.taskEvents.record({
      taskId: created.id,
      eventType: "created",
      toStatus: "inbox",
    });
    return created;
  });
  revalidatePath("/", "layout");
  return json({ task: toTaskDto(task, new Map()) }, 201);
});
