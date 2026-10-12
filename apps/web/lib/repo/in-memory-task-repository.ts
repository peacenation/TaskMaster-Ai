import {
  TASK_DEFAULTS,
  type NewTask,
  type TaskDependency,
  type TaskPatch,
  type TaskRecord,
  type TaskRepository,
} from "./task-repository";

/**
 * Array-backed adapter for tests and dev without Postgres (ADR-005). The
 * store is shared; each repository is a view of it bound to one user,
 * mirroring how RLS scopes the Postgres adapter. Must satisfy the same
 * contract as the Postgres adapter — see the paired test files.
 */
export interface InMemoryStore {
  tasks: TaskRecord[];
  dependencies: Array<TaskDependency & { userId: string }>;
}

export function createInMemoryStore(): InMemoryStore {
  return { tasks: [], dependencies: [] };
}

export function createInMemoryTaskRepository(
  store: InMemoryStore,
  userId: string
): TaskRepository {
  const mine = () => store.tasks.filter((t) => t.userId === userId);
  let clock = 0;
  // Strictly increasing timestamps, so "oldest first" is well defined even
  // when tasks are created within the same millisecond.
  const stamp = () => new Date(Math.max(Date.now(), clock + 1)).getTime();

  return {
    async list(filter) {
      return mine()
        .filter((t) => !filter?.statuses || filter.statuses.includes(t.status))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    },

    async get(id) {
      return mine().find((t) => t.id === id);
    },

    async create(input: NewTask) {
      clock = stamp();
      const now = new Date(clock);
      const task: TaskRecord = {
        ...TASK_DEFAULTS,
        ...input,
        id: crypto.randomUUID(),
        userId,
        createdAt: now,
        updatedAt: now,
      };
      store.tasks.push(task);
      return task;
    },

    async update(id, patch: TaskPatch) {
      const index = store.tasks.findIndex((t) => t.id === id && t.userId === userId);
      if (index === -1) throw new Error(`Task not found: ${id}`);
      const updated = { ...store.tasks[index], ...patch, updatedAt: new Date() };
      store.tasks[index] = updated;
      return updated;
    },

    async remove(id) {
      store.tasks = store.tasks.filter((t) => !(t.id === id && t.userId === userId));
    },

    async dependencies() {
      return store.dependencies
        .filter((d) => d.userId === userId)
        .map(({ taskId, dependsOnTaskId }) => ({ taskId, dependsOnTaskId }));
    },
  };
}
