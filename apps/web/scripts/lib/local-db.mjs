// Prepares a throwaway local PostgreSQL database for automated tests:
// creates it, applies every migration, and grants the app and auth roles.
// Shared by scripts/db-test.mjs (DB tests) and scripts/e2e-server.mjs
// (end-to-end tests). Refuses to touch anything but localhost, so it can
// never truncate or migrate a cloud database (e.g. Supabase) by accident.
import { config } from "dotenv";
import { Pool } from "pg";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

config({ path: ".env.local", quiet: true });

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
const AUTH_ROLE = "taskmaster_auth_test";
const AUTH_PASSWORD = "taskmaster_auth_test_local";

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
    BETTER_AUTH_SECRET: randomBytes(48).toString("hex"),
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
    const found = await pool.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [AUTH_ROLE]);
    if (!found.rowCount) {
      await pool.query(
        `CREATE ROLE ${AUTH_ROLE} LOGIN PASSWORD '${AUTH_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`
      );
    }
    await pool.query(`GRANT CONNECT ON DATABASE ${name} TO ${AUTH_ROLE}`);
    await pool.query(`GRANT USAGE ON SCHEMA taskmaster_auth TO ${AUTH_ROLE}, "${appRole}"`);
    await pool.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA taskmaster_auth TO ${AUTH_ROLE}`
    );
  } finally {
    await pool.end();
  }

  const authUrl = new URL(owner);
  authUrl.username = AUTH_ROLE;
  authUrl.password = AUTH_PASSWORD;
  env.DATABASE_URL_AUTH = authUrl.toString();
  return env;
}

/** Empties every user-owned table, keeping the schema and roles. */
export async function resetLocalDatabase(env) {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  try {
    await pool.query(
      `TRUNCATE TABLE users, taskmaster_auth."user", taskmaster_auth.verification RESTART IDENTITY CASCADE`
    );
  } finally {
    await pool.end();
  }
}
