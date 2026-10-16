import { describe, expect, it } from "vitest";
import {
  actualMinutes,
  learnedSummary,
  learnEstimates,
  NO_LEARNING,
  plannedMinutes,
} from "./learning";

const s = (estimatedMinutes: number | null, actual: number) => ({
  estimatedMinutes,
  actualMinutes: actual,
});

describe("learned estimates", () => {
  it("doesn't adjust anything until there's enough evidence", () => {
    expect(learnEstimates([s(30, 60), s(30, 60), s(30, 60), s(30, 60)])).toEqual({
      factor: 1,
      typicalMinutes: 30,
      samples: 4,
    });
    expect(plannedMinutes(45)).toBe(45);
    expect(plannedMinutes(null)).toBe(30);
    expect(learnedSummary(NO_LEARNING)).toBeNull();
  });

  it("learns a median ratio that one outlier can't skew, and a typical length", () => {
    const learned = learnEstimates([
      s(30, 45),
      s(60, 90),
      s(20, 30),
      s(40, 60),
      s(10, 400), // left open by mistake
      s(null, 25),
    ]);
    expect(learned.factor).toBe(1.5);
    expect(learned.typicalMinutes).toBe(55); // median of 25,30,45,60,90,400 is 52.5
    expect(plannedMinutes(30, learned)).toBe(45);
    expect(plannedMinutes(null, learned)).toBe(55);
    expect(learnedSummary(learned)).toMatch(/1\.5× your estimate/);
  });

  it("keeps the factor within sensible bounds", () => {
    expect(learnEstimates(Array.from({ length: 6 }, () => s(10, 300))).factor).toBe(2.5);
    expect(learnEstimates(Array.from({ length: 6 }, () => s(100, 10))).factor).toBe(0.5);
  });

  it("only believes plausible durations", () => {
    const start = new Date("2026-10-16T09:00:00Z");
    expect(actualMinutes(start, new Date("2026-10-16T09:42:00Z"))).toBe(42);
    expect(actualMinutes(start, new Date("2026-10-17T09:00:00Z"))).toBeNull();
    expect(actualMinutes(start, start)).toBeNull();
    expect(actualMinutes(null, start)).toBeNull();
  });
});
