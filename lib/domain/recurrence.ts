export type RecurrenceFrequency = "daily" | "weekly" | "monthly";

export interface RecurrenceSchedule {
  frequency: RecurrenceFrequency;
  intervalCount: number;
  timesPerPeriod: number;
  startDate: string;
  endDate?: string | null;
  daysOfWeek?: number[] | null;
}

export interface RecurrenceOccurrence {
  date: string;
  slot: number;
}

function parseDate(value: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || parsed.toISOString().slice(0, 10) !== value) {
    throw new RangeError(`Invalid calendar date: ${value}`);
  }
  return parsed;
}

function dateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function monthLength(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function scheduleDays(schedule: RecurrenceSchedule, year: number, month: number): number[] {
  if (schedule.frequency === "daily") return [0];
  if (schedule.frequency === "weekly" && schedule.daysOfWeek?.length) {
    return [...new Set(schedule.daysOfWeek)].sort((left, right) => left - right);
  }

  const periodLength = schedule.frequency === "weekly" ? 7 : monthLength(year, month);
  const count = Math.min(schedule.timesPerPeriod, periodLength);
  return Array.from({ length: count }, (_, index) =>
    Math.floor((index * periodLength) / count)
  );
}

/** Generate planned occurrence slots inside an inclusive calendar-date range. */
export function occurrencesBetween(
  schedule: RecurrenceSchedule,
  fromDate: string,
  throughDate: string
): RecurrenceOccurrence[] {
  if (!Number.isInteger(schedule.intervalCount) || schedule.intervalCount < 1) {
    throw new RangeError("intervalCount must be a positive integer");
  }
  if (!Number.isInteger(schedule.timesPerPeriod) || schedule.timesPerPeriod < 1) {
    throw new RangeError("timesPerPeriod must be a positive integer");
  }

  const start = parseDate(schedule.startDate);
  const from = parseDate(fromDate);
  const through = parseDate(throughDate);
  const end = schedule.endDate ? parseDate(schedule.endDate) : through;
  if (through < from || end < start) return [];

  const firstDay = new Date(Math.max(start.getTime(), from.getTime()));
  const lastDay = new Date(Math.min(through.getTime(), end.getTime()));
  const results: RecurrenceOccurrence[] = [];

  for (let day = firstDay; day <= lastDay; day.setUTCDate(day.getUTCDate() + 1)) {
    const elapsedDays = Math.floor((day.getTime() - start.getTime()) / 86_400_000);
    let periodIndex: number;
    let periodDay: number;

    if (schedule.frequency === "daily") {
      periodIndex = elapsedDays;
      periodDay = 0;
    } else if (schedule.frequency === "weekly") {
      const startWeekday = start.getUTCDay();
      const dayOffset = (day.getUTCDay() - startWeekday + 7) % 7;
      const weekStartOffset = elapsedDays - dayOffset;
      periodIndex = Math.floor(weekStartOffset / 7);
      periodDay = schedule.daysOfWeek?.length ? day.getUTCDay() : dayOffset;
    } else {
      const startMonth = start.getUTCFullYear() * 12 + start.getUTCMonth();
      const currentMonth = day.getUTCFullYear() * 12 + day.getUTCMonth();
      periodIndex = currentMonth - startMonth;
      periodDay = day.getUTCDate() - 1;
    }

    if (periodIndex % schedule.intervalCount !== 0) continue;
    const selectedDays = scheduleDays(schedule, day.getUTCFullYear(), day.getUTCMonth());
    if (!selectedDays.includes(periodDay)) continue;

    const slots = schedule.frequency === "daily" ? schedule.timesPerPeriod : 1;
    for (let slot = 0; slot < slots; slot++) {
      results.push({ date: dateString(day), slot });
    }
  }

  return results;
}
