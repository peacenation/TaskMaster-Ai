import { expect, test, type Page } from "@playwright/test";
import { saveBrainDump, signUp, uniqueEmail } from "./helpers";

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
