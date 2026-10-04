"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { zonedTimeToUtc } from "@/lib/domain/dates";
import { withRepositories } from "@/lib/repo";
import type { TaskEventType } from "@/lib/repo/postgres-repositories";
import { getCurrentUserId, getTimeZone } from "@/lib/server/session";

// Manual task creation/editing (PRD §2.2, P0) and status changes. Every
// input is validated here, at the boundary.

const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    schema.nullable()
  );

const score = optional(z.coerce.number().int().min(1).max(5));

const taskFormSchema = z.object({
  id: optional(z.string().uuid()),
  title: z.string().trim().min(1, "Give the task a title").max(500),
  description: optional(z.string().trim().max(5000)),
  // <input type="datetime-local">: wall-clock time in the user's timezone.
  dueLocal: optional(
    z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Use a valid date and time")
  ),
  estimatedMinutes: optional(z.coerce.number().int().min(1, "At least 1 minute").max(1440)),
  priority: score,
  importance: score,
  urgency: score,
  energy: optional(z.enum(["low", "medium", "high"])),
  status: z.enum(["inbox", "todo", "in_progress", "postponed", "completed"]).default("todo"),
  project: optional(z.string().trim().max(200)),
});

export interface TaskFormState {
  errors?: Partial<Record<string, string>>;
  message?: string;
}

function toUtc(dueLocal: string, timeZone: string): Date {
  const [date, time] = dueLocal.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return zonedTimeToUtc({ year, month, day }, hour, minute, timeZone);
}

export async function saveTask(
  _previous: TaskFormState,
  formData: FormData
): Promise<TaskFormState> {
  const parsed = taskFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { errors };
  }
  const { id, dueLocal, project, ...fields } = parsed.data;
  const userId = await getCurrentUserId();
  const timeZone = await getTimeZone();

  try {
    await withRepositories(userId, async (repos) => {
      const projectRecord = project ? await repos.projects.findOrCreate(project) : null;
      const values = {
        ...fields,
        dueAt: dueLocal ? toUtc(dueLocal, timeZone) : null,
        projectId: projectRecord?.id ?? null,
        completedAt: fields.status === "completed" ? new Date() : null,
      };
      if (id) {
        const before = await repos.tasks.get(id);
        if (!before) throw new Error("not_found");
        await repos.tasks.update(id, {
          ...values,
          // Keep the original completion time if it was already done.
          completedAt:
            fields.status === "completed" ? (before.completedAt ?? new Date()) : null,
        });
        if (before.status !== fields.status) {
          await repos.taskEvents.record({
            taskId: id,
            eventType: "status_changed",
            fromStatus: before.status,
            toStatus: fields.status,
          });
        }
      } else {
        const task = await repos.tasks.create({ ...values, source: "manual" });
        await repos.taskEvents.record({
          taskId: task.id,
          eventType: "created",
          toStatus: task.status,
        });
      }
    });
  } catch {
    return { message: "Couldn't save the task. Nothing was changed — try again." };
  }

  revalidatePath("/", "layout");
  redirect("/projects");
}

export async function deleteTask(id: string): Promise<void> {
  const taskId = z.string().uuid().parse(id);
  const userId = await getCurrentUserId();
  await withRepositories(userId, (repos) => repos.tasks.remove(taskId));
  revalidatePath("/", "layout");
  redirect("/projects");
}

const STATUS_EVENTS: Record<"completed" | "postponed" | "todo", TaskEventType> = {
  completed: "completed",
  postponed: "postponed",
  todo: "status_changed",
};

/** Complete, postpone, or bring back a task (PRD §2.2 Execution, P0). */
export async function setTaskStatus(id: string, status: "completed" | "postponed" | "todo") {
  const taskId = z.string().uuid().parse(id);
  const next = z.enum(["completed", "postponed", "todo"]).parse(status);
  const userId = await getCurrentUserId();
  await withRepositories(userId, async (repos) => {
    const before = await repos.tasks.get(taskId);
    if (!before) return;
    await repos.tasks.update(taskId, {
      status: next,
      completedAt: next === "completed" ? new Date() : null,
    });
    await repos.taskEvents.record({
      taskId,
      eventType: STATUS_EVENTS[next],
      fromStatus: before.status,
      toStatus: next,
    });
  });
  revalidatePath("/", "layout");
}

const organiseSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  project: z.string().trim().max(200).nullable(),
});

/** Inbox batch path: move captured items onto the list, optionally into a project. */
export async function organiseInbox(input: unknown): Promise<{ ok: boolean; moved: number }> {
  const parsed = organiseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, moved: 0 };
  const { ids, project } = parsed.data;
  const userId = await getCurrentUserId();
  const moved = await withRepositories(userId, async (repos) => {
    const projectRecord = project ? await repos.projects.findOrCreate(project) : null;
    let count = 0;
    for (const id of ids) {
      const before = await repos.tasks.get(id);
      if (!before || before.status !== "inbox") continue;
      await repos.tasks.update(id, {
        status: "todo",
        ...(projectRecord ? { projectId: projectRecord.id } : {}),
      });
      await repos.taskEvents.record({
        taskId: id,
        eventType: "status_changed",
        fromStatus: "inbox",
        toStatus: "todo",
      });
      count++;
    }
    return count;
  });
  revalidatePath("/", "layout");
  return { ok: true, moved };
}
