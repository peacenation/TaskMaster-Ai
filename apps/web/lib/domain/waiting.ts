// Waiting On (PRD §4.1, P1): the next step belongs to someone else — a
// reply, a delivery, a sign-off. The task stays the user's, but it leaves
// today's plan until it's time to chase, then comes back with a nudge.

const DAY_MS = 86_400_000;

/** Chase after this long when the user doesn't pick a date. */
export const DEFAULT_FOLLOW_UP_DAYS = 3;

export interface Waitable {
  waitingOn?: string | null;
  followUpAt?: Date | null;
}

/** Waiting, and not yet time to follow up: keep it out of the plan. */
export function isParked(task: Waitable, now: Date): boolean {
  return !!task.waitingOn && (!task.followUpAt || task.followUpAt > now);
}

/** Waiting, and the follow-up date has come: time to chase. */
export function isFollowUpDue(task: Waitable, now: Date): boolean {
  return !!task.waitingOn && !!task.followUpAt && task.followUpAt <= now;
}

/** The fields to store when a task starts or stops waiting. */
export function waitingPatch(
  waitingOn: string | null,
  followUpAt: Date | null | undefined,
  now: Date
): { waitingOn: string | null; waitingSince: Date | null; followUpAt: Date | null } {
  const who = waitingOn?.trim() || null;
  if (!who) return { waitingOn: null, waitingSince: null, followUpAt: null };
  return {
    waitingOn: who,
    waitingSince: now,
    followUpAt: followUpAt ?? new Date(now.getTime() + DEFAULT_FOLLOW_UP_DAYS * DAY_MS),
  };
}
