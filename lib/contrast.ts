// Pure WCAG 2.1 contrast-ratio math. No DOM, no framework — see
// docs/IMPLEMENTATION_PLAN.md Phase 4 (D4: domain logic is pure and
// framework-free). The DOM probe that resolves CSS custom properties into
// concrete rgb() strings lives in app/design/page.tsx, which calls into
// this module for the actual arithmetic.

export type Rgb = [number, number, number];

export function parseRgb(value: string): Rgb | null {
  const match = value.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function srgbChannelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance([r, g, b]: Rgb): number {
  return (
    0.2126 * srgbChannelToLinear(r) +
    0.7152 * srgbChannelToLinear(g) +
    0.0722 * srgbChannelToLinear(b)
  );
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const lumA = relativeLuminance(a);
  const lumB = relativeLuminance(b);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

export type ContrastLevel = "AA-normal" | "AA-large-or-ui" | "fail";

export function contrastLevel(ratio: number): ContrastLevel {
  if (ratio >= 4.5) return "AA-normal";
  if (ratio >= 3) return "AA-large-or-ui";
  return "fail";
}
