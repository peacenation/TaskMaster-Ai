// Prepares a throwaway local PostgreSQL database for automated tests:
// creates it, applies every migration, and grants the app role. Sign-in
// comes from the local Supabase stack (`npm run supabase:start`), whose
// URL and keys are read from the CLI (ADR-013).
// Shared by scripts/db-test.mjs (DB tests) and scripts/e2e-server.mjs
// (end-to-end tests). Refuses to touch anything but localhost, so it can
// never truncate or migrate a cloud database (e.g. Supabase) by accident.
import { config } from "dotenv";
import { Pool } from "pg";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

config({ path: ".env.local", quiet: true });

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

/** URL and keys of the local Supabase stack, from `supabase status`. */
export function localSupabase() {
  const result = spawnSync("supabase", ["status", "-o", "json", "--workdir", REPO_ROOT], {
    encoding: "utf8",
  });
  let status;
  try {
    status = JSON.parse(result.stdout.slice(result.stdout.indexOf("{")));
  } catch {
    throw new Error("Local Supabase isn't running. Start it with: npm run supabase:start");
  }
  if (!LOCAL_HOSTS.includes(new URL(status.API_URL).hostname)) {
    throw new Error("Refusing to use a non-local Supabase for tests.");
  }
  return {
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: status.SECRET_KEY,
    SUPABASE_AUTH_DB_URL: status.DB_URL,
    MAILPIT_URL: status.MAILPIT_URL ?? status.INBUCKET_URL,
  };
}

/**
 * @param {string} name database to (re)use, e.g. "taskmaster_test"
 * @returns {Promise<Record<string, string>>} env for processes using it
 */
export async function prepareLocalDatabase(name) {
  const owner = new URL(process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL);
  const app = new URL(process.env.LOCAL_DATABASE_URL_APP || process.env.DATABASE_URL_APP);
  if (![owner, app].every((url) => LOCAL_HOSTS.includes(url.hostname))) {
    throw new Error(
      "Automated tests require local PostgreSQL. Set LOCAL_DATABASE_URL and LOCAL_DATABASE_URL_APP when the application uses Supabase."
    );
  }
  if ([owner, app].some((url) => url.pathname === `/${name}`)) {
    throw new Error(`The development database must differ from ${name}.`);
  }

  const control = new URL(owner);
  control.pathname = "/postgres";
  const controlPool = new Pool({ connectionString: control.toString() });
  try {
    const found = await controlPool.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      name,
    ]);
    if (!found.rowCount) await controlPool.query(`CREATE DATABASE ${name}`);
  } finally {
    await controlPool.end();
  }

  owner.pathname = app.pathname = `/${name}`;
  const env = {
    ...process.env,
    DATABASE_URL: owner.toString(),
    DATABASE_URL_APP: app.toString(),
    TASKMASTER_TEST_DATABASE: name,
    ...localSupabase(),
  };

  const migrate = spawnSync("npm", ["run", "db:migrate"], { env, stdio: "inherit" });
  if (migrate.status !== 0) throw new Error("Migrations failed.");

  const pool = new Pool({ connectionString: owner.toString() });
  const appRole = decodeURIComponent(app.username).replaceAll('"', '""');
  try {
    await pool.query(`GRANT CONNECT ON DATABASE ${name} TO "${appRole}"`);
    await pool.query(`GRANT USAGE ON SCHEMA public TO "${appRole}"`);
    await pool.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${appRole}"`
    );
    await pool.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${appRole}"`);
  } finally {
    await pool.end();
  }

  return env;
}

/** Empties every user-owned table and every local Supabase login. */
export async function resetLocalDatabase(env) {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  try {
    await pool.query(`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  } finally {
    await pool.end();
  }
  // localSupabase() already refused anything but localhost.
  const auth = new Pool({ connectionString: env.SUPABASE_AUTH_DB_URL });
  try {
    await auth.query("DELETE FROM auth.users");
  } finally {
    await auth.end();
  }
  if (env.MAILPIT_URL) await fetch(`${env.MAILPIT_URL}/api/v1/messages`, { method: "DELETE" });
}
