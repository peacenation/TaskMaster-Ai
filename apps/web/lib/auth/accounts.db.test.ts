import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { getAdminDb } from "@/lib/db/client";
import { createAuth } from "./server";
import { withRepositories } from "@/lib/repo";
const base = "http://localhost:3108";
const admin = getAdminDb();
let auth: ReturnType<typeof createAuth>;
let outbox: string;
let a: string;
let b: string;
let cookieA: string;
let cookieB: string;
let taskId: string;
const password = "A long test password 42!";
function cookie(response: Response) {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
}
async function call(path: string, body?: unknown, cookies?: string) {
  return auth.handler(
    new Request(base + "/api/auth/" + path, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        Origin: base,
        ...(cookies ? { Cookie: cookies } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  );
}
beforeAll(async () => {
  await admin.execute(
    sql`TRUNCATE TABLE taskmaster_auth."user", taskmaster_auth.verification, users RESTART IDENTITY CASCADE`
  );
  outbox = await mkdtemp("/tmp/taskmaster-auth-mail-");
  process.env.AUTH_EMAIL_PROVIDER = "test";
  process.env.AUTH_TEST_EMAIL_DIR = outbox;
  auth = createAuth();
  const first = await call("sign-up/email", {
    name: "Account A",
    email: "account-a@test.local",
    password,
  });
  expect(first.status).toBe(200);
  a = (await first.json()).user.id;
  cookieA = cookie(first);
  const second = await call("sign-up/email", {
    name: "Account B",
    email: "account-b@test.local",
    password,
  });
  expect(second.status).toBe(200);
  b = (await second.json()).user.id;
  cookieB = cookie(second);
  const task = await withRepositories(a, (repos) =>
    repos.tasks.create({ title: "Private task", status: "todo" })
  );
  taskId = task.id;
});
afterAll(async () => {
  delete process.env.AUTH_EMAIL_PROVIDER;
  delete process.env.AUTH_TEST_EMAIL_DIR;
  await rm(outbox, { recursive: true, force: true });
});
describe("real authentication and accounts", () => {
  it("uses revocable sessions, creates private profiles, and persists cross-device data", async () => {
    const signed = await call("get-session", undefined, cookieA);
    expect((await signed.json()).user.id).toBe(a);
    const secondDevice = await call("sign-in/email", {
      email: "account-a@test.local",
      password,
    });
    expect(secondDevice.status).toBe(200);
    const secondCookie = cookie(secondDevice);
    expect((await call("get-session", undefined, secondCookie)).status).toBe(200);
    expect(
      (await withRepositories(a, (repos) => repos.account.export())).tasks.map(
        (task) => task.title
      )
    ).toEqual(["Private task"]);
    expect(await withRepositories(b, (repos) => repos.tasks.get(taskId))).toBeUndefined();
    await expect(
      withRepositories(b, (repos) => repos.tasks.update(taskId, { title: "Stolen" }))
    ).rejects.toThrow();
    await call("sign-out", {}, secondCookie);
    expect(await (await call("get-session", undefined, secondCookie)).json()).toBeNull();
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
  it("sends and consumes a hashed magic link once", async () => {
    const requested = await call("sign-in/magic-link", {
      email: "account-a@test.local",
      callbackURL: "/",
    });
    expect(requested.status).toBe(200);
    const files = await readdir(outbox);
    const mail = JSON.parse(await readFile(outbox + "/" + files[0], "utf8"));
    const url = mail.text.match(/https?:\/\/\S+/)[0];
    const response = await auth.handler(new Request(url, { headers: { Origin: base } }));
    expect(response.status).toBe(302);
    expect(cookie(response)).toContain("session_token");
    const replay = await auth.handler(new Request(url, { headers: { Origin: base } }));
    expect(replay.headers.get("location")).toContain("error");
  });
  it("resets the password, invalidates old sessions, and rejects the old password", async () => {
    const priorFiles = new Set(await readdir(outbox));
    const request = await call("request-password-reset", {
      email: "account-a@test.local",
      redirectTo: "/reset",
    });
    expect(request.status).toBe(200);
    const file = (await readdir(outbox)).find((file) => !priorFiles.has(file))!;
    const mail = JSON.parse(await readFile(outbox + "/" + file, "utf8"));
    const url = mail.text.match(/https?:\/\/\S+/)[0];
    const redirect = await auth.handler(new Request(url, { headers: { Origin: base } }));
    const token = new URL(redirect.headers.get("location")!, base).searchParams.get("token");
    expect(token).toBeTruthy();
    const reset = await call("reset-password", {
      token,
      newPassword: "A new test password 77!",
    });
    expect(reset.status).toBe(200);
    expect(await (await call("get-session", undefined, cookieA)).json()).toBeNull();
    expect(
      (await call("sign-in/email", { email: "account-a@test.local", password })).status
    ).toBe(401);
  });
  it("deletes an account, all owned data and sessions with a database-enforced cascade", async () => {
    const refused = await call("delete-user", { password: "wrong" }, cookieB);
    expect(refused.status).toBeGreaterThanOrEqual(400);
    await withRepositories(b, async (repos) => {
      await repos.tasks.create({ title: "Delete with my account" });
      await repos.brainDumps.create("Delete this raw text");
    });
    const deleted = await call("delete-user", { password }, cookieB);
    expect(deleted.status).toBe(200);
    const counts = await admin.execute<{ count: number }>(
      sql`SELECT count(*)::int AS count FROM users WHERE id=${b}`
    );
    expect(counts.rows[0].count).toBe(0);
    const tasks = await admin.execute<{ count: number }>(
      sql`SELECT count(*)::int AS count FROM tasks WHERE user_id=${b}`
    );
    expect(tasks.rows[0].count).toBe(0);
    const dumps = await admin.execute<{ count: number }>(
      sql`SELECT count(*)::int AS count FROM brain_dumps WHERE user_id=${b}`
    );
    expect(dumps.rows[0].count).toBe(0);
    expect(await (await call("get-session", undefined, cookieB)).json()).toBeNull();
  });
});
