import { fixedClock } from "../clock";
import { makeTask, type PlannableTask } from "../task";

// PRD worked example, verbatim — docs/archive/PRD_v1.md §20 "Example User
// Experience". v1 is archived for scope, but this example is the clearest
// executable statement of what the product should do, and PRD_v2.md §1.1
// carries the same promise forward. Used as the golden contract for the
// domain engine (IMPLEMENTATION_PLAN.md Phase 4, work item 8).

export const PRD_BRAIN_DUMP =
  "I've got loads going on. I need to finish the quarterly report by Thursday, book the dentist, start sorting the garage, go to the gym three times this week, call Mum, renew my car insurance before the end of the month, and I really need to start working on my side business again.";

/** Monday 5 October 2026, 09:00 London. */
export const PRD_CLOCK = fixedClock("2026-10-05T08:00:00Z");
export const PRD_TIME_ZONE = "Europe/London";

const DAY = 24 * 60 * 60 * 1000;
const now = PRD_CLOCK.now();

/**
 * The extracted items after a user has confirmed them and added what the
 * extractor can't know: rough estimates, energy, and which ones matter.
 * These annotations are the fixture's assumptions — the PRD gives the
 * outcome, not the numbers, so these are chosen to be plausible, not tuned.
 */
export const PRD_TASKS: PlannableTask[] = [
  makeTask({
    id: "report",
    title: "Finish the quarterly report",
    importance: 4,
    dueAt: new Date("2026-10-08T16:00:00Z"), // "by Thursday", 5pm London
    estimatedMinutes: 90,
    energy: "high",
    createdAt: now,
  }),
  makeTask({
    id: "dentist",
    title: "Book the dentist",
    estimatedMinutes: 5,
    energy: "low",
    createdAt: now,
  }),
  makeTask({
    id: "garage",
    title: "Start sorting the garage",
    estimatedMinutes: 60,
    energy: "medium",
    createdAt: now,
  }),
  makeTask({
    id: "gym",
    title: "Go to the gym",
    estimatedMinutes: 60,
    energy: "high",
    createdAt: now,
  }),
  makeTask({
    id: "mum",
    title: "Call Mum",
    estimatedMinutes: 15,
    energy: "low",
    createdAt: now,
  }),
  makeTask({
    id: "insurance",
    title: "Renew my car insurance",
    dueAt: new Date("2026-10-31T17:00:00Z"), // end of month, 5pm London (GMT)
    estimatedMinutes: 20,
    energy: "medium",
    createdAt: now,
  }),
  makeTask({
    id: "side-business",
    title: "Start working on my side business again",
    importance: 4,
    goalId: "goal-side-business",
    estimatedMinutes: 60,
    energy: "medium",
    // "I really need to start ... again" — untouched for three weeks.
    lastProgressAt: new Date(now.getTime() - 21 * DAY),
    createdAt: new Date(now.getTime() - 60 * DAY),
  }),
];
