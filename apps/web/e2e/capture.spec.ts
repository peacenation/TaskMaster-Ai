import { expect, test } from "@playwright/test";
import { guardPage, PRD_DUMP, signUp, uniqueEmail } from "./helpers";

// PRD_v2.md §2.10 — capture and organisation.

test.beforeEach(async ({ page }, info) => {
  await signUp(page, uniqueEmail("capture", info.project.name));
});

test("§2.10 #4–#7 — multi-item Brain Dump becomes separate, editable items with corrected dates", async ({
  page,
}) => {
  const check = guardPage(page);
  await page.getByLabel("Brain Dump").fill(PRD_DUMP);
  await page.getByRole("button", { name: "Organise it" }).click();

  // #5: separate proposed items, not one blob.
  const titles = page.getByLabel(/^Title for /);
  await expect(titles).toHaveCount(7);

  // #7: the vague date is flagged as a suggestion; the user corrects it.
  await expect(page.getByText("Suggested", { exact: true })).toBeVisible();
  const insuranceRow = page.locator(".review-row").filter({
    has: page.getByLabel("Title for Renew my car insurance"),
  });
  await insuranceRow.locator('input[type="datetime-local"]').fill("2026-10-20T09:00");

  // #6: edit and remove before saving.
  await page.getByLabel("Title for Book the dentist").fill("Book the dentist for a check-up");
  await page.getByRole("button", { name: "Remove Call Mum" }).click();
  await page.getByRole("button", { name: "Save 6 items" }).click();
  await expect(page.getByRole("heading", { name: "Saved" })).toBeVisible();

  await page.goto("/projects");
  await expect(
    page.getByRole("link", { name: "Book the dentist for a check-up" })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Call Mum" })).toHaveCount(0);
  const insurance = page.locator("li").filter({ hasText: "Renew my car insurance" });
  await expect(insurance).toContainText("20 Oct");
  check();
});

test("§2.10 #8 — related tasks are grouped into projects", async ({ page }) => {
  await page.getByLabel("Brain Dump").fill(PRD_DUMP);
  await page.getByRole("button", { name: "Organise it" }).click();
  await page.getByRole("button", { name: /^Save \d+ items$/ }).click();
  await expect(page.getByRole("heading", { name: "Saved" })).toBeVisible();

  await page.goto("/projects");
  const admin = page.getByRole("region", { name: "Personal admin" });
  await expect(admin.getByRole("link", { name: "Book the dentist" })).toBeVisible();
  await expect(admin.getByRole("link", { name: "Renew my car insurance" })).toBeVisible();
});

test("§2.10 #9 — Quick Add reads the date and lands in the Inbox", async ({ page }) => {
  await page.goto("/inbox");
  await page.getByRole("textbox", { name: "Quick Add" }).fill("Call John tomorrow at 2pm");
  await expect(page.getByText(/Adds\s+Call John/)).toBeVisible();
  // "tomorrow at 2pm" — shown in the browser's own locale (2:00 PM or 14:00).
  await expect(page.locator(".quick-add-reading")).toContainText(/2:00\s?PM|14:00/);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("link", { name: "Call John" })).toBeVisible();
});

test("§2.10 #10 — create and edit a task manually", async ({ page }) => {
  await page.goto("/tasks/new");
  await page.getByLabel("Title").fill("Renew passport");
  await page.getByLabel("Estimate (minutes)").fill("45");
  await page.getByRole("button", { name: "Create task" }).click();
  await page.waitForURL("**/projects");
  await page.getByRole("link", { name: "Renew passport" }).click();
  await page.getByLabel("Title").fill("Renew passport online");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForURL("**/projects");
  await page.reload();
  await expect(page.getByRole("link", { name: "Renew passport online" })).toBeVisible();
});

test("§2.10 #20 — a failed organise request never loses the Brain Dump", async ({ page }) => {
  await page.route("**/api/extract", (route) => route.abort("internetdisconnected"));
  await page.getByLabel("Brain Dump").fill("Call the bank, pay the plumber");
  await page.getByRole("button", { name: "Organise it" }).click();

  // The heuristic still produced reviewable items, and says what happened.
  await expect(page.getByText(/organised on your device/)).toBeVisible();
  await expect(page.getByLabel(/^Title for /)).toHaveCount(2);

  // Leave without saving: the raw text was stored first, so it's resumable.
  await page.unroute("**/api/extract");
  await page.goto("/inbox");
  await expect(page.getByText("Call the bank, pay the plumber")).toBeVisible();
});
