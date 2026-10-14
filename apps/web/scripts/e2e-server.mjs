// The server Playwright tests run against (playwright.config.ts webServer).
// A fresh local database every run, sign-in from the local Supabase stack
// (emails land in its Mailpit, where e2e/helpers.ts reads them), AI
// extraction switched off so no run ever makes a paid call, and a
// production build — what deploys.
import { spawn, spawnSync } from "node:child_process";
import { prepareLocalDatabase, resetLocalDatabase } from "./lib/local-db.mjs";

export const E2E_PORT = 3110;

const env = await prepareLocalDatabase("taskmaster_e2e");
await resetLocalDatabase(env);

Object.assign(env, {
  AI_EXTRACTION: "off",
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
