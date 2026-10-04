import { describe, expect, it } from "vitest";
import { fixedClock } from "./clock";
import {
  isValidTimeZone,
  localDateString,
  parseDeadline,
  parseNumber,
  removeSpans,
  zonedTimeToUtc,
} from "./dates";

// Monday 5 October 2026, 09:00 in London (BST, UTC+1).
const clock = fixedClock("2026-10-05T08:00:00Z");
const timeZone = "Europe/London";

function parse(
  text: string,
  overrides: Partial<{ clock: typeof clock; timeZone: string }> = {}
) {
  return parseDeadline(text, { clock, timeZone, ...overrides });
}

function iso(text: string) {
  return parse(text)?.at.toISOString();
}

describe("parseDeadline — the forms the PRD names explicitly", () => {
  it("'by Friday'-style weekday deadlines default to 5pm local", () => {
    const result = parse("finish the quarterly report by Thursday");
    expect(result?.at.toISOString()).toBe("2026-10-08T16:00:00.000Z");
    expect(result?.confidence).toBe(0.85);
    expect(result?.source).toBe("by Thursday");
  });

  it("'tomorrow at 2pm' combines date and time", () => {
    const result = parse("Call John tomorrow at 2pm");
    expect(result?.at.toISOString()).toBe("2026-10-06T13:00:00.000Z");
    expect(result?.source).toBe("tomorrow at 2pm");
    expect(result?.confidence).toBe(0.9);
  });

  it("'end of the month' crosses the BST→GMT change correctly", () => {
    const result = parse("renew my car insurance before the end of the month");
    // 31 Oct 2026 is after BST ends (25 Oct), so 5pm London is 17:00Z.
    expect(result?.at.toISOString()).toBe("2026-10-31T17:00:00.000Z");
    expect(result?.confidence).toBe(0.6);
    expect(result?.source).toBe("before the end of the month");
  });

  it("'in two weeks'", () => {
    expect(iso("start the course in two weeks")).toBe("2026-10-19T16:00:00.000Z");
  });

  it("'Friday morning' is a part-of-day, so lower confidence than an exact time", () => {
    const result = parse("Send Sarah the figures Friday morning");
    expect(result?.at.toISOString()).toBe("2026-10-09T08:00:00.000Z");
    expect(result?.confidence).toBe(0.8);
  });

  it("'next Tuesday' is ambiguous, so it's flagged with lower confidence", () => {
    const result = parse("dentist next Tuesday");
    expect(result?.at.toISOString()).toBe("2026-10-06T16:00:00.000Z");
    expect(result?.confidence).toBe(0.75);
  });
});

describe("parseDeadline — weekdays", () => {
  it("a bare weekday that is today means today", () => {
    expect(iso("on Monday")).toBe("2026-10-05T16:00:00.000Z");
  });

  it("'next <today's weekday>' means a week from today", () => {
    expect(iso("next Monday")).toBe("2026-10-12T16:00:00.000Z");
  });

  it("'this' and 'coming' read like a bare weekday", () => {
    expect(iso("this Friday")).toBe("2026-10-09T16:00:00.000Z");
    expect(iso("coming Wednesday")).toBe("2026-10-07T16:00:00.000Z");
  });

  it("wraps into next week for a weekday already passed", () => {
    expect(iso("Sunday")).toBe("2026-10-11T16:00:00.000Z");
  });

  it("ignores abbreviations that are ordinary words", () => {
    expect(parse("I sat on the sun lounger and got wed")).toBeNull();
  });
});

describe("parseDeadline — explicit calendar dates", () => {
  it("ISO dates", () => {
    const result = parse("due 2026-12-25");
    expect(result?.at.toISOString()).toBe("2026-12-25T17:00:00.000Z");
    expect(result?.confidence).toBe(0.95);
    expect(result?.source).toBe("due 2026-12-25");
  });

  it("rejects an invalid ISO date", () => {
    expect(parse("2026-02-30")).toBeNull();
  });

  it("day-month", () => {
    expect(iso("party on 25 December")).toBe("2026-12-25T17:00:00.000Z");
    expect(iso("the 1st of May")).toBe("2027-05-01T16:00:00.000Z");
  });

  it("month-day, with and without a year", () => {
    expect(iso("Dec 25")).toBe("2026-12-25T17:00:00.000Z");
    const withYear = parse("December 25, 2027");
    expect(withYear?.at.toISOString()).toBe("2027-12-25T17:00:00.000Z");
    expect(withYear?.confidence).toBe(0.95);
  });

  it("a date already passed this year means next year", () => {
    expect(iso("3 March")).toBe("2027-03-03T17:00:00.000Z");
  });

  it("rejects an impossible day", () => {
    expect(parse("31 February")).toBeNull();
    expect(parse("February 31")).toBeNull();
  });

  it("doesn't read the modal verb 'may' as a month", () => {
    expect(parse("I may call John")).toBeNull();
  });

  it("doesn't re-read the date's digits as a time", () => {
    expect(iso("December 25 at 9am")).toBe("2026-12-25T09:00:00.000Z");
  });
});

describe("parseDeadline — relative days", () => {
  it("today", () => {
    expect(iso("today")).toBe("2026-10-05T16:00:00.000Z");
  });

  it("'today' said after 5pm means end of today, not a time already past", () => {
    const evening = fixedClock("2026-10-05T17:30:00Z");
    expect(parse("today", { clock: evening })?.at.toISOString()).toBe(
      "2026-10-05T22:59:00.000Z"
    );
  });

  it("tonight defaults to 7pm", () => {
    expect(iso("tonight")).toBe("2026-10-05T18:00:00.000Z");
  });

  it("tomorrow and its abbreviation", () => {
    expect(iso("tomorrow")).toBe("2026-10-06T16:00:00.000Z");
    expect(iso("tmrw")).toBe("2026-10-06T16:00:00.000Z");
  });

  it("the day after tomorrow", () => {
    expect(iso("the day after tomorrow")).toBe("2026-10-07T16:00:00.000Z");
  });
});

describe("parseDeadline — 'in N', 'end of', 'next week'", () => {
  it("in N days, weeks, months, with digits or words", () => {
    expect(iso("in 3 days")).toBe("2026-10-08T16:00:00.000Z");
    expect(iso("in 1 week")).toBe("2026-10-12T16:00:00.000Z");
    expect(iso("in a month")).toBe("2026-11-05T17:00:00.000Z");
  });

  it("'in a month' clamps to the last day of a shorter month", () => {
    const jan31 = fixedClock("2027-01-31T10:00:00Z");
    expect(parse("in one month", { clock: jan31 })?.at.toISOString()).toBe(
      "2027-02-28T17:00:00.000Z"
    );
  });

  it("end of the week means Friday", () => {
    const result = parse("by the end of the week");
    expect(result?.at.toISOString()).toBe("2026-10-09T16:00:00.000Z");
    expect(result?.confidence).toBe(0.6);
  });

  it("next week means next Monday", () => {
    expect(iso("next week")).toBe("2026-10-12T16:00:00.000Z");
  });
});

describe("parseDeadline — times", () => {
  it("a bare time later today", () => {
    const result = parse("call at 2:30pm");
    expect(result?.at.toISOString()).toBe("2026-10-05T13:30:00.000Z");
    expect(result?.confidence).toBe(0.75);
  });

  it("a bare time already past today rolls to tomorrow", () => {
    expect(iso("at 7am")).toBe("2026-10-06T06:00:00.000Z");
  });

  it("24-hour times", () => {
    expect(iso("tomorrow 14:30")).toBe("2026-10-06T13:30:00.000Z");
  });

  it("noon and midday", () => {
    expect(iso("tomorrow at noon")).toBe("2026-10-06T11:00:00.000Z");
    expect(iso("tomorrow midday")).toBe("2026-10-06T11:00:00.000Z");
  });

  it("parts of the day", () => {
    expect(iso("tomorrow afternoon")).toBe("2026-10-06T13:00:00.000Z");
    expect(iso("this evening")).toBe("2026-10-05T17:00:00.000Z");
  });

  it("12am is midnight, 12pm is noon", () => {
    expect(iso("tomorrow 12am")).toBe("2026-10-05T23:00:00.000Z");
    expect(iso("tomorrow 12pm")).toBe("2026-10-06T11:00:00.000Z");
  });

  it("an out-of-range 12-hour time is not a time", () => {
    expect(parse("13pm")).toBeNull();
  });
});

describe("parseDeadline — defaults and non-matches", () => {
  it("returns null when there is no date or time", () => {
    expect(parse("Call Mum")).toBeNull();
  });

  it("defaults to UTC when no timezone is given", () => {
    expect(parseDeadline("tomorrow", { clock })?.at.toISOString()).toBe(
      "2026-10-06T17:00:00.000Z"
    );
  });
});

describe("zonedTimeToUtc", () => {
  it("converts wall-clock time in a western timezone", () => {
    expect(
      zonedTimeToUtc({ year: 2026, month: 7, day: 1 }, 9, 0, "America/New_York").toISOString()
    ).toBe("2026-07-01T13:00:00.000Z");
  });

  it("converts across a DST boundary in the same zone", () => {
    expect(
      zonedTimeToUtc({ year: 2026, month: 12, day: 1 }, 9, 0, "America/New_York").toISOString()
    ).toBe("2026-12-01T14:00:00.000Z");
  });
});

describe("helpers", () => {
  it("parseNumber reads digits and number words", () => {
    expect(parseNumber("12")).toBe(12);
    expect(parseNumber("three")).toBe(3);
    expect(parseNumber("an")).toBe(1);
    expect(parseNumber("lots")).toBeNull();
  });

  it("removeSpans cuts the matched words and tidies whitespace", () => {
    const text = "Call John tomorrow at 2pm.";
    const parsed = parse(text);
    expect(removeSpans(text, parsed!.spans)).toBe("Call John.");
  });
});

describe("timezone helpers", () => {
  it("isValidTimeZone accepts IANA names and rejects anything else", () => {
    expect(isValidTimeZone("Europe/London")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });

  it("localDateString gives the calendar date where the user is", () => {
    // 11pm Monday in New York is already Tuesday in UTC.
    const instant = new Date("2026-10-06T03:00:00Z");
    expect(localDateString(instant, "America/New_York")).toBe("2026-10-05");
    expect(localDateString(instant, "UTC")).toBe("2026-10-06");
  });
});
