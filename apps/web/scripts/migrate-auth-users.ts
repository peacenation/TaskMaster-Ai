// One-off: moves every Better Auth login (taskmaster_auth.user) into Supabase
// Auth with the SAME id, so public.users and everything that cascades from
// it stays attached unchanged (ADR-013, plan step 4).
//
//   npm run auth:migrate -w @taskmaster/web                      # dry run: report only
//   npm run auth:migrate -w @taskmaster/web -- --apply           # create the logins
//   ... -- --apply --send-reset --site=https://your.host         # and email password users
//
// Cutover order: --apply BEFORE deploying the Supabase Auth version (harmless
// while the old app runs), deploy, then --apply --send-reset: the email links
// point at /auth/confirm, which only the new version has. --send-reset emails
// every password user, including logins created by an earlier run.
//   add --confirm for any database that isn't localhost
//
// Emails are marked confirmed: these people have been using their accounts.
// Passwords can't move (Better Auth's scrypt format isn't one Supabase
// imports), so password users set a new one through the reset email, or
// sign in with Google or an email link. Google users are linked by Supabase
// on their first Google sign-in, because the email is confirmed.
// Safe to re-run: logins that already exist are skipped (and only emailed
// again if --send-reset is given).
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local", quiet: true });

const LOCAL = ["localhost", "127.0.0.1", "[::1]"];
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const sendReset = args.has("--send-reset");
const site = process.argv.find((arg) => arg.startsWith("--site="))?.slice("--site=".length);

interface LegacyUser {
  id: string;
  name: string;
  email: string;
  providers: string[];
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL (owner connection) is not set.");
  const host = new URL(url).hostname;
  if (!LOCAL.includes(host) && !args.has("--confirm"))
    throw new Error(`Refusing to read ${host} without --confirm.`);
  if (sendReset && !site) throw new Error("--send-reset needs --site=https://your.host");

  const { supabaseAdmin, supabaseStateless } = await import("../lib/supabase/server");
  const pool = new Pool({ connectionString: url, max: 1 });
  const exists = await pool.query("SELECT to_regclass('taskmaster_auth.user') AS t");
  if (!exists.rows[0].t) {
    console.log("No taskmaster_auth schema here: nothing to migrate.");
    await pool.end();
    return;
  }
  const { rows } = await pool.query<LegacyUser>(`
    SELECT u.id, u.name, u.email,
           coalesce(array_agg(a.provider_id) FILTER (WHERE a.provider_id IS NOT NULL), '{}') AS providers
      FROM taskmaster_auth."user" u
      LEFT JOIN taskmaster_auth.account a ON a.user_id = u.id
     GROUP BY u.id ORDER BY u.created_at`);
  await pool.end();

  const admin = supabaseAdmin().auth.admin;
  const counts = { created: 0, skipped: 0, resetSent: 0, failed: 0 };
  console.log(`${rows.length} Better Auth account(s) on ${host}${apply ? "" : " (dry run)"}`);
  const sendResetEmail = async (user: LegacyUser) => {
    if (!sendReset || !user.providers.includes("credential")) return;
    // Supabase allows one email per address per max_frequency; pace them.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const reset = await supabaseStateless().auth.resetPasswordForEmail(user.email, {
      redirectTo: `${site}/auth/confirm`,
    });
    if (reset.error)
      console.error(`  reset email failed for ${user.email}: ${reset.error.message}`);
    else counts.resetSent++;
  };
  for (const user of rows) {
    const label = `${user.email} [${user.providers.join(", ") || "no provider"}]`;
    const { data: found } = await admin.getUserById(user.id);
    if (found.user) {
      counts.skipped++;
      console.log(`  skip    ${label} — already in Supabase Auth`);
      if (apply) await sendResetEmail(user);
      continue;
    }
    if (!apply) {
      console.log(`  would create ${label}`);
      continue;
    }
    const { error } = await admin.createUser({
      id: user.id,
      email: user.email,
      email_confirm: true,
      user_metadata: { name: user.name },
    });
    if (error) {
      counts.failed++;
      console.error(`  FAILED  ${label}: ${error.message}`);
      continue;
    }
    counts.created++;
    console.log(`  created ${label}`);
    await sendResetEmail(user);
  }
  console.log(JSON.stringify(counts));
  if (counts.failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
