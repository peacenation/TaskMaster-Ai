import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { PASSWORD, createConfirmedUser, localSupabase, uniqueEmail } from "./helpers";

// The mobile API (/api/v1) as the Flutter app calls it: no cookie jar,
// authenticated only by the Supabase access token sent as a bearer token.

const BASE = "http://localhost:3110";

async function call(path: string, token?: string, init: RequestInit = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-time-zone": "Europe/London",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const body = response.headers.get("content-type")?.includes("json")
    ? await response.json()
    : null;
  return { status: response.status, body };
}

test("mobile API: Supabase token, profile, quick add, status changes", async ({}, info) => {
  test.skip(info.project.name !== "desktop", "API behaviour is viewport-independent");
  const email = uniqueEmail("api", info.project.name);
  await createConfirmedUser(email, "Ada Mobile");

  const { url, publishableKey } = localSupabase();
  const phone = createClient(url, publishableKey, { auth: { persistSession: false } });
  const { data, error } = await phone.auth.signInWithPassword({ email, password: PASSWORD });
  expect(error).toBeNull();
  const token = data.session!.access_token;

  expect((await call("/api/v1/me")).status).toBe(401);
  expect((await call("/api/v1/me", "not-a-real-token")).status).toBe(401);

  const me = await call("/api/v1/me", token);
  expect(me.status).toBe(200);
  expect(me.body).toMatchObject({ name: "Ada Mobile", email, timeZone: "Europe/London" });

  // New accounts haven't onboarded (Brain Dump) yet.
  expect((await call("/api/v1/today", token)).body).toEqual({ onboarded: false });

  const created = await call("/api/v1/tasks", token, {
    method: "POST",
    body: JSON.stringify({ title: "Call the plumber" }),
  });
  expect(created.status).toBe(201);
  const id = created.body.task.id as string;

  const inbox = await call("/api/v1/tasks?view=inbox", token);
  expect(inbox.body.tasks.map((t: { title: string }) => t.title)).toContain(
    "Call the plumber"
  );

  const moved = await call(`/api/v1/tasks/${id}/status`, token, {
    method: "POST",
    body: JSON.stringify({ status: "todo" }),
  });
  expect(moved.status).toBe(200);
  const all = await call("/api/v1/tasks?view=all", token);
  expect(all.body.tasks.map((t: { id: string }) => t.id)).toContain(id);

  expect(
    (
      await call(`/api/v1/tasks/${crypto.randomUUID()}/status`, token, {
        method: "POST",
        body: JSON.stringify({ status: "completed" }),
      })
    ).status
  ).toBe(404);
  expect(
    (
      await call(`/api/v1/tasks/${id}/status`, token, {
        method: "POST",
        body: JSON.stringify({ status: "bogus" }),
      })
    ).status
  ).toBe(400);
  expect((await call("/api/v1/tasks?view=nope", token)).status).toBe(400);

  // Signing out revokes the session at once, though the token hasn't expired.
  await phone.auth.signOut();
  expect((await call("/api/v1/me", token)).status).toBe(401);
});
