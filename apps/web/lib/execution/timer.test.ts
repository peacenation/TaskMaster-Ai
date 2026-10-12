import { describe, expect, it } from "vitest";
import { pauseTimer, readTimer, remainingTime, resumeTimer, startTimer } from "./timer";
describe("persisted focus timer", () => {
  it("keeps the original 20-minute deadline across reload", () => {
    const state = startTimer(20, 1000);
    const restored = readTimer(JSON.stringify(state))!;
    expect(remainingTime(restored, 61000)).toBe(19 * 60000);
    expect(remainingTime(restored, 1300000)).toBe(0);
  });
  it("pauses without consuming time and resumes from the remaining interval", () => {
    const state = pauseTimer(startTimer(20, 1000), 61000);
    expect(remainingTime(state, 9000000)).toBe(19 * 60000);
    expect(remainingTime(resumeTimer(state, 9000000), 9060000)).toBe(18 * 60000);
  });
  it("rejects corrupt storage", () => {
    for (const value of [
      null,
      "{",
      "{}",
      '{"remainingMs":-1,"endAt":null}',
      '{"remainingMs":10,"endAt":"bad"}',
    ])
      expect(readTimer(value)).toBeNull();
  });
});
