import { describe, expect, it } from "vitest";
import { breakdownTask } from "./breakdown";
import { fixedClock, systemClock } from "./clock";

describe("breakdownTask", () => {
  it("leaves a single concrete action alone", () => {
    expect(breakdownTask("Call the plumber")).toEqual({ needed: false, steps: [] });
    expect(breakdownTask("Book the dentist", 10)).toEqual({ needed: false, steps: [] });
  });

  it("a big 'atomic' verb isn't atomic anymore", () => {
    expect(breakdownTask("Check every receipt from last year", 180).needed).toBe(true);
  });

  it("deliverables: gather, draft, review, then submit or send", () => {
    expect(breakdownTask("Write the board presentation").steps).toEqual([
      "Gather what you need for the presentation",
      "Draft the presentation",
      "Review the presentation",
      "Send the presentation",
    ]);
    expect(breakdownTask("Finish my essay").steps.at(-1)).toBe("Submit the essay");
  });

  it("clearing a space", () => {
    expect(breakdownTask("Start sorting the garage").steps).toEqual([
      "Pick one corner of the garage to start with",
      "Sort items into keep, donate, and bin",
      "Take the donations and rubbish away",
      "Put what's left back in the garage, in order",
    ]);
  });

  it("vague work gets a generic first-step breakdown", () => {
    expect(breakdownTask("Figure out the pension")).toEqual({
      needed: true,
      steps: [
        "Write down what 'done' looks like",
        "List the first three concrete steps",
        "Do the first step — aim for 25 minutes",
      ],
    });
  });

  it("large work with no template gets the generic breakdown too", () => {
    expect(breakdownTask("Overhaul the bike", 240).needed).toBe(true);
  });

  it("small, specific, non-template work is left alone", () => {
    expect(breakdownTask("Water the plants", 10)).toEqual({ needed: false, steps: [] });
  });
});

describe("clock", () => {
  it("fixedClock always returns the same instant, as a fresh copy", () => {
    const clock = fixedClock("2026-10-05T08:00:00Z");
    const first = clock.now();
    first.setFullYear(2000);
    expect(clock.now().toISOString()).toBe("2026-10-05T08:00:00.000Z");
  });

  it("systemClock reads the real time", () => {
    expect(Math.abs(systemClock.now().getTime() - Date.now())).toBeLessThan(1000);
  });
});
