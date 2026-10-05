import { config } from "dotenv";
import { Pool } from "pg";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
config({ path: ".env.local", quiet: true });
async function main() {
  const url = new URL(process.env.DATABASE_URL);
  const role = "taskmaster_auth_service";
  const pool = new Pool({
    connectionString: url.toString(),
    max: 1,
    connectionTimeoutMillis: 10000,
  });
  try {
    const original = readFileSync(".env.local", "utf8");
    await pool.query("BEGIN");
    const existing = await pool.query(
      "SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=$1",
      [role]
    );
    let password;
    if (existing.rowCount) {
      if (existing.rows[0].rolsuper || existing.rows[0].rolbypassrls)
        throw new Error("Auth service role must not bypass RLS.");
      const configured = new URL(process.env.DATABASE_URL_AUTH || "");
      if (
        configured.hostname !== url.hostname ||
        !decodeURIComponent(configured.username).startsWith(role) ||
        !configured.password
      )
        throw new Error(
          "Configure the matching DATABASE_URL_AUTH for the existing auth role."
        );
      password = decodeURIComponent(configured.password);
    } else {
      password = randomBytes(32).toString("hex");
      await pool.query(
        `CREATE ROLE ${role} WITH LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`
      );
    }
    const database = decodeURIComponent(url.pathname.slice(1)).replaceAll('"', '""');
    await pool.query(`GRANT CONNECT ON DATABASE "${database}" TO ${role}`);
    await pool.query(`GRANT USAGE ON SCHEMA taskmaster_auth TO ${role}`);
    await pool.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA taskmaster_auth TO ${role}`
    );
    // Tables added by later migrations (e.g. rate_limit, 0007), created by
    // this same owner role, get the grant automatically — without it the
    // auth role hits "permission denied" on the first deploy that adds one.
    await pool.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA taskmaster_auth GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`
    );
    // The app role needs to check FK existence without reading auth accounts.
    const appUrl = new URL(process.env.DATABASE_URL_APP);
    const appRole = decodeURIComponent(appUrl.username).split(".")[0].replaceAll('"', '""');
    await pool.query(`GRANT USAGE ON SCHEMA taskmaster_auth TO "${appRole}"`);
    const authUrl = new URL(url);
    authUrl.username = url.hostname.endsWith(".pooler.supabase.com")
      ? `${role}.${url.username.split(".").at(-1)}`
      : role;
    authUrl.password = password;
    let updated = original;
    const save = (key, value) => {
      const pattern = new RegExp(`^${key}=.*$`, "m");
      const line = key + "=" + JSON.stringify(value);
      updated = pattern.test(updated)
        ? updated.replace(pattern, () => line)
        : updated.trimEnd() + "\n" + line + "\n";
    };
    save("DATABASE_URL_AUTH", authUrl.toString());
    if (!process.env.BETTER_AUTH_SECRET)
      save("BETTER_AUTH_SECRET", randomBytes(48).toString("hex"));
    if (!process.env.BETTER_AUTH_URL) save("BETTER_AUTH_URL", "http://localhost:3000");
    if (!process.env.AUTH_EMAIL_PROVIDER) save("AUTH_EMAIL_PROVIDER", "resend");
    writeFileSync(".env.local", updated, { mode: 0o600 });
    await pool.query("COMMIT");
    console.log(
      "Private authentication role and local secret configured. Credentials were not printed."
    );
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error(
    "Auth database setup failed. Check migrations and the existing role connection."
  );
  process.exitCode = 1;
});
