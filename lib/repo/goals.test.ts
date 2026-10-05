import { describe, expect, it } from "vitest";
import { createGoalRepository } from "./postgres-repositories";

describe("goal repository", () => {
  it("lists active goals and creates new ones", async () => {
    const existing = [
      { id: "g-1", title: "Side Business", targetDate: null, status: "active" },
    ];
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: async () => existing,
            limit: async () => existing,
          }),
        }),
      }),
      insert: () => ({
        values: (input: Record<string, unknown>) => ({
          returning: async () => [{ id: "g-2", ...input }],
        }),
      }),
    };

    const repo = createGoalRepository(db as never, "user-1");
    await expect(repo.list()).resolves.toHaveLength(1);
    const created = await repo.create({ title: "Build a home office" });
    expect(created).toMatchObject({ id: expect.any(String) });
  });
});
