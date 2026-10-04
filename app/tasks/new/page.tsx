import { EMPTY_TASK, TaskForm } from "@/components/tasks/TaskForm";
import { withRepositories } from "@/lib/repo";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export default async function NewTaskPage() {
  const userId = await getCurrentUserId();
  const projects = await withRepositories(userId, (repos) => repos.projects.list());
  return (
    <div className="wrap">
      <header className="hero">
        <p className="eyebrow">New task</p>
        <h1>Add a task</h1>
      </header>
      <TaskForm task={EMPTY_TASK} projects={projects.map((p) => p.name)} />
    </div>
  );
}
