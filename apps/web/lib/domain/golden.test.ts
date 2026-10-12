import { describe, expect, it } from "vitest";
import {
  PRD_BRAIN_DUMP,
  PRD_CLOCK,
  PRD_TASKS,
  PRD_TIME_ZONE,
} from "./__fixtures__/prd-worked-example";
import { breakdownTask } from "./breakdown";
import { extract } from "./extract";
import { nextBestAction } from "./nextBestAction";
import { buildPlan } from "./plan";

// The PRD's own worked example as an executable contract
// (IMPLEMENTATION_PLAN.md Phase 4, exit criteria 3 and 4).

const context = { now: PRD_CLOCK.now(), timeZone: PRD_TIME_ZONE };

describe("PRD worked example — extraction", () => {
  const proposal = extract(PRD_BRAIN_DUMP, { clock: PRD_CLOCK, timeZone: PRD_TIME_ZONE });
  const byTitle = (fragment: string) =>
    proposal.items.find((i) => i.title.toLowerCase().includes(fragment));

  it("splits one run-on sentence into separate items, dropping the noise", () => {
    expect(proposal.engine).toBe("heuristic");
    expect(proposal.items.map((i) => i.title)).toEqual([
      "Finish the quarterly report",
      "Book the dentist",
      "Start sorting the garage",
      "Go to the gym",
      "Call Mum",
      "Renew my car insurance",
      "Start working on my side business again",
    ]);
  });

  it("reads the report's deadline as Thursday, 5pm London", () => {
    const report = byTitle("quarterly report");
    expect(report?.kind).toBe("task");
    expect(report?.deadline).toEqual({
      at: "2026-10-08T16:00:00.000Z",
      confidence: 0.85,
      source: "by Thursday",
    });
  });

  it("proposes 'end of the month' as a low-confidence suggestion, not a fact", () => {
    const insurance = byTitle("insurance");
    expect(insurance?.deadline?.at).toBe("2026-10-31T17:00:00.000Z");
    expect(insurance?.deadline?.confidence).toBeLessThan(0.7);
  });

  it("classifies the gym as a 3×/week habit, the garage as a project, the side business as a goal", () => {
    expect(byTitle("gym")).toMatchObject({
      kind: "recurring",
      recurrence: { frequency: "weekly", timesPerPeriod: 3 },
      deadline: null,
    });
    expect(byTitle("garage")?.kind).toBe("project");
    expect(byTitle("side business")).toMatchObject({ kind: "goal", project: null });
  });

  it("groups items into the PRD's life areas", () => {
    expect(byTitle("quarterly report")?.project).toBe("Work");
    expect(byTitle("dentist")?.project).toBe("Personal admin");
    expect(byTitle("insurance")?.project).toBe("Personal admin");
    expect(byTitle("garage")?.project).toBe("Home");
    expect(byTitle("gym")?.project).toBe("Health");
    expect(byTitle("mum")?.project).toBe("Family");
  });

  it("breaks the report down into the PRD's four steps", () => {
    expect(breakdownTask("Finish the quarterly report").steps).toEqual([
      "Gather the missing figures",
      "Draft the report",
      "Review the report",
      "Submit the report",
    ]);
  });
});

describe("PRD worked example — what to do next", () => {
  it("recommends the report: the closest important deadline", () => {
    const recommendation = nextBestAction(PRD_TASKS, context);
    expect(recommendation?.task.id).toBe("report");
    expect(recommendation?.displaced).toBeNull();
    expect(recommendation?.message).toBe(
      "Finish the quarterly report next — it's due on Thursday and it's marked important."
    );
  });

  it("with only 20 minutes and low energy, recommends something different — the dentist", () => {
    const recommendation = nextBestAction(PRD_TASKS, {
      ...context,
      availableMinutes: 20,
      energy: "low",
    });
    expect(recommendation?.task.id).toBe("dentist");
    expect(recommendation?.displaced?.id).toBe("report");
    expect(recommendation?.message).toBe(
      'You don\'t have enough time or energy for meaningful progress on "Finish the quarterly report" right now. ' +
        "Book the dentist now — it fits in the 20 minutes you have, it suits your energy right now, and it's quick. " +
        'Come back to "Finish the quarterly report" when you have a longer stretch.'
    );
  });

  it("keeps the neglected side business in a 4-hour day alongside the report", () => {
    const plan = buildPlan(PRD_TASKS, context, { mode: "flexible", availableMinutes: 240 });
    const ids = plan.items.map((i) => i.task.id);
    expect(ids[0]).toBe("report");
    expect(ids).toContain("side-business");
    expect(plan.capacity.plannedMinutes).toBeLessThanOrEqual(plan.capacity.usableMinutes!);
  });
});
