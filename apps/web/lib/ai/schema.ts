import { z } from "zod";
import { extractionProposalSchema, type ExtractionProposal } from "@/lib/domain/proposal";

// What the model is asked to emit — deliberately looser than the domain
// contract (no numeric bounds, no datetime format). Structured outputs
// constrain the *shape*; the strict checks happen in toProposal(), on our
// side, where a failure means "fall back to the heuristic", not "the API
// rejected the schema on every request".
export const aiExtractionSchema = z.object({
  items: z.array(
    z.object({
      kind: z.enum(["task", "project", "goal", "note", "recurring"]),
      title: z.string(),
      deadline: z
        .object({
          at: z.string(),
          confidence: z.number(),
          source: z.string(),
        })
        .nullable(),
      recurrence: z
        .object({
          frequency: z.enum(["daily", "weekly", "monthly"]),
          timesPerPeriod: z.number(),
        })
        .nullable(),
      estimatedMinutes: z.number().nullable(),
      project: z.string().nullable(),
    })
  ),
});
export type AiExtraction = z.infer<typeof aiExtractionSchema>;

/**
 * The gate between model output and anything stored (PRD §2.7: "The raw AI
 * response must not directly mutate stored user data without validation").
 * Throws a ZodError if the response breaks the domain contract.
 */
export function toProposal(output: unknown): ExtractionProposal {
  const loose = aiExtractionSchema.parse(output);
  return extractionProposalSchema.parse({ engine: "ai", items: loose.items });
}
