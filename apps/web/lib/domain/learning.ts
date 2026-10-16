// Learned estimates (PRD §3.1 Improved Duration Estimates, §3.x Adaptive
// Planning): from tasks the person started and finished, learn how their
// real time compares with their estimates, and how long unestimated work
// typically takes. Today's plan uses both, and says so.

/** Below this many finished examples, guesses would be noise: don't adjust. */
export const MIN_SAMPLES = 5;

/** A started-then-completed duration counts only within these bounds. */
export const ACTUAL_BOUNDS = { min: 1, max: 8 * 60 } as const;

export interface DurationSample {
  estimatedMinutes: number | null;
  actualMinutes: number;
}

export interface LearnedEstimates {
  /** Multiply an estimate by this; 1 until there's enough evidence. */
  factor: number;
  /** Planned length for unestimated tasks (default 30 until learned). */
  typicalMinutes: number;
  /** How many examples the estimates are based on. */
  samples: number;
}

export const NO_LEARNING: LearnedEstimates = { factor: 1, typicalMinutes: 30, samples: 0 };

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Minutes from starting to completing, when that's a believable duration. */
export function actualMinutes(startedAt: Date | null, completedAt: Date): number | null {
  if (!startedAt) return null;
  const minutes = Math.round((completedAt.getTime() - startedAt.getTime()) / 60_000);
  return minutes >= ACTUAL_BOUNDS.min && minutes <= ACTUAL_BOUNDS.max ? minutes : null;
}

export function learnEstimates(samples: ReadonlyArray<DurationSample>): LearnedEstimates {
  const ratios = samples
    .filter((s) => s.estimatedMinutes !== null && s.estimatedMinutes > 0)
    .map((s) => s.actualMinutes / s.estimatedMinutes!);
  const actuals = samples.map((s) => s.actualMinutes);
  const factor =
    ratios.length >= MIN_SAMPLES
      ? // Median, not mean: one forgotten-open task shouldn't skew the plan.
        Math.round(Math.min(2.5, Math.max(0.5, median(ratios))) * 10) / 10
      : 1;
  const typicalMinutes =
    actuals.length >= MIN_SAMPLES
      ? Math.min(120, Math.max(10, Math.round(median(actuals) / 5) * 5))
      : 30;
  return { factor, typicalMinutes, samples: samples.length };
}

/** Planned minutes for a task, given what's been learned. Rounded to 5. */
export function plannedMinutes(
  estimatedMinutes: number | null,
  learned: LearnedEstimates = NO_LEARNING
): number {
  if (estimatedMinutes === null) return learned.typicalMinutes;
  if (learned.factor === 1) return estimatedMinutes;
  return Math.max(5, Math.round((estimatedMinutes * learned.factor) / 5) * 5);
}

/** e.g. "Your tasks usually take about 1.4× your estimate." */
export function learnedSummary(learned: LearnedEstimates): string | null {
  if (learned.samples < MIN_SAMPLES) return null;
  if (learned.factor > 1.05)
    return `Your tasks usually take about ${learned.factor}× your estimate, so the plan allows for that.`;
  if (learned.factor < 0.95)
    return `You usually finish faster than you estimate (about ${learned.factor}×), so the plan allows for that.`;
  return "Your estimates are usually spot on.";
}
