import { describe, expect, it } from "vitest";
import { goalProgress } from "./goal-progress";

describe("goalProgress", () => {
  it("flags a goal with no linked work", () => {
    expect(goalProgress("g", [{ goalId: "other", status: "todo" }])).toEqual({
      linked: 0,
      active: 0,
      completed: 0,
      nudge: "unlinked",
    });
  });

  it("flags a goal whose only open work is postponed", () => {
    const result = goalProgress("g", [
      { goalId: "g", status: "postponed" },
      { goalId: "g", status: "completed" },
    ]);
    expect(result).toMatchObject({ linked: 2, active: 0, completed: 1, nudge: "stalled" });
  });

  it("is quiet while something active moves the goal, and ignores dropped work", () => {
    const result = goalProgress("g", [
      { goalId: "g", status: "in_progress" },
      { goalId: "g", status: "dropped" },
    ]);
    expect(result).toEqual({ linked: 1, active: 1, completed: 0, nudge: null });
  });

  it("is quiet once every linked task is done", () => {
    expect(goalProgress("g", [{ goalId: "g", status: "completed" }]).nudge).toBeNull();
  });
});
