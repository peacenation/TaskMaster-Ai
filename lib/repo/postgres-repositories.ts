import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { AppDb } from "@/lib/db/client";
import {
  brainDumps,
  goals,
  projects,
  recurrenceRules,
  taskEvents,
  users,
} from "@/lib/db/schema";
import type { ExtractionProposal } from "@/lib/domain/proposal";
import type { TaskStatus } from "@/lib/domain/task";

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
}

export function createProjectRepository(db: AppDb, userId: string) {
  return {
    async list(): Promise<ProjectRecord[]> {
      return db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(and(eq(projects.userId, userId), eq(projects.status, "active")))
        .orderBy(projects.name);
    },

    /** Case-insensitive, so "work" and "Work" don't become two projects. */
    async findOrCreate(name: string): Promise<ProjectRecord> {
      const trimmed = name.trim();
      const existing = await db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(
          and(eq(projects.userId, userId), sql`lower(${projects.name}) = lower(${trimmed})`)
        )
        .limit(1);
      if (existing[0]) return existing[0];
      const rows = await db
        .insert(projects)
        .values({ userId, name: trimmed })
        .returning({ id: projects.id, name: projects.name });
      return rows[0];
    },
  };
}

export function createGoalRepository(db: AppDb, userId: string) {
  return {
    async create(input: {
      title: string;
      targetDate: string | null;
    }): Promise<{ id: string }> {
      const rows = await db
        .insert(goals)
        .values({ userId, title: input.title, targetDate: input.targetDate })
        .returning({ id: goals.id });
      return rows[0];
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
  };
}

export function createUserRepository(db: AppDb, userId: string) {
  return {
    /** Creates the user row if it doesn't exist yet. Idempotent. */
    async ensure(input: { name: string; email: string }): Promise<void> {
      await db
        .insert(users)
        .values({ id: userId, name: input.name, email: input.email })
        .onConflictDoNothing();
    },
  };
}
