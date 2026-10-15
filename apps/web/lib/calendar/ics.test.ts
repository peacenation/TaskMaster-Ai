import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseIcs } from "./ics";

const work = readFileSync(join(__dirname, "__fixtures__/work.ics"), "utf8");
const day = (iso: string) => new Date(iso);

describe("parseIcs", () => {
  it("lists a day's meetings: repeats, a moved instance and one-offs", () => {
    const events = parseIcs(work, day("2026-10-14T00:00:00Z"), day("2026-10-15T00:00:00Z"));
    expect(events.map((e) => [e.title, e.startsAt.toISOString(), e.allDay])).toEqual([
      ["Team offsite", "2026-10-14T00:00:00.000Z", true],
      // 11:00 BST — the moved stand-up replaces the usual 09:30 one.
      ["Stand-up (moved)", "2026-10-14T10:00:00.000Z", false],
      ["Quarterly review", "2026-10-14T13:00:00.000Z", false],
    ]);
  });

  it("skips cancelled events and ones marked free", () => {
    const titles = parseIcs(
      work,
      day("2026-10-14T00:00:00Z"),
      day("2026-10-15T00:00:00Z")
    ).map((e) => e.title);
    expect(titles).not.toContain("Cancelled 1:1");
    expect(titles).not.toContain("Focus time (free)");
  });

  it("expands a repeating meeting across the range, weekdays only, in its time zone", () => {
    const events = parseIcs(
      work,
      day("2026-10-12T00:00:00Z"),
      day("2026-10-19T00:00:00Z")
    ).filter((e) => e.title === "Stand-up");
    // Mon, Tue, Thu, Fri (Wed was moved; Sat/Sun aren't in the rule).
    expect(events.map((e) => e.startsAt.toISOString())).toEqual([
      "2026-10-12T08:30:00.000Z",
      "2026-10-13T08:30:00.000Z",
      "2026-10-15T08:30:00.000Z",
      "2026-10-16T08:30:00.000Z",
    ]);
    // After the clocks go back (25 Oct), 09:30 London is 09:30 UTC.
    const later = parseIcs(work, day("2026-10-26T00:00:00Z"), day("2026-10-27T00:00:00Z"));
    expect(later[0].startsAt.toISOString()).toBe("2026-10-26T09:30:00.000Z");
  });

  it("rejects something that isn't a calendar", () => {
    expect(() => parseIcs("<html>nope</html>", new Date(), new Date())).toThrow(
      /didn't return a calendar/
    );
  });
});
