import { expect, test } from "@playwright/test";

// Phase 11: catch unintended design-system drift. Screenshot baselines are
// per operating system (font rendering differs), and the committed ones
// were made on macOS, so this runs locally and is skipped in CI. After an
// intended visual change: npx playwright test e2e/visual.spec.ts --update-snapshots
// then review the new images before committing them.

test.skip(!!process.env.CI, "baselines are macOS-specific; run locally");

for (const path of ["/design", "/signin", "/signup", "/privacy"]) {
  test(`no visual drift on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${path.slice(1)}.png`, {
      fullPage: true,
      animations: "disabled",
      maxDiffPixelRatio: 0.01,
    });
  });
}
