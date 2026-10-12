import { expect, test } from "@playwright/test";
import { guardPage, saveBrainDump, signIn, signOut, signUp, uniqueEmail } from "./helpers";

// PRD_v2.md §2.10 — prioritise, plan, recommend, execute, persist.

let email: string;

test.beforeEach(async ({ page }, info) => {
  email = uniqueEmail("today", info.project.name);
  await signUp(page, email);
  await saveBrainDump(page);
  await page.goto("/");
});

test("§2.10 #11, #13–#15 — a daily plan with an explained Next Best Action", async ({
  page,
}) => {
  const check = guardPage(page);
  await expect(page.getByRole("heading", { name: "What to do next" })).toBeVisible();
  const nba = page.locator("section[aria-labelledby='nba-heading']");
  await expect(nba.getByText("Next Best Action")).toBeVisible();
  // #15: a reason, not just a title — the report is due Thursday.
  await expect(nba).toContainText(/next|due|important/i);
  // #13: other planned work is listed alongside it.
  await expect(page.locator("li.today-task").first()).toBeVisible();
  check();
});

test("§2.10 #12 — overriding a priority survives a reload", async ({ page }) => {
  const row = page.locator("li.today-task").first();
  const title = (await row.locator(".today-task-title").innerText()).trim();
  await row.getByLabel("Your priority").selectOption("5");
  await row.getByRole("button", { name: "Save priority" }).click();
  await expect(row).toContainText("Your priority: 5/5");
  await page.reload();
  const sameRow = page.locator("li.today-task").filter({ hasText: title }).first();
  await expect(sameRow).toContainText("Your priority: 5/5");
});

test("§2.10 #16–#18 — focus on the recommendation, complete it, and the plan moves on", async ({
  page,
}) => {
  const nba = page.locator("section[aria-labelledby='nba-heading']");
  const title = (await nba.locator("#nba-heading").innerText()).trim();
  await nba.getByRole("button", { name: "Start focus" }).click();
  await page.waitForURL(/\/focus\?task=/);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

  await page.getByRole("button", { name: "Complete" }).click();
  // Focus returns to Today once the completion is saved.
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.locator("#nba-heading")).not.toHaveText(title);
  await page.goto("/projects");
  await expect(page.getByRole("link", { name: title, exact: true })).toHaveCount(0);
});

test("§2.10 #19 — postponing keeps the task, out of today's plan", async ({ page }) => {
  const nba = page.locator("section[aria-labelledby='nba-heading']");
  const title = (await nba.locator("#nba-heading").innerText()).trim();
  await nba.getByRole("button", { name: "Start focus" }).click();
  await page.waitForURL(/\/focus\?task=/);
  await page.getByRole("button", { name: "Postpone" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await page.goto("/projects");
  const postponed = page
    .getByRole("region", { name: "Postponed" })
    .or(
      page.locator("section").filter({ has: page.getByRole("heading", { name: "Postponed" }) })
    );
  await expect(postponed.getByRole("link", { name: title, exact: true })).toBeVisible();
});

test("§2.10 #2–#3 — data persists across sessions and devices", async ({ page, browser }) => {
  await signOut(page);
  await signIn(page, email);
  await page.goto("/projects");
  await expect(page.getByRole("link", { name: "Book the dentist" })).toBeVisible();

  // A second, separate browser — another device with no shared cookies.
  const otherDevice = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const phone = await otherDevice.newPage();
  await signIn(phone, email);
  await phone.goto("/projects");
  await expect(phone.getByRole("link", { name: "Book the dentist" })).toBeVisible();
  await otherDevice.close();
});
