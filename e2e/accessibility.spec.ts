import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { saveBrainDump, signUp, uniqueEmail } from "./helpers";

// Phase 11 exit criterion: no WCAG 2.1 AA violations in the core flows.
// Runs on both projects (desktop and phone width).

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function expectNoViolations(page: import("@playwright/test").Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  const summary = results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} — ${v.nodes
        .map((n) => n.target.join(" "))
        .slice(0, 3)
        .join(", ")}`
  );
  expect(summary, `${label}\n${summary.join("\n")}`).toEqual([]);
}

test("public pages", async ({ page }) => {
  for (const path of ["/signin", "/signup", "/reset", "/magic"]) {
    await page.goto(path);
    await expectNoViolations(page, path);
  }
});

test("core signed-in flows", async ({ page }, info) => {
  await signUp(page, uniqueEmail("a11y", info.project.name));
  await expectNoViolations(page, "/dump (compose)");

  await page.getByLabel("Brain Dump").fill("Finish the report by Thursday, book the dentist");
  await page.getByRole("button", { name: "Organise it" }).click();
  await page.getByRole("heading", { name: "Review before you save" }).waitFor();
  await expectNoViolations(page, "/dump (review)");

  await saveBrainDump(page);
  for (const path of [
    "/",
    "/inbox",
    "/projects",
    "/goals",
    "/responsibilities",
    "/focus",
    "/settings",
    "/reviews/daily",
    "/reviews/weekly",
    "/tasks/new",
  ]) {
    await page.goto(path);
    await expectNoViolations(page, path);
  }
});
