import { describe, expect, it } from "vitest";
import { occurrencesBetween, type RecurrenceSchedule } from "./recurrence";

const base: RecurrenceSchedule = {
  frequency: "daily",
  intervalCount: 1,
  timesPerPeriod: 1,
  startDate: "2026-10-05",
};

describe("occurrencesBetween", () => {
  it("generates daily occurrences and separates multiple same-day slots", () => {
    expect(
      occurrencesBetween({ ...base, timesPerPeriod: 2 }, "2026-10-06", "2026-10-07")
    ).toEqual([
      { date: "2026-10-06", slot: 0 },
      { date: "2026-10-06", slot: 1 },
      { date: "2026-10-07", slot: 0 },
      { date: "2026-10-07", slot: 1 },
    ]);
  });

  it("respects intervals and distributes weekly sessions from the start weekday", () => {
    expect(
      occurrencesBetween(
        { ...base, frequency: "weekly", intervalCount: 2, timesPerPeriod: 3 },
        "2026-10-05",
        "2026-10-25"
      ).map(({ date }) => date)
    ).toEqual([
      "2026-10-05",
      "2026-10-07",
      "2026-10-09",
      "2026-10-19",
      "2026-10-21",
      "2026-10-23",
    ]);
  });

  it("honors explicitly selected weekdays", () => {
    expect(
      occurrencesBetween(
        { ...base, frequency: "weekly", daysOfWeek: [1, 3, 5] },
        "2026-10-05",
        "2026-10-11"
      ).map(({ date }) => date)
    ).toEqual(["2026-10-05", "2026-10-07", "2026-10-09"]);
  });

  it("distributes monthly sessions and clamps short months naturally", () => {
    expect(
      occurrencesBetween(
        { ...base, frequency: "monthly", timesPerPeriod: 2, startDate: "2026-01-01" },
        "2026-02-01",
        "2026-02-28"
      ).map(({ date }) => date)
    ).toEqual(["2026-02-01", "2026-02-15"]);
  });

  it("honors inclusive end dates and rejects invalid cadence values", () => {
    expect(
      occurrencesBetween({ ...base, endDate: "2026-10-06" }, "2026-10-05", "2026-10-08").map(
        ({ date }) => date
      )
    ).toEqual(["2026-10-05", "2026-10-06"]);
    expect(() =>
      occurrencesBetween({ ...base, intervalCount: 0 }, "2026-10-05", "2026-10-08")
    ).toThrow(RangeError);
  });
});
