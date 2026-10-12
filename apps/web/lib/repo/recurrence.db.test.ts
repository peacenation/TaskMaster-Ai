import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getAdminDb } from "@/lib/db/client";
import { withRepositories } from "@/lib/repo";

const admin = getAdminDb();
let userId: string;

beforeEach(async () => {
  await admin.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  const rows = await admin.execute<{ id: string }>(
    sql`INSERT INTO users (name, email) VALUES ('Recurrence Test', 'recurrence@test.local') RETURNING id`
  );
  userId = rows.rows[0].id;
});

describe("recurring responsibilities", () => {
  it("generates occurrences idempotently and keeps existing history when stopped", async () => {
    const ruleId = await withRepositories(userId, async (repos) => {
      const rule = await repos.recurrenceRules.create({
        title: "Water plants",
        frequency: "daily",
        timesPerPeriod: 1,
        startDate: "2026-10-05",
      });
      expect(await repos.recurrenceRules.generateThrough("2026-10-05", "2026-10-07")).toBe(3);
      expect(await repos.recurrenceRules.generateThrough("2026-10-05", "2026-10-07")).toBe(0);
      await repos.recurrenceRules.stop(rule.id);
      expect(await repos.recurrenceRules.generateThrough("2026-10-05", "2026-10-08")).toBe(0);
      return rule.id;
    });

    const result = await withRepositories(userId, async (repos) => ({
      occurrences: await repos.recurrenceRules.occurrences(ruleId),
      tasks: await repos.tasks.list(),
      rules: await repos.recurrenceRules.list(),
    }));
    expect(result.occurrences.map((item) => item.occurrenceDate)).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
    ]);
    expect(result.tasks).toHaveLength(3);
    expect(result.tasks.every((task) => task.source === "recurrence")).toBe(true);
    expect(result.rules.find((rule) => rule.id === ruleId)?.stoppedAt).toBeInstanceOf(Date);
  });
});
