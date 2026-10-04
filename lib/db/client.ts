// Not `import "server-only"` here: that package throws unconditionally
// outside Next's own webpack build (it relies on Next aliasing it to a
// no-op for server bundles), which breaks this module being imported
// directly by tsx (the seed script) and Vitest (the isolation test). No
// Next.js app code imports this yet — once a Phase 5+ Route Handler does,
// add `import "server-only"` at that call site instead, or re-evaluate
// then. The real client-bundle guarantee is Next's own env-var handling
// plus the CI grep (docs/adr/ADR-009-deployment-environments-secrets.md).
import { config } from "dotenv";
import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

// Safe to call unconditionally: dotenv never overwrites a variable Next.js
// has already loaded from .env.local itself, and standalone scripts (the
// seed script, drizzle-kit, the isolation test) have no other loader.
config({ path: ".env.local" });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set — copy .env.example to .env.local and fill it in.`);
  }
  return value;
}

/**
 * Admin/owner connection — migrations and the seed script only. This role
 * is a local superuser (BYPASSRLS). Never use it for application queries;
 * see docs/adr/ADR-004-row-level-security.md.
 */
export const adminDb = drizzle(new Pool({ connectionString: requireEnv("DATABASE_URL") }), {
  schema,
});

/**
 * Application connection — the non-superuser role RLS actually applies
 * to. Every query through this pool must go through withUserContext()
 * below so `app_current_user_id()` resolves to the right row before any
 * policy check runs.
 */
const appPool = new Pool({ connectionString: requireEnv("DATABASE_URL_APP") });
export const appDb = drizzle(appPool, { schema });

export type AppDb = NodePgDatabase<typeof schema>;

/**
 * Runs `fn` inside a transaction with `app.current_user_id` set for that
 * transaction only (SET LOCAL — scoped to the transaction, never leaks to
 * the next query on a pooled connection). This is the only sanctioned way
 * to make an RLS-scoped query; see migrations/0001_row_level_security.sql.
 */
export async function withUserContext<T>(
  userId: string,
  fn: (tx: AppDb) => Promise<T>
): Promise<T> {
  return appDb.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_user_id', ${userId}, true)`);
    return fn(tx as AppDb);
  });
}
