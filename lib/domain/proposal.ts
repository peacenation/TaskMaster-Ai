import { z } from "zod";

// The one contract both extraction engines emit — the heuristic
// (lib/domain/extract.ts) and the AI route (app/api/extract/route.ts). The
// review UI never branches on which engine produced a proposal
// (IMPLEMENTATION_PLAN.md Phase 4, work item 3); `engine` exists only so
// the UI can tell the user which one ran (ADR-007, PRD §2.6).

export const itemKindSchema = z.enum(["task", "project", "goal", "note", "recurring"]);
export type ItemKind = z.infer<typeof itemKindSchema>;

export const proposedDeadlineSchema = z.object({
  /** ISO 8601 date-time. */
  at: z.string().datetime({ offset: true }),
  /** 0–1. Below LOW_CONFIDENCE the UI shows it as a suggestion, not a fact. */
  confidence: z.number().min(0).max(1),
  /** The words the date was read from, so the UI can show its working. */
  source: z.string(),
});
export type ProposedDeadline = z.infer<typeof proposedDeadlineSchema>;

export const proposedItemSchema = z.object({
  kind: itemKindSchema,
  title: z.string().min(1).max(500),
  deadline: proposedDeadlineSchema.nullable(),
  recurrence: z
    .object({
      frequency: z.enum(["daily", "weekly", "monthly"]),
      timesPerPeriod: z.number().int().min(1).max(31),
    })
    .nullable(),
  estimatedMinutes: z
    .number()
    .int()
    .min(1)
    .max(24 * 60)
    .nullable(),
  /** Suggested project name for grouping; null if none inferred. */
  project: z.string().min(1).max(200).nullable(),
});
export type ProposedItem = z.infer<typeof proposedItemSchema>;

export const extractionProposalSchema = z.object({
  engine: z.enum(["heuristic", "ai"]),
  items: z.array(proposedItemSchema).max(200),
});
export type ExtractionProposal = z.infer<typeof extractionProposalSchema>;

export const LOW_CONFIDENCE = 0.7;
