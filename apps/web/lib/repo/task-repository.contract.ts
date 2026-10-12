import { beforeEach, describe, expect, it } from "vitest";
import type { TaskRepository } from "./task-repository";

// One behavioural contract, run against every TaskRepository adapter
// (ADR-005, ADR-008). `setup` must start from a fresh, empty store.
export interface ContractFixture {
  /**
   * Runs `fn` with two repositories bound to two different users. Writes
   * made in one call must be visible to later calls.
   */
  run<T>(fn: (repo: TaskRepository, other: TaskRepository) => Promise<T>): Promise<T>;
}

export function runTaskRepositoryContract(
  name: string,
  setup: () => Promise<ContractFixture>
) {
  describe(`TaskRepository contract: ${name}`, () => {
    let fixture: ContractFixture;

    beforeEach(async () => {
      fixture = await setup();
    });

    const run = <T>(fn: (repo: TaskRepository, other: TaskRepository) => Promise<T>) =>
      fixture.run(fn);

    it("creates a task with defaults and reads it back", async () => {
      const created = await run((repo) => repo.create({ title: "Call John" }));
      const fetched = await run((repo) => repo.get(created.id));
      expect(fetched).toMatchObject({
        title: "Call John",
        status: "todo",
        source: "manual",
        dueAt: null,
        importance: null,
      });
    });

    it("stores every editable field", async () => {
      const dueAt = new Date("2026-10-08T16:00:00.000Z");
      const created = await run((repo) =>
        repo.create({
          title: "Finish the report",
          description: "Q3 numbers",
          status: "in_progress",
          priority: 4,
          urgency: 2,
          importance: 5,
          dueAt,
          estimatedMinutes: 90,
          energy: "high",
          source: "brain_dump",
        })
      );
      expect(created).toMatchObject({
        description: "Q3 numbers",
        status: "in_progress",
        priority: 4,
        urgency: 2,
        importance: 5,
        dueAt,
        estimatedMinutes: 90,
        energy: "high",
        source: "brain_dump",
      });
    });

    it("lists oldest first, filtered by status", async () => {
      await run(async (repo) => {
        await repo.create({ title: "First" });
        await repo.create({ title: "Second", status: "inbox" });
        await repo.create({ title: "Third" });
      });
      const all = await run((repo) => repo.list());
      expect(all.map((t) => t.title)).toEqual(["First", "Second", "Third"]);
      const inbox = await run((repo) => repo.list({ statuses: ["inbox"] }));
      expect(inbox.map((t) => t.title)).toEqual(["Second"]);
    });

    it("updates fields, including clearing a date", async () => {
      const created = await run((repo) =>
        repo.create({ title: "Original", dueAt: new Date("2026-10-08T16:00:00Z") })
      );
      const updated = await run((repo) =>
        repo.update(created.id, { status: "completed", dueAt: null, title: "Renamed" })
      );
      expect(updated).toMatchObject({ status: "completed", dueAt: null, title: "Renamed" });
    });

    it("throws when updating a task that doesn't exist", async () => {
      await expect(
        run((repo) =>
          repo.update("00000000-0000-4000-8000-000000000999", { status: "completed" })
        )
      ).rejects.toThrow();
    });

    it("removes a task", async () => {
      const created = await run((repo) => repo.create({ title: "Delete me" }));
      await run((repo) => repo.remove(created.id));
      expect(await run((repo) => repo.get(created.id))).toBeUndefined();
    });

    it("isolates users: one user's tasks are invisible and untouchable to another", async () => {
      const mine = await run((repo) => repo.create({ title: "Mine" }));
      await run((_, other) => other.create({ title: "Theirs" }));

      expect((await run((repo) => repo.list())).map((t) => t.title)).toEqual(["Mine"]);
      expect((await run((_, other) => other.list())).map((t) => t.title)).toEqual(["Theirs"]);
      expect(await run((_, other) => other.get(mine.id))).toBeUndefined();
      await expect(
        run((_, other) => other.update(mine.id, { title: "Hijacked" }))
      ).rejects.toThrow();
      await run((_, other) => other.remove(mine.id));
      expect((await run((repo) => repo.get(mine.id)))?.title).toBe("Mine");
    });
  });
}
