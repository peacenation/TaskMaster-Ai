import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getAdminDb } from "@/lib/db/client";
import { withRepositories } from "@/lib/repo";

// Phase 10 exit criterion: three consecutive postponements of one task
// trigger Procrastination Assist.

const admin = getAdminDb();
let userId: string;

beforeEach(async () => {
  await admin.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  const rows = await admin.execute<{ id: string }>(
    sql`INSERT INTO users (name, email) VALUES ('Assist Test', 'assist@test.local') RETURNING id`
  );
  userId = rows.rows[0].id;
});

async function taskWithHistory(title: string, events: string[]): Promise<string> {
  const task = await withRepositories(userId, (repos) =>
    repos.tasks.create({ title, status: "todo" })
  );
  for (const [i, eventType] of events.entries()) {
    // Distinct, ordered timestamps: the rule reads the most recent three.
    await admin.execute(
      sql`INSERT INTO task_events (user_id, task_id, event_type, occurred_at)
          VALUES (${userId}, ${task.id}, ${eventType}, now() - ${`${events.length - i} minutes`}::interval)`
    );
  }
  return task.id;
}

describe("Procrastination Assist trigger", () => {
  it("fires on the third consecutive postponement, not before", async () => {
    await taskWithHistory("Twice", ["created", "postponed", "postponed"]);
    const thrice = await taskWithHistory("Thrice", [
      "created",
      "postponed",
      "postponed",
      "postponed",
    ]);
    const candidates = await withRepositories(userId, (repos) =>
      repos.taskEvents.procrastinationCandidates()
    );
    expect(candidates).toEqual([{ taskId: thrice, title: "Thrice" }]);
  });

  it("resets when other progress interrupts the run", async () => {
    await taskWithHistory("Interrupted", [
      "postponed",
      "postponed",
      "status_changed",
      "postponed",
    ]);
    expect(
      await withRepositories(userId, (repos) => repos.taskEvents.procrastinationCandidates())
    ).toEqual([]);
  });

  it("ignores finished tasks", async () => {
    const id = await taskWithHistory("Done now", ["postponed", "postponed", "postponed"]);
    await admin.execute(sql`UPDATE tasks SET status = 'completed' WHERE id = ${id}`);
    expect(
      await withRepositories(userId, (repos) => repos.taskEvents.procrastinationCandidates())
    ).toEqual([]);
  });
});
