import { z } from "zod";
import { localDateString } from "@/lib/domain/dates";
import { itemKindSchema } from "@/lib/domain/proposal";
import type { Repositories } from "@/lib/repo";

// Commit a reviewed Brain Dump (Phase 5 work item 5). Nothing reaches the
// user's lists until this runs, and it runs inside one transaction
// (withRepositories): every task, project, goal, and habit is created, or
// none are. On failure the review screen keeps its state and the raw dump
// stays saved.

/** One row as the user left it on the review screen. Validated at the server boundary. */
export const reviewedItemSchema = z.object({
  kind: itemKindSchema,
  title: z.string().trim().min(1).max(500),
  dueAt: z.string().datetime({ offset: true }).nullable(),
  recurrence: z
    .object({
      frequency: z.enum(["daily", "weekly", "monthly"]),
      timesPerPeriod: z.number().int().min(1).max(31),
    })
    .nullable(),
  estimatedMinutes: z.number().int().min(1).max(1440).nullable(),
  project: z.string().trim().min(1).max(200).nullable(),
  importance: z.number().int().min(1).max(5).nullable(),
});
export type ReviewedItem = z.infer<typeof reviewedItemSchema>;

export const commitInputSchema = z.object({
  /** Null when the dump couldn't be saved earlier (offline); it's saved now. */
  dumpId: z.string().uuid().nullable(),
  rawText: z.string().min(1).max(20_000),
  timeZone: z.string().min(1).max(100),
  items: z.array(reviewedItemSchema).min(1).max(200),
});
export type CommitInput = z.infer<typeof commitInputSchema>;

export interface CommitSummary {
  dumpId: string;
  tasks: number;
  projects: number;
  goals: number;
  habits: number;
  notes: number;
}

export async function commitReviewedItems(
  repos: Repositories,
  input: CommitInput,
  now: Date
): Promise<CommitSummary> {
  const dumpId = input.dumpId ?? (await repos.brainDumps.create(input.rawText)).id;
  const summary: CommitSummary = {
    dumpId,
    tasks: 0,
    projects: 0,
    goals: 0,
    habits: 0,
    notes: 0,
  };

  for (const item of input.items) {
    switch (item.kind) {
      case "task": {
        const project = item.project ? await repos.projects.findOrCreate(item.project) : null;
        const task = await repos.tasks.create({
          title: item.title,
          dueAt: item.dueAt ? new Date(item.dueAt) : null,
          estimatedMinutes: item.estimatedMinutes,
          importance: item.importance,
          projectId: project?.id ?? null,
          source: "brain_dump",
          status: "todo",
        });
        await repos.taskEvents.record({
          taskId: task.id,
          eventType: "created",
          toStatus: "todo",
        });
        summary.tasks++;
        break;
      }
      case "project":
        await repos.projects.findOrCreate(item.title);
        summary.projects++;
        break;
      case "goal":
        await repos.goals.create({
          title: item.title,
          targetDate: item.dueAt
            ? localDateString(new Date(item.dueAt), input.timeZone)
            : null,
        });
        summary.goals++;
        break;
      case "recurring":
        await repos.recurrenceRules.create({
          title: item.title,
          // A row switched to "recurring" during review may have no cadence yet.
          frequency: item.recurrence?.frequency ?? "weekly",
          timesPerPeriod: item.recurrence?.timesPerPeriod ?? 1,
          startDate: localDateString(now, input.timeZone),
        });
        summary.habits++;
        break;
      case "note":
        // No notes entity exists in PRD §1.10. Notes stay with the dump's
        // retained proposal rather than becoming tasks (§2.2 "Notes vs
        // Tasks Detection": don't turn every thought into an action).
        summary.notes++;
        break;
    }
  }

  await repos.brainDumps.markCommitted(dumpId);
  return summary;
}
