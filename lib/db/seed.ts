// Seeds realistic multi-user sample data — deliberately more than one
// user, so an isolation bug (a missing WHERE clause, a wrong RLS policy)
// surfaces immediately as "I can see someone else's tasks" rather than
// hiding behind a single-user dataset where every row is implicitly the
// only user's anyway. See docs/IMPLEMENTATION_PLAN.md Phase 3, work item 5.
//
// Runs as the admin role (adminDb, superuser/BYPASSRLS) — seeding across
// multiple users is exactly the case RLS exists to prevent for the
// application's own connection, so this script intentionally uses the
// role that bypasses it. Never import adminDb from application code.
import { getAdminDb, getAppDb } from "./client";
import { brainDumps, goals, plans, planItems, projects, tasks, users } from "./schema";
import { sql } from "drizzle-orm";

const adminDb = getAdminDb();
const appDb = getAppDb();

async function main() {
  console.log("Clearing existing data...");
  await adminDb.execute(
    sql`TRUNCATE TABLE users, goals, projects, brain_dumps, tasks, task_dependencies, task_events, recurrence_rules, plans, plan_items RESTART IDENTITY CASCADE`
  );

  console.log("Seeding users...");
  const [alice, bob] = await adminDb
    .insert(users)
    .values([
      { name: "Alice Nwosu", email: "alice@example.com", timezone: "Africa/Lagos" },
      { name: "Bob Chen", email: "bob@example.com", timezone: "America/New_York" },
    ])
    .returning();

  console.log("Seeding goals, projects, brain dumps, tasks, plans...");
  for (const user of [alice, bob]) {
    const [goal] = await adminDb
      .insert(goals)
      .values({
        userId: user.id,
        title: `${user.name.split(" ")[0]}'s Q4 goal`,
        description: "A longer-term outcome to keep daily work honest against.",
        status: "active",
      })
      .returning();

    const [project] = await adminDb
      .insert(projects)
      .values({
        userId: user.id,
        name: `${user.name.split(" ")[0]}'s side project`,
        status: "active",
        goalId: goal.id,
      })
      .returning();

    await adminDb.insert(brainDumps).values({
      userId: user.id,
      rawText: "Call the dentist. Finish the deck for Friday. Book flights.",
      processingStatus: "completed",
      proposalJson: {
        items: ["Call the dentist", "Finish the deck for Friday", "Book flights"],
      },
    });

    const createdTasks = await adminDb
      .insert(tasks)
      .values([
        {
          userId: user.id,
          title: "Call the dentist",
          status: "todo",
          source: "brain_dump",
          projectId: null,
        },
        {
          userId: user.id,
          title: "Finish the deck for Friday",
          status: "in_progress",
          source: "brain_dump",
          projectId: project.id,
          priority: 4,
          urgency: 4,
          importance: 5,
        },
        {
          userId: user.id,
          title: "Book flights",
          status: "completed",
          source: "brain_dump",
          completedAt: new Date(),
        },
      ])
      .returning();

    const [plan] = await adminDb
      .insert(plans)
      .values({
        userId: user.id,
        date: new Date().toISOString().slice(0, 10),
        mode: "flexible",
        availableMinutes: 240,
      })
      .returning();

    await adminDb.insert(planItems).values(
      createdTasks
        .filter((t) => t.status !== "completed")
        .map((t, index) => ({
          userId: user.id,
          planId: plan.id,
          taskId: t.id,
          position: index,
          recommendationReason:
            index === 0 ? "Next in line and nothing else is blocking it." : null,
        }))
    );
  }

  console.log("\nVerifying isolation as the application role (not admin)...");
  for (const user of [alice, bob]) {
    const rows = await appDb.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.current_user_id', ${user.id}, true)`);
      return tx.select().from(tasks);
    });
    const ownRows = rows.filter((r) => r.userId === user.id);
    const otherRows = rows.filter((r) => r.userId !== user.id);
    if (otherRows.length > 0) {
      throw new Error(
        `ISOLATION FAILURE: scoped to ${user.name}, saw ${otherRows.length} row(s) belonging to another user`
      );
    }
    console.log(
      `  ${user.name}: sees ${ownRows.length} task(s), 0 belonging to anyone else. OK.`
    );
  }

  console.log("\nSeed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
