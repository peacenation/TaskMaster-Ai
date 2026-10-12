import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local", quiet: true });
const tables = [
  "users",
  "goals",
  "projects",
  "brain_dumps",
  "tasks",
  "task_dependencies",
  "task_events",
  "recurrence_rules",
  "plans",
  "plan_items",
];
async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_APP,
    max: 1,
    connectionTimeoutMillis: 10000,
  });
  try {
    const role = await pool.query(
      "SELECT rolsuper, rolbypassrls, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user"
    );
    if (
      !role.rowCount ||
      role.rows[0].rolsuper ||
      role.rows[0].rolbypassrls ||
      role.rows[0].rolcreatedb ||
      role.rows[0].rolcreaterole
    )
      throw new Error("Application role bypasses row-level security.");
    const result = await pool.query(
      "SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity, (SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid) AS policies FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1)",
      [tables]
    );
    if (
      result.rowCount !== tables.length ||
      result.rows.some(
        (row) => !row.relrowsecurity || !row.relforcerowsecurity || Number(row.policies) === 0
      )
    )
      throw new Error("Application schema or RLS configuration is incomplete.");
    await pool.query("BEGIN");
    await pool.query("SELECT set_config('app.current_user_id', '', true)");
    for (const table of tables) {
      const count = await pool.query(`SELECT count(*) AS count FROM public."${table}"`);
      if (Number(count.rows[0].count) !== 0)
        throw new Error("Rows are visible without user context.");
    }
    await pool.query("ROLLBACK");
    console.log(
      "Database connection passed: restricted application role, all ten tables protected by forced RLS, and no rows visible without user context. No data was changed."
    );
  } finally {
    await pool.end();
  }
}
if (!process.env.DATABASE_URL_APP)
  throw new Error("Set DATABASE_URL_APP in .env.local first.");
main().catch(() => {
  console.error(
    "Database check failed. Verify the connection, application role grants and migrations."
  );
  process.exitCode = 1;
});
