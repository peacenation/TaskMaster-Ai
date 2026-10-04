import { describe, expect, it } from "vitest";
import { buildPlan, PLAN_DEFAULTS, PROTECTED_REASON } from "./plan";
import { makeTask, type PlannableTask } from "./task";

const now = new Date("2026-10-05T08:07:00Z");
const context = { now, timeZone: "Europe/London" };
const DAY = 24 * 60 * 60 * 1000;

const tomorrow = new Date(now.getTime() + DAY);

function urgent(id: string, minutes: number): PlannableTask {
  return makeTask({ id, title: id, dueAt: tomorrow, estimatedMinutes: minutes });
}

describe("buildPlan — capacity", () => {
  it("holds a buffer back: never plans every available minute", () => {
    const tasks = [urgent("a", 60), urgent("b", 60), urgent("c", 60)];
    const plan = buildPlan(tasks, context, { mode: "flexible", availableMinutes: 150 });
    expect(plan.capacity.usableMinutes).toBe(120);
    expect(plan.items.map((i) => i.task.id)).toEqual(["a", "b"]);
    expect(plan.deferred.map((s) => s.task.id)).toEqual(["c"]);
  });

  it("skips a task too big for what's left but keeps filling with smaller ones", () => {
    const tasks = [
      makeTask({ id: "big", title: "big", priority: 5, estimatedMinutes: 100 }),
      makeTask({ id: "mid", title: "mid", priority: 4, estimatedMinutes: 30 }),
      makeTask({ id: "small", title: "small", estimatedMinutes: 10 }),
    ];
    const plan = buildPlan(tasks, context, { mode: "flexible", availableMinutes: 150 });
    expect(plan.items.map((i) => i.task.id)).toEqual(["big", "small"]);
  });

  it("uses a default estimate for unestimated tasks, and says so", () => {
    const plan = buildPlan([makeTask({ id: "a", title: "a" })], context, {
      mode: "flexible",
      availableMinutes: 100,
    });
    expect(plan.items[0]).toMatchObject({
      minutes: PLAN_DEFAULTS.defaultEstimateMinutes,
      estimateIsDefault: true,
    });
  });

  it("without stated availability, caps the plan by item count instead", () => {
    const tasks = Array.from({ length: 8 }, (_, i) =>
      makeTask({ id: `t${i}`, title: `t${i}` })
    );
    const plan = buildPlan(tasks, context, { mode: "flexible" });
    expect(plan.items).toHaveLength(PLAN_DEFAULTS.maxItems);
    expect(plan.capacity).toMatchObject({
      availableMinutes: null,
      usableMinutes: null,
      overloaded: false,
    });
  });

  it("flags overload when today's must-do work alone exceeds usable time", () => {
    const tasks = [urgent("a", 90), urgent("b", 90)];
    const plan = buildPlan(tasks, context, { mode: "flexible", availableMinutes: 120 });
    expect(plan.capacity).toMatchObject({ mustDoMinutes: 180, overloaded: true });
  });

  it("doesn't flag overload when must-do work fits", () => {
    const plan = buildPlan([urgent("a", 30)], context, {
      mode: "flexible",
      availableMinutes: 120,
    });
    expect(plan.capacity.overloaded).toBe(false);
  });

  it("leaves blocked tasks out of the plan, but reports them", () => {
    const tasks = [
      makeTask({ id: "first", title: "first" }),
      makeTask({ id: "second", title: "second", priority: 5, dependsOn: ["first"] }),
    ];
    const plan = buildPlan(tasks, context, { mode: "flexible" });
    expect(plan.items.map((i) => i.task.id)).toEqual(["first"]);
    expect(plan.blocked.map((s) => s.task.id)).toEqual(["second"]);
  });
});

describe("buildPlan — scheduled mode", () => {
  it("assigns back-to-back blocks with gaps, starting at the next quarter hour", () => {
    const tasks = [urgent("a", 30), urgent("b", 45)];
    const plan = buildPlan(tasks, context, { mode: "scheduled", availableMinutes: 240 });
    expect(
      plan.items.map((i) => [i.scheduledStart?.toISOString(), i.scheduledEnd?.toISOString()])
    ).toEqual([
      ["2026-10-05T08:15:00.000Z", "2026-10-05T08:45:00.000Z"],
      ["2026-10-05T08:55:00.000Z", "2026-10-05T09:40:00.000Z"],
    ]);
  });

  it("counts the gaps between blocks against capacity", () => {
    // 3×35 = 105 fits in usable 112, but with 10-minute gaps it doesn't.
    const tasks = [urgent("a", 35), urgent("b", 35), urgent("c", 35)];
    const flexible = buildPlan(tasks, context, { mode: "flexible", availableMinutes: 140 });
    const scheduled = buildPlan(tasks, context, { mode: "scheduled", availableMinutes: 140 });
    expect(flexible.items).toHaveLength(3);
    expect(scheduled.items).toHaveLength(2);
  });

  it("honours an explicit start time", () => {
    const startAt = new Date("2026-10-05T13:00:00Z");
    const plan = buildPlan([urgent("a", 30)], context, {
      mode: "scheduled",
      startAt,
      availableMinutes: 120,
    });
    expect(plan.items[0].scheduledStart).toEqual(startAt);
  });

  it("flexible mode has no times", () => {
    const plan = buildPlan([urgent("a", 30)], context, { mode: "flexible" });
    expect(plan.items[0]).toMatchObject({ scheduledStart: null, scheduledEnd: null });
  });
});

describe("buildPlan — protected slot for long-term work (PRD §7.5 item 8)", () => {
  const goal = makeTask({
    id: "goal",
    title: "Work on the novel",
    goalId: "g",
    estimatedMinutes: 30,
    lastProgressAt: now,
  });

  it("displaces lower-ranked, non-deadline work to make room", () => {
    const tasks = [
      urgent("deadline", 60),
      makeTask({ id: "idle-1", title: "idle-1", priority: 4, estimatedMinutes: 30 }),
      makeTask({ id: "idle-2", title: "idle-2", priority: 4, estimatedMinutes: 30 }),
      goal,
    ];
    // usable 96: deadline 60 + idle-1 30 = 90; the goal (score 5) would never make it.
    const plan = buildPlan(tasks, context, { mode: "flexible", availableMinutes: 120 });
    const ids = plan.items.map((i) => i.task.id);
    expect(ids).toEqual(["deadline", "goal"]);
    const protectedItem = plan.items.find((i) => i.protected);
    expect(protectedItem?.task.id).toBe("goal");
    expect(protectedItem?.reasons).toContainEqual(PROTECTED_REASON);
    expect(plan.deferred.map((s) => s.task.id)).toEqual(["idle-1", "idle-2"]);
  });

  it("never displaces work due within the protection horizon", () => {
    const tasks = [urgent("a", 45), urgent("b", 45), goal];
    const plan = buildPlan(tasks, context, { mode: "flexible", availableMinutes: 120 });
    expect(plan.items.map((i) => i.task.id)).toEqual(["a", "b"]);
    expect(plan.items.some((i) => i.protected)).toBe(false);
  });

  it("isn't needed when long-term work already made the plan on merit", () => {
    const plan = buildPlan([goal], context, { mode: "flexible", availableMinutes: 120 });
    expect(plan.items[0]).toMatchObject({ protected: false });
    expect(plan.items[0].reasons).not.toContainEqual(PROTECTED_REASON);
  });

  it("works without stated availability by replacing the lowest non-deadline item", () => {
    const tasks = [
      ...Array.from({ length: 5 }, (_, i) =>
        makeTask({ id: `p${i}`, title: `p${i}`, priority: 5, estimatedMinutes: 10 })
      ),
      goal,
    ];
    const plan = buildPlan(tasks, context, { mode: "flexible" });
    expect(plan.items).toHaveLength(PLAN_DEFAULTS.maxItems);
    expect(plan.items.map((i) => i.task.id)).toContain("goal");
    expect(plan.items.map((i) => i.task.id)).not.toContain("p4");
  });

  it("does nothing when there's no long-term work at all", () => {
    const plan = buildPlan([urgent("a", 30)], context, {
      mode: "flexible",
      availableMinutes: 60,
    });
    expect(plan.items.some((i) => i.protected)).toBe(false);
  });
});
