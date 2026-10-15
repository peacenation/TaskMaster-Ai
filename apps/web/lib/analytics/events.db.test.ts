import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { commitAndOnboard } from "@/lib/capture/commit";
import { getAdminDb } from "@/lib/db/client";
import { changeStatus } from "@/lib/execution/operations";
import { withRepositories } from "@/lib/repo";
import { loadToday } from "@/lib/server/today-view";

// Product events (PRD §2.9) are written by the real flows, in the same
// transaction, with ids and counts only.

const admin = getAdminDb();
let userId: string;

beforeEach(async () => {
  await admin.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  const rows = await admin.execute<{ id: string }>(
    sql`INSERT INTO users (name, email, created_at) VALUES ('Metrics Test', 'metrics@test.local', now() - interval '90 seconds') RETURNING id`
  );
  userId = rows.rows[0].id;
});

const events = async () =>
  (
    await admin.execute<{ name: string; properties: Record<string, unknown> }>(
      sql`SELECT name, properties FROM product_events WHERE user_id = ${userId} ORDER BY occurred_at, name`
    )
  ).rows;

describe("product events", () => {
  it("records onboarding, Brain Dump corrections, Today and task actions", async () => {
    const dumpId = await withRepositories(userId, async (repos) => {
      const dump = await repos.brainDumps.create("Finish report, book dentist, maybe piano");
      await repos.brainDumps.saveProposal(dump.id, {
        items: ["Finish report", "Book dentist", "Maybe piano"].map((title) => ({
          kind: "task",
          title,
          deadline: null,
          recurrence: null,
          estimatedMinutes: 30,
          project: null,
        })),
      } as never);
      return dump.id;
    });
    await withRepositories(userId, (repos) =>
      commitAndOnboard(
        repos,
        {
          dumpId,
          rawText: "x",
          timeZone: "UTC",
          items: [
            {
              kind: "task",
              title: "Finish the Q3 report",
              dueAt: null,
              recurrence: null,
              estimatedMinutes: 30,
              project: null,
              importance: null,
            },
            {
              kind: "task",
              title: "Book dentist",
              dueAt: null,
              recurrence: null,
              estimatedMinutes: 30,
              project: null,
              importance: null,
            },
          ],
        },
        new Date()
      )
    );

    const view = await loadToday(userId, "UTC");
    await loadToday(userId, "UTC"); // once a day, however often Today opens
    if (!view.onboarded) throw new Error("expected onboarded");
    const recommended = view.recommendation!.task.id;
    await withRepositories(userId, (repos) =>
      changeStatus(repos, recommended, "completed", new Date())
    );

    const recorded = await events();
    const byName = (name: string) => recorded.filter((e) => e.name === name);
    expect(byName("brain_dump_committed")[0].properties).toMatchObject({
      proposed: 3,
      saved: 2,
      accepted: 1,
      corrected: 1,
      removed: 1,
      tasks: 2,
    });
    const onboarding = byName("onboarding_completed");
    expect(onboarding).toHaveLength(1);
    expect(Number(onboarding[0].properties.seconds_since_signup)).toBeGreaterThanOrEqual(89);
    expect(byName("today_viewed")).toHaveLength(1);
    expect(byName("today_viewed")[0].properties.recommended_task_id).toBe(recommended);
    expect(byName("task_completed")[0].properties).toEqual({ task_id: recommended });
    // Never any text from the user's tasks or dump.
    expect(JSON.stringify(recorded)).not.toMatch(/report|dentist|piano/i);
  });

  it("goes with the account", async () => {
    await withRepositories(userId, (repos) => repos.events.track("plan_rebuilt", {}));
    await admin.execute(sql`DELETE FROM users WHERE id = ${userId}`);
    expect(await events()).toEqual([]);
  });
});
