import { describe, expect, it } from "vitest";
import { fixedClock } from "./clock";
import {
  classify,
  extract,
  extractItem,
  matchEstimate,
  matchRecurrence,
  splitFragments,
  suggestArea,
} from "./extract";
import { extractionProposalSchema } from "./proposal";

const options = { clock: fixedClock("2026-10-05T08:00:00Z"), timeZone: "Europe/London" };

describe("splitFragments", () => {
  it("splits on lines, bullets, sentences, semicolons and commas", () => {
    expect(
      splitFragments("- Call John\n* Email Sue; book flights. Pay rent, walk dog")
    ).toEqual(["Call John", "Email Sue", "book flights.", "Pay rent", "walk dog"]);
  });

  it("strips numbered-list markers", () => {
    expect(splitFragments("1) Call John\n2. Email Sue")).toEqual(["Call John", "Email Sue"]);
  });

  it("keeps the comma inside 'December 25, 2026' with its date", () => {
    expect(splitFragments("Party on December 25, 2026, buy gifts")).toEqual([
      "Party on December 25 2026",
      "buy gifts",
    ]);
  });
});

describe("matchRecurrence", () => {
  it("counted cadences", () => {
    expect(matchRecurrence("gym three times this week")).toMatchObject({
      frequency: "weekly",
      timesPerPeriod: 3,
    });
    expect(matchRecurrence("stretch 2x a day")).toMatchObject({
      frequency: "daily",
      timesPerPeriod: 2,
    });
    expect(matchRecurrence("water plants twice a week")).toMatchObject({ timesPerPeriod: 2 });
    expect(matchRecurrence("call gran once a month")).toMatchObject({
      frequency: "monthly",
      timesPerPeriod: 1,
    });
  });

  it("'every' cadences", () => {
    expect(matchRecurrence("meditate every morning")).toMatchObject({ frequency: "daily" });
    expect(matchRecurrence("bins out every Monday")).toMatchObject({ frequency: "weekly" });
    expect(matchRecurrence("pay rent every month")).toMatchObject({ frequency: "monthly" });
  });

  it("adverbs", () => {
    expect(matchRecurrence("journal daily")).toMatchObject({ frequency: "daily" });
    expect(matchRecurrence("review budget monthly")).toMatchObject({ frequency: "monthly" });
    expect(matchRecurrence("team sync weekly")).toMatchObject({ frequency: "weekly" });
  });

  it("no cadence", () => {
    expect(matchRecurrence("call John")).toBeNull();
  });
});

describe("classify", () => {
  it.each([
    ["Idea: a podcast about gardening", "note"],
    ["what if we moved to Leeds", "note"],
    ["should I switch banks?", "note"],
    ["learn Spanish", "goal"],
    ["grow my side business", "goal"],
    ["plan the wedding", "project"],
    ["declutter the loft", "project"],
    ["launch the new website", "project"],
    ["call the plumber", "task"],
  ])("%s → %s", (fragment, kind) => {
    expect(classify(fragment, false)).toBe(kind);
  });

  it("a cadence makes anything recurring", () => {
    expect(classify("learn Spanish", true)).toBe("recurring");
  });
});

describe("suggestArea", () => {
  it.each([
    ["Send the client deck", "Work"],
    ["Pay the council tax bill", "Personal admin"],
    ["Fix the boiler", "Home"],
    ["Book a yoga class", "Health"],
    ["Ring my sister", "Family"],
  ])("%s → %s", (title, area) => {
    expect(suggestArea(title)).toBe(area);
  });

  it("returns null when nothing matches", () => {
    expect(suggestArea("Think about life")).toBeNull();
  });
});

describe("matchEstimate", () => {
  it("explicit minutes and hours with a lead-in", () => {
    expect(matchEstimate("write intro (about 30 mins)")?.minutes).toBe(30);
    expect(matchEstimate("deep clean takes 2 hours")?.minutes).toBe(120);
    expect(matchEstimate("review for 45 minutes")?.minutes).toBe(45);
    expect(matchEstimate("stretch ~10 min")?.minutes).toBe(10);
  });

  it("phrases", () => {
    expect(matchEstimate("tidy desk for half an hour")?.minutes).toBe(30);
    expect(matchEstimate("read about an hour")?.minutes).toBe(60);
  });

  it("ignores durations without a lead-in, which are usually deadlines", () => {
    expect(matchEstimate("call back in 2 hours")).toBeNull();
  });

  it("rejects absurd estimates", () => {
    expect(matchEstimate("nap for 0 minutes")).toBeNull();
    expect(matchEstimate("work for 99 hours")).toBeNull();
  });
});

describe("extractItem", () => {
  it("strips filler, deadline and estimate from the title, and capitalises it", () => {
    expect(
      extractItem("I really need to email Sue by Friday (about 15 mins)", options)
    ).toEqual({
      kind: "task",
      title: "Email Sue",
      deadline: { at: "2026-10-09T16:00:00.000Z", confidence: 0.85, source: "by Friday" },
      recurrence: null,
      estimatedMinutes: 15,
      project: null,
    });
  });

  it("a recurring item's 'every Monday' is its cadence, not a deadline", () => {
    expect(extractItem("bins out every Monday", options)).toMatchObject({
      kind: "recurring",
      title: "Bins out",
      deadline: null,
      recurrence: { frequency: "weekly", timesPerPeriod: 1 },
      project: "Home",
    });
  });

  it("keeps a question mark on notes that are questions", () => {
    expect(extractItem("should I switch banks?", options)).toMatchObject({
      kind: "note",
      title: "Should I switch banks?",
      project: null,
    });
  });

  it("drops noise and empty fragments", () => {
    expect(extractItem("I've got so much on my plate", options)).toBeNull();
    expect(extractItem("That's it.", options)).toBeNull();
    expect(extractItem("and also", options)).toBeNull();
  });
});

describe("extract", () => {
  it("de-duplicates repeated items, case-insensitively", () => {
    const proposal = extract("Call Mum\ncall mum\nCall Mum.", options);
    expect(proposal.items).toHaveLength(1);
  });

  it("caps output at the schema's 200-item limit", () => {
    const raw = Array.from({ length: 250 }, (_, i) => `Task number ${i}`).join("\n");
    expect(extract(raw, options).items).toHaveLength(200);
  });

  it("always emits output that satisfies the shared AI/heuristic contract", () => {
    const proposal = extract(
      "Call John tomorrow at 2pm; gym 3x a week; idea: start a blog",
      options
    );
    expect(() => extractionProposalSchema.parse(proposal)).not.toThrow();
  });

  it("returns an empty proposal for empty input", () => {
    expect(extract("   ", options)).toEqual({ engine: "heuristic", items: [] });
  });
});
