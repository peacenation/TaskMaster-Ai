import { asc, eq } from "drizzle-orm";
import { withUserContext } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema";
import type { NewTask, Task, TaskRepository } from "./task-repository";

type TaskRow = typeof tasks.$inferSelect;

function toDomainTask(row: TaskRow, position: number): Task {
  return {
    id: row.id,
    userId: row.userId,
    text: row.title,
    status: row.status === "completed" ? "completed" : "pending",
    position,
    createdAt: row.createdAt,
  };
}

/**
 * Postgres adapter for the Phase 2 TaskRepository interface (ADR-005).
 *
 * The interface's `Task` shape (id, userId, text, status, position,
 * createdAt) is deliberately the minimal placeholder Phase 2 defined
 * against the in-memory adapter — not the full PRD_v2.md §1.10 `tasks`
 * table, which has title/description/priority/urgency/importance/dueDate/
 * etc. This adapter is a thin compatibility shim over the real schema:
 * `text` maps to the `title` column, and `position` is derived from
 * `created_at` ordering (there is no stored position column on `tasks` —
 * real ordering is a Plan's job, via `plan_items.position`, built in a
 * later phase). ADR-005 anticipated exactly this: "the interface will
 * almost certainly need small additions once the Postgres adapter ... are
 * built against it for real." Extending the interface with the richer
 * fields is Phase 4/5 work, once the domain engine needs them.
 *
 * Scoped to one user per instance rather than taking a userId per call —
 * every query must run inside withUserContext() for RLS to apply at all
 * (see migrations/0001_row_level_security.sql), and get/update/remove
 * don't receive a userId in the Phase 2 interface. A factory per
 * request/session is the natural fit: pass an id that isn't this user's,
 * and RLS silently returns nothing rather than leaking another user's
 * row — fail-safe by construction, not by caller discipline.
 */
export function createPostgresTaskRepository(userId: string): TaskRepository {
  return {
    async list(forUserId: string): Promise<Task[]> {
      return withUserContext(forUserId, async (tx) => {
        const rows = await tx
          .select()
          .from(tasks)
          .where(eq(tasks.userId, forUserId))
          .orderBy(asc(tasks.createdAt));
        return rows.map((row, index) => toDomainTask(row, index));
      });
    },

    async get(id: string): Promise<Task | undefined> {
      return withUserContext(userId, async (tx) => {
        const rows = await tx.select().from(tasks).where(eq(tasks.id, id)).limit(1);
        const row = rows[0];
        return row ? toDomainTask(row, 0) : undefined;
      });
    },

    async create(input: NewTask): Promise<Task> {
      return withUserContext(input.userId, async (tx) => {
        const rows = await tx
          .insert(tasks)
          .values({ userId: input.userId, title: input.text })
          .returning();
        return toDomainTask(rows[0], 0);
      });
    },

    async update(id: string, patch: Partial<Omit<Task, "id" | "userId">>): Promise<Task> {
      return withUserContext(userId, async (tx) => {
        const rows = await tx
          .update(tasks)
          .set({
            ...(patch.text !== undefined ? { title: patch.text } : {}),
            ...(patch.status !== undefined
              ? { status: patch.status === "completed" ? "completed" : "todo" }
              : {}),
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, id))
          .returning();
        const row = rows[0];
        if (!row) throw new Error(`Task not found: ${id}`);
        return toDomainTask(row, 0);
      });
    },

    async remove(id: string): Promise<void> {
      await withUserContext(userId, async (tx) => {
        await tx.delete(tasks).where(eq(tasks.id, id));
      });
    },
  };
}
