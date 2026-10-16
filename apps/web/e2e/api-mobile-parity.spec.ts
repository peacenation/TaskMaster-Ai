import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { PASSWORD, createConfirmedUser, localSupabase, uniqueEmail } from "./helpers";

// The rest of the web's features over /api/v1, for the mobile app: Inbox
// triage, task detail/edit/breakdown/delete, goals, responsibilities,
// reviews, Today's settings and "choose next", preferences and account
// deletion.

const BASE = "http://localhost:3110";

async function call(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-time-zone": "Europe/London",
      authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}
const send = (method: string) => (path: string, token: string, body: unknown) =>
  call(path, token, { method, body: JSON.stringify(body) });
const post = send("POST");
const put = send("PUT");
const patch = send("PATCH");
const del = send("DELETE");

test("mobile: everything the web does", async ({}, info) => {
  test.skip(info.project.name !== "desktop", "API behaviour is viewport-independent");
  const email = uniqueEmail("mobile-parity", info.project.name);
  await createConfirmedUser(email, "Grace Hopper");
  const { url, publishableKey } = localSupabase();
  const phone = createClient(url, publishableKey, { auth: { persistSession: false } });
  const { data } = await phone.auth.signInWithPassword({ email, password: PASSWORD });
  const token = data.session!.access_token;

  // Onboard with a Brain Dump.
  const dump = await post("/api/v1/dumps", token, {
    text: "Finish the quarterly report by Friday",
  });
  const items = dump.body.items.map((item: Record<string, unknown>) => ({
    kind: item.kind,
    title: item.title,
    dueAt: (item.deadline as { at: string } | null)?.at ?? null,
    recurrence: item.recurrence,
    estimatedMinutes: 120,
    project: null,
    importance: null,
  }));
  expect(
    (await post(`/api/v1/dumps/${dump.body.dumpId}/commit`, token, { items })).status
  ).toBe(201);
  const report = (await call("/api/v1/tasks?view=all", token)).body.tasks[0];

  // Inbox triage: quick-added items move onto the list, into a project.
  await post("/api/v1/tasks", token, { title: "Buy stamps" });
  await post("/api/v1/tasks", token, { title: "Water plants" });
  const inbox = (await call("/api/v1/tasks?view=inbox", token)).body.tasks;
  expect(inbox).toHaveLength(2);
  const organised = await post("/api/v1/tasks/organise", token, {
    ids: inbox.map((t: { id: string }) => t.id),
    project: "Home",
  });
  expect(organised.body).toEqual({ moved: 2 });
  expect((await call("/api/v1/tasks?view=inbox", token)).body.tasks).toHaveLength(0);
  expect((await post("/api/v1/tasks/organise", token, { ids: [] })).status).toBe(400);

  // Task detail: suggested steps for a large deliverable, then save them.
  const detail = await call(`/api/v1/tasks/${report.id}`, token);
  expect(detail.status).toBe(200);
  expect(detail.body.canBreakDown).toBe(true);
  expect(detail.body.suggestedSteps).toContain("Draft the report");
  expect(detail.body.projects.map((p: { name: string }) => p.name)).toContain("Home");
  const steps = detail.body.suggestedSteps.map((title: string) => ({
    title,
    estimatedMinutes: 30,
  }));
  expect((await post(`/api/v1/tasks/${report.id}/breakdown`, token, { steps })).status).toBe(
    201
  );
  expect((await post(`/api/v1/tasks/${report.id}/breakdown`, token, { steps })).status).toBe(
    409
  );
  const broken = (await call(`/api/v1/tasks/${report.id}`, token)).body;
  expect(broken.steps).toHaveLength(steps.length);
  expect(broken.canBreakDown).toBe(false);
  expect(broken.suggestedSteps).toEqual([]);

  // Edit: rename, estimate, energy and a new goal by name.
  const edited = await patch(`/api/v1/tasks/${report.id}`, token, {
    title: "Finish the Q3 report",
    estimatedMinutes: 90,
    energy: "high",
    goal: "Get promoted",
  });
  expect(edited.status).toBe(200);
  expect(edited.body.task).toMatchObject({
    title: "Finish the Q3 report",
    estimatedMinutes: 90,
  });
  const after = (await call(`/api/v1/tasks/${report.id}`, token)).body.task;
  expect(after).toMatchObject({ energy: "high", goal: { title: "Get promoted" } });
  expect((await patch(`/api/v1/tasks/${report.id}`, token, { title: "" })).status).toBe(400);
  expect((await call(`/api/v1/tasks/${crypto.randomUUID()}`, token)).status).toBe(404);

  // Goals: progress, a nudge when nothing moves a goal, and adding work to it.
  expect((await post("/api/v1/goals", token, { title: "Learn Spanish" })).status).toBe(201);
  let goals = (await call("/api/v1/goals", token)).body.goals;
  const spanish = goals.find((g: { title: string }) => g.title === "Learn Spanish");
  expect(spanish).toMatchObject({ linked: 0, nudge: "unlinked" });
  expect(goals.find((g: { title: string }) => g.title === "Get promoted")).toMatchObject({
    linked: 1,
    active: 1,
    nudge: null,
  });
  const lesson = await post("/api/v1/tasks", token, {
    title: "Book a lesson",
    goalId: spanish.id,
  });
  expect(lesson.body.task.status).toBe("todo");
  goals = (await call("/api/v1/goals", token)).body.goals;
  expect(goals.find((g: { id: string }) => g.id === spanish.id).nudge).toBeNull();
  expect((await post("/api/v1/goals", token, { title: " " })).status).toBe(400);

  // Goal breakdown: suggested steps (built-in rules in e2e), then saved.
  const suggested = await call(`/api/v1/goals/${spanish.id}/steps`, token);
  expect(suggested.body.engine).toBe("rules");
  expect(suggested.body.steps[0].title).toBe("Choose one course or book for Spanish");
  const savedSteps = await post(`/api/v1/goals/${spanish.id}/steps`, token, {
    steps: suggested.body.steps.slice(0, 2),
  });
  expect(savedSteps.body).toEqual({ saved: 2 });
  goals = (await call("/api/v1/goals", token)).body.goals;
  expect(goals.find((g: { id: string }) => g.id === spanish.id).linked).toBe(3);
  expect((await call(`/api/v1/goals/${crypto.randomUUID()}/steps`, token)).status).toBe(404);

  // Today: decisions it asks for, settings, and choosing the next task.
  const today = (await call("/api/v1/today", token)).body;
  expect(today).toHaveProperty("recovery");
  expect(today).toHaveProperty("realityCheck");
  expect(today).toHaveProperty("procrastination");
  expect(
    (
      await put("/api/v1/today/settings", token, {
        dayMinutes: 300,
        availableMinutes: 60,
        energy: "low",
      })
    ).status
  ).toBe(200);
  expect((await call("/api/v1/today", token)).body.settings).toEqual({
    dayMinutes: 300,
    availableMinutes: 60,
    energy: "low",
  });
  expect((await put("/api/v1/today/settings", token, { dayMinutes: 0 })).status).toBe(400);
  expect(
    (await put("/api/v1/today/next", token, { taskId: lesson.body.task.id })).status
  ).toBe(200);
  const chosen = (await call("/api/v1/today", token)).body.recommendation;
  expect(chosen).toMatchObject({ overridden: true, task: { id: lesson.body.task.id } });
  expect((await put("/api/v1/today/next", token, { taskId: null })).status).toBe(200);
  expect((await post("/api/v1/today/recovery", token, { decisions: [] })).status).toBe(400);

  // Waiting On: parked out of the plan until the follow-up, then back.
  const waiting = await patch(`/api/v1/tasks/${lesson.body.task.id}`, token, {
    waitingOn: "Maria (tutor)",
  });
  expect(waiting.body.task.waitingOn).toBe("Maria (tutor)");
  expect(new Date(waiting.body.task.followUpAt).getTime()).toBeGreaterThan(Date.now());
  const waitingList = (await call("/api/v1/tasks?view=waiting", token)).body.tasks;
  expect(waitingList.map((t: { id: string }) => t.id)).toEqual([lesson.body.task.id]);
  let plan = (await call("/api/v1/today", token)).body;
  expect(plan.plan.map((p: { task: { id: string } }) => p.task.id)).not.toContain(
    lesson.body.task.id
  );
  expect(plan.followUps).toEqual([]);
  await patch(`/api/v1/tasks/${lesson.body.task.id}`, token, {
    followUpAt: new Date(Date.now() - 60_000).toISOString(),
  });
  plan = (await call("/api/v1/today", token)).body;
  expect(plan.followUps.map((t: { id: string }) => t.id)).toEqual([lesson.body.task.id]);
  await patch(`/api/v1/tasks/${lesson.body.task.id}`, token, { waitingOn: null });
  expect((await call("/api/v1/tasks?view=waiting", token)).body.tasks).toEqual([]);

  // Reviews and responsibilities.
  const daily = await call("/api/v1/reviews/daily", token);
  expect(daily.status).toBe(200);
  expect(daily.body).toHaveProperty("completed");
  expect(daily.body).toHaveProperty("carried");
  const weekly = await call("/api/v1/reviews/weekly", token);
  expect(weekly.body.goals.map((g: { title: string }) => g.title)).toContain("Learn Spanish");
  expect((await call("/api/v1/responsibilities", token)).body.responsibilities).toEqual([]);

  // Delete a task.
  const stamps = inbox[0];
  expect((await del(`/api/v1/tasks/${stamps.id}`, token, {})).status).toBe(200);
  expect((await call(`/api/v1/tasks/${stamps.id}`, token)).status).toBe(404);

  // Preferences.
  const me = await patch("/api/v1/me", token, { dayMinutes: 360, planMode: "scheduled" });
  expect(me.body).toMatchObject({
    hasPassword: true,
    preferences: { dayMinutes: 360, planMode: "scheduled" },
  });
  expect((await patch("/api/v1/me", token, { timeZone: "Mars/Base" })).status).toBe(400);

  // Account deletion: typed confirmation and the password, then it's gone.
  expect((await del("/api/v1/me", token, { confirmation: "yes" })).status).toBe(400);
  expect((await del("/api/v1/me", token, { confirmation: "DELETE" })).status).toBe(400);
  expect(
    (await del("/api/v1/me", token, { confirmation: "DELETE", password: "wrong-password" }))
      .status
  ).toBe(400);
  expect(
    (await del("/api/v1/me", token, { confirmation: "DELETE", password: PASSWORD })).body
  ).toEqual({ ok: true });
  expect((await call("/api/v1/me", token)).status).toBe(401);
});
