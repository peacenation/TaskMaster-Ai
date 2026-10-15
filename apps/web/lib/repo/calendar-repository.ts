import { and, asc, eq, gt, lt } from "drizzle-orm";
import type { AppDb } from "@/lib/db/client";
import { calendarEvents, calendarFeeds } from "@/lib/db/schema";
import type { CalendarEvent } from "@/lib/calendar/ics";

export function createCalendarRepository(db: AppDb, userId: string) {
  return {
    async feeds() {
      return db
        .select()
        .from(calendarFeeds)
        .where(eq(calendarFeeds.userId, userId))
        .orderBy(asc(calendarFeeds.createdAt));
    },

    async addFeed(input: { label: string; urlEncrypted: string }) {
      const [feed] = await db
        .insert(calendarFeeds)
        .values({ userId, ...input })
        .returning({ id: calendarFeeds.id });
      return feed.id;
    },

    async removeFeed(id: string) {
      const removed = await db
        .delete(calendarFeeds)
        .where(and(eq(calendarFeeds.userId, userId), eq(calendarFeeds.id, id)))
        .returning({ id: calendarFeeds.id });
      return removed.length > 0;
    },

    /** Swap a feed's cached events for a fresh set and record the sync. */
    async replaceEvents(feedId: string, events: CalendarEvent[], now: Date) {
      await db
        .delete(calendarEvents)
        .where(and(eq(calendarEvents.userId, userId), eq(calendarEvents.feedId, feedId)));
      if (events.length)
        await db
          .insert(calendarEvents)
          .values(events.map((event) => ({ userId, feedId, ...event })));
      await db
        .update(calendarFeeds)
        .set({ lastSyncedAt: now, lastError: null })
        .where(and(eq(calendarFeeds.userId, userId), eq(calendarFeeds.id, feedId)));
    },

    /** Keep the old events when a refresh fails; just note why. */
    async syncFailed(feedId: string, message: string, now: Date) {
      await db
        .update(calendarFeeds)
        .set({ lastSyncedAt: now, lastError: message })
        .where(and(eq(calendarFeeds.userId, userId), eq(calendarFeeds.id, feedId)));
    },

    async eventsBetween(from: Date, to: Date): Promise<CalendarEvent[]> {
      return db
        .select({
          title: calendarEvents.title,
          startsAt: calendarEvents.startsAt,
          endsAt: calendarEvents.endsAt,
          allDay: calendarEvents.allDay,
        })
        .from(calendarEvents)
        .where(
          and(
            eq(calendarEvents.userId, userId),
            lt(calendarEvents.startsAt, to),
            gt(calendarEvents.endsAt, from)
          )
        )
        .orderBy(asc(calendarEvents.startsAt));
    },
  };
}
