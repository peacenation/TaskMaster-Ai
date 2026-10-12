// The shared TaskRepository contract against the real Postgres adapter,
// through withRepositories() — so it also proves RLS isolates users, not
// just the adapter's own user_id filters. Needs a local Postgres with
// migrations applied (scripts/db-bootstrap.sh); runs via `npm run db:test`.
import { sql } from "drizzle-orm";
import { getAdminDb } from "@/lib/db/client";
import { withRepositories } from "./index";
import { runTaskRepositoryContract } from "./task-repository.contract";

runTaskRepositoryContract("postgres", async () => {
  const admin = getAdminDb();
  await admin.execute(sql`TRUNCATE TABLE users, tasks RESTART IDENTITY CASCADE`);
  const rows = await admin.execute<{ id: string }>(
    sql`INSERT INTO users (name, email) VALUES ('Contract A', 'contract-a@test.local'), ('Contract B', 'contract-b@test.local') RETURNING id`
  );
  const [userA, userB] = rows.rows.map((r) => r.id);

  return {
    // Each call opens its own RLS-scoped transactions, committed on return.
    run: (fn) =>
      withRepositories(userA, (a) => withRepositories(userB, (b) => fn(a.tasks, b.tasks))),
  };
});
