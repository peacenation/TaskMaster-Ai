import { and, asc, desc, eq, inArray, isNotNull, or } from "drizzle-orm";
import type { AppDb } from "@/lib/db/client";
import { taskDependencies, tasks } from "@/lib/db/schema";
import { TASK_DEFAULTS, type TaskRecord, type TaskRepository } from "./task-repository";

type TaskRow = typeof tasks.$inferSelect;

function toRecord(row: TaskRow): TaskRecord {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    description: row.description,
    parentTaskId: row.parentTaskId,
    status: row.status,
    priority: row.priority,
    urgency: row.urgency,
    importance: row.importance,
    dueAt: row.dueDate,
    estimatedMinutes: row.estimatedMinutes,
    energy: row.energyRequirement,
    projectId: row.projectId,
    goalId: row.goalId,
    recurrenceRuleId: row.recurrenceRuleId,
    occurrenceDate: row.occurrenceDate,
    occurrenceSlot: row.occurrenceSlot,
    source: row.source,
    waitingOn: row.waitingOn,
    waitingSince: row.waitingSince,
    followUpAt: row.followUpAt,
    actualMinutes: row.actualMinutes,
    assigneeId: row.assigneeId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt,
  };
}

/**
 * Postgres adapter for TaskRepository. Runs on a transaction that already
 * has `app.current_user_id` set (lib/repo/index.ts withRepositories) — RLS
 * scopes every query to that user, and the explicit user_id filters below
 * are defence in depth, not the isolation mechanism (ADR-004).
 */
export function createPostgresTaskRepository(db: AppDb, userId: string): TaskRepository {
  return {
    async list(filter) {
      const conditions = [or(eq(tasks.userId, userId), eq(tasks.assigneeId, userId))!];
      if (filter?.statuses) conditions.push(inArray(tasks.status, filter.statuses));
      const rows = await db
        .select()
        .from(tasks)
        .where(and(...conditions))
        .orderBy(asc(tasks.createdAt), asc(tasks.id));
      return rows.map(toRecord);
    },

    async visible() {
      // RLS decides: own rows, plus every task in a project shared with you.
      const rows = await db.select().from(tasks).orderBy(asc(tasks.createdAt), asc(tasks.id));
      return rows.map(toRecord);
    },

    async get(id) {
      const rows = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
      return rows[0] ? toRecord(rows[0]) : undefined;
    },

    async create(input) {
      const merged = { ...TASK_DEFAULTS, ...input };
      const rows = await db
        .insert(tasks)
        .values({
          userId,
          title: merged.title,
          description: merged.description,
          parentTaskId: merged.parentTaskId,
          status: merged.status,
          priority: merged.priority,
          urgency: merged.urgency,
          importance: merged.importance,
          dueDate: merged.dueAt,
          estimatedMinutes: merged.estimatedMinutes,
          energyRequirement: merged.energy,
          projectId: merged.projectId,
          goalId: merged.goalId,
          recurrenceRuleId: merged.recurrenceRuleId,
          occurrenceDate: merged.occurrenceDate,
          occurrenceSlot: merged.occurrenceSlot,
          source: merged.source,
          waitingOn: merged.waitingOn,
          waitingSince: merged.waitingSince,
          followUpAt: merged.followUpAt,
          actualMinutes: merged.actualMinutes,
          assigneeId: merged.assigneeId,
          completedAt: merged.completedAt,
        })
        .returning();
      return toRecord(rows[0]);
    },

    async update(id, patch) {
      const { dueAt, energy, ...rest } = patch;
      const rows = await db
        .update(tasks)
        .set({
          ...rest,
          ...(dueAt !== undefined ? { dueDate: dueAt } : {}),
          ...(energy !== undefined ? { energyRequirement: energy } : {}),
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, id))
        .returning();
      if (!rows[0]) throw new Error(`Task not found: ${id}`);
      return toRecord(rows[0]);
    },

    async remove(id) {
      await db.delete(tasks).where(eq(tasks.id, id));
    },

    /** Recent started-then-completed tasks, for learned estimates. */
    async durationSamples(limit = 30) {
      const rows = await db
        .select({
          estimatedMinutes: tasks.estimatedMinutes,
          actualMinutes: tasks.actualMinutes,
        })
        .from(tasks)
        .where(and(eq(tasks.userId, userId), isNotNull(tasks.actualMinutes)))
        .orderBy(desc(tasks.completedAt))
        .limit(limit);
      return rows.map((r) => ({
        estimatedMinutes: r.estimatedMinutes,
        actualMinutes: r.actualMinutes!,
      }));
    },

    async dependencies() {
      return db
        .select({
          taskId: taskDependencies.taskId,
          dependsOnTaskId: taskDependencies.dependsOnTaskId,
        })
        .from(taskDependencies)
        .where(eq(taskDependencies.userId, userId));
    },
  };
}
