// Production migrations, run by .github/workflows/deploy.yml before each
// deploy (docs/OPERATIONS.md). Applies the checked-in migrations with the
// owner connection, then re-grants the two restricted roles on whatever
// tables now exist. Re-running is a no-op: applied migrations are skipped
// and grants are idempotent.
//
// The owner credentials live only in the CI secret store, never in the
// app's runtime environment. Refuses to run outside CI without --confirm,
// so a stray local run can't migrate a cloud database by accident.
import { config } from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { poolConfig } from "../lib/db/pool-config";

config({ path: ".env.local", quiet: true });

const APP_ROLE = "taskmaster_app";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL (the owner connection) is not set.");
  if (process.env.CI !== "true" && !process.argv.includes("--confirm")) {
    throw new Error(
      `Refusing to migrate ${new URL(url).hostname} outside CI. Re-run with --confirm if you mean it.`
    );
  }
  console.log(`Migrating ${new URL(url).hostname} …`);

  const pool = new Pool({ ...poolConfig(url), max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "migrations" });

    const roles = await pool.query<{ rolname: string }>(
      "SELECT rolname FROM pg_roles WHERE rolname = ANY($1)",
      [[APP_ROLE]]
    );
    const present = new Set(roles.rows.map((row) => row.rolname));
    // Fixed role names; no user input reaches these statements.
    if (present.has(APP_ROLE)) {
      await pool.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_ROLE}`
      );
    }
    if (!present.has(APP_ROLE)) {
      console.warn(
        `Role not provisioned yet: ${APP_ROLE}. Run db:supabase:setup once (docs/SUPABASE.md).`
      );
    }
    console.log("Migrations applied; role grants refreshed.");
  } finally {
    await pool.end();
  }
}

/** The database error behind Drizzle's wrapper, however it's nested. */
function describe(error: unknown, depth = 0): string[] {
  if (!(error instanceof Error) || depth > 4) return [];
  const e = error as Error & { code?: string; errors?: unknown[] };
  const line = [e.name, e.code, e.message].filter(Boolean).join(" · ");
  return [
    line,
    ...(e.errors ?? []).flatMap((inner) => describe(inner, depth + 1)),
    ...describe(e.cause, depth + 1),
  ];
}

main().catch((error) => {
  // Drizzle's "Failed query" hides the reason (wrong password, certificate,
  // network). Postgres and network errors never include the password.
  const [first, ...causes] = describe(error);
  console.error(first ?? String(error));
  for (const cause of causes) console.error(`Cause: ${cause}`);
  process.exit(1);
});
