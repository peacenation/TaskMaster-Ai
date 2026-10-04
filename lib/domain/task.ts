// The task shape the planning engine reasons about — richer than the
// Phase 2 TaskRepository placeholder (`text`/`status`/`position`), and
// mapped from the `tasks` table by whichever adapter feeds it. Kept free of
// database and framework types so every domain module stays pure (D4).

export type TaskStatus = "inbox" | "todo" | "in_progress" | "completed" | "postponed" | "dropped";
export type Energy = "low" | "medium" | "high";

export interface PlannableTask {
  id: string;
  title: string;
  status: TaskStatus;
  /** The user's own explicit priority, 1 (low) to 5 (high). */
  priority: number | null;
  urgency: number | null;
  importance: number | null;
  dueAt: Date | null;
  estimatedMinutes: number | null;
  energy: Energy | null;
  projectId: string | null;
  goalId: string | null;
  /** Ids of tasks that must be done before this one. */
  dependsOn: string[];
  /** Last time the user made progress on it; falls back to createdAt. */
  lastProgressAt: Date | null;
  createdAt: Date;
}

export interface PlanningContext {
  now: Date;
  /** The user's timezone; "due today" means today where they are. Defaults to UTC. */
  timeZone?: string;
  /** Minutes available right now, if the user said ("I have 20 minutes"). */
  availableMinutes?: number;
  /** The user's current energy, if they said. */
  energy?: Energy;
  focusProjectId?: string;
}

export function isOpen(task: PlannableTask): boolean {
  return task.status !== "completed" && task.status !== "dropped";
}

/** Waiting on another task that isn't finished yet. */
export function isBlocked(task: PlannableTask, byId: Map<string, PlannableTask>): boolean {
  return task.dependsOn.some((id) => {
    const dependency = byId.get(id);
    return dependency !== undefined && isOpen(dependency);
  });
}

export function makeTask(
  overrides: Partial<PlannableTask> & Pick<PlannableTask, "id" | "title">
): PlannableTask {
  return {
    status: "todo",
    priority: null,
    urgency: null,
    importance: null,
    dueAt: null,
    estimatedMinutes: null,
    energy: null,
    projectId: null,
    goalId: null,
    dependsOn: [],
    lastProgressAt: null,
    createdAt: new Date(0),
    ...overrides,
  };
}
