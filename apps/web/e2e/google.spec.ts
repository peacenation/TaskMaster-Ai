import { expect, test } from "@playwright/test";
import { signUp, uniqueEmail } from "./helpers";

// Google sign-in without a real Google account: local Supabase Auth has
// placeholder Google credentials (supabase/.env.example), and the hop to
// Google is intercepted, so these check what TaskMasterAi controls — the
// button, the OAuth request that results, and how failures are explained.

test("Continue with Google goes to Google through Supabase Auth", async ({ page }) => {
  // Supabase Auth redirects to Google server-side, which page.route can't
  // intercept; the redirect still raises a request event we can inspect.
  // Anything that does load from Google is stubbed out.
  await page.route("https://accounts.google.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<p>Google</p>" })
  );
  const toGoogle = page.waitForRequest((request) =>
    request.url().startsWith("https://accounts.google.com/o/oauth2")
  );
  await page.goto("/signin");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  const params = new URL((await toGoogle).url()).searchParams;
  expect(params.get("client_id")).toBe("local-google-client.apps.googleusercontent.com");
  // Google returns to Supabase Auth, which then returns to our /auth/callback.
  expect(params.get("redirect_uri")).toBe("http://127.0.0.1:54321/auth/v1/callback");
  expect(params.get("scope")).toContain("email");
  expect(params.get("state")).toBeTruthy();
  expect(params.get("prompt")).toBe("select_account");
});

test("sign-up offers Google too", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByText("or sign up with email")).toBeVisible();
});

test("a failed return from Google or an email link is explained", async ({ page }) => {
  await page.goto("/signin?error=access_denied");
  await expect(page.locator(".auth-card").getByRole("alert")).toContainText("cancelled");
  await page.goto("/signin?error=link_invalid");
  await expect(page.locator(".auth-card").getByRole("alert")).toContainText("expired");
});

test("Settings shows sign-in methods and Connect Google", async ({ page }, info) => {
  await signUp(page, uniqueEmail("google", info.project.name));
  await page.goto("/settings/security");
  const methods = page.locator("section", {
    has: page.getByRole("heading", { name: "Sign-in methods" }),
  });
  await expect(methods).toContainText("Password");
  await expect(methods).toContainText("Not connected");
  await expect(methods.getByRole("button", { name: "Connect Google" })).toBeVisible();
  // A password account still deletes with its password, not a Google step.
  await page.goto("/settings/data");
  await expect(page.getByLabel("Current password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm with Google" })).toHaveCount(0);
});
