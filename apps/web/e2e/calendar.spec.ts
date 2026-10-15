import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { PASSWORD, createConfirmedUser, localSupabase, uniqueEmail } from "./helpers";

// Calendar integration: connect a feed by its iCal address, and Today plans
// around the meeting in it — on the API (mobile) and the web schedule.

const BASE = "http://localhost:3110";

/**
 * A fixed-offset zone where it's about midday right now, so "a meeting in
 * two hours" is always later today whenever the suite runs. (Etc/GMT-N is
 * UTC+N — the sign is inverted by convention.)
 */
const offset = 12 - new Date().getUTCHours();
const ZONE = offset === 0 ? "Etc/GMT" : `Etc/GMT${offset > 0 ? "-" : "+"}${Math.abs(offset)}`;

const stamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

/** A calendar with one meeting starting in two hours. */
function feed(now: Date) {
  const start = new Date(Math.ceil(now.getTime() / 900_000) * 900_000 + 2 * 3_600_000);
  const end = new Date(start.getTime() + 3_600_000);
  return {
    start,
    end,
    ics: [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//TaskMasterAi e2e//EN",
      "BEGIN:VEVENT",
      "UID:e2e-meeting",
      "SUMMARY:Design review",
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n"),
  };
}

let server: Server;
let feedUrl: string;
let meeting: { start: Date; end: Date };

test.beforeAll(async () => {
  const calendar = feed(new Date());
  meeting = calendar;
  server = createServer((req, res) => {
    if (req.url === "/private/basic.ics") {
      res.writeHead(200, { "content-type": "text/calendar" });
      res.end(calendar.ics);
    } else {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  feedUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/private/basic.ics`;
});

test.afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

async function call(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-time-zone": ZONE,
      authorization: `Bearer ${token}`,
    },
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

test("calendar: connect a feed and Today plans around the meeting", async ({}, info) => {
  test.skip(info.project.name !== "desktop", "API behaviour is viewport-independent");
  const email = uniqueEmail("calendar", info.project.name);
  await createConfirmedUser(email, "Ada Lovelace");
  const { url, publishableKey } = localSupabase();
  const phone = createClient(url, publishableKey, { auth: { persistSession: false } });
  const { data } = await phone.auth.signInWithPassword({ email, password: PASSWORD });
  const token = data.session!.access_token;

  const dump = await call("/api/v1/dumps", token, {
    method: "POST",
    body: JSON.stringify({ text: "Write the launch plan, prepare slides, email the team" }),
  });
  const items = dump.body.items.map((item: Record<string, unknown>) => ({
    kind: item.kind,
    title: item.title,
    dueAt: null,
    recurrence: null,
    estimatedMinutes: 60,
    project: null,
    importance: null,
  }));
  await call(`/api/v1/dumps/${dump.body.dumpId}/commit`, token, {
    method: "POST",
    body: JSON.stringify({ items }),
  });

  // Wrong addresses fail clearly; nothing is saved.
  const bad = await call("/api/v1/calendars", token, {
    method: "POST",
    body: JSON.stringify({ url: "http://example.com/cal.ics" }),
  });
  expect(bad.status).toBe(422);
  expect(bad.body.error).toMatch(/https:\/\/ or webcal/);
  const missing = await call("/api/v1/calendars", token, {
    method: "POST",
    body: JSON.stringify({ url: feedUrl.replace("basic.ics", "nope.ics") }),
  });
  expect(missing.status).toBe(422);
  expect(missing.body.error).toMatch(/secret\) iCal address/);

  const connected = await call("/api/v1/calendars", token, {
    method: "POST",
    body: JSON.stringify({ url: feedUrl, label: "Work" }),
  });
  expect(connected.status).toBe(201);
  expect(connected.body.events).toBe(1);
  const listed = await call("/api/v1/calendars", token);
  expect(listed.body.calendars).toEqual([
    expect.objectContaining({ label: "Work", error: null }),
  ]);
  expect(JSON.stringify(listed.body)).not.toContain("private/basic.ics");

  // Rebuild today's plan so it accounts for the meeting.
  expect(
    (
      await call("/api/v1/today/settings", token, {
        method: "PUT",
        body: JSON.stringify({ dayMinutes: 480 }),
      })
    ).status
  ).toBe(200);
  const today = (await call("/api/v1/today", token)).body;
  expect(today.events).toEqual([
    expect.objectContaining({ title: "Design review", allDay: false }),
  ]);
  expect(today.meetingMinutes).toBe(60);
  expect(today.capacity.availableMinutes).toBe(420);
  for (const item of today.plan) {
    const start = new Date(item.scheduledStart).getTime();
    const end = new Date(item.scheduledEnd).getTime();
    expect(end <= meeting.start.getTime() || start >= meeting.end.getTime()).toBe(true);
  }

  // Disconnecting removes its events.
  const id = listed.body.calendars[0].id;
  expect((await call(`/api/v1/calendars/${id}`, token, { method: "DELETE" })).status).toBe(
    200
  );
  expect((await call("/api/v1/today", token)).body.events).toEqual([]);
});
