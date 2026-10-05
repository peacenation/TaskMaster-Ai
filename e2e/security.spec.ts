import { expect, test } from "@playwright/test";
import { saveBrainDump, signUp, uniqueEmail } from "./helpers";

// Phase 11 security review checks that need a real browser and build.

test("security headers are sent on every page", async ({ request }) => {
  for (const path of ["/signin", "/"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    const headers = response.headers();
    expect(headers["content-security-policy"], path).toContain("frame-ancestors 'none'");
    expect(headers["x-frame-options"], path).toBe("DENY");
    expect(headers["x-content-type-options"], path).toBe("nosniff");
    expect(headers["x-powered-by"], path).toBeUndefined();
  }
});

test("the content security policy blocks nothing the app needs", async ({ page }, info) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy|Refused to/i.test(message.text()))
      violations.push(message.text());
  });
  await signUp(page, uniqueEmail("csp", info.project.name));
  await saveBrainDump(page);
  for (const path of ["/", "/inbox", "/projects", "/focus", "/settings", "/reviews/daily"]) {
    await page.goto(path);
  }
  expect(violations).toEqual([]);
});
