import { describe, expect, it } from "vitest";
import { safeNext } from "./redirect";

describe("safeNext", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/dump")).toBe("/dump");
    expect(safeNext("/reset?step=update")).toBe("/reset?step=update");
  });
  it("refuses anything that leaves the site", () => {
    for (const next of ["https://evil.example", "//evil.example", "/\\evil.example", "evil"])
      expect(safeNext(next)).toBe("/");
    expect(safeNext(null, "/settings")).toBe("/settings");
  });
});
