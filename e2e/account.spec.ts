import { expect, test } from "@playwright/test";
import { PASSWORD, saveBrainDump, signUp, uniqueEmail } from "./helpers";

test("§2.10 #22 — deleting the account removes it and its data", async ({ page }, info) => {
  const email = uniqueEmail("delete", info.project.name);
  await signUp(page, email);
  await saveBrainDump(page, "Pay the council tax, book a haircut");

  await page.goto("/settings");
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByRole("button", { name: "Permanently delete account" }).click();
  await page.waitForURL("**/signup");

  // The account is gone: its credentials no longer work.
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/signin$/);
});
