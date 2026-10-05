import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getAdminDb } from "@/lib/db/client";
import { withRepositories } from "@/lib/repo";

const admin = getAdminDb();
let userA: string;
let userB: string;
const hourAgo = () => new Date(Date.now() - 60 * 60 * 1000);
const claim = (userId: string, limit = 2) =>
  withRepositories(userId, (repos) => repos.aiUsage.claim(limit, hourAgo()));

beforeEach(async () => {
  await admin.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  const rows = await admin.execute<{ id: string }>(
    sql`INSERT INTO users (name, email) VALUES ('Quota A', 'quota-a@test.local'), ('Quota B', 'quota-b@test.local') RETURNING id`
  );
  [userA, userB] = rows.rows.map((row) => row.id);
});

describe("AI request quota", () => {
  it("allows requests up to the limit, then refuses", async () => {
    expect(await claim(userA)).toBe(true);
    expect(await claim(userA)).toBe(true);
    expect(await claim(userA)).toBe(false);
  });

  it("counts each user separately", async () => {
    await claim(userA);
    await claim(userA);
    expect(await claim(userB)).toBe(true);
  });

  it("forgets requests older than the window, and prunes them", async () => {
    await admin.execute(
      sql`INSERT INTO ai_requests (user_id, created_at) VALUES (${userA}, now() - interval '2 hours'), (${userA}, now() - interval '90 minutes')`
    );
    expect(await claim(userA)).toBe(true);
    const left = await admin.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM ai_requests WHERE user_id = ${userA}`
    );
    expect(left.rows[0].n).toBe(1);
  });

  it("concurrent requests cannot all slip under the limit", async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => claim(userA, 3)));
    expect(results.filter(Boolean)).toHaveLength(3);
  });
});
