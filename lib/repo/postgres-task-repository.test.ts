// Same behavioural contract as lib/repo/in-memory-task-repository.test.ts
// (ADR-005/ADR-008's "same suite, two adapters" intent), run against the
// real Postgres adapter instead of an array. Not literally shared test
// code with the in-memory suite: a fresh `new InMemoryTaskRepository()`
// gives empty state for free per test, a persistent database doesn't, so
// this file truncates between tests instead. See vitest.config.db.mts —
// this needs a real local Postgres with migrations applied
// (scripts/db-bootstrap.sh), so it runs via `npm run db:test`, never
// `npm run test`.
import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { adminDb } from "@/lib/db/client";
import { createPostgresTaskRepository } from "./postgres-task-repository";

let userId: string;
let otherUserId: string;

beforeEach(async () => {
  await adminDb.execute(sql`TRUNCATE TABLE users, tasks RESTART IDENTITY CASCADE`);
  const rows = await adminDb.execute<{ id: string }>(
    sql`INSERT INTO users (name, email) VALUES ('Contract Test U1', 'contract-u1@test.local'), ('Contract Test U2', 'contract-u2@test.local') RETURNING id`
  );
  userId = rows.rows[0].id;
  otherUserId = rows.rows[1].id;
});

describe("createPostgresTaskRepository", () => {
  it("creates a task and lists it back", async () => {
    const repo = createPostgresTaskRepository(userId);
    const created = await repo.create({ userId, text: "Call John" });
    const listed = await repo.list(userId);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ id: created.id, text: "Call John", status: "pending" });
  });

  it("only lists tasks for the given user", async () => {
    const repo = createPostgresTaskRepository(userId);
    await repo.create({ userId, text: "Task A" });
    await repo.create({ userId: otherUserId, text: "Task B" });
    expect(await repo.list(userId)).toHaveLength(1);
    expect(await repo.list(otherUserId)).toHaveLength(1);
  });

  it("preserves creation order via position", async () => {
    const repo = createPostgresTaskRepository(userId);
    await repo.create({ userId, text: "First" });
    await repo.create({ userId, text: "Second" });
    const listed = await repo.list(userId);
    expect(listed.map((t) => t.text)).toEqual(["First", "Second"]);
  });

  it("updates a task", async () => {
    const repo = createPostgresTaskRepository(userId);
    const created = await repo.create({ userId, text: "Original" });
    const updated = await repo.update(created.id, { status: "completed" });
    expect(updated.status).toBe("completed");
    expect(updated.text).toBe("Original");
  });

  it("throws when updating a task that doesn't exist", async () => {
    const repo = createPostgresTaskRepository(userId);
    await expect(
      repo.update("00000000-0000-0000-0000-000000000000", { status: "completed" })
    ).rejects.toThrow();
  });

  it("removes a task", async () => {
    const repo = createPostgresTaskRepository(userId);
    const created = await repo.create({ userId, text: "Delete me" });
    await repo.remove(created.id);
    expect(await repo.get(created.id)).toBeUndefined();
  });

  it("cannot get another user's task even by a correct id (RLS, not just app logic)", async () => {
    const ownerRepo = createPostgresTaskRepository(userId);
    const created = await ownerRepo.create({ userId, text: "Owned by userId" });
    const otherRepo = createPostgresTaskRepository(otherUserId);
    expect(await otherRepo.get(created.id)).toBeUndefined();
  });
});
