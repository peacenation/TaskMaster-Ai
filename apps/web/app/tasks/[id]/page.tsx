import Link from "next/link";
import { BreakdownReview } from "@/components/execution/BreakdownReview";
import { breakdownTask } from "@/lib/domain/breakdown";
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
  const { task, projects, goals, children, events } = await withRepositories(
    userId,
    async (repos) => ({
      task: await repos.tasks.get(id),
      projects: await repos.projects.list(),
      goals: await repos.goals.list(),
      children: await repos.execution.children(id),
      events: await repos.execution.events(id),
    })
  );
  if (!task) notFound();

  return (
    <div className="wrap">
      <header className="hero">
        <p className="eyebrow">Edit task</p>
        <h1>{task.title}</h1>
      </header>
      {children.length > 0 ? (
        <section>
          <h2>Steps</h2>
          <ul>
            {children.map((child) => (
              <li key={child.id}>
                <Link href={`/tasks/${child.id}`}>{child.title}</Link> · {child.status}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        ["todo", "in_progress", "inbox"].includes(task.status) && (
          <BreakdownReview
            taskId={task.id}
            suggested={breakdownTask(task.title, task.estimatedMinutes).steps}
          />
        )
      )}
      <TaskForm
        projects={projects.map((p) => p.name)}
        goals={goals.map((goal) => goal.title)}
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
          goal: goals.find((goal) => goal.id === task.goalId)?.title ?? "",
        }}
      />
      <section>
        <h2>Task history</h2>
        <ul>
          {events.map((event) => (
            <li key={event.id}>
              {event.eventType.replaceAll("_", " ")} · {event.toStatus ?? ""} ·{" "}
              {event.occurredAt.toLocaleString("en-GB", { timeZone })}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
