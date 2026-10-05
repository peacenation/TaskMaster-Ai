import { describe, expect, it } from "vitest";
import { MAX_INSIGHTS, weeklyInsights, type InsightInput } from "./insights";

const now = new Date("2026-10-05T09:00:00Z"); // Monday, London
const task = (
  id: string,
  overrides: Partial<InsightInput["tasks"][number]> = {}
): InsightInput["tasks"][number] => ({
  id,
  title: `Task ${id}`,
  status: "todo",
  goalId: null,
  dueAt: null,
  ...overrides,
});
const input = (overrides: Partial<InsightInput>): InsightInput => ({
  goals: [],
  tasks: [],
  events: [],
  now,
  timeZone: "Europe/London",
  ...overrides,
});
const postponed = (taskId: string) => ({ taskId, eventType: "postponed" });

describe("weeklyInsights", () => {
  it("says nothing when there is no pattern", () => {
    expect(weeklyInsights(input({ tasks: [task("a")] }))).toEqual([]);
  });

  it("suggests a smaller step for the open task postponed most often", () => {
    const [insight] = weeklyInsights(
      input({
        tasks: [task("a", { title: "Garage" }), task("b", { title: "Taxes" })],
        events: [
          postponed("a"),
          postponed("a"),
          postponed("b"),
          postponed("b"),
          postponed("b"),
        ],
      })
    );
    expect(insight).toMatchObject({ kind: "repeated_postponement", href: "/tasks/b" });
    expect(insight.message).toContain('"Taxes" 3 times');
  });

  it("ignores a single postponement and tasks already finished", () => {
    const found = weeklyInsights(
      input({
        tasks: [
          task("a"),
          task("b", { status: "completed" }),
          task("c", { status: "dropped" }),
        ],
        events: [
          postponed("a"),
          postponed("b"),
          postponed("b"),
          postponed("c"),
          postponed("c"),
        ],
      })
    );
    expect(found).toEqual([]);
  });

  it("says 'twice' rather than '2 times'", () => {
    const [insight] = weeklyInsights(
      input({
        tasks: [task("a", { title: "Garage" })],
        events: [postponed("a"), postponed("a")],
      })
    );
    expect(insight.message).toContain('"Garage" twice');
  });

  it("flags a goal with open work and nothing completed this week", () => {
    const found = weeklyInsights(
      input({
        goals: [
          { id: "g1", title: "Run a 10k" },
          { id: "g2", title: "Learn Spanish" },
          { id: "g3", title: "Empty goal" },
        ],
        tasks: [
          task("a", { goalId: "g1" }),
          task("b", { goalId: "g2" }),
          task("c", { goalId: "g2", status: "completed" }),
        ],
        events: [{ taskId: "c", eventType: "completed" }],
      })
    );
    expect(found).toEqual([
      expect.objectContaining({
        kind: "neglected_goal",
        href: "/goals",
        message: expect.stringContaining("Run a 10k"),
      }),
    ]);
  });

  it("points at the earliest of three deadlines landing on the same local day", () => {
    const [insight] = weeklyInsights(
      input({
        tasks: [
          task("a", { title: "Report", dueAt: new Date("2026-10-08T16:00:00Z") }),
          task("b", { title: "Invoice", dueAt: new Date("2026-10-08T09:00:00Z") }),
          // 23:30 UTC on the 7th is 00:30 on the 8th in London.
          task("c", { title: "Slides", dueAt: new Date("2026-10-07T23:30:00Z") }),
          task("d", {
            title: "Done",
            dueAt: new Date("2026-10-08T10:00:00Z"),
            status: "completed",
          }),
        ],
      })
    );
    expect(insight).toMatchObject({ kind: "deadline_cluster", href: "/tasks/c" });
    expect(insight.message).toMatch(/^3 deadlines land on Thursday 8 Oct/);
  });

  it("ignores deadlines already past or beyond the next seven days", () => {
    const found = weeklyInsights(
      input({
        tasks: [
          task("a", { dueAt: new Date("2026-10-04T10:00:00Z") }),
          task("b", { dueAt: new Date("2026-10-04T11:00:00Z") }),
          task("c", { dueAt: new Date("2026-10-04T12:00:00Z") }),
          task("d", { dueAt: new Date("2026-10-13T10:00:00Z") }),
          task("e", { dueAt: new Date("2026-10-13T11:00:00Z") }),
          task("f", { dueAt: new Date("2026-10-13T12:00:00Z") }),
        ],
      })
    );
    expect(found).toEqual([]);
  });

  it("shows at most one of each kind, most actionable first", () => {
    const due = new Date("2026-10-08T10:00:00Z");
    const found = weeklyInsights(
      input({
        goals: [
          { id: "g1", title: "One" },
          { id: "g2", title: "Two" },
        ],
        tasks: [
          task("a", { goalId: "g1", dueAt: due }),
          task("b", { goalId: "g2", dueAt: due }),
          task("c", { dueAt: due }),
          task("d"),
          task("e"),
        ],
        events: [postponed("d"), postponed("d"), postponed("e"), postponed("e")],
      })
    );
    expect(found.map((insight) => insight.kind)).toEqual([
      "repeated_postponement",
      "deadline_cluster",
      "neglected_goal",
    ]);
    expect(found).toHaveLength(MAX_INSIGHTS);
  });

  it("phrases every insight as a suggestion with an action, not a bare number", () => {
    const found = weeklyInsights(
      input({
        goals: [{ id: "g1", title: "One" }],
        tasks: [task("a", { goalId: "g1" })],
        events: [postponed("a"), postponed("a")],
      })
    );
    for (const insight of found) {
      expect(insight.actionLabel.length).toBeGreaterThan(0);
      expect(insight.href).toMatch(/^\//);
      expect(insight.message).toMatch(/\.$/);
    }
  });
});
