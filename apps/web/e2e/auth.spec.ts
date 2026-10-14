import { expect, test } from "@playwright/test";
import {
  PASSWORD,
  createConfirmedUser,
  emailLink,
  guardPage,
  signIn,
  signOut,
  signUp,
  uniqueEmail,
} from "./helpers";

// PRD_v2.md §2.10 — accounts and persistence.

test("§2.10 #1 — create an account, sign out, sign back in", async ({ page }, info) => {
  const check = guardPage(page);
  const email = uniqueEmail("signup", info.project.name);
  await signUp(page, email);

  // Regression: the route gate once treated every signed-in user as signed
  // out. A new user is sent to the Brain Dump first (PRD §1.7), so the check
  // is "reached the app", not "stayed on /".
  await page.goto("/");
  await expect(page).not.toHaveURL(/\/signin/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await signOut(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/signin$/);

  await signIn(page, email);
  await expect(page).not.toHaveURL(/\/signin/);
  check();
});

test("unauthenticated requests are refused", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/signin$/);
  for (const path of ["/api/extract", "/api/account/export", "/api/account/delete"]) {
    const response = await request.post(path, { data: {}, maxRedirects: 0 });
    expect(response.status(), path).toBe(401);
  }
});

test("a revoked session cookie can't reach data, even past the route gate", async ({
  page,
  context,
}, info) => {
  const email = uniqueEmail("revoked", info.project.name);
  await signUp(page, email);
  const stale = (await context.cookies()).filter((c) => c.name.startsWith("sb-"));
  expect(stale.length).toBeGreaterThan(0);
  await signOut(page);

  // Replay the old cookie: it passes the cheap presence check in proxy.ts
  // (the access token hasn't expired), so the page's own check with the
  // Auth server must reject it.
  await context.addCookies(stale);
  await page.goto("/");
  await expect(page).toHaveURL(/\/signin$/);
});

test("sign-in is refused until the email is confirmed", async ({ page }, info) => {
  const email = uniqueEmail("unconfirmed", info.project.name);
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Not Yet");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("status")).toContainText("confirm your account");

  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".auth-card").getByRole("alert")).toContainText(
    "Confirm your email"
  );
});

test("reset a forgotten password by email", async ({ page }, info) => {
  const email = uniqueEmail("reset", info.project.name);
  await createConfirmedUser(email);
  await page.goto("/reset");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("reset link will arrive");

  await page.goto(await emailLink(email, "recovery"));
  await expect(page).toHaveURL(/\/reset\?step=update$/);
  await page.getByLabel("Password").fill("a brand new password 7");
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page.getByRole("status")).toContainText("Password updated");

  await signOut(page);
  await signIn(page, email, "a brand new password 7");
  await expect(page).not.toHaveURL(/\/signin/);
});

test("sign in with an email link", async ({ page }, info) => {
  const email = uniqueEmail("magic", info.project.name);
  await createConfirmedUser(email);
  await page.goto("/magic");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText("sign-in link will arrive");
  await page.goto(await emailLink(email, "magiclink"));
  await expect(page).not.toHaveURL(/\/signin|\/magic/);
});

test("an email link can't send you to another site", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=bogus&type=email&next=https://evil.example");
  await expect(page).toHaveURL(/\/signin\?error=link_invalid$/);
});
