import { expect, test } from "@playwright/test";
import { guardPage, signIn, signOut, signUp, uniqueEmail } from "./helpers";

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
  const stale = (await context.cookies()).filter((c) => c.name.includes("session"));
  await signOut(page);

  // Replay the old cookie: it passes the cheap presence check in proxy.ts,
  // so the page's own database-backed session check must reject it.
  await context.addCookies(stale);
  await page.goto("/");
  await expect(page).toHaveURL(/\/signin$/);
});
