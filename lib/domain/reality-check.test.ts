import { describe, expect, it } from "vitest";
import { realityCheckSummary } from "./reality-check";

describe("realityCheckSummary", () => {
  it("reports exact excess work over usable capacity", () => {
    expect(realityCheckSummary(540, 300)).toEqual({
      workMinutes: 540,
      usableMinutes: 300,
      excessMinutes: 240,
    });
  });

  it("does not trigger when the work fits exactly or below capacity", () => {
    expect(realityCheckSummary(300, 300)).toBeNull();
    expect(realityCheckSummary(240, 300)).toBeNull();
  });
});