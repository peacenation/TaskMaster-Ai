import { EMPTY_TASK, TaskForm } from "@/components/tasks/TaskForm";
import { withRepositories } from "@/lib/repo";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export default async function NewTaskPage() {
  const userId = await getCurrentUserId();
  const { projects, goals } = await withRepositories(userId, async (repos) => ({
    projects: await repos.projects.list(),
    goals: await repos.goals.list(),
  }));
  return (
    <div className="wrap">
      <header className="hero">
        <p className="eyebrow">New task</p>
        <h1>Add a task</h1>
      </header>
      <TaskForm
        task={EMPTY_TASK}
        projects={projects.map((p) => p.name)}
        goals={goals.map((goal) => goal.title)}
      />
    </div>
  );
}
