import type { ExtractionProposal } from "@/lib/domain/proposal";

// AI correction rate (PRD §2.9): how much of what was proposed from a
// Brain Dump the person had to change before saving. An item counts as
// accepted when it was saved with the same kind, title and due date it
// was proposed with; anything renamed, re-dated, re-kinded or added is a
// correction, and proposed items that were dropped are removals.

export interface CorrectionStats {
  proposed: number;
  saved: number;
  accepted: number;
  corrected: number;
  removed: number;
}

const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");
const key = (kind: string, title: string, due: string | null | undefined) =>
  `${kind}\u0000${title.trim().toLowerCase()}\u0000${day(due)}`;

export function correctionStats(
  proposal: ExtractionProposal | null | undefined,
  saved: ReadonlyArray<{ kind: string; title: string; dueAt: string | null }>
): CorrectionStats {
  const pool = new Map<string, number>();
  for (const item of proposal?.items ?? []) {
    const k = key(item.kind, item.title, item.deadline?.at);
    pool.set(k, (pool.get(k) ?? 0) + 1);
  }
  let accepted = 0;
  for (const item of saved) {
    const k = key(item.kind, item.title, item.dueAt);
    const left = pool.get(k) ?? 0;
    if (left > 0) {
      accepted++;
      pool.set(k, left - 1);
    }
  }
  const proposed = proposal?.items.length ?? 0;
  const corrected = saved.length - accepted;
  return {
    proposed,
    saved: saved.length,
    accepted,
    corrected,
    removed: Math.max(0, proposed - accepted - corrected),
  };
}
