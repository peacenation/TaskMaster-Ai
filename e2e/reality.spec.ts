import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { e2eDatabaseUrl, saveBrainDump, signUp, uniqueEmail } from "./helpers";

// Phase 10 exit criteria: an overloaded day triggers Reality Check with a
// specific arithmetic statement, and no reduction is ever applied without
// the user's confirmation (PRD v2 §3.1, §7.4, §7.5 item 6).

test("Reality Check states the overload and changes nothing until confirmed", async ({
  page,
}, info) => {
  const email = uniqueEmail("reality", info.project.name);
  await signUp(page, email);
  await saveBrainDump(page);

  const pool = new Pool({ connectionString: e2eDatabaseUrl() });
  const statuses = async () =>
    (
      await pool.query<{ title: string; status: string }>(
        `SELECT t.title, t.status FROM tasks t JOIN users u ON u.id = t.user_id
         WHERE u.email = $1 AND t.title LIKE 'Overload %' ORDER BY t.title`,
        [email]
      )
    ).rows;
  try {
    await pool.query(
      `INSERT INTO tasks (user_id, title, status, due_date, estimated_minutes, source)
       SELECT u.id, 'Overload ' || n, 'todo', now() + interval '4 hours', 150, 'manual'
       FROM users u, generate_series(1, 2) AS n WHERE u.email = $1`,
      [email]
    );

    await page.goto("/");
    const check = page.locator("section.reality-check");
    await expect(
      check.getByRole("heading", { name: "Something needs to move" })
    ).toBeVisible();
    // Default day: 240 minutes, 20% held back as buffer → 192 usable.
    await expect(check).toContainText(/about \d+ minutes of deadline-critical work/);
    await expect(check).toContainText("roughly 192 usable minutes");

    // Seeing it, and reloading, applies nothing.
    await page.reload();
    expect(await statuses()).toEqual([
      { title: "Overload 1", status: "todo" },
      { title: "Overload 2", status: "todo" },
    ]);

    // Only an explicit confirmation changes one task — and only that one.
    await check
      .locator("li", { hasText: "Overload 1" })
      .getByRole("button", { name: "Confirm postpone" })
      .click();
    await expect(check.locator("li", { hasText: "Overload 1" })).toHaveCount(0);
    expect(await statuses()).toEqual([
      { title: "Overload 1", status: "postponed" },
      { title: "Overload 2", status: "todo" },
    ]);
  } finally {
    await pool.end();
  }
});
