import { describe, expect, it } from "vitest";
import { buildToday, todaySettingsSchema } from "./today";
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
