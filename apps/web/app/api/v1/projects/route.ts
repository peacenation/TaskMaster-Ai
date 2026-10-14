import { withRepositories } from "@/lib/repo";
import { apiRoute, json } from "@/lib/server/api";
import { isOpenTask } from "@/lib/server/today-view";

export const dynamic = "force-dynamic";

export const GET = apiRoute(async ({ userId }) => {
  const { records, projects } = await withRepositories(userId, async (repos) => ({
    records: await repos.tasks.list(),
    projects: await repos.projects.list(),
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
      };
    }),
  });
});
