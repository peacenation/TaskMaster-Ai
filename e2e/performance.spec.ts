import { expect, test, type Page } from "@playwright/test";
import { Pool } from "pg";
import { e2eDatabaseUrl, saveBrainDump, signUp, uniqueEmail } from "./helpers";

// Phase 11: interaction latency within budget on a throttled connection.
// Budgets set from measured runs with headroom (docs/HARDENING.md); a
// regression past them fails CI. Chromium-only (uses the DevTools protocol).

const SLOW_CONNECTION = {
  offline: false,
  latency: 150, // ms round trip
  downloadThroughput: (1.6 * 1024 * 1024) / 8, // 1.6 Mbps
  uploadThroughput: (750 * 1024) / 8, // 750 Kbps
};

export const BUDGET_MS = {
  todayColdLoadThrottled: 4000,
  todayLoadThrottled: 4000,
  organiseThrottled: 2500,
  completeThrottled: 2500,
  todayLoad600Tasks: 4000,
};

async function throttle(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", SLOW_CONNECTION);
  return cdp;
}

async function timed(action: () => Promise<unknown>): Promise<number> {
  const start = Date.now();
  await action();
  return Date.now() - start;
}

test("core interactions stay within budget on a slow connection", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "measured once, on desktop");
  await signUp(page, uniqueEmail("perf", info.project.name));
  await saveBrainDump(page);
  const cdp = await throttle(page);

  // A first visit: nothing cached, every script downloaded on the slow link.
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  const todayColdLoad = await timed(async () => {
    await page.goto("/", { waitUntil: "load" });
    await page.locator("#nba-heading").waitFor();
  });
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: false });

  const todayLoad = await timed(async () => {
    await page.goto("/", { waitUntil: "load" });
    await page.locator("#nba-heading").waitFor();
  });

  await page.goto("/dump");
  await page.getByLabel("Brain Dump").fill("Call the bank, pay the plumber, book a haircut");
  const organise = await timed(async () => {
    await page.getByRole("button", { name: "Organise it" }).click();
    await page.getByRole("heading", { name: "Review before you save" }).waitFor();
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Start focus" }).click();
  await page.waitForURL(/\/focus\?task=/);
  const complete = await timed(async () => {
    await page.getByRole("button", { name: "Complete" }).click();
    await page.waitForURL((url) => url.pathname === "/");
  });

  const measured = {
    todayColdLoadThrottled: todayColdLoad,
    todayLoadThrottled: todayLoad,
    organiseThrottled: organise,
    completeThrottled: complete,
  };
  await info.attach("timings.json", {
    body: JSON.stringify(measured, null, 2),
    contentType: "application/json",
  });
  console.log("PERF", JSON.stringify(measured));
  for (const [key, value] of Object.entries(measured)) {
    expect(
      value,
      `${key}: ${value}ms > ${BUDGET_MS[key as keyof typeof BUDGET_MS]}ms`
    ).toBeLessThanOrEqual(BUDGET_MS[key as keyof typeof BUDGET_MS]);
  }
});

test("a user with 600 open tasks still gets a usable Today", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "measured once, on desktop");
  const email = uniqueEmail("load", info.project.name);
  await signUp(page, email);
  await saveBrainDump(page);

  const pool = new Pool({ connectionString: e2eDatabaseUrl() });
  try {
    // Varied deadlines, estimates and priorities, so ranking does real work.
    await pool.query(
      `INSERT INTO tasks (user_id, title, status, due_date, estimated_minutes, priority, source)
       SELECT u.id, 'Load task ' || n, 'todo',
              CASE WHEN n % 3 = 0 THEN now() + (n % 40) * interval '6 hours' END,
              15 + (n % 8) * 15, 1 + n % 5, 'manual'
       FROM users u, generate_series(1, 600) AS n
       WHERE u.email = $1`,
      [email]
    );
  } finally {
    await pool.end();
  }

  await throttle(page);
  const todayLoad600Tasks = await timed(async () => {
    await page.goto("/", { waitUntil: "load" });
    await page.locator("#nba-heading").waitFor();
  });
  console.log("PERF", JSON.stringify({ todayLoad600Tasks }));
  expect(todayLoad600Tasks).toBeLessThan(BUDGET_MS.todayLoad600Tasks);

  // The backlog is summarised, not dumped onto the page.
  await expect(page.getByText(/And \d+ more that can wait/)).toBeVisible();
  const waiting = await page.locator('[aria-labelledby="wait-heading"] > ul > li').count();
  console.log("PERF", JSON.stringify({ deferredRowsShown: waiting }));
  // About 25 seeded tasks are due within 24 hours (always shown) + 10 others.
  expect(waiting).toBeLessThanOrEqual(40);

  // Usable, not just loaded: the recommendation can be acted on.
  const before = await page.locator("#nba-heading").textContent();
  await page.getByRole("button", { name: "Complete" }).first().click();
  await expect(page.locator("#nba-heading")).not.toHaveText(before ?? "");
});
