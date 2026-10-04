import { describe, expect, it } from "vitest";
import { joinAnd, nextBestAction } from "./nextBestAction";
import { makeTask } from "./task";

const context = { now: new Date("2026-10-05T08:00:00Z"), timeZone: "Europe/London" };

describe("nextBestAction", () => {
  it("returns null when nothing is actionable", () => {
    expect(nextBestAction([], context)).toBeNull();
    const onlyBlocked = [
      makeTask({ id: "a", title: "a", dependsOn: ["b"] }),
      makeTask({ id: "b", title: "b", dependsOn: ["a"] }),
    ];
    expect(nextBestAction(onlyBlocked, context)).toBeNull();
  });

  it("never recommends a blocked task, however high it scores", () => {
    const tasks = [
      makeTask({
        id: "blocked",
        title: "Blocked",
        priority: 5,
        importance: 5,
        dependsOn: ["first"],
      }),
      makeTask({ id: "first", title: "Do the first thing" }),
    ];
    expect(nextBestAction(tasks, context)?.task.id).toBe("first");
  });

  it("phrases the reason the way PRD §2.3 does", () => {
    const tasks = [
      makeTask({
        id: "proposal",
        title: "Work on the client proposal",
        importance: 5,
        dueAt: new Date("2026-10-06T16:00:00Z"),
      }),
      makeTask({ id: "x", title: "x", dependsOn: ["proposal"] }),
      makeTask({ id: "y", title: "y", dependsOn: ["proposal"] }),
    ];
    expect(nextBestAction(tasks, context)?.message).toBe(
      "Work on the client proposal next — it's due tomorrow, it's marked important, and 2 other tasks depend on it."
    );
  });

  it("still says what to do when there's no particular reason", () => {
    expect(
      nextBestAction([makeTask({ id: "a", title: "Water the plants" })], context)?.message
    ).toBe("Water the plants next.");
  });

  it("names time as the constraint when only time displaced the top task", () => {
    const tasks = [
      makeTask({ id: "long", title: "Long task", importance: 5, estimatedMinutes: 120 }),
      makeTask({ id: "short", title: "Short task", estimatedMinutes: 10 }),
    ];
    const result = nextBestAction(tasks, { ...context, availableMinutes: 15 });
    expect(result?.task.id).toBe("short");
    expect(result?.message).toMatch(
      /^You don't have enough time for meaningful progress on "Long task"/
    );
  });

  it("names energy as the constraint when only energy displaced the top task", () => {
    const tasks = [
      makeTask({ id: "hard", title: "Hard task", importance: 5, energy: "high" }),
      makeTask({ id: "easy", title: "Easy task", importance: 4, energy: "low" }),
    ];
    const result = nextBestAction(tasks, { ...context, energy: "low" });
    expect(result?.task.id).toBe("easy");
    expect(result?.message).toMatch(/^You don't have enough energy for/);
  });

  it("doesn't mention a displaced task when the constraint didn't change the answer", () => {
    const tasks = [
      makeTask({ id: "a", title: "Quick thing", importance: 5, estimatedMinutes: 5 }),
    ];
    const result = nextBestAction(tasks, { ...context, availableMinutes: 30 });
    expect(result?.displaced).toBeNull();
    expect(result?.message).toMatch(/^Quick thing next/);
  });
});

describe("joinAnd", () => {
  it.each([
    [[], ""],
    [["a"], "a"],
    [["a", "b"], "a and b"],
    [["a", "b", "c"], "a, b, and c"],
  ])("%j → %s", (parts, expected) => {
    expect(joinAnd(parts)).toBe(expected);
  });
});
