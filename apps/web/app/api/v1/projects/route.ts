import { withRepositories } from "@/lib/repo";
import { apiRoute, json } from "@/lib/server/api";
import { isOpenTask } from "@/lib/server/today-view";

export const dynamic = "force-dynamic";

// Projects you own and projects shared with you, with progress across
// everyone's tasks in them.
export const GET = apiRoute(async ({ userId }) => {
  const { records, projects, invites } = await withRepositories(userId, async (repos) => ({
    records: await repos.tasks.visible(),
    projects: await repos.projects.list(),
    invites: await repos.sharing.mine(),
  }));
  return json({
    projects: projects.map((project) => {
      const tasks = records.filter(
        (task) =>
          task.projectId === project.id &&
          task.source !== "recurrence" &&
          !["dropped", "inbox"].includes(task.status)
      );
      return {
        id: project.id,
        name: project.name,
        done: tasks.filter((task) => task.status === "completed").length,
        total: tasks.length,
        open: tasks.filter(isOpenTask).length,
        role: project.ownerId === userId ? "owner" : "member",
      };
    }),
    // Invitations waiting for an answer, shown above the list.
    invites: invites.map((i) => ({
      id: i.id,
      projectName: i.projectName,
      inviterName: i.inviterName,
      expiresAt: i.expiresAt.toISOString(),
    })),
  });
});
