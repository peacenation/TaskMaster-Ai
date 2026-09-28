import type { NewTask, Task, TaskRepository } from "./task-repository";

/**
 * Array-backed adapter — used in tests and any dev workflow that doesn't
 * need real persistence. See docs/adr/ADR-005-repository-boundary.md.
 * The Phase 3 Postgres adapter must satisfy the same contract this class
 * does; see docs/adr/ADR-008-testing-strategy.md's contract-test note.
 */
export class InMemoryTaskRepository implements TaskRepository {
  private tasks: Task[] = [];
  private nextPosition = 0;

  async list(userId: string): Promise<Task[]> {
    return this.tasks
      .filter((t) => t.userId === userId)
      .sort((a, b) => a.position - b.position);
  }

  async get(id: string): Promise<Task | undefined> {
    return this.tasks.find((t) => t.id === id);
  }

  async create(input: NewTask): Promise<Task> {
    const task: Task = {
      id: crypto.randomUUID(),
      userId: input.userId,
      text: input.text,
      status: "pending",
      position: input.position ?? this.nextPosition++,
      createdAt: new Date(),
    };
    this.tasks.push(task);
    return task;
  }

  async update(id: string, patch: Partial<Omit<Task, "id" | "userId">>): Promise<Task> {
    const index = this.tasks.findIndex((t) => t.id === id);
    if (index === -1) throw new Error(`Task not found: ${id}`);
    const updated = { ...this.tasks[index], ...patch };
    this.tasks[index] = updated;
    return updated;
  }

  async remove(id: string): Promise<void> {
    this.tasks = this.tasks.filter((t) => t.id !== id);
  }
}
