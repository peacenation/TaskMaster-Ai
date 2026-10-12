import { config } from "dotenv";
import { expect, type Page } from "@playwright/test";

export const PASSWORD = "correct horse battery";

/** A unique address per test run and project, so runs never collide. */
export function uniqueEmail(label: string, project: string): string {
  return `${label}-${project}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.local`;
}

export async function signUp(page: Page, email: string, name = "E2E Tester") {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dump");
}

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/signin"));
}

export async function signOut(page: Page) {
  await page.goto("/more");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/signin");
}

/** Fails the test on any uncaught page error or 5xx response. */
export function guardPage(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 500) problems.push(`${r.status()} ${r.url()}`);
  });
  return () => expect(problems, problems.join("\n")).toEqual([]);
}

export const PRD_DUMP =
  "I've got loads going on. I need to finish the quarterly report by Thursday, book the dentist, start sorting the garage, go to the gym three times this week, call Mum, renew my car insurance before the end of the month, and I really need to start working on my side business again.";

/** Brain Dump → organise → save. Completes onboarding, so Today stops redirecting. */
export async function saveBrainDump(page: Page, text = PRD_DUMP) {
  await page.goto("/dump");
  await page.getByLabel("Brain Dump").fill(text);
  await page.getByRole("button", { name: "Organise it" }).click();
  await expect(page.getByRole("heading", { name: "Review before you save" })).toBeVisible();
  await page.getByRole("button", { name: /^Save \d+ items?$/ }).click();
  await expect(page.getByRole("heading", { name: "Saved" })).toBeVisible();
}

/**
 * Owner connection to the throwaway e2e database, for seeding volumes a
 * browser can't create quickly. Mirrors scripts/e2e-server.mjs; localhost
 * only, like every test database.
 */
export function e2eDatabaseUrl(): string {
  config({ path: ".env.local", quiet: true });
  const url = new URL(process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL || "");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("e2e seeding is restricted to a local database.");
  }
  url.pathname = "/taskmaster_e2e";
  return url.toString();
}
