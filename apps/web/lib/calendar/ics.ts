import ICAL from "ical.js";

// Read events out of an iCal feed (RFC 5545) for a date range, expanding
// repeating meetings and their one-off changes. Cancelled events and ones
// marked "free" are skipped: they don't take time from the day.

export interface CalendarEvent {
  title: string;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
}

/** Safety cap on occurrences per repeating event (a daily stand-up for a year). */
const MAX_OCCURRENCES = 400;

function blocksTime(component: ICAL.Component): boolean {
  const status = String(component.getFirstPropertyValue("status") ?? "").toUpperCase();
  const transp = String(component.getFirstPropertyValue("transp") ?? "").toUpperCase();
  return status !== "CANCELLED" && transp !== "TRANSPARENT";
}

/** All-day dates have no time zone: keep them as that calendar date (UTC midnight). */
const dateOnly = (t: ICAL.Time) => new Date(Date.UTC(t.year, t.month - 1, t.day));

function toEvent(title: string, start: ICAL.Time, end: ICAL.Time): CalendarEvent {
  return {
    title: title.trim() || "Busy",
    startsAt: start.isDate ? dateOnly(start) : start.toJSDate(),
    endsAt: end.isDate ? dateOnly(end) : end.toJSDate(),
    allDay: start.isDate,
  };
}

export function parseIcs(text: string, from: Date, to: Date): CalendarEvent[] {
  let root: ICAL.Component;
  try {
    root = new ICAL.Component(ICAL.parse(text));
  } catch {
    throw new Error("That address didn't return a calendar.");
  }
  if (root.name !== "vcalendar") throw new Error("That address didn't return a calendar.");
  for (const zone of root.getAllSubcomponents("vtimezone")) {
    try {
      ICAL.TimezoneService.register(zone);
    } catch {
      // A malformed zone falls back to floating time for its events.
    }
  }

  const masters = new Map<string, ICAL.Event>();
  const exceptions: ICAL.Event[] = [];
  for (const component of root.getAllSubcomponents("vevent")) {
    const event = new ICAL.Event(component);
    if (!event.startDate) continue;
    if (event.isRecurrenceException()) exceptions.push(event);
    else masters.set(event.uid ?? crypto.randomUUID(), event);
  }
  for (const exception of exceptions) {
    const master = masters.get(exception.uid);
    if (master) master.relateException(exception);
    else masters.set(`${exception.uid}:${exception.recurrenceId}`, exception);
  }

  const events: CalendarEvent[] = [];
  const inRange = (e: CalendarEvent) => e.endsAt > from && e.startsAt < to;
  for (const master of masters.values()) {
    if (!master.isRecurring()) {
      if (!blocksTime(master.component)) continue;
      const end = master.endDate ?? master.startDate;
      const event = toEvent(master.summary ?? "", master.startDate, end);
      if (inRange(event)) events.push(event);
      continue;
    }
    const iterator = master.iterator();
    for (
      let i = 0, next = iterator.next();
      next && i < MAX_OCCURRENCES;
      i++, next = iterator.next()
    ) {
      if (next.toJSDate() >= to) break;
      const details = master.getOccurrenceDetails(next);
      if (!blocksTime(details.item.component)) continue;
      const event = toEvent(details.item.summary ?? "", details.startDate, details.endDate);
      if (inRange(event)) events.push(event);
    }
  }
  return events.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}
