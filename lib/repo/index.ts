import { withUserContext } from "@/lib/db/client";
import { createPostgresTaskRepository } from "./postgres-task-repository";
import {
  createBrainDumpRepository,
  createGoalRepository,
  createProjectRepository,
  createRecurrenceRuleRepository,
  createTaskEventRepository,
  createUserRepository,
} from "./postgres-repositories";

export function createRepositories(
  db: Parameters<typeof createPostgresTaskRepository>[0],
  userId: string
) {
  return {
    users: createUserRepository(db, userId),
    tasks: createPostgresTaskRepository(db, userId),
    taskEvents: createTaskEventRepository(db, userId),
    brainDumps: createBrainDumpRepository(db, userId),
    projects: createProjectRepository(db, userId),
    goals: createGoalRepository(db, userId),
    recurrenceRules: createRecurrenceRuleRepository(db, userId),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;

/**
 * The one way application code reaches the database: every repository,
 * bound to `userId`, sharing a single transaction with RLS scoped to that
 * user (ADR-004, ADR-005). Everything `fn` does commits or rolls back
 * together — which is what makes a Brain Dump commit atomic.
 */
export function withRepositories<T>(
  userId: string,
  fn: (repos: Repositories) => Promise<T>
): Promise<T> {
  return withUserContext(userId, (tx) => fn(createRepositories(tx, userId)));
}
