import Link from "next/link";
import { setTaskStatus } from "@/app/actions/tasks";
import { InvitationsCard } from "@/components/sharing/InvitationsCard";
import { EmptyState } from "@/components/ui";
import { withRepositories } from "@/lib/repo";
import type { TaskRecord } from "@/lib/repo/task-repository";
import { getCurrentUserId, getTimeZone } from "@/lib/server/session";
import { formatDue } from "@/lib/server/views";

export const dynamic = "force-dynamic";

// Projects (PRD §2.5): every open task, grouped by project. Project
// detail pages and breakdown are Phase 9; this is where committed work,
// manual creation, and editing live in the meantime.

function TaskRow({ task, timeZone }: { task: TaskRecord; timeZone: string }) {
  return (
    <li className="review-item">
      <span className="review-item-text">
        <Link href={`/tasks/${task.id}`}>{task.title}</Link>
        {task.status === "in_progress" && <span className="field-hint"> · in progress</span>}
        {task.dueAt && (
          <span className="field-hint"> · due {formatDue(task.dueAt, timeZone)}</span>
        )}
      </span>
      <form action={setTaskStatus.bind(null, task.id, "completed")}>
        <button type="submit" className="review-item-remove">
          Done
        </button>
      </form>
    </li>
  );
}

export default async function ProjectsPage() {
  const userId = await getCurrentUserId();
  const timeZone = await getTimeZone();
  const { open, postponed, projects, invites } = await withRepositories(
    userId,
    async (repos) => {
      // Everything visible: your tasks plus everyone's in shared projects.
      const visible = (await repos.tasks.visible()).filter((t) => t.source !== "recurrence");
      return {
        open: visible.filter((t) => t.status === "todo" || t.status === "in_progress"),
        postponed: visible.filter((t) => t.status === "postponed"),
        projects: await repos.projects.list(),
        invites: await repos.sharing.mine(),
      };
    }
  );
  const shared = new Set(projects.filter((p) => p.ownerId !== userId).map((p) => p.id));

  const groups = [
    ...projects.map((p) => ({
      name: shared.has(p.id) ? `${p.name} (shared with you)` : p.name,
      tasks: open.filter((t) => t.projectId === p.id),
    })),
    { name: "No project", tasks: open.filter((t) => t.projectId === null) },
  ];

  return (
    <div className="wrap">
      <header className="hero">
        <p className="eyebrow">Projects</p>
        <h1>All your tasks</h1>
        <div className="button-row" style={{ marginTop: "1rem" }}>
          <Link href="/tasks/new" className="btn btn-primary">
            New task
          </Link>
          <Link href="/dump" className="btn btn-secondary">
            Brain Dump
          </Link>
        </div>
      </header>

      <InvitationsCard invites={invites} />
      {open.length === 0 && postponed.length === 0 && (
        <EmptyState title="No tasks yet" description="Create one, or start a Brain Dump." />
      )}

      {groups
        .filter((g) => g.tasks.length > 0 || (g.name !== "No project" && open.length > 0))
        .map((group) => (
          <section key={group.name} aria-label={group.name}>
            <h2>
              {group.name} <span className="review-count">{group.tasks.length}</span>
            </h2>
            {group.tasks.length === 0 ? (
              <p className="field-hint">No open tasks.</p>
            ) : (
              <ul className="review-list">
                {group.tasks.map((task) => (
                  <TaskRow key={task.id} task={task} timeZone={timeZone} />
                ))}
              </ul>
            )}
          </section>
        ))}

      {postponed.length > 0 && (
        <section aria-labelledby="postponed-heading">
          <h2 id="postponed-heading">Postponed</h2>
          <ul className="review-list">
            {postponed.map((task) => (
              <li className="review-item" key={task.id}>
                <span className="review-item-text">
                  <Link href={`/tasks/${task.id}`}>{task.title}</Link>
                </span>
                <form action={setTaskStatus.bind(null, task.id, "todo")}>
                  <button type="submit" className="review-item-remove">
                    Bring back
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="project-outcomes-heading">
        <h2 id="project-outcomes-heading">Project outcomes</h2>
        {projects.length ? (
          <ul className="review-list">
            {projects.map((project) => {
              const projectTasks = [...open, ...postponed].filter(
                (task) => task.projectId === project.id
              );
              return (
                <li className="review-item" key={project.id}>
                  <span className="review-item-text">
                    <Link href={`/projects/${project.id}`}>{project.name}</Link>
                    <span className="field-hint">
                      {" "}
                      · {projectTasks.length} active or postponed
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="field-hint">Projects appear here as tasks are grouped.</p>
        )}
      </section>
    </div>
  );
}
