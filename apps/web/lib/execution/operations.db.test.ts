import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { getAdminDb } from "@/lib/db/client";
import { withRepositories } from "@/lib/repo";
import { buildPlan } from "@/lib/domain/plan";
import { makeTask } from "@/lib/domain/task";
import { changeStatus, commitBreakdown, recover } from "./operations";
const admin = getAdminDb();
let user: string;
const now = new Date("2026-10-05T08:00:00Z");
beforeEach(async () => {
  await admin.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  const rows = await admin.execute<{ id: string }>(
    sql`INSERT INTO users(name,email) VALUES ('Executor','executor@test.local') RETURNING id`
  );
  user = rows.rows[0].id;
});
describe("execution persistence", () => {
  it("logs completion, postponement and drop without deleting work", async () => {
    const task = await withRepositories(user, (repos) =>
      repos.tasks.create({ title: "Keep my record" })
    );
    for (const status of ["completed", "todo", "postponed", "todo", "dropped"] as const)
      await withRepositories(user, (repos) => changeStatus(repos, task.id, status, now));
    const result = await withRepositories(user, async (repos) => ({
      task: await repos.tasks.get(task.id),
      events: await repos.execution.events(task.id),
    }));
    expect(result.task?.status).toBe("dropped");
    expect(result.events.map((e) => e.toStatus)).toEqual([
      "completed",
      "todo",
      "postponed",
      "todo",
      "dropped",
    ]);
  });
  it("creates reviewed steps, blocks the parent, and rejects duplicate commits", async () => {
    const parent = await withRepositories(user, (repos) =>
      repos.tasks.create({ title: "Finish report" })
    );
    const input = {
      taskId: parent.id,
      steps: [
        { title: "Gather figures", estimatedMinutes: 15 },
        { title: "Draft report", estimatedMinutes: 30 },
      ],
    };
    await withRepositories(user, (repos) => commitBreakdown(repos, input));
    const children = await withRepositories(user, (repos) =>
      repos.execution.children(parent.id)
    );
    expect(children.map((t) => t.title)).toEqual(["Gather figures", "Draft report"]);
    await expect(
      withRepositories(user, (repos) => commitBreakdown(repos, input))
    ).rejects.toThrow();
    await expect(
      withRepositories(user, (repos) => changeStatus(repos, parent.id, "in_progress", now))
    ).rejects.toThrow();
    for (const child of children)
      await withRepositories(user, (repos) => changeStatus(repos, child.id, "completed", now));
    await withRepositories(user, (repos) =>
      changeStatus(repos, parent.id, "in_progress", now)
    );
  });
  it("keeps a missed block on reload, asks for a decision, and does not silently move its times", async () => {
    const task = await withRepositories(user, (repos) =>
      repos.tasks.create({ title: "Missed work", estimatedMinutes: 20 })
    );
    const plan = buildPlan(
      [makeTask({ id: task.id, title: task.title, estimatedMinutes: 20 })],
      { now },
      { mode: "scheduled", availableMinutes: 60 }
    );
    await withRepositories(user, (repos) =>
      repos.execution.savePlan("2026-10-05", plan, false)
    );
    const late = new Date("2026-10-05T09:00:00Z");
    const before = await withRepositories(user, (repos) => repos.execution.plan("2026-10-05"));
    const affected = await withRepositories(user, (repos) => repos.execution.recovery(late));
    expect(affected).toHaveLength(1);
    await withRepositories(user, (repos) =>
      recover(repos, [{ id: affected[0].id, choice: "keep" }], late)
    );
    const after = await withRepositories(user, (repos) => repos.execution.plan("2026-10-05"));
    expect(after?.items[0].scheduledStart).toEqual(before?.items[0].scheduledStart);
    expect(await withRepositories(user, (repos) => repos.execution.recovery(late))).toEqual(
      []
    );
    expect((await withRepositories(user, (repos) => repos.tasks.get(task.id)))?.status).toBe(
      "todo"
    );
  });
  it("rolls back the whole recovery batch if any decision is stale", async () => {
    const task = await withRepositories(user, (repos) =>
      repos.tasks.create({ title: "Work", estimatedMinutes: 20 })
    );
    const plan = buildPlan(
      [makeTask({ id: task.id, title: task.title, estimatedMinutes: 20 })],
      { now },
      { mode: "scheduled", availableMinutes: 60 }
    );
    await withRepositories(user, (repos) =>
      repos.execution.savePlan("2026-10-05", plan, false)
    );
    const late = new Date("2026-10-05T09:00:00Z");
    const [affected] = await withRepositories(user, (repos) => repos.execution.recovery(late));
    await expect(
      withRepositories(user, (repos) =>
        recover(
          repos,
          [
            { id: affected.id, choice: "drop" },
            { id: "00000000-0000-4000-8000-000000000099", choice: "keep" },
          ],
          late
        )
      )
    ).rejects.toThrow();
    expect((await withRepositories(user, (repos) => repos.tasks.get(task.id)))?.status).toBe(
      "todo"
    );
  });
});
