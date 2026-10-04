import { defineConfig } from "vitest/config";
import path from "node:path";

if (
  process.env.TASKMASTER_TEST_DATABASE !== "taskmaster_test" ||
  [process.env.DATABASE_URL, process.env.DATABASE_URL_APP].some(
    (value) => !value || new URL(value).pathname !== "/taskmaster_test"
  )
) {
  throw new Error(
    "Run npm run db:test: destructive fixtures are restricted to taskmaster_test."
  );
}

// Separate from vitest.config.mts on purpose: this one needs a real local
// Postgres with migrations applied (scripts/db-bootstrap.sh), so it must
// never be what `npm run test` (CI) picks up by default.
export default defineConfig({
  test: {
    environment: "node",
    include: [
      "lib/db/isolation.test.ts",
      "lib/repo/postgres-task-repository.test.ts",
      "lib/**/*.db.test.ts",
    ],
    hookTimeout: 20_000,
    // Both files truncate shared tables against the same real database —
    // running them concurrently lets one file's TRUNCATE wipe out
    // another's fixtures mid-run. Sequential only, unlike vitest.config.mts.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});
