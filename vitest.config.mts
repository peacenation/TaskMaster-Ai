import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    // Anything needing a real Postgres (lib/db/**, the Postgres repository
    // test, and any *.db.test.ts) has no place in `npm run test`, which CI
    // runs with no database. Run those via `npm run db:test`
    // (vitest.config.db.mts) after scripts/db-bootstrap.sh.
    exclude: [
      "**/node_modules/**",
      "lib/db/**",
      "lib/repo/postgres-task-repository.test.ts",
      "**/*.db.test.ts",
    ],
    coverage: {
      provider: "v8",
      // The threshold guards the domain engine specifically
      // (IMPLEMENTATION_PLAN.md Phase 4 exit criterion: ≥ 85%).
      include: ["lib/domain/**/*.ts"],
      exclude: ["lib/domain/**/*.test.ts", "lib/domain/__fixtures__/**"],
      thresholds: { lines: 85, branches: 85, functions: 85, statements: 85 },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});
