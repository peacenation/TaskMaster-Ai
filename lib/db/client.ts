// Not `import "server-only"` here: that package throws unconditionally
// outside Next's own build (it relies on Next aliasing it to a no-op for
// server bundles), which breaks this module being imported directly by
// tsx (the seed script) and Vitest (the DB tests). The client-bundle
// guarantee is Next's own env-var handling plus the CI grep
// (docs/adr/ADR-009-deployment-environments-secrets.md).
import { config } from "dotenv";
import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
import { authSchema } from "./auth-schema";

// Safe to call unconditionally: dotenv never overwrites a variable Next.js
// has already loaded from .env.local itself, and standalone scripts (the
// seed script, drizzle-kit, the DB tests) have no other loader.
config({ path: ".env.local", quiet: true });

export type AppDb = NodePgDatabase<typeof schema>;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set — copy .env.example to .env.local and fill it in.`);
  }
  return value;
}

// Pools are created on first use, not at import: `next build` imports
// server modules to collect page data, and CI builds with no database.
let admin: AppDb | undefined;
let app: AppDb | undefined;
let authDb: NodePgDatabase<typeof authSchema> | undefined;

/** Auth service role can reach only the private authentication schema. */
export function getAuthDb() {
  authDb ??= drizzle(
    new Pool({
      connectionString: requireEnv("DATABASE_URL_AUTH"),
      max: 5,
      connectionTimeoutMillis: 10000,
    }),
    { schema: authSchema }
  );
  return authDb;
}

/**
 * Admin/owner connection — migrations and the seed script only. This role
 * is the local owner or Supabase migration role. Never use it for application queries;
 * see docs/adr/ADR-004-row-level-security.md.
 */
export function getAdminDb(): AppDb {
  admin ??= drizzle(new Pool({ connectionString: requireEnv("DATABASE_URL") }), { schema });
  return admin;
}

/**
 * Application connection — the non-superuser role RLS actually applies
 * to. Every query through it must go through withUserContext() so
 * `app_current_user_id()` resolves before any policy check runs.
 */
export function getAppDb(): AppDb {
  app ??= drizzle(new Pool({ connectionString: requireEnv("DATABASE_URL_APP") }), { schema });
  return app;
}

/**
 * Runs `fn` inside a transaction with `app.current_user_id` set for that
 * transaction only (SET LOCAL semantics — never leaks to the next query on
 * a pooled connection). The only sanctioned way to make an RLS-scoped
 * query; see migrations/0001_row_level_security.sql.
 */
export async function withUserContext<T>(
  userId: string,
  fn: (tx: AppDb) => Promise<T>
): Promise<T> {
  return getAppDb().transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_user_id', ${userId}, true)`);
    return fn(tx as AppDb);
  });
}
