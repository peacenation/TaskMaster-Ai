import { describe, expect, it } from "vitest";
import type { ExtractionProposal } from "@/lib/domain/proposal";
import { correctionStats } from "./corrections";

const item = (title: string, at: string | null = null, kind = "task") => ({
  kind,
  title,
  deadline: at ? { at, confidence: 0.9, source: "by Friday" } : null,
  recurrence: null,
  estimatedMinutes: null,
  project: null,
});
const proposal = (items: ReturnType<typeof item>[]) =>
  ({ items }) as unknown as ExtractionProposal;
const saved = (title: string, dueAt: string | null = null, kind = "task") => ({
  kind,
  title,
  dueAt,
});

describe("correctionStats", () => {
  it("counts everything saved as proposed as accepted", () => {
    expect(
      correctionStats(proposal([item("Book the dentist"), item("Call Mum")]), [
        saved("Book the dentist"),
        saved("call mum"),
      ])
    ).toEqual({ proposed: 2, saved: 2, accepted: 2, corrected: 0, removed: 0 });
  });

  it("treats renames, new dates and new kinds as corrections, and dropped items as removals", () => {
    const stats = correctionStats(
      proposal([
        item("Finish report", "2026-10-16T17:00:00Z"),
        item("Gym"),
        item("Garage"),
        item("Maybe learn piano"),
      ]),
      [
        saved("Finish the Q3 report", "2026-10-16T17:00:00Z"), // renamed
        saved("Gym", null, "recurring"), // re-kinded
        saved("Garage"), // as proposed
      ]
    );
    expect(stats).toEqual({ proposed: 4, saved: 3, accepted: 1, corrected: 2, removed: 1 });
  });

  it("handles a dump saved without a proposal (offline)", () => {
    expect(correctionStats(null, [saved("A")])).toEqual({
      proposed: 0,
      saved: 1,
      accepted: 0,
      corrected: 1,
      removed: 0,
    });
  });
});
