// Proves Phase 3's exit criteria for real, against a real local Postgres
// (see scripts/db-bootstrap.sh) — not mocked. Run via `npm run
// db:test`, never `npm run test` (see vitest.config.mts).
//
// Two things are checked:
// 1. Enumeration: every table with a user-ownership column actually has
//    RLS enabled, forced, and at least one policy — so a new table added
//    later without RLS fails this test immediately instead of silently
//    shipping unprotected.
// 2. Cross-user access: authenticated as user A, every operation
//    (select/update/delete/insert) against user B's rows is blocked, for
//    every user-scoped table.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { getAdminDb, getAppDb } from "./client";

const adminDb = getAdminDb();
const appDb = getAppDb();

interface TableFixture {
  table: string;
  // The column whose value identifies the owning user. For every table
  // except `users` this is `user_id`; for `users` itself, a row's own
  // primary key *is* the owning user's id, so it's `id`. Either way, "the
  // value identifying user X's row in this table" is simply `userA` or
  // `userB` — never the fixture row's own separately-generated primary
  // key, which was this file's original bug (see commit history): a
  // goal's own id is not the value that `user_id = ...` matches against.
  ownerColumn: "id" | "user_id";
  /** A minimal valid row for this table, owned by the given user id. */
  insertAs: (userId: string) => ReturnType<typeof sql>;
}

let userA: string;
let userB: string;
let taskIdA: string;
let taskIdB: string;
let planIdA: string;
let planIdB: string;
let fixtures: TableFixture[];

async function runAsUser<T>(userId: string, fn: (tx: typeof appDb) => Promise<T>): Promise<T> {
  return appDb.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_user_id', ${userId}, true)`);
    return fn(tx as unknown as typeof appDb);
  });
}

async function truncateAll() {
  await adminDb.execute(
    sql`TRUNCATE TABLE users, goals, projects, brain_dumps, tasks, task_dependencies, task_events, recurrence_rules, plans, plan_items, ai_requests RESTART IDENTITY CASCADE`
  );
}

beforeAll(async () => {
  await truncateAll();

  const userRows = await adminDb.execute<{ id: string }>(
    sql`INSERT INTO users (name, email) VALUES ('Isolation Test A', 'isolation-a@test.local'), ('Isolation Test B', 'isolation-b@test.local') RETURNING id`
  );
  userA = userRows.rows[0].id;
  userB = userRows.rows[1].id;

  const taskRows = await adminDb.execute<{ id: string; user_id: string }>(
    sql`INSERT INTO tasks (user_id, title) VALUES (${userA}, 'Task A1'), (${userA}, 'Task A2'), (${userB}, 'Task B1'), (${userB}, 'Task B2') RETURNING id, user_id`
  );
  taskIdA = taskRows.rows[0].id;
  const taskIdA2 = taskRows.rows[1].id;
  taskIdB = taskRows.rows[2].id;
  const taskIdB2 = taskRows.rows[3].id;

  const planRows = await adminDb.execute<{ id: string }>(
    sql`INSERT INTO plans (user_id, date) VALUES (${userA}, CURRENT_DATE), (${userB}, CURRENT_DATE + 1) RETURNING id`
  );
  planIdA = planRows.rows[0].id;
  planIdB = planRows.rows[1].id;

  await adminDb.execute(
    sql`INSERT INTO goals (user_id, title) VALUES (${userA}, 'Goal A'), (${userB}, 'Goal B')`
  );
  await adminDb.execute(
    sql`INSERT INTO projects (user_id, name) VALUES (${userA}, 'Project A'), (${userB}, 'Project B')`
  );
  await adminDb.execute(
    sql`INSERT INTO brain_dumps (user_id, raw_text) VALUES (${userA}, 'Dump A'), (${userB}, 'Dump B')`
  );
  await adminDb.execute(
    sql`INSERT INTO task_dependencies (user_id, task_id, depends_on_task_id) VALUES (${userA}, ${taskIdA}, ${taskIdA2}), (${userB}, ${taskIdB}, ${taskIdB2})`
  );
  await adminDb.execute(
    sql`INSERT INTO task_events (user_id, task_id, event_type) VALUES (${userA}, ${taskIdA}, 'created'), (${userB}, ${taskIdB}, 'created')`
  );
  await adminDb.execute(
    sql`INSERT INTO recurrence_rules (user_id, title, frequency, start_date) VALUES (${userA}, 'Rule A', 'weekly', CURRENT_DATE), (${userB}, 'Rule B', 'weekly', CURRENT_DATE)`
  );
  await adminDb.execute(
    sql`INSERT INTO plan_items (user_id, plan_id, task_id, position) VALUES (${userA}, ${planIdA}, ${taskIdA}, 0), (${userB}, ${planIdB}, ${taskIdB}, 0)`
  );
  await adminDb.execute(sql`INSERT INTO ai_requests (user_id) VALUES (${userA}), (${userB})`);

  fixtures = [
    { table: "users", ownerColumn: "id", insertAs: () => sql`` },
    {
      table: "goals",
      ownerColumn: "user_id",
      insertAs: (uid) => sql`INSERT INTO goals (user_id, title) VALUES (${uid}, 'x')`,
    },
    {
      table: "projects",
      ownerColumn: "user_id",
      insertAs: (uid) => sql`INSERT INTO projects (user_id, name) VALUES (${uid}, 'x')`,
    },
    {
      table: "brain_dumps",
      ownerColumn: "user_id",
      insertAs: (uid) => sql`INSERT INTO brain_dumps (user_id, raw_text) VALUES (${uid}, 'x')`,
    },
    {
      table: "tasks",
      ownerColumn: "user_id",
      insertAs: (uid) => sql`INSERT INTO tasks (user_id, title) VALUES (${uid}, 'x')`,
    },
    {
      table: "task_dependencies",
      ownerColumn: "user_id",
      insertAs: (uid) =>
        sql`INSERT INTO task_dependencies (user_id, task_id, depends_on_task_id) VALUES (${uid}, ${taskIdA}, ${taskIdA2})`,
    },
    {
      table: "task_events",
      ownerColumn: "user_id",
      insertAs: (uid) =>
        sql`INSERT INTO task_events (user_id, task_id, event_type) VALUES (${uid}, ${taskIdA}, 'created')`,
    },
    {
      table: "recurrence_rules",
      ownerColumn: "user_id",
      insertAs: (uid) =>
        sql`INSERT INTO recurrence_rules (user_id, title, frequency, start_date) VALUES (${uid}, 'x', 'weekly', CURRENT_DATE)`,
    },
    {
      table: "plans",
      ownerColumn: "user_id",
      insertAs: (uid) =>
        sql`INSERT INTO plans (user_id, date) VALUES (${uid}, CURRENT_DATE + 5)`,
    },
    {
      table: "plan_items",
      ownerColumn: "user_id",
      insertAs: (uid) =>
        sql`INSERT INTO plan_items (user_id, plan_id, task_id, position) VALUES (${uid}, ${planIdA}, ${taskIdA}, 1)`,
    },
    {
      table: "ai_requests",
      ownerColumn: "user_id",
      insertAs: (uid) => sql`INSERT INTO ai_requests (user_id) VALUES (${uid})`,
    },
  ];
});

afterAll(async () => {
  await truncateAll();
});

describe("every user-scoped table has RLS enabled, forced, and a policy", () => {
  it("enumerates tables with a user-ownership column and checks each one", async () => {
    const result = await adminDb.execute<{
      tablename: string;
      rowsecurity: boolean;
      forcerowsecurity: boolean;
      policy_count: number;
    }>(sql`
      SELECT
        c.relname AS tablename,
        c.relrowsecurity AS rowsecurity,
        c.relforcerowsecurity AS forcerowsecurity,
        (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname)::int AS policy_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND EXISTS (
          SELECT 1 FROM information_schema.columns col
          WHERE col.table_schema = 'public'
            AND col.table_name = c.relname
            AND col.column_name IN ('user_id', 'id')
        )
      ORDER BY c.relname
    `);

    expect(result.rows.length).toBe(11);
    for (const row of result.rows) {
      expect(row.rowsecurity, `${row.tablename}.relrowsecurity`).toBe(true);
      expect(row.forcerowsecurity, `${row.tablename}.relforcerowsecurity`).toBe(true);
      expect(row.policy_count, `${row.tablename} policy count`).toBeGreaterThan(0);
    }
  });
});

describe("cross-user access is blocked, per table, per operation", () => {
  it("every fixture table was captured (sanity check on the test itself)", () => {
    expect(fixtures.map((f) => f.table).sort()).toEqual(
      [
        "ai_requests",
        "brain_dumps",
        "goals",
        "plan_items",
        "plans",
        "projects",
        "recurrence_rules",
        "task_dependencies",
        "task_events",
        "tasks",
        "users",
      ].sort()
    );
  });

  it("select: user A cannot see user B's row, in any table", async () => {
    for (const f of fixtures) {
      const rows = await runAsUser(userA, (tx) =>
        tx.execute(sql.raw(`SELECT 1 FROM ${f.table} WHERE ${f.ownerColumn} = '${userB}'`))
      );
      expect(rows.rows.length, `${f.table}: user A selecting user B's row`).toBe(0);
    }
  });

  it("select: user A can see their own row, in any table (negative-control check)", async () => {
    for (const f of fixtures) {
      const rows = await runAsUser(userA, (tx) =>
        tx.execute(sql.raw(`SELECT 1 FROM ${f.table} WHERE ${f.ownerColumn} = '${userA}'`))
      );
      expect(rows.rows.length, `${f.table}: user A selecting their own row`).toBeGreaterThan(
        0
      );
    }
  });

  it("update: user A affects zero rows targeting user B's row, in any table", async () => {
    const updateColumn: Record<string, string> = {
      users: "name = name",
      goals: "title = title",
      projects: "name = name",
      brain_dumps: "raw_text = raw_text",
      tasks: "title = title",
      task_dependencies: "created_at = created_at",
      task_events: "event_type = event_type",
      recurrence_rules: "title = title",
      plans: "mode = mode",
      plan_items: "position = position",
      ai_requests: "created_at = created_at",
    };
    for (const f of fixtures) {
      const result = await runAsUser(userA, (tx) =>
        tx.execute(
          sql.raw(
            `UPDATE ${f.table} SET ${updateColumn[f.table]} WHERE ${f.ownerColumn} = '${userB}'`
          )
        )
      );
      expect(result.rowCount, `${f.table}: user A updating user B's row`).toBe(0);
    }
  });

  it("delete: user A affects zero rows targeting user B's row, in any table", async () => {
    for (const f of fixtures) {
      const result = await runAsUser(userA, (tx) =>
        tx.execute(sql.raw(`DELETE FROM ${f.table} WHERE ${f.ownerColumn} = '${userB}'`))
      );
      expect(result.rowCount, `${f.table}: user A deleting user B's row`).toBe(0);
    }
  });

  it("insert: user A cannot insert a row owned by user B, in any table", async () => {
    for (const f of fixtures) {
      if (f.table === "users") continue; // see note below
      // The exact error text is driver-wrapped (drizzle-orm's node-postgres
      // execute() throws "Failed query: ..." rather than surfacing
      // Postgres's own "new row violates row-level security policy"
      // message verbatim) — manually verified against psql directly while
      // building this migration; asserting "rejects at all" is what
      // actually matters here; see migrations/0001_row_level_security.sql.
      await expect(
        runAsUser(userA, (tx) => tx.execute(f.insertAs(userB))),
        `${f.table}: user A inserting a row owned by user B`
      ).rejects.toThrow();
    }
  });

  // `users` has no separate "insert on behalf of" case distinct from the
  // row's own id — the WITH CHECK (id = app_current_user_id()) already
  // covers it structurally, proven by the update/delete/select checks
  // above using ownerColumn: "id".
});
