import { and, count, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import type { AppDb } from "@/lib/db/client";
import {
  aiRequests,
  brainDumps,
  goals,
  projects,
  recurrenceRules,
  tasks,
  taskEvents,
  users,
} from "@/lib/db/schema";
import type { ExtractionProposal } from "@/lib/domain/proposal";
import type { TaskStatus } from "@/lib/domain/task";
import { occurrencesBetween } from "@/lib/domain/recurrence";

// Postgres-only repositories for the aggregates beyond tasks. No in-memory
// twins: nothing needs one yet (ADR-008 — tooling arrives with its first
// consumer, not before). Each is bound to one user and runs on an
// RLS-scoped transaction from withRepositories() in ./index.ts.

export type BrainDumpStatus = "pending" | "processing" | "completed" | "failed";

export interface BrainDumpRecord {
  id: string;
  rawText: string;
  processingStatus: BrainDumpStatus;
  proposal: ExtractionProposal | null;
  committedAt: Date | null;
  createdAt: Date;
}

function toBrainDump(row: typeof brainDumps.$inferSelect): BrainDumpRecord {
  return {
    id: row.id,
    rawText: row.rawText,
    processingStatus: row.processingStatus,
    proposal: (row.proposalJson as ExtractionProposal | null) ?? null,
    committedAt: row.committedAt,
    createdAt: row.createdAt,
  };
}

export function createBrainDumpRepository(db: AppDb, userId: string) {
  return {
    async create(rawText: string): Promise<BrainDumpRecord> {
      const rows = await db.insert(brainDumps).values({ userId, rawText }).returning();
      return toBrainDump(rows[0]);
    },

    async get(id: string): Promise<BrainDumpRecord | undefined> {
      const rows = await db.select().from(brainDumps).where(eq(brainDumps.id, id)).limit(1);
      return rows[0] ? toBrainDump(rows[0]) : undefined;
    },

    async setStatus(id: string, processingStatus: BrainDumpStatus): Promise<void> {
      await db.update(brainDumps).set({ processingStatus }).where(eq(brainDumps.id, id));
    },

    async saveProposal(id: string, proposal: ExtractionProposal): Promise<void> {
      await db
        .update(brainDumps)
        .set({ proposalJson: proposal, processingStatus: "completed" })
        .where(eq(brainDumps.id, id));
    },

    async markCommitted(id: string): Promise<void> {
      await db
        .update(brainDumps)
        .set({ committedAt: new Date() })
        .where(eq(brainDumps.id, id));
    },

    /** Saved but never committed — the Inbox offers to resume these. */
    async listUncommitted(): Promise<BrainDumpRecord[]> {
      const rows = await db
        .select()
        .from(brainDumps)
        .where(and(eq(brainDumps.userId, userId), isNull(brainDumps.committedAt)))
        .orderBy(desc(brainDumps.createdAt));
      return rows.map(toBrainDump);
    },
  };
}

export interface ProjectRecord {
  id: string;
  name: string;
  description: string | null;
  dueDate: string | null;
}

export interface GoalRecord {
  id: string;
  title: string;
  description: string | null;
  targetDate: string | null;
  status: "active" | "completed" | "archived";
}

function toGoal(row: typeof goals.$inferSelect): GoalRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    targetDate: row.targetDate,
    status: row.status,
  };
}

/** Every query that returns a ProjectRecord selects exactly these columns. */
const projectColumns = {
  id: projects.id,
  name: projects.name,
  description: projects.description,
  dueDate: projects.dueDate,
};

export function createProjectRepository(db: AppDb, userId: string) {
  return {
    async list(): Promise<ProjectRecord[]> {
      return db
        .select(projectColumns)
        .from(projects)
        .where(and(eq(projects.userId, userId), eq(projects.status, "active")))
        .orderBy(projects.name);
    },

    async get(id: string): Promise<ProjectRecord | undefined> {
      const rows = await db
        .select(projectColumns)
        .from(projects)
        .where(and(eq(projects.id, id), eq(projects.userId, userId)))
        .limit(1);
      return rows[0];
    },

    async updateOutcome(
      id: string,
      description: string | null,
      dueDate: string | null
    ): Promise<void> {
      await db
        .update(projects)
        .set({ description, dueDate, updatedAt: new Date() })
        .where(and(eq(projects.id, id), eq(projects.userId, userId)));
    },

    /** Case-insensitive, so "work" and "Work" don't become two projects. */
    async findOrCreate(name: string): Promise<ProjectRecord> {
      const trimmed = name.trim();
      const existing = await db
        .select(projectColumns)
        .from(projects)
        .where(
          and(eq(projects.userId, userId), sql`lower(${projects.name}) = lower(${trimmed})`)
        )
        .limit(1);
      if (existing[0]) return existing[0];
      const rows = await db
        .insert(projects)
        .values({ userId, name: trimmed })
        .returning(projectColumns);
      return rows[0];
    },
  };
}

export function createGoalRepository(db: AppDb, userId: string) {
  return {
    async list(): Promise<GoalRecord[]> {
      const rows = await db
        .select()
        .from(goals)
        .where(and(eq(goals.userId, userId), eq(goals.status, "active")))
        .orderBy(goals.title);
      return rows.map(toGoal);
    },

    async findOrCreate(input: {
      title: string;
      targetDate?: string | null;
      description?: string | null;
    }): Promise<GoalRecord> {
      const trimmed = input.title.trim();
      if (!trimmed) throw new Error("Goal title is required.");

      const existing = await db
        .select()
        .from(goals)
        .where(and(eq(goals.userId, userId), sql`lower(${goals.title}) = lower(${trimmed})`))
        .limit(1);
      if (existing[0]) return toGoal(existing[0]);

      const rows = await db
        .insert(goals)
        .values({
          userId,
          title: trimmed,
          targetDate: input.targetDate ?? null,
          description: input.description ?? null,
        })
        .returning();
      return toGoal(rows[0]);
    },

    async create(input: {
      title: string;
      targetDate?: string | null;
      description?: string | null;
    }): Promise<{ id: string }> {
      const created = await this.findOrCreate(input);
      return { id: created.id };
    },
  };
}

export function createRecurrenceRuleRepository(db: AppDb, userId: string) {
  return {
    async create(input: {
      title: string;
      frequency: "daily" | "weekly" | "monthly";
      timesPerPeriod: number;
      startDate: string;
    }): Promise<{ id: string }> {
      const rows = await db
        .insert(recurrenceRules)
        .values({ userId, ...input })
        .returning({ id: recurrenceRules.id });
      return rows[0];
    },

    async generateThrough(fromDate: string, throughDate: string): Promise<number> {
      const rules = await db
        .select()
        .from(recurrenceRules)
        .where(and(eq(recurrenceRules.userId, userId), isNull(recurrenceRules.stoppedAt)));
      let created = 0;
      for (const rule of rules) {
        const occurrences = occurrencesBetween(
          {
            frequency: rule.frequency,
            intervalCount: rule.intervalCount,
            timesPerPeriod: rule.timesPerPeriod,
            startDate: rule.startDate,
            endDate: rule.endDate,
            daysOfWeek: Array.isArray(rule.daysOfWeek) ? (rule.daysOfWeek as number[]) : null,
          },
          fromDate,
          throughDate
        );
        for (const occurrence of occurrences) {
          const inserted = await db
            .insert(tasks)
            .values({
              userId,
              title: rule.title,
              status: "todo",
              source: "recurrence",
              recurrenceRuleId: rule.id,
              occurrenceDate: occurrence.date,
              occurrenceSlot: occurrence.slot,
            })
            .onConflictDoNothing({
              target: [tasks.recurrenceRuleId, tasks.occurrenceDate, tasks.occurrenceSlot],
            })
            .returning({ id: tasks.id });
          created += inserted.length;
        }
      }
      return created;
    },

    async list() {
      return db
        .select({
          id: recurrenceRules.id,
          title: recurrenceRules.title,
          frequency: recurrenceRules.frequency,
          intervalCount: recurrenceRules.intervalCount,
          timesPerPeriod: recurrenceRules.timesPerPeriod,
          startDate: recurrenceRules.startDate,
          endDate: recurrenceRules.endDate,
          stoppedAt: recurrenceRules.stoppedAt,
        })
        .from(recurrenceRules)
        .where(eq(recurrenceRules.userId, userId))
        .orderBy(recurrenceRules.title);
    },

    async stop(id: string): Promise<void> {
      await db
        .update(recurrenceRules)
        .set({ stoppedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(recurrenceRules.id, id), eq(recurrenceRules.userId, userId)));
    },

    async occurrences(ruleId: string) {
      return db
        .select({
          id: tasks.id,
          title: tasks.title,
          status: tasks.status,
          occurrenceDate: tasks.occurrenceDate,
        })
        .from(tasks)
        .where(and(eq(tasks.userId, userId), eq(tasks.recurrenceRuleId, ruleId)))
        .orderBy(tasks.occurrenceDate);
    },
  };
}

export type TaskEventType =
  | "created"
  | "status_changed"
  | "priority_changed"
  | "postponed"
  | "completed"
  | "rescheduled";

export function createTaskEventRepository(db: AppDb, userId: string) {
  return {
    async record(input: {
      taskId: string;
      eventType: TaskEventType;
      fromStatus?: TaskStatus | null;
      toStatus?: TaskStatus | null;
    }): Promise<void> {
      await db.insert(taskEvents).values({
        userId,
        taskId: input.taskId,
        eventType: input.eventType,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus ?? null,
      });
    },

    async procrastinationCandidates(): Promise<Array<{ taskId: string; title: string }>> {
      const history = await db
        .select({ taskId: taskEvents.taskId, eventType: taskEvents.eventType })
        .from(taskEvents)
        .where(eq(taskEvents.userId, userId))
        .orderBy(desc(taskEvents.occurredAt));
      const recent = new Map<string, string[]>();
      for (const event of history) {
        const events = recent.get(event.taskId) ?? [];
        if (events.length < 3) recent.set(event.taskId, [...events, event.eventType]);
      }
      const ids = [...recent]
        .filter(
          ([, events]) => events.length === 3 && events.every((event) => event === "postponed")
        )
        .map(([taskId]) => taskId);
      if (ids.length === 0) return [];
      return db
        .select({ taskId: tasks.id, title: tasks.title })
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, userId),
            inArray(tasks.id, ids),
            sql`${tasks.status} IN ('todo','in_progress','postponed')`
          )
        )
        .orderBy(tasks.createdAt);
    },
  };
}

export function createUserRepository(db: AppDb, userId: string) {
  return {
    async nextTaskId(): Promise<string | null> {
      const [row] = await db
        .select({ preferences: users.preferences })
        .from(users)
        .where(eq(users.id, userId));
      const value = (row?.preferences as Record<string, unknown> | undefined)?.nextTaskId;
      return typeof value === "string" ? value : null;
    },

    async chooseNext(taskId: string | null): Promise<void> {
      await db
        .update(users)
        .set({
          preferences: sql`${users.preferences} || jsonb_build_object('nextTaskId', ${taskId}::text)`,
        })
        .where(eq(users.id, userId));
    },
    /** Creates the user row if it doesn't exist yet. Idempotent. */
    async profile() {
      const [row] = await db.select().from(users).where(eq(users.id, userId));
      return row ? { ...row, preferences: row.preferences as Record<string, unknown> } : null;
    },
    async savePreferences(timezone: string, preferences: Record<string, unknown>) {
      await db
        .update(users)
        .set({
          timezone,
          preferences: sql`${users.preferences} || ${JSON.stringify(preferences)}::jsonb`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
    },
    async ensure(input: { name: string; email: string; authId?: string }): Promise<void> {
      const insert = db.insert(users).values({
        id: userId,
        name: input.name,
        email: input.email,
        authId: input.authId ?? null,
      });
      // users.auth_id is what makes deleting the login cascade to every row
      // the person owns (migration 0004). An unlinked row survives account
      // deletion, so link it even when the row already exists.
      if (input.authId) {
        await insert.onConflictDoUpdate({ target: users.id, set: { authId: input.authId } });
      } else {
        await insert.onConflictDoNothing();
      }
    },
  };
}

export function createAiUsageRepository(db: AppDb, userId: string) {
  return {
    /**
     * Records one AI request if the user has made fewer than `limit` since
     * `since`; returns whether it was allowed. The advisory lock serialises
     * one user's concurrent claims, so parallel requests can't all slip
     * under the limit. It is transaction-scoped and released on commit.
     */
    async claim(limit: number, since: Date): Promise<boolean> {
      await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
      await db
        .delete(aiRequests)
        .where(and(eq(aiRequests.userId, userId), lt(aiRequests.createdAt, since)));
      const [{ used }] = await db
        .select({ used: count() })
        .from(aiRequests)
        .where(and(eq(aiRequests.userId, userId), gte(aiRequests.createdAt, since)));
      if (used >= limit) return false;
      await db.insert(aiRequests).values({ userId });
      return true;
    },
  };
}
