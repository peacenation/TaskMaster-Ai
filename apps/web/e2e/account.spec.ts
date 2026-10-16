import { expect, test } from "@playwright/test";
import { PASSWORD, saveBrainDump, signUp, uniqueEmail } from "./helpers";

test("§2.10 #22 — deleting the account removes it and its data", async ({ page }, info) => {
  const email = uniqueEmail("delete", info.project.name);
  await signUp(page, email);
  await saveBrainDump(page, "Pay the council tax, book a haircut");

  await page.goto("/settings/data");
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByRole("button", { name: "Permanently delete account" }).click();
  await page.waitForURL("**/signup");

  // The account is gone: its credentials no longer work.
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  // Scoped to the form: Next.js's route announcer is also role="alert".
  await expect(page.locator(".auth-card").getByRole("alert")).toContainText(
    "don't match an account"
  );
  await expect(page).toHaveURL(/\/signin$/);
});

test("Settings saves planning preferences, and Cancel puts them back", async ({
  page,
}, info) => {
  await signUp(page, uniqueEmail("prefs", info.project.name));
  await page.goto("/settings");
  await page.getByLabel("Hours").fill("3");
  await page.getByLabel("Minutes").fill("30");
  await expect(
    page.getByText("Your default planning capacity is 3 hours 30 minutes per day.")
  ).toBeVisible();
  await page.getByLabel("Scheduled").check();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Preferences saved." })
  ).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Hours")).toHaveValue("3");
  await expect(page.getByLabel("Minutes")).toHaveValue("30");
  await expect(page.getByLabel("Scheduled")).toBeChecked();

  await page.getByLabel("Hours").fill("6");
  await page.getByLabel("Flexible").check();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByLabel("Hours")).toHaveValue("3");
  await expect(page.getByLabel("Scheduled")).toBeChecked();

  // The notifications page saves only its own field.
  await page.goto("/settings/notifications");
  await page.getByRole("combobox", { name: "Notifications" }).selectOption("important");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Preferences saved." })
  ).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByLabel("Hours")).toHaveValue("3");
  await expect(page.getByRole("combobox", { name: "Notifications" })).toHaveValue("important");
});
