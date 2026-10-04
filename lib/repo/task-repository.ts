import type { Energy, TaskStatus } from "@/lib/domain/task";

// The only seam allowed to reach task storage — see
// docs/adr/ADR-005-repository-boundary.md. No caller may import a
// database client directly.
//
// Phase 5 replaced Phase 2's placeholder shape (`text`/`position`) with the
// real fields, as ADR-005 anticipated. Every repository instance is bound
// to one user for its lifetime (ADR-005's Phase 3 note): with Postgres,
// that's what row-level security scopes against.

export type TaskSource = "brain_dump" | "quick_add" | "manual" | "recurrence";

export interface TaskRecord {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  parentTaskId: string | null;
  status: TaskStatus;
  priority: number | null;
  urgency: number | null;
  importance: number | null;
  dueAt: Date | null;
  estimatedMinutes: number | null;
  energy: Energy | null;
  projectId: string | null;
  goalId: string | null;
  source: TaskSource;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

type Editable = Omit<TaskRecord, "id" | "userId" | "createdAt" | "updatedAt">;

export type NewTask = Pick<TaskRecord, "title"> & Partial<Editable>;
export type TaskPatch = Partial<Omit<Editable, "source">>;

export interface TaskDependency {
  taskId: string;
  dependsOnTaskId: string;
}

export interface TaskRepository {
  /** The user's tasks, oldest first, optionally filtered by status. */
  list(filter?: { statuses?: TaskStatus[] }): Promise<TaskRecord[]>;
  get(id: string): Promise<TaskRecord | undefined>;
  create(input: NewTask): Promise<TaskRecord>;
  /** Throws if the task doesn't exist (or isn't this user's). */
  update(id: string, patch: TaskPatch): Promise<TaskRecord>;
  remove(id: string): Promise<void>;
  dependencies(): Promise<TaskDependency[]>;
}

export const TASK_DEFAULTS: Omit<Editable, "title"> = {
  description: null,
  parentTaskId: null,
  status: "todo",
  priority: null,
  urgency: null,
  importance: null,
  dueAt: null,
  estimatedMinutes: null,
  energy: null,
  projectId: null,
  goalId: null,
  source: "manual",
  completedAt: null,
};
