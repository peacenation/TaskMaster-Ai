import { describe, expect, it } from "vitest";
import { isFollowUpDue, isParked, waitingPatch } from "./waiting";

const now = new Date("2026-10-16T09:00:00Z");
const later = new Date("2026-10-19T09:00:00Z");
const earlier = new Date("2026-10-15T09:00:00Z");

describe("waiting on someone", () => {
  it("parks a waiting task until its follow-up, then brings it back", () => {
    expect(isParked({ waitingOn: "Sam", followUpAt: later }, now)).toBe(true);
    expect(isFollowUpDue({ waitingOn: "Sam", followUpAt: later }, now)).toBe(false);
    expect(isParked({ waitingOn: "Sam", followUpAt: earlier }, now)).toBe(false);
    expect(isFollowUpDue({ waitingOn: "Sam", followUpAt: earlier }, now)).toBe(true);
  });

  it("leaves ordinary tasks alone", () => {
    expect(isParked({ waitingOn: null, followUpAt: null }, now)).toBe(false);
    expect(isFollowUpDue({}, now)).toBe(false);
  });

  it("defaults the follow-up to three days and clears everything when done", () => {
    expect(waitingPatch(" Sam ", undefined, now)).toEqual({
      waitingOn: "Sam",
      waitingSince: now,
      followUpAt: later,
    });
    expect(waitingPatch("", later, now)).toEqual({
      waitingOn: null,
      waitingSince: null,
      followUpAt: null,
    });
  });
});
