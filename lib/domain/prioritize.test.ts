import { describe, expect, it } from "vitest";
import { neglectReason, prioritize, scoreTask, WEIGHTS } from "./prioritize";
import { isBlocked, makeTask, type PlanningContext } from "./task";

// Monday 5 October 2026, 09:00 London.
const now = new Date("2026-10-05T08:00:00Z");
const context: PlanningContext = { now, timeZone: "Europe/London" };
const DAY = 24 * 60 * 60 * 1000;

function codes(
  task: Parameters<typeof scoreTask>[0],
  ctx: PlanningContext = context,
  all = [task]
) {
  return scoreTask(task, ctx, all).reasons.map((r) => r.code);
}

describe("scoreTask — the user's own signals", () => {
  it("explicit priority above and below neutral", () => {
    const high = scoreTask(makeTask({ id: "a", title: "a", priority: 5 }), context);
    expect(high.score).toBe(2 * WEIGHTS.priorityPerPoint);
    expect(high.reasons[0].text).toBe("you marked it high priority");
    const low = scoreTask(makeTask({ id: "b", title: "b", priority: 1 }), context);
    expect(low.score).toBe(-2 * WEIGHTS.priorityPerPoint);
    expect(low.reasons[0].text).toBe("you marked it low priority");
  });

  it("neutral priority/importance/urgency add nothing and no reason", () => {
    const neutral = scoreTask(
      makeTask({ id: "a", title: "a", priority: 3, importance: 3, urgency: 3 }),
      context
    );
    expect(neutral.score).toBe(0);
    expect(neutral.reasons).toEqual([]);
  });

  it("importance in both directions", () => {
    expect(
      scoreTask(makeTask({ id: "a", title: "a", importance: 5 }), context).reasons[0].text
    ).toBe("it's marked important");
    expect(
      scoreTask(makeTask({ id: "a", title: "a", importance: 1 }), context).reasons[0].text
    ).toBe("it's marked as less important");
  });

  it("urgency in both directions", () => {
    expect(codes(makeTask({ id: "a", title: "a", urgency: 5 }))).toEqual(["urgency"]);
    expect(
      scoreTask(makeTask({ id: "a", title: "a", urgency: 1 }), context).reasons[0].text
    ).toBe("it isn't urgent");
  });
});

describe("scoreTask — deadlines, in the user's calendar days", () => {
  it.each([
    ["overdue", new Date(now.getTime() - 60_000), "overdue"],
    ["today", new Date("2026-10-05T16:00:00Z"), "due_today"],
    ["tomorrow", new Date("2026-10-06T16:00:00Z"), "due_tomorrow"],
    ["Thursday", new Date("2026-10-08T16:00:00Z"), "due_soon"],
    ["next week", new Date("2026-10-12T16:00:00Z"), "due_this_week"],
    ["this month", new Date("2026-10-31T17:00:00Z"), "due_this_month"],
  ])("%s", (_label, dueAt, code) => {
    expect(codes(makeTask({ id: "a", title: "a", dueAt }))).toEqual([code]);
  });

  it("names the weekday for a deadline within three days", () => {
    const scored = scoreTask(
      makeTask({ id: "a", title: "a", dueAt: new Date("2026-10-08T16:00:00Z") }),
      context
    );
    expect(scored.reasons[0].text).toBe("it's due on Thursday");
  });

  it("far-off deadlines add nothing", () => {
    expect(
      codes(makeTask({ id: "a", title: "a", dueAt: new Date("2027-03-01T00:00:00Z") }))
    ).toEqual([]);
  });

  it("uses the user's timezone: the same instants read differently in New York and UTC", () => {
    const nyNow = new Date("2026-10-06T02:00:00Z"); // 10pm Monday in New York; Tuesday in UTC
    const dueAt = new Date("2026-10-06T05:00:00Z"); // 1am Tuesday in New York; still Tuesday in UTC
    const task = makeTask({ id: "a", title: "a", dueAt });
    expect(codes(task, { now: nyNow, timeZone: "America/New_York" })).toEqual([
      "due_tomorrow",
    ]);
    expect(codes(task, { now: nyNow, timeZone: "UTC" })).toEqual(["due_today"]);
  });

  it("defaults to UTC without a timezone", () => {
    const utcNow = new Date("2026-10-05T23:00:00Z");
    expect(
      codes(makeTask({ id: "a", title: "a", dueAt: new Date("2026-10-06T01:00:00Z") }), {
        now: utcNow,
      })
    ).toEqual(["due_tomorrow"]);
  });
});

describe("scoreTask — structure", () => {
  it("counts open dependents, capped", () => {
    const blocker = makeTask({ id: "b", title: "blocker" });
    const one = [blocker, makeTask({ id: "d1", title: "d1", dependsOn: ["b"] })];
    expect(scoreTask(blocker, context, one).reasons[0].text).toBe(
      "another task depends on it"
    );

    const many = [
      blocker,
      ...["d1", "d2", "d3", "d4"].map((id) => makeTask({ id, title: id, dependsOn: ["b"] })),
    ];
    const scored = scoreTask(blocker, context, many);
    expect(scored.reasons[0].text).toBe("4 other tasks depend on it");
    expect(scored.score).toBe(WEIGHTS.maxDependents * WEIGHTS.perDependent);
  });

  it("completed dependents don't count", () => {
    const blocker = makeTask({ id: "b", title: "blocker" });
    const all = [
      blocker,
      makeTask({ id: "d", title: "d", dependsOn: ["b"], status: "completed" }),
    ];
    expect(scoreTask(blocker, context, all).reasons).toEqual([]);
  });

  it("goal, focus project, in progress", () => {
    const task = makeTask({
      id: "a",
      title: "a",
      goalId: "g",
      projectId: "p",
      status: "in_progress",
      lastProgressAt: now,
    });
    expect(codes(task, { ...context, focusProjectId: "p" })).toEqual([
      "goal",
      "focus_project",
      "in_progress",
    ]);
    expect(codes(task, { ...context, focusProjectId: "other" })).not.toContain(
      "focus_project"
    );
  });
});

describe("neglectReason — anti-crowding", () => {
  it("doesn't apply to ordinary short-term work", () => {
    expect(
      neglectReason(makeTask({ id: "a", title: "a", createdAt: new Date(0) }), now)
    ).toBeNull();
  });

  it("doesn't apply within the grace period", () => {
    const task = makeTask({
      id: "a",
      title: "a",
      goalId: "g",
      lastProgressAt: new Date(now.getTime() - 5 * DAY),
    });
    expect(neglectReason(task, now)).toBeNull();
  });

  it("grows per day after the grace period", () => {
    const task = makeTask({
      id: "a",
      title: "a",
      goalId: "g",
      lastProgressAt: new Date(now.getTime() - 10 * DAY),
    });
    expect(neglectReason(task, now)).toEqual({
      code: "neglected",
      text: "you haven't made progress on it in 10 days",
      weight: 3 * WEIGHTS.neglectPerDay,
    });
  });

  it("is capped", () => {
    const task = makeTask({
      id: "a",
      title: "a",
      goalId: "g",
      lastProgressAt: new Date(now.getTime() - 400 * DAY),
    });
    expect(neglectReason(task, now)?.weight).toBe(WEIGHTS.neglectMax);
  });

  it("falls back to createdAt, and applies to important work with no deadline", () => {
    const task = makeTask({
      id: "a",
      title: "a",
      importance: 4,
      createdAt: new Date(now.getTime() - 9 * DAY),
    });
    expect(neglectReason(task, now)?.weight).toBe(2 * WEIGHTS.neglectPerDay);
  });

  it("an important task *with* a deadline is driven by the deadline, not neglect", () => {
    const task = makeTask({
      id: "a",
      title: "a",
      importance: 5,
      dueAt: new Date("2027-01-01"),
      createdAt: new Date(0),
    });
    expect(neglectReason(task, now)).toBeNull();
  });

  it("lifts a stale goal above idle work without a deadline", () => {
    const goal = makeTask({
      id: "goal",
      title: "goal",
      goalId: "g",
      createdAt: new Date(now.getTime() - 30 * DAY),
    });
    const idle = makeTask({ id: "idle", title: "idle", importance: 3 });
    expect(prioritize([idle, goal], context)[0].task.id).toBe("goal");
  });
});

describe("scoreTask — time and energy right now", () => {
  it("penalises work that doesn't fit, rewards work that does, prefers quick wins", () => {
    const ctx = { ...context, availableMinutes: 20 };
    expect(codes(makeTask({ id: "a", title: "a", estimatedMinutes: 90 }), ctx)).toEqual([
      "does_not_fit",
    ]);
    const quick = scoreTask(makeTask({ id: "a", title: "a", estimatedMinutes: 5 }), ctx);
    const slower = scoreTask(makeTask({ id: "b", title: "b", estimatedMinutes: 15 }), ctx);
    expect(quick.reasons.map((r) => r.code)).toEqual(["fits", "quick_win"]);
    expect(quick.score).toBeGreaterThan(slower.score);
  });

  it("a task that exactly fills the time fits, with no quick-win bonus", () => {
    expect(
      codes(makeTask({ id: "a", title: "a", estimatedMinutes: 20 }), {
        ...context,
        availableMinutes: 20,
      })
    ).toEqual(["fits"]);
  });

  it("ignores time when the task has no estimate", () => {
    expect(
      codes(makeTask({ id: "a", title: "a" }), { ...context, availableMinutes: 20 })
    ).toEqual([]);
  });

  it("energy matching under low energy", () => {
    const low = { ...context, energy: "low" as const };
    expect(scoreTask(makeTask({ id: "a", title: "a", energy: "high" }), low).score).toBe(
      WEIGHTS.energyMismatchHigh
    );
    expect(scoreTask(makeTask({ id: "a", title: "a", energy: "medium" }), low).score).toBe(
      WEIGHTS.energyMismatchMedium
    );
    expect(scoreTask(makeTask({ id: "a", title: "a", energy: "low" }), low).score).toBe(
      WEIGHTS.energyMatchLow
    );
  });

  it("energy only matters when the user is low on it", () => {
    expect(
      codes(makeTask({ id: "a", title: "a", energy: "high" }), { ...context, energy: "high" })
    ).toEqual([]);
    expect(codes(makeTask({ id: "a", title: "a" }), { ...context, energy: "low" })).toEqual(
      []
    );
  });
});

describe("prioritize", () => {
  it("drops completed tasks and sorts blocked ones last", () => {
    const tasks = [
      makeTask({ id: "done", title: "done", status: "completed", priority: 5 }),
      makeTask({ id: "blocked", title: "blocked", priority: 5, dependsOn: ["blocker"] }),
      makeTask({ id: "blocker", title: "blocker" }),
    ];
    const ranked = prioritize(tasks, context);
    expect(ranked.map((s) => s.task.id)).toEqual(["blocker", "blocked"]);
    expect(ranked[1].blocked).toBe(true);
  });

  it("breaks ties deterministically: deadline, then age, then id", () => {
    const tasks = [
      makeTask({ id: "c", title: "c", createdAt: new Date(2) }),
      makeTask({ id: "b", title: "b", createdAt: new Date(1) }),
      makeTask({ id: "a2", title: "a2", createdAt: new Date(1) }),
      makeTask({
        id: "far",
        title: "far",
        dueAt: new Date("2028-01-01"),
        createdAt: new Date(9),
      }),
      makeTask({
        id: "far2",
        title: "far2",
        dueAt: new Date("2029-01-01"),
        createdAt: new Date(0),
      }),
    ];
    expect(prioritize(tasks, context).map((s) => s.task.id)).toEqual([
      "far",
      "far2",
      "a2",
      "b",
      "c",
    ]);
  });

  it("is stable when two tasks are identical except id", () => {
    const tasks = [makeTask({ id: "z", title: "z" }), makeTask({ id: "z", title: "z2" })];
    expect(prioritize(tasks, context)).toHaveLength(2);
  });
});

describe("isBlocked", () => {
  it("ignores dependencies on unknown or finished tasks", () => {
    const done = makeTask({ id: "done", title: "done", status: "completed" });
    const task = makeTask({ id: "t", title: "t", dependsOn: ["done", "missing"] });
    expect(isBlocked(task, new Map([[done.id, done]]))).toBe(false);
  });
});
