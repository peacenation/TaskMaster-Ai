# TaskMaster — Scoring Model

How TaskMaster decides what matters, what to do next, and what fits in a
day. Written so it can be reviewed and tuned **without reading the code**
(IMPLEMENTATION_PLAN.md Phase 4 output). The code lives in
[`lib/domain/prioritize.ts`](../lib/domain/prioritize.ts),
[`plan.ts`](../lib/domain/plan.ts), and
[`nextBestAction.ts`](../lib/domain/nextBestAction.ts). If a weight here
disagrees with `WEIGHTS` in `prioritize.ts`, that's a bug — fix one or
the other, never leave them apart.

> **Review status:** Phase 4's exit criteria require this document to be
> reviewed by someone who did not write the code. **That has not happened
> yet.** Until it does, treat every number below as a reasoned first guess,
> not a validated one.

## The principle

Every point of score comes with a plain-English reason. A task is never
ranked by a number the user can't see the working for (PRD_v2.md §1.11
Explainability, §2.3). The recommendation message is assembled from the
same reasons that produced the score, so the explanation can't drift
from the actual logic.

## Score components

A task starts at 0. Each signal below adds (or subtracts) a fixed amount,
and records a reason. Signals the user hasn't set add nothing — an unset
importance is neutral, not low.

| Signal | Points | Reason shown | Notes |
|---|---|---|---|
| Your own priority (1–5) | ±10 per point from 3 | "you marked it high priority" | Strongest single signal — **AI recommends, user decides** (§1.5) |
| Importance (1–5) | ±8 per point from 3 | "it's marked important" | |
| Urgency (1–5) | ±6 per point from 3 | "it's marked urgent" | Deliberately weaker than importance |
| Overdue | +40 | "it's overdue" | |
| Due today | +30 | "it's due today" | |
| Due tomorrow | +25 | "it's due tomorrow" | |
| Due within 3 days | +18 | "it's due on Thursday" | Names the weekday |
| Due within 7 days | +10 | "it's due within a week" | |
| Due within 31 days | +4 | "it's due this month" | |
| Other open tasks depend on it | +8 each, max 3 | "2 other tasks depend on it" | Unblocking work is high-leverage |
| Linked to a goal | +5 | "it moves a goal forward" | |
| In the project you're focusing on | +6 | "it's in the project you're focusing on" | |
| Already in progress | +5 | "you've already started it" | Momentum; avoids half-finished work piling up |
| **Neglected long-term work** | +1/day after 7 days, max 10 | "you haven't made progress on it in 21 days" | See *Anti-crowding* below |

Deadline buckets are **calendar days in the user's timezone**, not elapsed
hours. A Thursday 5pm deadline seen on Monday at 9am is "due on Thursday",
even though it's 3 days and 8 hours away.

### Right-now constraints

Only applied when the user says how much time or energy they have
("I have 20 minutes", PRD §2.2 Available-Time Input). They change the
*next action*, not the day's plan.

| Situation | Points | Reason shown |
|---|---|---|
| Needs more time than you have | −30 | "it needs about 90 minutes and you have 20" |
| Fits in the time you have | +10 | "it fits in the 20 minutes you have" |
| Quick, relative to the time you have | up to +6 | "it's quick" |
| You're low on energy, it needs high | −25 | "it needs more energy than you have right now" |
| You're low on energy, it needs medium | −8 | (same) |
| You're low on energy, it needs low | +5 | "it suits your energy right now" |

The quick-win bonus exists because under a time limit, a task you can
*finish* is worth more than one you can only start.

### Ties

Equal scores are broken by earliest deadline, then oldest task, then id —
so the same inputs always produce the same order.

### Blocked tasks

A task waiting on another unfinished task is never recommended as the
next action and never placed in a plan, however high it scores. It is
still scored and reported, so the UI can say what it's waiting on.

## Anti-crowding (PRD_v2.md §7.5 item 8)

> *"Avoid allowing every urgent item to permanently crowd out important
> long-term work."*

Left alone, a scoring model like this one starves long-term work: anything
with a deadline will always outscore a goal that has none. TaskMaster
counters that with **two explicit, separately visible mechanisms**, not a
side effect of tuning other weights:

1. **A modest scoring nudge (neglect).** Work linked to a goal, or marked
   important with no deadline, gains +1 point per day it goes untouched
   after a 7-day grace period, up to +10. It lifts stale long-term work
   above idle tasks — but is *deliberately* too weak to push it above
   equally important work due within a few days.

2. **A protected slot in the daily plan (the guarantee).** If a day's plan
   would otherwise contain no long-term work at all, the planner protects
   one slot for the best long-term candidate, making room by dropping the
   lowest-ranked items **that have no deadline within the next 7 days**.
   It never displaces near-deadline work to do so — if there's no room
   without breaking a deadline, the slot isn't forced. A protected item is
   marked as such, with the reason "it's protected so urgent work doesn't
   crowd out your longer-term goal".

This split mirrors the PRD's worked example: the quarterly report (due
Thursday, important) is still the next action, while the neglected side
business gets protected time rather than overtaking it.

## The daily plan

- **Realistic, not full.** 20% of the stated available time is held back
  as buffer (PRD §1.5 "Realistic Planning"). A 4-hour day plans at most
  3 h 12 m of work.
- **Unestimated tasks** are planned at 30 minutes and flagged as a guess,
  so the UI can say so rather than present it as known.
- **No stated availability:** the plan is capped at 5 items instead.
- **Scheduled mode** places tasks in back-to-back blocks with a 10-minute
  gap, starting at the next quarter hour. The gaps count against
  capacity.
- **Capacity warning.** If work due within 24 hours (or overdue) alone
  needs more than the usable time, the plan is flagged *overloaded*. That
  only triggers a warning — it never silently drops committed work (PRD
  §2.4 Flow 5, §3.2 Reality Check).

## The recommendation message

The top three positive reasons, by weight, joined into the shape PRD §2.3
gives:

> Finish the quarterly report next — it's due on Thursday and it's marked
> important.

When a time or energy constraint changes the answer, the message names
what was displaced and why, rather than silently swapping it:

> You don't have enough time or energy for meaningful progress on "Finish
> the quarterly report" right now. Book the dentist now — it fits in the
> 20 minutes you have, it suits your energy right now, and it's quick.
> Come back to "Finish the quarterly report" when you have a longer
> stretch.

Both messages are asserted verbatim in
[`lib/domain/golden.test.ts`](../lib/domain/golden.test.ts), against the
PRD's own worked example.

## Known limitations

- **Every weight is a first guess.** None has been validated against real
  usage. PRD_v2.md §2.9 already lists "AI correction rate" and
  "recommendation usefulness" as metrics — those are what should tune
  these numbers, not intuition.
- **Neglect is measured from `lastProgressAt`**, which nothing populates
  yet. Until task events (Phase 3's `task_events` table) feed it, it falls
  back to the task's creation date.
- **Energy only matters when the user is low on it.** "High energy"
  doesn't currently favour demanding work.
- **Dependencies count direct dependents only**, not the full chain of
  work transitively unblocked.
