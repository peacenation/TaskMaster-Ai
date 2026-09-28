// The only seam allowed to reach storage — see docs/adr/ADR-005-repository-boundary.md.
// No caller of this interface may import a database client directly.

export type TaskStatus = "pending" | "completed";

export interface Task {
  id: string;
  userId: string;
  text: string;
  status: TaskStatus;
  position: number;
  createdAt: Date;
}

export type NewTask = Pick<Task, "userId" | "text"> & Partial<Pick<Task, "position">>;

export interface TaskRepository {
  list(userId: string): Promise<Task[]>;
  get(id: string): Promise<Task | undefined>;
  create(input: NewTask): Promise<Task>;
  update(id: string, patch: Partial<Omit<Task, "id" | "userId">>): Promise<Task>;
  remove(id: string): Promise<void>;
}
