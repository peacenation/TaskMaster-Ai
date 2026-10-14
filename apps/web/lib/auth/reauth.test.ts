import { describe, expect, it } from "vitest";
import { isRecentSignIn, REAUTH_WINDOW_MS } from "./reauth";

describe("isRecentSignIn", () => {
  const now = Date.UTC(2026, 9, 12, 12, 0, 0);
  it("accepts a session started inside the window", () => {
    expect(isRecentSignIn(new Date(now - REAUTH_WINDOW_MS + 1000), now)).toBe(true);
  });
  it("rejects an unknown sign-in time", () => {
    expect(isRecentSignIn(null, now)).toBe(false);
  });
  it("rejects a session at or past the window", () => {
    expect(isRecentSignIn(new Date(now - REAUTH_WINDOW_MS), now)).toBe(false);
    expect(isRecentSignIn(new Date(now - 24 * 60 * 60 * 1000), now)).toBe(false);
  });
});
