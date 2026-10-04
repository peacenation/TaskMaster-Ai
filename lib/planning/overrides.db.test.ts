import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getAdminDb } from "@/lib/db/client";
import { withRepositories } from "@/lib/repo";
import { toPlannable } from "@/lib/server/views";
import { buildToday } from "./today";

describe("persistent planning overrides", () => {
  it("retains priority and chosen action across transactions and rebuilds, isolated by user", async () => {
    const admin = getAdminDb();
    await admin.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
    const rows = await admin.execute<{ id: string }>(
      sql`INSERT INTO users (name, email) VALUES ('Planner A', 'planner-a@test.local'), ('Planner B', 'planner-b@test.local') RETURNING id`
    );
    const [a, b] = rows.rows.map((row) => row.id);
    const task = await withRepositories(a, async (repos) => {
      const task = await repos.tasks.create({
        title: "My chosen work",
        priority: 1,
        estimatedMinutes: 60,
      });
      await repos.tasks.update(task.id, { priority: 5 });
      await repos.users.chooseNext(task.id);
      return task;
    });
    for (const dayMinutes of [120, 240]) {
      const saved = await withRepositories(a, async (repos) => ({
        tasks: await repos.tasks.list(),
        dependencies: await repos.tasks.dependencies(),
        chosenId: await repos.users.nextTaskId(),
      }));
      expect(saved.tasks[0].priority).toBe(5);
      const today = buildToday(
        toPlannable(saved.tasks, saved.dependencies),
        { now: new Date("2026-10-05T08:00:00Z") },
        dayMinutes,
        saved.chosenId
      );
      expect(today.recommendation?.task.id).toBe(task.id);
      expect(today.overridden).toBe(true);
    }
    expect(await withRepositories(b, (repos) => repos.users.nextTaskId())).toBeNull();
    await withRepositories(a, (repos) => repos.users.chooseNext(null));
    expect(await withRepositories(a, (repos) => repos.users.nextTaskId())).toBeNull();
  });
});
