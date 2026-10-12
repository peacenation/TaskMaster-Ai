import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Drizzle applies a migration only if its journal `when` is later than the
// last migration a database has recorded. A hand-written migration with a
// wrong or future `when` therefore makes every later migration silently
// skip on databases that ran it — no error, just a missing schema change.
// This happened once (0005 was dated 17:00 later that day, hiding 0006 and
// 0007); these checks make it a failing test instead of a production bug.

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

const dir = join(import.meta.dirname, "..", "migrations");
const journal: { entries: JournalEntry[] } = JSON.parse(
  readFileSync(join(dir, "meta", "_journal.json"), "utf8")
);

describe("migrations journal", () => {
  it("has strictly increasing timestamps, in index order", () => {
    for (let i = 1; i < journal.entries.length; i++) {
      const previous = journal.entries[i - 1];
      const current = journal.entries[i];
      expect(current.idx, `${current.tag} index`).toBe(previous.idx + 1);
      expect(
        current.when,
        `${current.tag} must be dated after ${previous.tag}`
      ).toBeGreaterThan(previous.when);
    }
  });

  it("has no migration dated in the future", () => {
    for (const entry of journal.entries) {
      expect(entry.when, `${entry.tag} is dated in the future`).toBeLessThanOrEqual(
        Date.now()
      );
    }
  });

  it("has a SQL file for every entry", () => {
    for (const entry of journal.entries) {
      expect(existsSync(join(dir, `${entry.tag}.sql`)), `${entry.tag}.sql`).toBe(true);
    }
  });
});
