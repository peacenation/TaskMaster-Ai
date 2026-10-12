// Decompose a large or vague task into concrete steps (PRD_v2.md §2.2
// Task Breakdown, P1). Heuristic templates keyed on the kind of work; an
// AI-backed breakdown can sit on top of this later the same way AI
// extraction sits on top of lib/domain/extract.ts (ADR-007) — this path
// stays as the always-available fallback.

export interface Breakdown {
  /** False when the task is already a single concrete action. */
  needed: boolean;
  steps: string[];
}

const ATOMIC =
  /^(?:call|ring|phone|text|email|e-mail|book|pay|renew|buy|order|send|reply|cancel|post|print|sign|check|confirm|message)\b/i;

const DELIVERABLE =
  /\b(report|proposal|deck|presentation|slides|essay|document|article|cv|resume|newsletter)\b/i;

const SEND_NOT_SUBMIT = new Set(["proposal", "deck", "presentation", "slides", "newsletter"]);

const SPACE =
  /\b(?:sort|sorting|organi[sz]e|organi[sz]ing|clear|clearing|declutter|decluttering|tidy|tidying|clean|cleaning)\b.*?\b(garage|attic|loft|house|shed|room|office|kitchen|wardrobe|desk|basement)\b/i;

/** Above this, a task with no other template still gets a generic breakdown. */
const LARGE_TASK_MINUTES = 120;

export function breakdownTask(
  title: string,
  estimatedMinutes: number | null = null
): Breakdown {
  const small = estimatedMinutes === null || estimatedMinutes <= 30;
  if (ATOMIC.test(title.trim()) && small) return { needed: false, steps: [] };

  const deliverable = DELIVERABLE.exec(title);
  if (deliverable) {
    const noun = deliverable[1].toLowerCase();
    const gather =
      noun === "report"
        ? "Gather the missing figures"
        : `Gather what you need for the ${noun}`;
    const finish = SEND_NOT_SUBMIT.has(noun) ? "Send" : "Submit";
    return {
      needed: true,
      steps: [gather, `Draft the ${noun}`, `Review the ${noun}`, `${finish} the ${noun}`],
    };
  }

  const space = SPACE.exec(title);
  if (space) {
    const place = space[1].toLowerCase();
    return {
      needed: true,
      steps: [
        `Pick one corner of the ${place} to start with`,
        "Sort items into keep, donate, and bin",
        "Take the donations and rubbish away",
        `Put what's left back in the ${place}, in order`,
      ],
    };
  }

  const vague =
    /^(?:start|work\s+on|look\s+into|figure\s+out|think\s+about|sort\s+out|deal\s+with)\b/i.test(
      title.trim()
    );
  if (vague || (estimatedMinutes !== null && estimatedMinutes > LARGE_TASK_MINUTES)) {
    return {
      needed: true,
      steps: [
        "Write down what 'done' looks like",
        "List the first three concrete steps",
        "Do the first step — aim for 25 minutes",
      ],
    };
  }

  return { needed: false, steps: [] };
}
