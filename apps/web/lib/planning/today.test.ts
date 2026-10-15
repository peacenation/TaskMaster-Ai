import { describe, expect, it } from "vitest";
import { buildToday, busyMinutesAhead, todaySettingsSchema } from "./today";
import {
  PRD_CLOCK,
  PRD_TASKS,
  PRD_TIME_ZONE,
} from "@/lib/domain/__fixtures__/prd-worked-example";
import { makeTask } from "@/lib/domain/task";

const context = { now: PRD_CLOCK.now(), timeZone: PRD_TIME_ZONE };
describe("Today planning", () => {
  it("answers the PRD example and adapts to 20 minutes / low energy", () => {
    expect(buildToday(PRD_TASKS, context, 240, null).recommendation?.task.id).toBe("report");
    const constrained = buildToday(
      PRD_TASKS,
      { ...context, availableMinutes: 20, energy: "low" },
      240,
      null
    );
    expect(constrained.recommendation?.task.id).toBe("dentist");
    expect(constrained.recommendation?.displaced?.id).toBe("report");
  });
  it("a chosen next action survives repeated rebuilds, even under different constraints", () => {
    for (const availableMinutes of [20, 120]) {
      const today = buildToday(
        PRD_TASKS,
        { ...context, availableMinutes, energy: "low" },
        240,
        "report"
      );
      expect(today.overridden).toBe(true);
      expect(today.recommendation?.task.id).toBe("report");
    }
  });
  it("does not recommend a completed, postponed or blocked chosen task", () => {
    const tasks = [
      makeTask({ id: "inbox", title: "Unprocessed dependency", status: "inbox" }),
      makeTask({ id: "blocked", title: "Blocked", dependsOn: ["inbox"] }),
      makeTask({ id: "postponed", title: "Postponed", status: "postponed" }),
      makeTask({ id: "done", title: "Done", status: "completed" }),
      makeTask({ id: "ready", title: "Ready" }),
    ];
    for (const id of ["blocked", "postponed", "done"]) {
      const today = buildToday(tasks, context, 240, id);
      expect(today.overridden).toBe(false);
      expect(today.recommendation?.task.id).toBe("ready");
      expect(today.blocked.map((task) => task.id)).toEqual(["blocked"]);
    }
  });
  it("keeps gaps and buffer in the single plan used by both views", () => {
    const { plan } = buildToday(PRD_TASKS, context, 240, null);
    expect(plan.capacity.plannedMinutes).toBeLessThan(240);
    for (let i = 1; i < plan.items.length; i++)
      expect(
        plan.items[i].scheduledStart!.getTime() - plan.items[i - 1].scheduledEnd!.getTime()
      ).toBe(600000);
    expect(
      plan.items.at(-1)!.scheduledEnd!.getTime() - plan.items[0].scheduledStart!.getTime()
    ).toBeLessThanOrEqual(plan.capacity.usableMinutes! * 60000);
  });
  it("warns when urgent work exceeds capacity and reports the gap", () => {
    const tasks = [
      makeTask({ id: "urgent", title: "Urgent", dueAt: context.now, estimatedMinutes: 90 }),
    ];
    const { plan } = buildToday(tasks, context, 60, null);
    expect(plan.capacity.overloaded).toBe(true);
    expect(plan.capacity.mustDoMinutes - plan.capacity.usableMinutes!).toBe(42);
  });
  it("bounds query input and treats empty optional constraints as absent", () => {
    expect(
      todaySettingsSchema.parse({ dayMinutes: "-1", availableMinutes: "", energy: "" })
    ).toEqual({ dayMinutes: 240, availableMinutes: undefined, energy: undefined });
    expect(
      todaySettingsSchema.parse({ dayMinutes: "120", availableMinutes: "20", energy: "low" })
    ).toEqual({ dayMinutes: 120, availableMinutes: 20, energy: "low" });
  });
});

describe("calendar-aware planning", () => {
  const now = new Date("2026-10-14T09:00:00Z");
  const at = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 14, h, m));
  const task = (id: string, minutes: number) => ({
    id,
    title: id,
    status: "todo" as const,
    priority: null,
    urgency: null,
    importance: null,
    dueAt: null,
    estimatedMinutes: minutes,
    energy: null,
    projectId: null,
    goalId: null,
    dependsOn: [],
    lastProgressAt: null,
    createdAt: new Date("2026-10-01T00:00:00Z"),
  });

  it("counts only meeting time still ahead, overlaps once", () => {
    expect(
      busyMinutesAhead(
        [
          { start: at(8), end: at(9, 30) }, // 30 min left
          { start: at(10), end: at(11) },
          { start: at(10, 30), end: at(11, 30) }, // overlaps: +30
        ],
        now
      )
    ).toBe(120);
  });

  it("takes meetings out of the day and schedules blocks around them", () => {
    const today = buildToday(
      [task("a", 45), task("b", 60)],
      { now, timeZone: "UTC" },
      240,
      null,
      [{ start: at(9, 30), end: at(10, 30) }]
    );
    expect(today.meetingMinutes).toBe(60);
    expect(today.plan.capacity.availableMinutes).toBe(180);
    const blocks = today.plan.items.map((i) => [
      i.scheduledStart!.toISOString().slice(11, 16),
      i.scheduledEnd!.toISOString().slice(11, 16),
    ]);
    // 09:00 + 45 min would run into the 09:30 meeting, so it moves after it.
    for (const [start, end] of blocks) {
      expect(end <= "09:30" || start >= "10:30").toBe(true);
    }
    expect(blocks[0][0]).toBe("10:45");
  });
});

describe("waiting on someone", () => {
  const now = new Date("2026-10-16T09:00:00Z");
  const base = {
    status: "todo" as const,
    priority: null,
    urgency: null,
    importance: null,
    dueAt: null,
    estimatedMinutes: 30,
    energy: null,
    projectId: null,
    goalId: null,
    dependsOn: [],
    lastProgressAt: null,
    createdAt: new Date("2026-10-01T00:00:00Z"),
  };

  it("keeps a parked task out of the plan and the recommendation", () => {
    const today = buildToday(
      [
        {
          ...base,
          id: "parked",
          title: "Get sign-off",
          priority: 5,
          waitingOn: "Sam",
          followUpAt: new Date("2026-10-20T09:00:00Z"),
        },
        { ...base, id: "mine", title: "Write the brief" },
      ],
      { now, timeZone: "UTC" },
      240,
      null
    );
    expect(today.recommendation?.task.id).toBe("mine");
    expect(today.plan.items.map((i) => i.task.id)).toEqual(["mine"]);
  });

  it("brings it back once the follow-up is due", () => {
    const today = buildToday(
      [
        {
          ...base,
          id: "chase",
          title: "Chase sign-off",
          waitingOn: "Sam",
          followUpAt: new Date("2026-10-15T09:00:00Z"),
        },
      ],
      { now, timeZone: "UTC" },
      240,
      null
    );
    expect(today.plan.items.map((i) => i.task.id)).toEqual(["chase"]);
  });
});
