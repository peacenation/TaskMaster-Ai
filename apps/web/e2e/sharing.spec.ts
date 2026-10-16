import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { PASSWORD, createConfirmedUser, localSupabase, uniqueEmail } from "./helpers";

// Shared projects end to end: invite by email, join (in the app and by the
// link, through sign-in), work together, assign, and keep strangers out.

const BASE = "http://localhost:3110";

async function tokenFor(email: string, name: string) {
  await createConfirmedUser(email, name);
  const { url, publishableKey } = localSupabase();
  const client = createClient(url, publishableKey, { auth: { persistSession: false } });
  const { data } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  return data.session!.access_token;
}

function api(token: string) {
  const call = async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        "x-time-zone": "Europe/London",
        authorization: `Bearer ${token}`,
      },
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  };
  return {
    get: (path: string) => call(path),
    send: (method: string, path: string, body?: unknown) =>
      call(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }),
  };
}

test("sharing over the API: invite, join, work together, assign", async ({}, info) => {
  test.skip(info.project.name !== "desktop", "API behaviour is viewport-independent");
  const ownerEmail = uniqueEmail("share-owner", info.project.name);
  const memberEmail = uniqueEmail("share-member", info.project.name);
  const strangerEmail = uniqueEmail("share-stranger", info.project.name);
  const owner = api(await tokenFor(ownerEmail, "Olu Owner"));
  const member = api(await tokenFor(memberEmail, "Mia Member"));
  const stranger = api(await tokenFor(strangerEmail, "Sam Stranger"));

  // The owner's project, from a Brain Dump.
  const dump = await owner.send("POST", "/api/v1/dumps", { text: "Write the launch post" });
  await owner.send("POST", `/api/v1/dumps/${dump.body.dumpId}/commit`, {
    items: dump.body.items.map((item: Record<string, unknown>) => ({
      kind: "task",
      title: item.title,
      dueAt: null,
      recurrence: null,
      estimatedMinutes: 30,
      project: "Launch",
      importance: null,
    })),
  });
  const launch = (await owner.get("/api/v1/projects")).body.projects[0];
  expect(launch).toMatchObject({ name: "Launch", role: "owner" });

  // Invite: refused for non-owners; the invitee sees it in the app.
  expect(
    (
      await stranger.send("POST", `/api/v1/projects/${launch.id}/invites`, {
        email: memberEmail,
      })
    ).status
  ).toBe(409);
  const invited = await owner.send("POST", `/api/v1/projects/${launch.id}/invites`, {
    email: memberEmail,
  });
  expect(invited.status).toBe(201);
  expect(invited.body.link).toMatch(/\/invites\/[\w-]+$/);
  expect((await stranger.get("/api/v1/invites")).body.invites).toEqual([]);
  const [invite] = (await member.get("/api/v1/invites")).body.invites;
  expect(invite).toMatchObject({ projectName: "Launch", inviterName: "Olu Owner" });
  expect(
    (await stranger.send("POST", `/api/v1/invites/${invite.id}`, { action: "accept" })).status
  ).toBe(410);
  const joined = await member.send("POST", `/api/v1/invites/${invite.id}`, {
    action: "accept",
  });
  expect(joined.body).toEqual({ ok: true, projectId: launch.id });

  // Members see the project, its people and its tasks; strangers see nothing.
  expect((await member.get("/api/v1/projects")).body.projects).toEqual([
    expect.objectContaining({ name: "Launch", role: "member" }),
  ]);
  const detail = (await member.get(`/api/v1/projects/${launch.id}`)).body;
  expect(detail.people.map((p: { name: string; role: string }) => [p.name, p.role])).toEqual([
    ["Olu Owner", "owner"],
    ["Mia Member", "member"],
  ]);
  const task = detail.todo[0];
  expect((await stranger.get(`/api/v1/projects/${launch.id}`)).status).toBe(404);
  expect((await stranger.get(`/api/v1/tasks/${task.id}`)).status).toBe(404);

  // The member has their own first Brain Dump, so they have a Today.
  const own = await member.send("POST", "/api/v1/dumps", { text: "Renew my passport" });
  await member.send("POST", `/api/v1/dumps/${own.body.dumpId}/commit`, {
    items: [
      {
        kind: "task",
        title: "Renew my passport",
        dueAt: null,
        recurrence: null,
        estimatedMinutes: 30,
        project: null,
        importance: null,
      },
    ],
  });

  // Assign it to the member: it's on their list and their Today, not the owner's.
  expect(
    (
      await owner.send("PATCH", `/api/v1/tasks/${task.id}`, {
        assigneeId: (await member.get("/api/v1/me")).body.id,
      })
    ).status
  ).toBe(200);
  const memberTasks = (await member.get("/api/v1/tasks?view=all")).body.tasks;
  expect(memberTasks.map((t: { id: string }) => t.id)).toContain(task.id);
  const memberToday = (await member.get("/api/v1/today")).body;
  expect(memberToday.plan.map((p: { task: { id: string } }) => p.task.id)).toContain(task.id);
  const ownerToday = (await owner.get("/api/v1/today")).body;
  expect(ownerToday.plan.map((p: { task: { id: string } }) => p.task.id)).not.toContain(
    task.id
  );
  expect(
    (
      await owner.send("PATCH", `/api/v1/tasks/${task.id}`, {
        assigneeId: (await stranger.get("/api/v1/me")).body.id,
      })
    ).status
  ).toBe(400);

  // The member works on it, but can't move it out of the project.
  expect(
    (await member.send("POST", `/api/v1/tasks/${task.id}/status`, { status: "completed" }))
      .status
  ).toBe(200);
  expect((await owner.get(`/api/v1/tasks/${task.id}`)).body.task.status).toBe("completed");
  expect(
    (await member.send("PATCH", `/api/v1/tasks/${task.id}`, { project: "Mine now" })).status
  ).toBe(403);

  // Leaving takes the project away.
  const memberId = (await member.get("/api/v1/me")).body.id;
  expect(
    (await member.send("DELETE", `/api/v1/projects/${launch.id}/members/${memberId}`)).status
  ).toBe(200);
  expect((await member.get(`/api/v1/projects/${launch.id}`)).status).toBe(404);
});

test("joining by the invitation link, through sign-in", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop", "one viewport is enough");
  const ownerEmail = uniqueEmail("link-owner", info.project.name);
  const memberEmail = uniqueEmail("link-member", info.project.name);
  const owner = api(await tokenFor(ownerEmail, "Olu Owner"));
  await createConfirmedUser(memberEmail, "Mia Member");
  const dump = await owner.send("POST", "/api/v1/dumps", { text: "Book the venue" });
  await owner.send("POST", `/api/v1/dumps/${dump.body.dumpId}/commit`, {
    items: [
      {
        kind: "task",
        title: "Book the venue",
        dueAt: null,
        recurrence: null,
        estimatedMinutes: 30,
        project: "Offsite",
        importance: null,
      },
    ],
  });
  const offsite = (await owner.get("/api/v1/projects")).body.projects[0];
  const { body } = await owner.send("POST", `/api/v1/projects/${offsite.id}/invites`, {
    email: memberEmail,
  });

  const page = await (await browser.newContext()).newPage();
  await page.goto(new URL(body.link).pathname);
  await expect(page).toHaveURL(/\/signin\?next=%2Finvites%2F/);
  await page.getByLabel("Email").fill(memberEmail);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Join Offsite?" })).toBeVisible();
  await page.getByRole("button", { name: "Join project" }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${offsite.id}$`));
  await expect(page.getByRole("heading", { name: "People" })).toBeVisible();
  await expect(page.getByText("Book the venue")).toBeVisible();
  await expect(page.getByRole("button", { name: "Leave project" })).toBeVisible();
});
