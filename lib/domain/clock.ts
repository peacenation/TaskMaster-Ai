// Domain modules never call Date.now() or `new Date()` without an argument
// (IMPLEMENTATION_PLAN.md D4) — "now" is always injected, so every test
// controls it.
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export function fixedClock(iso: string): Clock {
  const fixed = new Date(iso);
  return { now: () => new Date(fixed) };
}
