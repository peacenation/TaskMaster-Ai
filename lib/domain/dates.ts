import type { Clock } from "./clock";

// Natural-language deadline parser. Pattern-based, not a general NLP date
// library: it covers the forms PRD_v2.md and the implementation plan name
// explicitly (explicit dates, "tomorrow", "next Tuesday", "by Friday",
// "end of month", "in two weeks", "Friday morning", "2pm") and returns a
// confidence so vague readings are *proposed*, never asserted (§2.6).
//
// All calendar arithmetic happens in the user's timezone, then converts to
// a UTC instant — so "Friday 5pm" means 5pm where the user is, across DST.

export interface ParsedDeadline {
  at: Date;
  confidence: number;
  /** The matched words, e.g. "by Thursday" or "tomorrow at 2pm". */
  source: string;
  /** Character ranges in the input that were consumed, for title cleanup. */
  spans: Array<[number, number]>;
}

export interface ParseOptions {
  clock: Clock;
  timeZone?: string;
}

interface LocalDate {
  year: number;
  month: number; // 1–12
  day: number;
}

interface DateMatch {
  date: LocalDate;
  confidence: number;
  span: [number, number];
  defaultTime?: [number, number];
}

interface TimeMatch {
  hour: number;
  minute: number;
  confidence: number;
  span: [number, number];
}

/** Deadlines with a date but no time mean "by end of the working day". */
const DEFAULT_DEADLINE_TIME: [number, number] = [17, 0];

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};
const MONTH_PATTERN = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join("|");

// Abbreviations that are also ordinary words ("sat", "sun", "wed") are
// deliberately excluded — "I sat down" must not become a Saturday deadline.
const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  tues: 2,
  wednesday: 3,
  weds: 3,
  thursday: 4,
  thurs: 4,
  friday: 5,
  saturday: 6,
};
const WEEKDAY_PATTERN = Object.keys(WEEKDAYS)
  .sort((a, b) => b.length - a.length)
  .join("|");

const WORD_NUMBERS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

export function parseNumber(token: string): number | null {
  const lower = token.toLowerCase();
  if (/^\d+$/.test(lower)) return Number(lower);
  return WORD_NUMBERS[lower] ?? null;
}

// ---------------------------------------------------------------- timezones

const WEEKDAY_SHORT: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function zonedParts(instant: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAY_SHORT[parts.weekday],
  };
}

function offsetMinutes(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/** Wall-clock time in `timeZone` → the UTC instant it refers to. */
export function zonedTimeToUtc(
  date: LocalDate,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const guess = Date.UTC(date.year, date.month - 1, date.day, hour, minute);
  const first = guess - offsetMinutes(new Date(guess), timeZone) * 60000;
  // Second pass corrects for a DST transition between the guess and the answer.
  const second = guess - offsetMinutes(new Date(first), timeZone) * 60000;
  return new Date(second);
}

// ---------------------------------------------------- calendar arithmetic

function addDays(date: LocalDate, days: number): LocalDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addMonths(date: LocalDate, months: number): LocalDate {
  const index = date.month - 1 + months;
  const year = date.year + Math.floor(index / 12);
  const month = (((index % 12) + 12) % 12) + 1;
  return { year, month, day: Math.min(date.day, daysInMonth(year, month)) };
}

function weekdayOf(date: LocalDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

function compareDates(a: LocalDate, b: LocalDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

function isValidDate(year: number, month: number, day: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

// ------------------------------------------------------------ date matchers

const LEAD = String.raw`(?:\b(?:by|on|due(?:\s+(?:on|by))?|before|until|for)\s+)?`;

type DateMatcher = (text: string, today: LocalDate) => DateMatch | null;

function span(m: RegExpExecArray): [number, number] {
  return [m.index, m.index + m[0].length];
}

const isoDate: DateMatcher = (text) => {
  const m = new RegExp(LEAD + String.raw`\b(\d{4})-(\d{2})-(\d{2})\b`, "i").exec(text);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (!isValidDate(year, month, day)) return null;
  return { date: { year, month, day }, confidence: 0.95, span: span(m) };
};

function namedMonthDate(
  m: RegExpExecArray,
  monthToken: string,
  dayToken: string,
  yearToken: string | undefined,
  today: LocalDate
): DateMatch | null {
  const month = MONTHS[monthToken.toLowerCase()];
  const day = Number(dayToken);
  let year = yearToken ? Number(yearToken) : today.year;
  if (!isValidDate(year, month, day)) return null;
  if (!yearToken && compareDates({ year, month, day }, today) < 0) year += 1;
  return {
    date: { year, month, day },
    confidence: yearToken ? 0.95 : 0.9,
    span: span(m),
  };
}

const dayMonth: DateMatcher = (text, today) => {
  const m = new RegExp(
    LEAD +
      String.raw`\b(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(${MONTH_PATTERN})\b\.?(?:,?\s+(\d{4})\b)?`,
    "i"
  ).exec(text);
  return m ? namedMonthDate(m, m[2], m[1], m[3], today) : null;
};

const monthDay: DateMatcher = (text, today) => {
  const m = new RegExp(
    LEAD +
      String.raw`\b(${MONTH_PATTERN})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(\d{4})\b)?`,
    "i"
  ).exec(text);
  return m ? namedMonthDate(m, m[1], m[2], m[3], today) : null;
};

const relativeDay: DateMatcher = (text, today) => {
  const m = new RegExp(
    LEAD + String.raw`\b(the\s+day\s+after\s+tomorrow|today|tonight|tomorrow|tmrw)\b`,
    "i"
  ).exec(text);
  if (!m) return null;
  const word = m[1].toLowerCase().replace(/\s+/g, " ");
  if (word === "today") return { date: today, confidence: 0.9, span: span(m) };
  if (word === "tonight")
    return { date: today, confidence: 0.9, span: span(m), defaultTime: [19, 0] };
  if (word === "the day after tomorrow")
    return { date: addDays(today, 2), confidence: 0.9, span: span(m) };
  return { date: addDays(today, 1), confidence: 0.9, span: span(m) };
};

const inN: DateMatcher = (text, today) => {
  const m = new RegExp(
    String.raw`\bin\s+(\d+|${Object.keys(WORD_NUMBERS).join("|")})\s+(days?|weeks?|months?)\b`,
    "i"
  ).exec(text);
  if (!m) return null;
  const n = parseNumber(m[1]) as number;
  const unit = m[2].toLowerCase();
  const date = unit.startsWith("day")
    ? addDays(today, n)
    : unit.startsWith("week")
      ? addDays(today, n * 7)
      : addMonths(today, n);
  return { date, confidence: 0.85, span: span(m) };
};

const endOf: DateMatcher = (text, today) => {
  const m = new RegExp(
    String.raw`\b(?:(?:by|before|until)\s+)?(?:the\s+)?end\s+of\s+(?:the\s+|this\s+)?(week|month)\b`,
    "i"
  ).exec(text);
  if (!m) return null;
  if (m[1].toLowerCase() === "month") {
    return {
      date: { ...today, day: daysInMonth(today.year, today.month) },
      confidence: 0.6,
      span: span(m),
    };
  }
  const toFriday = (5 - weekdayOf(today) + 7) % 7;
  return { date: addDays(today, toFriday), confidence: 0.6, span: span(m) };
};

const nextWeek: DateMatcher = (text, today) => {
  const m = new RegExp(LEAD + String.raw`\bnext\s+week\b`, "i").exec(text);
  if (!m) return null;
  const toMonday = (1 - weekdayOf(today) + 7) % 7 || 7;
  return { date: addDays(today, toMonday), confidence: 0.6, span: span(m) };
};

const weekday: DateMatcher = (text, today) => {
  const m = new RegExp(
    LEAD + String.raw`\b(?:(next|this|coming)\s+)?(${WEEKDAY_PATTERN})\b`,
    "i"
  ).exec(text);
  if (!m) return null;
  const target = WEEKDAYS[m[2].toLowerCase()];
  let ahead = (target - weekdayOf(today) + 7) % 7;
  // "next Tuesday" is genuinely ambiguous (this coming one, or the week
  // after?). Read it as the nearest one strictly after today, and say so
  // with a lower confidence rather than guessing silently.
  const isNext = m[1]?.toLowerCase() === "next";
  if (isNext && ahead === 0) ahead = 7;
  return { date: addDays(today, ahead), confidence: isNext ? 0.75 : 0.85, span: span(m) };
};

// Most specific first: the first matcher that hits wins.
const DATE_MATCHERS: DateMatcher[] = [
  isoDate,
  dayMonth,
  monthDay,
  relativeDay,
  inN,
  endOf,
  nextWeek,
  weekday,
];

// ------------------------------------------------------------ time matchers

function matchTime(text: string): TimeMatch | null {
  const twelveHour = /\b(?:at\s+)?(\d{1,2})(?::([0-5]\d))?\s*(am|pm|a\.m\.|p\.m\.)/i.exec(
    text
  );
  if (twelveHour) {
    const raw = Number(twelveHour[1]);
    if (raw >= 1 && raw <= 12) {
      const pm = twelveHour[3].toLowerCase().startsWith("p");
      const hour = (raw % 12) + (pm ? 12 : 0);
      return {
        hour,
        minute: Number(twelveHour[2] ?? 0),
        confidence: 0.95,
        span: span(twelveHour),
      };
    }
  }

  const twentyFour = /\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/.exec(text);
  if (twentyFour) {
    return {
      hour: Number(twentyFour[1]),
      minute: Number(twentyFour[2]),
      confidence: 0.95,
      span: span(twentyFour),
    };
  }

  const named =
    /\b(?:at\s+)?(noon|midday)\b|\b(?:in\s+the\s+|this\s+)?(morning|afternoon|evening)\b/i.exec(
      text
    );
  if (named) {
    if (named[1]) return { hour: 12, minute: 0, confidence: 0.95, span: span(named) };
    const hours: Record<string, number> = { morning: 9, afternoon: 14, evening: 18 };
    // A part of the day is an approximation, not a time — say so.
    return {
      hour: hours[named[2].toLowerCase()],
      minute: 0,
      confidence: 0.8,
      span: span(named),
    };
  }

  return null;
}

// ------------------------------------------------------------------- public

export function todayIn(clock: Clock, timeZone: string): LocalDate {
  const p = zonedParts(clock.now(), timeZone);
  return { year: p.year, month: p.month, day: p.day };
}

export function parseDeadline(text: string, options: ParseOptions): ParsedDeadline | null {
  const timeZone = options.timeZone ?? "UTC";
  const now = options.clock.now();
  const today = todayIn(options.clock, timeZone);

  let dateMatch: DateMatch | null = null;
  for (const matcher of DATE_MATCHERS) {
    dateMatch = matcher(text, today);
    if (dateMatch) break;
  }

  // Don't let a time matcher re-read digits the date matcher already used
  // (e.g. the "25" in "25 December").
  const timeSearchText = dateMatch
    ? text.slice(0, dateMatch.span[0]) +
      " ".repeat(dateMatch.span[1] - dateMatch.span[0]) +
      text.slice(dateMatch.span[1])
    : text;
  const timeMatch = matchTime(timeSearchText);

  if (!dateMatch && !timeMatch) return null;

  let at: Date;
  let confidence: number;
  if (dateMatch && timeMatch) {
    at = zonedTimeToUtc(dateMatch.date, timeMatch.hour, timeMatch.minute, timeZone);
    confidence = Math.min(dateMatch.confidence, timeMatch.confidence);
  } else if (dateMatch) {
    const [hour, minute] = dateMatch.defaultTime ?? DEFAULT_DEADLINE_TIME;
    at = zonedTimeToUtc(dateMatch.date, hour, minute, timeZone);
    // "today" said after 5pm shouldn't produce a deadline already in the past.
    if (at <= now && compareDates(dateMatch.date, today) === 0) {
      at = zonedTimeToUtc(dateMatch.date, 23, 59, timeZone);
    }
    confidence = dateMatch.confidence;
  } else {
    const tm = timeMatch as TimeMatch;
    // A bare time means the next time it comes round.
    at = zonedTimeToUtc(today, tm.hour, tm.minute, timeZone);
    if (at <= now) at = zonedTimeToUtc(addDays(today, 1), tm.hour, tm.minute, timeZone);
    confidence = Math.min(0.75, tm.confidence);
  }

  const spans = [dateMatch?.span, timeMatch?.span]
    .filter((s): s is [number, number] => Boolean(s))
    .sort((a, b) => a[0] - b[0]);
  const source = spans
    .map(([start, end]) => text.slice(start, end).trim())
    .join(" ")
    .replace(/\s+/g, " ");

  return { at, confidence, source, spans };
}

/** Removes the given spans from text and tidies the whitespace left behind. */
export function removeSpans(text: string, spans: Array<[number, number]>): string {
  let result = text;
  for (const [start, end] of [...spans].sort((a, b) => b[0] - a[0])) {
    result = result.slice(0, start) + " " + result.slice(end);
  }
  return result
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
