import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { PASSWORD, createConfirmedUser, localSupabase, uniqueEmail } from "./helpers";

// Mobile features over /api/v1: Brain Dump (organise → review → commit),
// project detail, add-to-project, the not-yet-onboarded greeting, and the
// AI Planner (rules mode here: the e2e server runs with AI switched off).

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
const post = (path: string, token: string, body: unknown) =>
  call(path, token, { method: "POST", body: JSON.stringify(body) });

test("mobile: Brain Dump, projects and the AI Planner", async ({}, info) => {
  test.skip(info.project.name !== "desktop", "API behaviour is viewport-independent");
  const email = uniqueEmail("mobile-features", info.project.name);
  await createConfirmedUser(email, "Ada Lovelace");
  const { url, publishableKey } = localSupabase();
  const phone = createClient(url, publishableKey, { auth: { persistSession: false } });
  const { data } = await phone.auth.signInWithPassword({ email, password: PASSWORD });
  const token = data.session!.access_token;

  // Before the first Brain Dump: greeted, not planned.
  const before = await call("/api/v1/today", token);
  expect(before.body).toMatchObject({ onboarded: false, firstName: "Ada" });
  expect(before.body.greeting).toMatch(/^Good (morning|afternoon|evening)$/);
  expect((await post("/api/v1/planner", token, { message: "Plan my day" })).status).toBe(409);

  // Brain Dump: organised by the built-in rules, nothing saved yet.
  expect((await post("/api/v1/dumps", token, { text: "  " })).status).toBe(400);
  const dump = await post("/api/v1/dumps", token, {
    text: "Finish the quarterly report by Friday, book the dentist, call the bank",
  });
  expect(dump.status).toBe(201);
  expect(dump.body.engine).toBe("heuristic");
  expect(dump.body.notice).toMatch(/built-in rules/);
  expect(dump.body.items.length).toBeGreaterThanOrEqual(3);
  expect((await call("/api/v1/tasks?view=all", token)).body.tasks).toHaveLength(0);

  // Review on the phone (rename one, drop one, put one in a project), then commit.
  const items = dump.body.items.map((item: Record<string, unknown>) => ({
    kind: item.kind,
    title: item.title,
    dueAt: (item.deadline as { at: string } | null)?.at ?? null,
    recurrence: item.recurrence,
    estimatedMinutes: item.estimatedMinutes ?? 45,
    project: "Work",
    importance: null,
  }));
  items[0].title = "Finish the Q3 report";
  const reviewed = items.slice(0, 2);
  const committed = await post(`/api/v1/dumps/${dump.body.dumpId}/commit`, token, {
    items: reviewed,
  });
  expect(committed.status).toBe(201);
  expect(committed.body.summary.tasks).toBe(2);
  const all = await call("/api/v1/tasks?view=all", token);
  expect(all.body.tasks.map((t: { title: string }) => t.title)).toContain(
    "Finish the Q3 report"
  );
  expect((await call("/api/v1/today", token)).body.onboarded).toBe(true);
  expect(
    (await post(`/api/v1/dumps/${crypto.randomUUID()}/commit`, token, { items: reviewed }))
      .status
  ).toBe(404);

  // Projects: detail screen data, and adding a task straight into a project.
  const projects = (await call("/api/v1/projects", token)).body.projects;
  const work = projects.find((p: { name: string }) => p.name === "Work");
  expect(work).toBeTruthy();
  const added = await post("/api/v1/tasks", token, {
    title: "Draft slides",
    projectId: work.id,
  });
  expect(added.status).toBe(201);
  expect(added.body.task).toMatchObject({ status: "todo", project: { name: "Work" } });
  const detail = await call(`/api/v1/projects/${work.id}`, token);
  expect(detail.body.project).toMatchObject({ name: "Work", done: 0, total: 3 });
  expect(detail.body.todo.map((t: { title: string }) => t.title)).toContain("Draft slides");
  expect((await call(`/api/v1/projects/${crypto.randomUUID()}`, token)).status).toBe(404);
  expect(
    (await post("/api/v1/tasks", token, { title: "x", projectId: crypto.randomUUID() })).status
  ).toBe(404);

  // AI Planner (rules mode): a timeline of the user's tasks, then apply it.
  const plan = await post("/api/v1/planner", token, {
    message: "Plan my day around my 2pm meeting",
    history: [{ role: "user", text: "Morning focus please" }],
  });
  expect(plan.status).toBe(200);
  expect(plan.body.engine).toBe("rules");
  expect(plan.body.reply).toMatch(/isn't set up/);
  const taskIds = new Set(all.body.tasks.map((t: { id: string }) => t.id));
  expect(plan.body.blocks.length).toBeGreaterThan(0);
  for (const block of plan.body.blocks) expect(taskIds.has(block.taskId)).toBe(true);

  const first = all.body.tasks[0];
  const applied = await post("/api/v1/planner/apply", token, {
    blocks: [{ taskId: first.id, start: "23:00", minutes: 30 }],
  });
  expect(applied.body).toEqual({ ok: true, scheduled: 1 });
  const today = await call("/api/v1/today", token);
  expect(today.body.plan.map((p: { task: { id: string } }) => p.task.id)).toEqual([first.id]);
  expect(
    (
      await post("/api/v1/planner/apply", token, {
        blocks: [{ taskId: crypto.randomUUID(), start: "10:00", minutes: 30 }],
      })
    ).status
  ).toBe(404);
  expect(
    (
      await post("/api/v1/planner/apply", token, {
        blocks: [{ taskId: first.id, start: "9am", minutes: 30 }],
      })
    ).status
  ).toBe(400);
});
