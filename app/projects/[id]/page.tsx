import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { saveProjectOutcome } from "@/app/actions/projects";
import { setTaskStatus } from "@/app/actions/tasks";
import { EmptyState } from "@/components/ui";
import { withRepositories } from "@/lib/repo";
import { getCurrentUserId, getTimeZone } from "@/lib/server/session";
import { formatDue } from "@/lib/server/views";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const userId = await getCurrentUserId();
  const timeZone = await getTimeZone();
  const data = await withRepositories(userId, async (repos) => ({
    project: await repos.projects.get(id),
    tasks: await repos.tasks.list(),
  }));
  if (!data.project) notFound();
  const tasks = data.tasks.filter(
    (task) => task.projectId === id && task.source !== "recurrence" && task.status !== "dropped"
  );
  const completed = tasks.filter((task) => task.status === "completed").length;
  const percent = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

  return (
    <div className="wrap">
      <header className="hero">
        <p className="eyebrow"><Link href="/projects">Projects</Link></p>
        <h1>{data.project.name}</h1>
        <p>{completed} of {tasks.length} tasks complete · {percent}%</p>
        <progress aria-label="Project task completion" max={100} value={percent} />
      </header>
      <section>
        <h2>Outcome</h2>
        <form action={saveProjectOutcome} className="task-form">
          <input type="hidden" name="id" value={id} />
          <label className="field" htmlFor="description">
            <span>What does finished look like?</span>
            <textarea id="description" name="description" maxLength={2000} defaultValue={data.project.description ?? ""} />
          </label>
          <label className="field" htmlFor="dueDate">
            <span>Target date</span>
            <input id="dueDate" name="dueDate" type="date" defaultValue={data.project.dueDate ?? ""} />
          </label>
          <button type="submit" className="btn btn-primary">Save outcome</button>
        </form>
      </section>
      <section>
        <h2>Tasks</h2>
        {tasks.length === 0 ? (
          <EmptyState title="No tasks in this project" description="Add a task and connect it to this project." action={<Link href="/tasks/new">New task</Link>} />
        ) : (
          <ul className="review-list">
            {tasks.map((task) => (
              <li className="review-item" key={task.id}>
                <span className="review-item-text">
                  <Link href={`/tasks/${task.id}`}>{task.title}</Link>
                  <span className="field-hint"> · {task.status.replaceAll("_", " ")}</span>
                  {task.dueAt && <span className="field-hint"> · due {formatDue(task.dueAt, timeZone)}</span>}
                </span>
                {task.status !== "completed" && (
                  <form action={setTaskStatus.bind(null, task.id, "completed")}>
                    <button type="submit" className="review-item-remove">Done</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}