export interface ExtractedItem {
  id: string;
  text: string;
}

/**
 * Local heuristic fallback — always available, no network dependency.
 * See docs/adr/ADR-007-ai-fallback-policy.md: this is not a fallback
 * bolted on after the fact, it's the first-class path the real AI call
 * (docs/adr/ADR-006-ai-integration.md) sits on top of, never depends on.
 *
 * Splits on line breaks and sentence-ending punctuation, drops blanks.
 */
export function extractItems(rawText: string): ExtractedItem[] {
  return rawText
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((text) => ({ id: crypto.randomUUID(), text }));
}
