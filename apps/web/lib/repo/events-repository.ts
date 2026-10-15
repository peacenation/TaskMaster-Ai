import { sql } from "drizzle-orm";
import type { AppDb } from "@/lib/db/client";
import { productEvents } from "@/lib/db/schema";

export type ProductEventName =
  | "brain_dump_organised"
  | "brain_dump_committed"
  | "onboarding_completed"
  | "today_viewed"
  | "task_started"
  | "task_completed"
  | "task_postponed"
  | "task_dropped"
  | "recommendation_overridden"
  | "plan_rebuilt"
  | "recovery_resolved"
  | "planner_applied"
  | "calendar_connected"
  | "waiting_marked";

/** Counts, flags and ids only — never task or Brain Dump text. */
export type EventProperties = Record<string, string | number | boolean | null>;

export function createEventsRepository(db: AppDb, userId: string) {
  return {
    /** Record an event. With a dedupe key, only the first one counts. */
    async track(name: ProductEventName, properties: EventProperties = {}, dedupeKey?: string) {
      await db
        .insert(productEvents)
        .values({ userId, name, properties, dedupeKey: dedupeKey ?? null })
        .onConflictDoNothing({ target: [productEvents.userId, productEvents.dedupeKey] });
    },

    /** Has this user ever recorded `name`? (Used for first-time events.) */
    async seen(name: ProductEventName): Promise<boolean> {
      const result = await db.execute(
        sql`SELECT 1 FROM product_events WHERE user_id = ${userId} AND name = ${name} LIMIT 1`
      );
      return result.rows.length > 0;
    },
  };
}
