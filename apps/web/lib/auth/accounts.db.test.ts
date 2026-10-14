import { beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAdminDb } from "@/lib/db/client";
import { withRepositories } from "@/lib/repo";

// Real sign-in against the local Supabase Auth stack (scripts/db-test.mjs
// passes its URL and keys) with app data in taskmaster_test (ADR-013).

const admin = getAdminDb();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const mailpit = process.env.MAILPIT_URL!;
const auth = createClient(url, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
}).auth.admin;
const password = "A long test password 42!";
const emailA = "account-a@test.local";
const emailB = "account-b@test.local";
let a: string;
let b: string;
let taskId: string;

/** A separate device: its own client and session. */
function device(): SupabaseClient {
  return createClient(url, publishable, { auth: { persistSession: false } });
}
async function signedIn(email: string, pass = password) {
  const client = device();
  const { data, error } = await client.auth.signInWithPassword({ email, password: pass });
  if (error) throw error;
  return { client, token: data.session.access_token };
}
async function valid(token: string) {
  return !(await device().auth.getUser(token)).error;
}
/** The token hash from the newest email of `type` sent to `email`. */
async function emailToken(email: string, type: string): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const search = await fetch(
      `${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`
    );
    for (const { ID } of ((await search.json()) as { messages: { ID: string }[] }).messages) {
      const html = (
        (await (await fetch(`${mailpit}/api/v1/message/${ID}`)).json()) as {
          HTML: string;
        }
      ).HTML.replaceAll("&amp;", "&");
      const link = html.match(/href="([^"]*token_hash[^"]*)"/)?.[1];
      if (link && new URL(link).searchParams.get("type") === type)
        return new URL(link).searchParams.get("token_hash")!;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No ${type} email for ${email}`);
}

beforeAll(async () => {
  await admin.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  await fetch(`${mailpit}/api/v1/messages`, { method: "DELETE" });
  const { data: existing } = await auth.listUsers();
  for (const user of existing.users)
    if ([emailA, emailB].includes(user.email ?? "")) await auth.deleteUser(user.id);
  for (const [email, name] of [
    [emailA, "Account A"],
    [emailB, "Account B"],
  ]) {
    const { data, error } = await auth.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (error) throw error;
    await withRepositories(data.user.id, (repos) =>
      repos.users.ensure({ name, email, authId: data.user.id })
    );
    if (email === emailA) a = data.user.id;
    else b = data.user.id;
  }
  const task = await withRepositories(a, (repos) =>
    repos.tasks.create({ title: "Private task", status: "todo" })
  );
  taskId = task.id;
});

describe("real authentication and accounts", () => {
  it("uses revocable sessions, creates private profiles, and persists cross-device data", async () => {
    const laptop = await signedIn(emailA);
    const phone = await signedIn(emailA);
    expect((await device().auth.getUser(laptop.token)).data.user?.id).toBe(a);
    expect(await valid(phone.token)).toBe(true);
    expect(
      (await withRepositories(a, (repos) => repos.account.export())).tasks.map(
        (task) => task.title
      )
    ).toEqual(["Private task"]);
    expect(await withRepositories(b, (repos) => repos.tasks.get(taskId))).toBeUndefined();
    await expect(
      withRepositories(b, (repos) => repos.tasks.update(taskId, { title: "Stolen" }))
    ).rejects.toThrow();
    // Signing out one device revokes that session at once; the other stays.
    await phone.client.auth.signOut({ scope: "local" });
    expect(await valid(phone.token)).toBe(false);
    expect(await valid(laptop.token)).toBe(true);
  });

  it("stores preferences independently by user, including timezone", async () => {
    await withRepositories(a, (repos) =>
      repos.users.savePreferences("America/New_York", {
        timezoneSet: true,
        dayMinutes: 120,
        planMode: "scheduled",
      })
    );
    const profile = await withRepositories(a, (repos) => repos.users.profile());
    expect(profile?.timezone).toBe("America/New_York");
    expect(profile?.preferences.dayMinutes).toBe(120);
    expect(
      (await withRepositories(b, (repos) => repos.users.profile()))?.preferences.dayMinutes
    ).toBeUndefined();
  });

  it("sends an email sign-in link that works exactly once", async () => {
    const { error } = await device().auth.signInWithOtp({
      email: emailA,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: "http://localhost:3000/auth/confirm",
      },
    });
    expect(error).toBeNull();
    const tokenHash = await emailToken(emailA, "magiclink");
    const first = await device().auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
    expect(first.error).toBeNull();
    expect(first.data.user?.id).toBe(a);
    const replay = await device().auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
    expect(replay.error).not.toBeNull();
  });

  it("resets the password, signs out other sessions, and rejects the old password", async () => {
    const elsewhere = await signedIn(emailA);
    // Supabase Auth allows one email per address per `max_frequency`
    // (supabase/config.toml: 1s locally); the previous test just sent one.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const { error } = await device().auth.resetPasswordForEmail(emailA, {
      redirectTo: "http://localhost:3000/auth/confirm",
    });
    expect(error).toBeNull();
    const recovering = device();
    const verified = await recovering.auth.verifyOtp({
      token_hash: await emailToken(emailA, "recovery"),
      type: "recovery",
    });
    expect(verified.error).toBeNull();
    // What the reset form does (components/auth/AuthForm.tsx).
    expect(
      (await recovering.auth.updateUser({ password: "A new test password 77!" })).error
    ).toBeNull();
    await recovering.auth.signOut({ scope: "others" });
    expect(await valid(elsewhere.token)).toBe(false);
    await expect(signedIn(emailA)).rejects.toThrow();
    await expect(signedIn(emailA, "A new test password 77!")).resolves.toBeTruthy();
  });

  it("deletes an account, all owned data and every session", async () => {
    const session = await signedIn(emailB);
    await withRepositories(b, async (repos) => {
      await repos.tasks.create({ title: "Delete with my account" });
      await repos.brainDumps.create("Delete this raw text");
    });
    // What app/api/account/delete does: data first, then the login.
    await withRepositories(b, (repos) => repos.account.deleteAll());
    expect((await auth.deleteUser(b)).error).toBeNull();

    for (const table of ["users", "tasks", "brain_dumps"]) {
      const column = table === "users" ? sql`id` : sql`user_id`;
      const rows = await admin.execute<{ count: number }>(
        sql`SELECT count(*)::int AS count FROM ${sql.identifier(table)} WHERE ${column}=${b}`
      );
      expect(rows.rows[0].count, table).toBe(0);
    }
    expect(await valid(session.token)).toBe(false);
    // Account A is untouched.
    expect(await withRepositories(a, (repos) => repos.tasks.get(taskId))).toBeDefined();
  });
});
