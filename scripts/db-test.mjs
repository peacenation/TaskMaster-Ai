import { config } from "dotenv";
import { Pool } from "pg";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

config({ path: ".env.local", quiet: true });
// Always derive a separate local test database; never pass the dev URL to Vitest.
const owner = new URL(process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL);
const app = new URL(process.env.LOCAL_DATABASE_URL_APP || process.env.DATABASE_URL_APP);
const testName = "taskmaster_test";
if (![owner, app].every((url) => ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) {
  throw new Error(
    "Database tests require local PostgreSQL. Set LOCAL_DATABASE_URL and LOCAL_DATABASE_URL_APP when the application uses Supabase."
  );
}
if ([owner, app].some((url) => url.pathname === `/${testName}`)) {
  throw new Error("The development database must differ from taskmaster_test.");
}
const control = new URL(owner);
control.pathname = "/postgres";
const pool = new Pool({ connectionString: control.toString() });
try {
  const found = await pool.query("SELECT 1 FROM pg_database WHERE datname = $1", [testName]);
  if (!found.rowCount) await pool.query(`CREATE DATABASE ${testName}`);
} finally {
  await pool.end();
}
owner.pathname = app.pathname = `/${testName}`;
const env = {
  ...process.env,
  DATABASE_URL: owner.toString(),
  DATABASE_URL_APP: app.toString(),
  TASKMASTER_TEST_DATABASE: testName,
  BETTER_AUTH_SECRET: randomBytes(48).toString("hex"),
  BETTER_AUTH_URL: "http://localhost:3108",
};
const run = (args) => {
  const result = spawnSync("npm", args, { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
run(["run", "db:migrate"]);
const testPool = new Pool({ connectionString: owner.toString() });
const role = decodeURIComponent(app.username).replaceAll('"', '""');
try {
  await testPool.query(`GRANT CONNECT ON DATABASE ${testName} TO "${role}"`);
  await testPool.query(`GRANT USAGE ON SCHEMA public TO "${role}"`);
  await testPool.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${role}"`
  );
  await testPool.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${role}"`);
  const authRole = "taskmaster_auth_test";
  const found = await testPool.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [authRole]);
  if (!found.rowCount)
    await testPool.query(
      `CREATE ROLE ${authRole} LOGIN PASSWORD 'taskmaster_auth_test_local' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`
    );
  await testPool.query(`GRANT CONNECT ON DATABASE ${testName} TO ${authRole}`);
  await testPool.query(`GRANT USAGE ON SCHEMA taskmaster_auth TO ${authRole}, "${role}"`);
  await testPool.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA taskmaster_auth TO ${authRole}`
  );
  const authUrl = new URL(owner);
  authUrl.username = authRole;
  authUrl.password = "taskmaster_auth_test_local";
  env.DATABASE_URL_AUTH = authUrl.toString();
} finally {
  await testPool.end();
}
run(["exec", "--", "vitest", "run", "--config", "vitest.config.db.mts"]);
