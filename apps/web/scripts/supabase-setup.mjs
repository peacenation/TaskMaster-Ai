import { config } from "dotenv";
import { Pool } from "pg";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

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
  "ai_requests",
];

async function main() {
  const owner = new URL(process.env.DATABASE_URL ?? "");
  const pooled = owner.hostname.endsWith(".pooler.supabase.com");
  if (
    (!pooled && !/^db\.[a-z0-9]+\.supabase\.co$/.test(owner.hostname)) ||
    owner.pathname !== "/postgres" ||
    (owner.port && owner.port !== "5432")
  ) {
    throw new Error(
      "Set DATABASE_URL to the Supabase direct or session-pooler URL on port 5432 first."
    );
  }
  if (!["require", "verify-ca", "verify-full"].includes(owner.searchParams.get("sslmode"))) {
    throw new Error(
      "The Supabase connection URL needs sslmode=require or certificate verification."
    );
  }
  const pool = new Pool({
    connectionString: owner.toString(),
    max: 1,
    connectionTimeoutMillis: 10000,
  });
  const role = "taskmaster_app";
  try {
    // Check that the private destination file exists before creating credentials.
    const envFile = ".env.local";
    const original = readFileSync(envFile, "utf8");
    // Run only after the checked-in migrations, never against a partial/unrelated schema.
    const existing = await pool.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1)",
      [tables]
    );
    if (existing.rowCount !== tables.length)
      throw new Error("Run npm run db:migrate before provisioning the application role.");
    await pool.query("BEGIN");
    const known = await pool.query(
      "SELECT rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolinherit, EXISTS (SELECT 1 FROM pg_auth_members WHERE member = pg_roles.oid) AS memberships FROM pg_roles WHERE rolname = $1",
      [role]
    );
    let password;
    if (known.rowCount) {
      const flags = known.rows[0];
      if (
        flags.rolsuper ||
        flags.rolbypassrls ||
        flags.rolcreatedb ||
        flags.rolcreaterole ||
        flags.rolinherit ||
        flags.memberships
      )
        throw new Error(
          "Existing taskmaster_app has unexpected privileges; inspect it before continuing."
        );
      const configured = new URL(process.env.DATABASE_URL_APP ?? "");
      const expectedUser = pooled ? `${role}.${owner.username.split(".").at(-1)}` : role;
      if (
        configured.hostname !== owner.hostname ||
        configured.username !== expectedUser ||
        configured.pathname !== owner.pathname ||
        !configured.password
      )
        throw new Error(
          "taskmaster_app already exists. Configure its matching DATABASE_URL_APP to re-run setup without changing its password."
        );
      password = decodeURIComponent(configured.password);
    } else {
      password = randomBytes(32).toString("hex");
      // Generated hexadecimal password and fixed role name; neither contains SQL syntax.
      await pool.query(
        `CREATE ROLE ${role} WITH LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`
      );
    }
    await pool.query(`GRANT CONNECT ON DATABASE postgres TO ${role}`);
    await pool.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
    await pool.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ${tables.map((table) => `public."${table}"`).join(", ")} TO ${role}`
    );
    await pool.query(`GRANT EXECUTE ON FUNCTION public.app_current_user_id() TO ${role}`);
    // Future app tables created by this owner role by later migrations are
    // granted automatically; every app table carries an RLS policy
    // (lib/db/isolation.test.ts enumerates and enforces that).
    await pool.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`
    );
    const connection = new URL(owner);
    connection.username = pooled ? `${role}.${owner.username.split(".").at(-1)}` : role;
    connection.password = password;
    const line = `DATABASE_URL_APP=${connection.toString()}`;
    const updated = /^DATABASE_URL_APP=.*$/m.test(original)
      ? original.replace(/^DATABASE_URL_APP=.*$/m, () => line)
      : `${original.trimEnd()}\n${line}\n`;
    writeFileSync(envFile, updated, { mode: 0o600 });
    await pool.query("COMMIT");
    console.log(
      "Supabase application role configured. DATABASE_URL_APP saved to .env.local; credentials were not printed. Run npm run db:check next."
    );
  } finally {
    await pool.end();
  }
}
main().catch((error) => {
  // Driver errors can include endpoint details; only print our own actionable messages.
  console.error(
    error instanceof TypeError
      ? "Check DATABASE_URL and DATABASE_URL_APP in .env.local."
      : error.code
        ? "Supabase provisioning failed. Check connectivity, migration status and role permissions."
        : error.message
  );
  process.exitCode = 1;
});
