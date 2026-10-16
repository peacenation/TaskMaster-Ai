import { z } from "zod";
import { withRepositories } from "@/lib/repo";
import { ApiError, apiRoute, json, toTaskDto } from "@/lib/server/api";
import { peopleDto } from "@/lib/server/sharing";

export const dynamic = "force-dynamic";

// One project with its tasks, grouped the way the project screen shows them.
export const GET = apiRoute(
  async ({ userId }, _request, { params }: { params: Promise<{ id: string }> }) => {
    const id = z
      .string()
      .uuid()
      .safeParse((await params).id);
    if (!id.success) throw new ApiError(404, "Project not found.");
    const { project, records, people, pending } = await withRepositories(
      userId,
      async (repos) => {
        const project = await repos.projects.get(id.data);
        return {
          project,
          records: project ? await repos.tasks.visible() : [],
          people: project ? await repos.sharing.people(id.data) : [],
          pending: project?.ownerId === userId ? await repos.sharing.pendingFor(id.data) : [],
        };
      }
    );
    if (!project) throw new ApiError(404, "Project not found.");
    const names = new Map([[project.id, project.name]]);
    const tasks = records.filter(
      (task) =>
        task.projectId === project.id &&
        task.source !== "recurrence" &&
        !["dropped", "inbox"].includes(task.status)
    );
    const byDue = (a: (typeof tasks)[number], b: (typeof tasks)[number]) =>
      (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity);
    const pick = (status: string) =>
      tasks
        .filter((t) => t.status === status)
        .sort(byDue)
        .map((t) => toTaskDto(t, names));
    const done = tasks.filter((t) => t.status === "completed").length;
    return json({
      project: { id: project.id, name: project.name, done, total: tasks.length },
      inProgress: pick("in_progress"),
      todo: pick("todo"),
      postponed: pick("postponed"),
      role: project.ownerId === userId ? "owner" : "member",
      people: peopleDto(people, userId),
      invites: pending.map((i) => ({
        id: i.id,
        email: i.email,
        expiresAt: i.expiresAt.toISOString(),
      })),
    });
  }
);
