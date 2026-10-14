import { execFileSync } from "node:child_process";
import { config } from "dotenv";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

export const PASSWORD = "correct horse battery";

/** A unique address per test run and project, so runs never collide. */
export function uniqueEmail(label: string, project: string): string {
  return `${label}-${project}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.local`;
}

/** URL and keys of the local Supabase stack (the same one the e2e server uses). */
export function localSupabase() {
  const out = execFileSync("supabase", ["status", "-o", "json", "--workdir", "../.."], {
    encoding: "utf8",
  });
  const status = JSON.parse(out.slice(out.indexOf("{")));
  return {
    url: status.API_URL as string,
    publishableKey: status.PUBLISHABLE_KEY as string,
    secretKey: status.SECRET_KEY as string,
  };
}

/** A confirmed account created directly through the Auth admin API. */
export async function createConfirmedUser(email: string, name = "E2E Tester") {
  const { url, secretKey } = localSupabase();
  const admin = createClient(url, secretKey, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error) throw error;
  return data.user!;
}

/** Local Supabase's mail catcher (supabase/config.toml [local_smtp]). */
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

/**
 * The newest auth email sent to `email` (confirm, magic link, reset), as the
 * link the person would click. Polls briefly: the Auth service sends async.
 */
export async function emailLink(email: string, type?: string): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const search = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`
    );
    const { messages = [] } = (await search.json()) as { messages?: { ID: string }[] };
    for (const { ID } of messages) {
      const message = (await (await fetch(`${MAILPIT}/api/v1/message/${ID}`)).json()) as {
        HTML: string;
      };
      const href = message.HTML.match(/href="([^"]*token_hash[^"]*)"/)?.[1];
      const link = href?.replaceAll("&amp;", "&");
      if (link && (!type || new URL(link).searchParams.get("type") === type)) return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No ${type ?? "auth"} email arrived for ${email}`);
}

/** Sign up through the form, then confirm the email as a person would. */
export async function signUp(page: Page, email: string, name = "E2E Tester") {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("status")).toContainText("confirm your account");
  await page.goto(await emailLink(email, "email"));
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
