import type { PoolConfig } from "pg";

// Connection settings shared by every pool (app, auth, admin, deploy
// migrations). Locally, TLS settings live in the URL (sslmode=verify-full&
// sslrootcert=/path). A host such as Vercel has no certificate file, so
// there the CA's PEM text goes in DATABASE_CA_CERT instead. node-postgres
// lets TLS parameters in the URL override an explicit `ssl` option, so they
// are removed whenever the PEM is supplied.

const URL_TLS_PARAMS = ["sslmode", "sslrootcert", "sslcert", "sslkey", "sslcompat"];

export function poolConfig(
  connectionString: string,
  env: Record<string, string | undefined> = process.env
): PoolConfig {
  const config: PoolConfig = {
    connectionString,
    // Serverless runs many small instances; keep each one's share of the
    // database's connections small (docs/OPERATIONS.md).
    max: Number(env.DATABASE_POOL_MAX) || 10,
    connectionTimeoutMillis: 10_000,
  };
  const ca = env.DATABASE_CA_CERT?.replaceAll("\\n", "\n").trim();
  if (!ca) return config;

  const url = new URL(connectionString);
  for (const param of URL_TLS_PARAMS) url.searchParams.delete(param);
  // Verifies the chain against this CA and the hostname (verify-full).
  return {
    ...config,
    connectionString: url.toString(),
    ssl: { ca, rejectUnauthorized: true },
  };
}
