// DB tests against a separate local database, never the dev or cloud one.
import { spawnSync } from "node:child_process";
import { prepareLocalDatabase } from "./lib/local-db.mjs";

const env = await prepareLocalDatabase("taskmaster_test");
env.BETTER_AUTH_URL = "http://localhost:3108";
const result = spawnSync(
  "npm",
  ["exec", "--", "vitest", "run", "--config", "vitest.config.db.mts"],
  {
    env,
    stdio: "inherit",
  }
);
process.exit(result.status ?? 1);
