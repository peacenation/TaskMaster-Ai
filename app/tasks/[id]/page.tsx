import { notFound } from "next/navigation";
import { z } from "zod";
import { TaskForm } from "@/components/tasks/TaskForm";
import { withRepositories } from "@/lib/repo";
import { getCurrentUserId, getTimeZone } from "@/lib/server/session";
import { toLocalInput } from "@/lib/server/views";

export const dynamic = "force-dynamic";

const str = (value: number | string | null) => (value === null ? "" : String(value));

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const userId = await getCurrentUserId();
  const timeZone = await getTimeZone();
  const { task, projects } = await withRepositories(userId, async (repos) => ({
    task: await repos.tasks.get(id),
    projects: await repos.projects.list(),
  }));
  if (!task) notFound();

  return (
    <div className="wrap">
      <header className="hero">
        <p className="eyebrow">Edit task</p>
        <h1>{task.title}</h1>
      </header>
      <TaskForm
        projects={projects.map((p) => p.name)}
        task={{
          id: task.id,
          title: task.title,
          description: task.description ?? "",
          dueLocal: toLocalInput(task.dueAt, timeZone),
          estimatedMinutes: str(task.estimatedMinutes),
          priority: str(task.priority),
          importance: str(task.importance),
          urgency: str(task.urgency),
          energy: task.energy ?? "",
          status: task.status,
          project: projects.find((p) => p.id === task.projectId)?.name ?? "",
        }}
      />
    </div>
  );
}
