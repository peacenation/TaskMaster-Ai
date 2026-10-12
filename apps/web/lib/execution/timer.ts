export interface FocusTimerState {
  endAt: number | null;
  remainingMs: number;
}
export function remainingTime(timer: FocusTimerState, now: number) {
  return Math.max(0, timer.endAt === null ? timer.remainingMs : timer.endAt - now);
}
export function startTimer(minutes: number, now: number): FocusTimerState {
  return { endAt: now + minutes * 60000, remainingMs: minutes * 60000 };
}
export function pauseTimer(timer: FocusTimerState, now: number): FocusTimerState {
  return { endAt: null, remainingMs: remainingTime(timer, now) };
}
export function resumeTimer(timer: FocusTimerState, now: number): FocusTimerState {
  return { endAt: now + timer.remainingMs, remainingMs: timer.remainingMs };
}
export function readTimer(value: string | null): FocusTimerState | null {
  try {
    const parsed = JSON.parse(value || "null");
    if (
      parsed &&
      Number.isFinite(parsed.remainingMs) &&
      parsed.remainingMs >= 0 &&
      (parsed.endAt === null || Number.isFinite(parsed.endAt))
    )
      return parsed;
  } catch {}
  return null;
}
