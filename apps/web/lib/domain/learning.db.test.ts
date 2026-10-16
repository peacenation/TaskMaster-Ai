import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getAdminDb } from "@/lib/db/client";
import { changeStatus } from "@/lib/execution/operations";
import { withRepositories } from "@/lib/repo";
import { loadToday } from "@/lib/server/today-view";

// Learned estimates end to end: real durations are recorded when a started
// task is completed, and Today's plan sizes tasks with them.

const admin = getAdminDb();
let userId: string;

beforeEach(async () => {
  await admin.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  const rows = await admin.execute<{ id: string }>(
    sql`INSERT INTO users (name, email, preferences) VALUES ('Learning Test', 'learning@test.local', '{"onboardingCompleted": true}') RETURNING id`
  );
  userId = rows.rows[0].id;
});

/** Start a task "minutes" ago, then complete it now. */
async function finish(estimate: number, minutes: number) {
  const id = await withRepositories(userId, async (repos) => {
    const task = await repos.tasks.create({ title: "x", estimatedMinutes: estimate });
    await changeStatus(repos, task.id, "in_progress", new Date());
    return task.id;
  });
  await admin.execute(
    sql`UPDATE task_events SET occurred_at = now() - ${`${minutes} minutes`}::interval WHERE task_id = ${id} AND to_status = 'in_progress'`
  );
  await withRepositories(userId, (repos) => changeStatus(repos, id, "completed", new Date()));
  return id;
}

describe("learned estimates", () => {
  it("records how long a started task really took", async () => {
    const id = await finish(30, 47);
    const task = await withRepositories(userId, (repos) => repos.tasks.get(id));
    expect(task?.actualMinutes).toBe(47);
  });

  it("doesn't record a duration for a task completed without being started", async () => {
    const task = await withRepositories(userId, async (repos) => {
      const created = await repos.tasks.create({ title: "x", estimatedMinutes: 30 });
      await changeStatus(repos, created.id, "completed", new Date());
      return repos.tasks.get(created.id);
    });
    expect(task?.actualMinutes).toBeNull();
  });

  it("plans with the learned ratio once there are enough examples", async () => {
    for (let i = 0; i < 5; i++) await finish(20, 40); // always twice the estimate
    await withRepositories(userId, (repos) =>
      repos.tasks.create({ title: "Write the brief", estimatedMinutes: 30 })
    );
    const view = await loadToday(userId, "UTC");
    if (!view.onboarded) throw new Error("expected onboarded");
    expect(view.learned).toMatchObject({ factor: 2, samples: 5 });
    const item = view.plan.items.find((i) => i.task.title === "Write the brief");
    expect(item?.minutes).toBe(60);
  });
});
