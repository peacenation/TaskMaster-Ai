import { z } from "zod";

// What the AI Planner asks Claude for (structured output). Validation of
// task ids, times and overlaps happens afterwards, in plan.ts — the model's
// output is a suggestion, never trusted as-is.
export const plannerOutputSchema = z.object({
  /** One or two friendly sentences explaining the plan. */
  reply: z.string(),
  blocks: z.array(
    z.object({
      /** "task" must reference a task id from the list; "break"/"event" have none. */
      kind: z.enum(["task", "break", "event"]),
      taskId: z.string().nullable(),
      /** For breaks and events: what it is (e.g. "Lunch", "Team meeting"). */
      label: z.string(),
      /** Local 24-hour start time, HH:MM. */
      start: z.string(),
      minutes: z.number().int(),
    })
  ),
});
export type PlannerOutput = z.infer<typeof plannerOutputSchema>;
