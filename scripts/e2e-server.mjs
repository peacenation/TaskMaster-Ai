// The server Playwright tests run against (playwright.config.ts webServer).
// A fresh local database every run, test-mode email written to /tmp
// (tests read magic links from there), AI extraction switched off so no
// run ever makes a paid call, and a production build — what deploys.
import { spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { prepareLocalDatabase, resetLocalDatabase } from "./lib/local-db.mjs";

export const E2E_PORT = 3110;
export const E2E_MAIL_DIR = "/tmp/taskmaster-e2e-mail";

const env = await prepareLocalDatabase("taskmaster_e2e");
await resetLocalDatabase(env);
rmSync(E2E_MAIL_DIR, { recursive: true, force: true });

Object.assign(env, {
  BETTER_AUTH_URL: `http://localhost:${E2E_PORT}`,
  AUTH_EMAIL_PROVIDER: "test",
  AUTH_TEST_EMAIL_DIR: E2E_MAIL_DIR,
  AI_EXTRACTION: "off",
  AUTH_RATE_LIMIT: "off",
  NODE_ENV: "production",
});
delete env.ANTHROPIC_API_KEY;
delete env.ANTHROPIC_AUTH_TOKEN;

if (process.env.E2E_SKIP_BUILD !== "1") {
  const build = spawnSync("npm", ["run", "build"], { env, stdio: "inherit" });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const server = spawn("npx", ["next", "start", "-p", String(E2E_PORT)], {
  env,
  stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
server.on("exit", (code) => process.exit(code ?? 0));
