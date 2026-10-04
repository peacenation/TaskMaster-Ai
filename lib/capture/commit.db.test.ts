// Phase 5 exit criteria against a real local Postgres:
//   - "Nothing appears in the user's tasks without explicit commit"
//   - "Editing and removing any proposed item works and persists"
//   - commit is one transaction (all or nothing)
// Needs scripts/db-bootstrap.sh + migrations; runs via `npm run db:test`.
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getAdminDb } from "@/lib/db/client";
import { fixedClock } from "@/lib/domain/clock";
import { extract } from "@/lib/domain/extract";
import { withRepositories } from "@/lib/repo";
import {
  commitInputSchema,
  commitReviewedItems,
  type CommitInput,
  type ReviewedItem,
} from "./commit";

const admin = getAdminDb();
let userId: string;
const now = new Date("2026-10-05T08:00:00Z");

const item = (overrides: Partial<ReviewedItem>): ReviewedItem => ({
  kind: "task",
  title: "Untitled",
  dueAt: null,
  recurrence: null,
  estimatedMinutes: null,
  project: null,
  importance: null,
  ...overrides,
});

const input = (items: ReviewedItem[], dumpId: string | null = null): CommitInput =>
  commitInputSchema.parse({ dumpId, rawText: "raw words", timeZone: "Europe/London", items });

beforeEach(async () => {
  await admin.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  const rows = await admin.execute<{ id: string }>(
    sql`INSERT INTO users (name, email) VALUES ('Commit Test', 'commit@test.local') RETURNING id`
  );
  userId = rows.rows[0].id;
});

describe("Brain Dump capture", () => {
  it("saving and extracting a dump puts nothing in the user's tasks", async () => {
    await withRepositories(userId, async (repos) => {
      const dump = await repos.brainDumps.create("Call Mum, book the dentist");
      await repos.brainDumps.saveProposal(
        dump.id,
        extract(dump.rawText, { clock: fixedClock(now.toISOString()) })
      );
    });
    const tasks = await withRepositories(userId, (repos) => repos.tasks.list());
    expect(tasks).toEqual([]);
    const pending = await withRepositories(userId, (repos) =>
      repos.brainDumps.listUncommitted()
    );
    expect(pending).toHaveLength(1);
    expect(pending[0].rawText).toBe("Call Mum, book the dentist");
  });

  it("commits the reviewed items — with the user's edits — in the reviewed order", async () => {
    const dumpId = await withRepositories(
      userId,
      async (repos) => (await repos.brainDumps.create("raw")).id
    );
    const summary = await withRepositories(userId, (repos) =>
      commitReviewedItems(
        repos,
        input(
          [
            item({
              title: "Renew car insurance (edited)",
              importance: 4,
              project: "Personal admin",
              dueAt: "2026-10-31T17:00:00Z",
            }),
            item({
              title: "Book the dentist",
              project: "personal ADMIN",
              estimatedMinutes: 5,
            }),
            item({ kind: "project", title: "Sort the garage" }),
            item({
              kind: "goal",
              title: "Grow the side business",
              dueAt: "2026-12-31T17:00:00Z",
            }),
            item({
              kind: "recurring",
              title: "Gym",
              recurrence: { frequency: "weekly", timesPerPeriod: 3 },
            }),
            item({ kind: "recurring", title: "Stretch" }),
            item({ kind: "note", title: "What if we moved to Leeds?" }),
          ],
          dumpId
        ),
        now
      )
    );

    expect(summary).toEqual({ dumpId, tasks: 2, projects: 1, goals: 1, habits: 2, notes: 1 });

    const tasks = await withRepositories(userId, (repos) => repos.tasks.list());
    expect(tasks.map((t) => t.title)).toEqual([
      "Renew car insurance (edited)",
      "Book the dentist",
    ]);
    expect(tasks[0]).toMatchObject({
      importance: 4,
      source: "brain_dump",
      status: "todo",
      dueAt: new Date("2026-10-31T17:00:00Z"),
    });
    expect(tasks[1].estimatedMinutes).toBe(5);
    // "Personal admin" and "personal ADMIN" are one project, not two.
    expect(tasks[0].projectId).not.toBeNull();
    expect(tasks[1].projectId).toBe(tasks[0].projectId);

    const projects = await withRepositories(userId, (repos) => repos.projects.list());
    expect(projects.map((p) => p.name).sort()).toEqual(["Personal admin", "Sort the garage"]);

    const goals = await admin.execute<{ title: string; target_date: string }>(
      sql`SELECT title, target_date::text FROM goals WHERE user_id = ${userId}`
    );
    expect(goals.rows).toEqual([
      { title: "Grow the side business", target_date: "2026-12-31" },
    ]);

    const habits = await admin.execute<{
      title: string;
      frequency: string;
      times_per_period: number;
    }>(
      sql`SELECT title, frequency, times_per_period FROM recurrence_rules WHERE user_id = ${userId} ORDER BY title`
    );
    expect(habits.rows).toEqual([
      { title: "Gym", frequency: "weekly", times_per_period: 3 },
      { title: "Stretch", frequency: "weekly", times_per_period: 1 },
    ]);

    // Notes don't become tasks.
    expect(tasks.some((t) => t.title.includes("Leeds"))).toBe(false);

    const pending = await withRepositories(userId, (repos) =>
      repos.brainDumps.listUncommitted()
    );
    expect(pending).toEqual([]);

    const events = await admin.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM task_events WHERE user_id = ${userId} AND event_type = 'created'`
    );
    expect(events.rows[0].n).toBe(2);
  });

  it("saves the raw text at commit time if it couldn't be saved earlier", async () => {
    const summary = await withRepositories(userId, (repos) =>
      commitReviewedItems(repos, input([item({ title: "Call Mum" })], null), now)
    );
    const dump = await withRepositories(userId, (repos) =>
      repos.brainDumps.get(summary.dumpId)
    );
    expect(dump?.rawText).toBe("raw words");
    expect(dump?.committedAt).not.toBeNull();
  });

  it("is all or nothing: a failure after some writes leaves no trace", async () => {
    const dumpId = await withRepositories(
      userId,
      async (repos) => (await repos.brainDumps.create("raw")).id
    );
    await expect(
      withRepositories(userId, async (repos) => {
        await commitReviewedItems(
          repos,
          input([item({ title: "A" }), item({ title: "B", project: "Work" })], dumpId),
          now
        );
        throw new Error("simulated failure after the writes");
      })
    ).rejects.toThrow("simulated failure");

    expect(await withRepositories(userId, (repos) => repos.tasks.list())).toEqual([]);
    expect(await withRepositories(userId, (repos) => repos.projects.list())).toEqual([]);
    const dump = await withRepositories(userId, (repos) => repos.brainDumps.get(dumpId));
    expect(dump?.committedAt).toBeNull();
    expect(dump?.rawText).toBe("raw");
  });
});

describe("commitInputSchema", () => {
  it("rejects an empty commit, blank titles, and out-of-range values", () => {
    const base = { dumpId: null, rawText: "x", timeZone: "UTC" };
    expect(commitInputSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(
      commitInputSchema.safeParse({ ...base, items: [item({ title: "   " })] }).success
    ).toBe(false);
    expect(
      commitInputSchema.safeParse({ ...base, items: [item({ importance: 9 })] }).success
    ).toBe(false);
    expect(
      commitInputSchema.safeParse({ ...base, items: [item({ dueAt: "Thursday" })] }).success
    ).toBe(false);
  });
});
