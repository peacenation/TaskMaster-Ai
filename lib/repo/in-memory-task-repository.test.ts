import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryTaskRepository } from "./in-memory-task-repository";

// Any future Postgres adapter (Phase 3) must pass this same suite — see
// docs/adr/ADR-005-repository-boundary.md and ADR-008's contract-test note.
describe("InMemoryTaskRepository", () => {
  let repo: InMemoryTaskRepository;

  beforeEach(() => {
    repo = new InMemoryTaskRepository();
  });

  it("creates a task and lists it back", async () => {
    const created = await repo.create({ userId: "u1", text: "Call John" });
    const listed = await repo.list("u1");
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ id: created.id, text: "Call John", status: "pending" });
  });

  it("only lists tasks for the given user", async () => {
    await repo.create({ userId: "u1", text: "Task A" });
    await repo.create({ userId: "u2", text: "Task B" });
    expect(await repo.list("u1")).toHaveLength(1);
    expect(await repo.list("u2")).toHaveLength(1);
  });

  it("preserves creation order via position", async () => {
    await repo.create({ userId: "u1", text: "First" });
    await repo.create({ userId: "u1", text: "Second" });
    const listed = await repo.list("u1");
    expect(listed.map((t) => t.text)).toEqual(["First", "Second"]);
  });

  it("updates a task", async () => {
    const created = await repo.create({ userId: "u1", text: "Original" });
    const updated = await repo.update(created.id, { status: "completed" });
    expect(updated.status).toBe("completed");
    expect(updated.text).toBe("Original");
  });

  it("throws when updating a task that doesn't exist", async () => {
    await expect(repo.update("missing-id", { status: "completed" })).rejects.toThrow();
  });

  it("removes a task", async () => {
    const created = await repo.create({ userId: "u1", text: "Delete me" });
    await repo.remove(created.id);
    expect(await repo.get(created.id)).toBeUndefined();
  });
});
