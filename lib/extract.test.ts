import { describe, expect, it } from "vitest";
import { extractItems } from "./extract";

describe("extractItems", () => {
  it("splits on line breaks", () => {
    const result = extractItems("Call John tomorrow\nBook the car in for a service");
    expect(result.map((r) => r.text)).toEqual([
      "Call John tomorrow",
      "Book the car in for a service",
    ]);
  });

  it("splits on sentence-ending punctuation", () => {
    const result = extractItems("Finish the proposal. Send the invoice!");
    expect(result.map((r) => r.text)).toEqual(["Finish the proposal.", "Send the invoice!"]);
  });

  it("drops blank lines", () => {
    const result = extractItems("Task one\n\n\nTask two");
    expect(result.map((r) => r.text)).toEqual(["Task one", "Task two"]);
  });

  it("returns an empty array for blank input", () => {
    expect(extractItems("   \n  ")).toEqual([]);
  });

  it("assigns each item a unique id", () => {
    const result = extractItems("One\nTwo\nThree");
    const ids = new Set(result.map((r) => r.id));
    expect(ids.size).toBe(3);
  });

  it("works with no network access and no AI provider configured (ADR-007)", () => {
    // extractItems has no fetch/network dependency at all — this test just
    // documents that guarantee so a future import of a network call here
    // would be a visible regression against ADR-007's intent.
    expect(extractItems("Anything")).toHaveLength(1);
  });
});
