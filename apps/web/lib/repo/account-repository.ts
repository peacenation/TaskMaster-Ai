import { eq } from "drizzle-orm";
import type { AppDb } from "@/lib/db/client";
import {
  users,
  tasks,
  projects,
  goals,
  brainDumps,
  recurrenceRules,
  taskEvents,
  taskDependencies,
  plans,
  planItems,
  calendarFeeds,
  calendarEvents,
  productEvents,
} from "@/lib/db/schema";
export function createAccountRepository(db: AppDb, userId: string) {
  return {
    /**
     * Deletes the profile row; every other table cascades from it
     * (ON DELETE CASCADE on each user_id). Removing the login itself is the
     * Auth service's job (app/api/account/delete).
     */
    async deleteAll() {
      await db.delete(users).where(eq(users.id, userId));
    },
    async export() {
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      return {
        version: 1,
        exportedAt: new Date().toISOString(),
        user,
        tasks: await db.select().from(tasks).where(eq(tasks.userId, userId)),
        projects: await db.select().from(projects).where(eq(projects.userId, userId)),
        goals: await db.select().from(goals).where(eq(goals.userId, userId)),
        brainDumps: await db.select().from(brainDumps).where(eq(brainDumps.userId, userId)),
        recurrenceRules: await db
          .select()
          .from(recurrenceRules)
          .where(eq(recurrenceRules.userId, userId)),
        taskEvents: await db.select().from(taskEvents).where(eq(taskEvents.userId, userId)),
        taskDependencies: await db
          .select()
          .from(taskDependencies)
          .where(eq(taskDependencies.userId, userId)),
        plans: await db.select().from(plans).where(eq(plans.userId, userId)),
        planItems: await db.select().from(planItems).where(eq(planItems.userId, userId)),
        // The private calendar address is a credential and stays out of
        // exports; the label and sync state identify the feed.
        calendars: await db
          .select({
            id: calendarFeeds.id,
            label: calendarFeeds.label,
            lastSyncedAt: calendarFeeds.lastSyncedAt,
            lastError: calendarFeeds.lastError,
            createdAt: calendarFeeds.createdAt,
          })
          .from(calendarFeeds)
          .where(eq(calendarFeeds.userId, userId)),
        calendarEvents: await db
          .select()
          .from(calendarEvents)
          .where(eq(calendarEvents.userId, userId)),
        productEvents: await db
          .select()
          .from(productEvents)
          .where(eq(productEvents.userId, userId)),
      };
    },
  };
}
