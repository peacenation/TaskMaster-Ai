import { describe, expect, it } from "vitest";
import { contrastLevel, contrastRatio, parseRgb, relativeLuminance } from "./contrast";

describe("parseRgb", () => {
  it("parses an rgb() string", () => {
    expect(parseRgb("rgb(251, 246, 238)")).toEqual([251, 246, 238]);
  });

  it("parses an rgba() string, ignoring alpha", () => {
    expect(parseRgb("rgba(28, 20, 13, 0.6)")).toEqual([28, 20, 13]);
  });

  it("returns null for an unparseable value", () => {
    expect(parseRgb("transparent")).toBeNull();
  });
});

describe("relativeLuminance", () => {
  it("is 1 for white", () => {
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 5);
  });

  it("is 0 for black", () => {
    expect(relativeLuminance([0, 0, 0])).toBeCloseTo(0, 5);
  });
});

describe("contrastRatio", () => {
  it("is 21:1 for black on white (the WCAG maximum)", () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 1);
  });

  it("is 1:1 for identical colours", () => {
    expect(contrastRatio([100, 100, 100], [100, 100, 100])).toBeCloseTo(1, 5);
  });

  it("is symmetric regardless of argument order", () => {
    const a: [number, number, number] = [46, 32, 19];
    const b: [number, number, number] = [251, 246, 238];
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
  });

  it("matches the text-primary/surface-page pair fixed in app/globals.css", () => {
    // #2e2013 on #fbf6ee — verified 14.65:1 while building the dark-mode
    // token pass (docs/DESIGN_SYSTEM.md). A regression here means the
    // token values or this math drifted apart.
    const ratio = contrastRatio([0x2e, 0x20, 0x13], [0xfb, 0xf6, 0xee]);
    expect(ratio).toBeCloseTo(14.65, 1);
  });
});

describe("contrastLevel", () => {
  it("classifies AA-normal at or above 4.5:1", () => {
    expect(contrastLevel(4.5)).toBe("AA-normal");
    expect(contrastLevel(7)).toBe("AA-normal");
  });

  it("classifies AA-large-or-ui between 3:1 and 4.5:1", () => {
    expect(contrastLevel(3)).toBe("AA-large-or-ui");
    expect(contrastLevel(4.49)).toBe("AA-large-or-ui");
  });

  it("classifies fail below 3:1", () => {
    expect(contrastLevel(2.99)).toBe("fail");
  });
});
