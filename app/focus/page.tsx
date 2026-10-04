import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { EmptyState } from "@/components/ui";
import { FocusTimer } from "@/components/execution/FocusTimer";
import { TaskActions } from "@/components/execution/TaskActions";
import { getCurrentUserId, getTimeZone } from "@/lib/server/session";
import { withRepositories } from "@/lib/repo";
import { toPlannable, formatDue } from "@/lib/server/views";
import { buildToday } from "@/lib/planning/today";
export const dynamic = "force-dynamic";
export default async function FocusPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string }>;
}) {
  const { task: id } = await searchParams;
  const userId = await getCurrentUserId();
  const timeZone = await getTimeZone();
  const now = new Date();
  const result = await withRepositories(userId, async (repos) => {
    const records = await repos.tasks.list();
    const dependencies = await repos.tasks.dependencies();
    const today = buildToday(
      toPlannable(records, dependencies),
      { now, timeZone },
      240,
      await repos.users.nextTaskId()
    );
    const task = id
      ? records.find((t) => t.id === id)
      : records.find((t) => t.id === today.recommendation?.task.id);
    return { task, blocked: today.blocked.some((t) => t.id === task?.id) };
  });
  if (id && !z.string().uuid().safeParse(id).success) notFound();
  if (id && !result.task) notFound();
  const task = result.task;
  return (
    <div className="wrap focus-wrap">
      <header className="hero">
        <p className="eyebrow">Focus</p>
        <h1>{task?.title ?? "A clear moment"}</h1>
      </header>
      {!task || !["todo", "in_progress"].includes(task.status) ? (
        <EmptyState
          title="No active task to focus on"
          description="Choose your next action from Today."
          action={<Link href="/">Back to Today</Link>}
        />
      ) : result.blocked ? (
        <p className="notice">
          This task is waiting on another task. <Link href="/">Choose another action</Link>.
        </p>
      ) : (
        <>
          {task.description && <p>{task.description}</p>}
          <p className="field-hint">
            {task.dueAt ? `Due ${formatDue(task.dueAt, timeZone)}` : "No deadline"}
            {task.estimatedMinutes ? ` · ${task.estimatedMinutes} minutes estimated` : ""}
          </p>
          <FocusTimer userId={userId} taskId={task.id} />
          <TaskActions taskId={task.id} focus />
          <p>
            <Link href="/">Return to Today</Link>
          </p>
        </>
      )}
    </div>
  );
}
