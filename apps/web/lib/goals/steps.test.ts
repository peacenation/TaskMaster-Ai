import { describe, expect, it } from "vitest";
import { cleanSteps, MAX_STEPS, rulesGoalSteps } from "./steps";

describe("goal steps", () => {
  it("has a template for common goals and a generic fallback", () => {
    expect(rulesGoalSteps("Run a 10k by March").steps[0].title).toMatch(/training plan/);
    expect(rulesGoalSteps("Learn Spanish").steps[0].title).toBe(
      "Choose one course or book for Spanish"
    );
    expect(rulesGoalSteps("Save £5,000").steps.length).toBeGreaterThanOrEqual(3);
    expect(rulesGoalSteps("Renovate the garden").steps[0].title).toContain(
      '"Renovate the garden"'
    );
  });

  it("cleans suggestions: trims, drops blanks and duplicates, skips planned steps, caps", () => {
    const steps = cleanSteps(
      [
        { title: "  Book a  lesson ", estimatedMinutes: 2 },
        { title: "book a lesson", estimatedMinutes: 30 },
        { title: "", estimatedMinutes: 10 },
        { title: "Buy a textbook", estimatedMinutes: 999 },
        ...Array.from({ length: 10 }, (_, i) => ({
          title: `Step ${i}`,
          estimatedMinutes: null,
        })),
      ],
      ["Buy a textbook"]
    );
    expect(steps[0]).toEqual({ title: "Book a lesson", estimatedMinutes: 5 });
    expect(steps.map((s) => s.title)).not.toContain("Buy a textbook");
    expect(steps).toHaveLength(MAX_STEPS);
  });
});
