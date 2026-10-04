import { and, asc, eq, isNull, lt, sql } from "drizzle-orm";
import type { AppDb } from "@/lib/db/client";
import { plans, planItems, tasks, taskEvents, taskDependencies } from "@/lib/db/schema";
import type { Plan } from "@/lib/domain/plan";

export function createExecutionRepository(db: AppDb, userId: string) {
  return {
    async plan(date: string) {
      const [plan] = await db
        .select()
        .from(plans)
        .where(and(eq(plans.userId, userId), eq(plans.date, date)));
      if (!plan) return null;
      return {
        ...plan,
        items: await db
          .select()
          .from(planItems)
          .where(eq(planItems.planId, plan.id))
          .orderBy(asc(planItems.position)),
      };
    },
    async savePlan(date: string, plan: Plan, replace: boolean) {
      const [saved] = await db
        .insert(plans)
        .values({
          userId,
          date,
          mode: plan.mode,
          availableMinutes: plan.capacity.availableMinutes,
        })
        .onConflictDoUpdate({
          target: [plans.userId, plans.date],
          set: replace
            ? {
                mode: plan.mode,
                availableMinutes: plan.capacity.availableMinutes,
                updatedAt: new Date(),
              }
            : { date },
        })
        .returning();
      if (!replace) {
        const existing = await db
          .select()
          .from(planItems)
          .where(eq(planItems.planId, saved.id))
          .limit(1);
        if (existing.length) return;
      }
      await db.delete(planItems).where(eq(planItems.planId, saved.id));
      if (plan.items.length)
        await db
          .insert(planItems)
          .values(
            plan.items.map((item) => ({
              userId,
              planId: saved.id,
              taskId: item.task.id,
              position: item.position,
              scheduledStart: item.scheduledStart,
              scheduledEnd: item.scheduledEnd,
              recommendationReason: item.reasons.map((reason) => reason.text).join("; "),
            }))
          );
    },
    async recovery(now: Date) {
      const rows = await db
        .select({
          id: planItems.id,
          taskId: tasks.id,
          title: tasks.title,
          scheduledEnd: planItems.scheduledEnd,
        })
        .from(planItems)
        .innerJoin(tasks, eq(tasks.id, planItems.taskId))
        .where(
          and(
            eq(planItems.userId, userId),
            isNull(planItems.recoveryReviewedAt),
            lt(planItems.scheduledEnd, now),
            sql`${tasks.status} IN ('todo','in_progress')`
          )
        )
        .orderBy(asc(planItems.scheduledEnd));
      return rows;
    },
    async reviewRecovery(id: string, now: Date) {
      await db
        .update(planItems)
        .set({ recoveryReviewedAt: now })
        .where(and(eq(planItems.userId, userId), eq(planItems.id, id)));
    },
    async children(parentId: string) {
      await db.execute(sql`SELECT id FROM tasks WHERE id=${parentId} FOR UPDATE`);
      return db
        .select()
        .from(tasks)
        .where(and(eq(tasks.userId, userId), eq(tasks.parentTaskId, parentId)))
        .orderBy(asc(tasks.createdAt));
    },
    async linkChild(parentId: string, childId: string) {
      await db
        .insert(taskDependencies)
        .values({ userId, taskId: parentId, dependsOnTaskId: childId })
        .onConflictDoNothing();
    },
    async events(taskId: string) {
      return db
        .select()
        .from(taskEvents)
        .where(and(eq(taskEvents.userId, userId), eq(taskEvents.taskId, taskId)))
        .orderBy(asc(taskEvents.occurredAt));
    },
  };
}
