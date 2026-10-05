import { describe, expect, it } from "vitest";
import { poolConfig } from "./pool-config";

const PEM = "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----";
const URL_WITH_TLS =
  "postgresql://u:p@db.example.com:5432/postgres?sslmode=verify-full&sslrootcert=%2Ftmp%2Fca.pem&application_name=tm";

describe("poolConfig", () => {
  it("leaves the URL's own TLS settings alone when no CA is supplied", () => {
    expect(poolConfig(URL_WITH_TLS, {})).toEqual({
      connectionString: URL_WITH_TLS,
      max: 10,
      connectionTimeoutMillis: 10_000,
    });
  });

  it("verifies against DATABASE_CA_CERT and drops URL TLS params that would override it", () => {
    const config = poolConfig(URL_WITH_TLS, { DATABASE_CA_CERT: PEM });
    expect(config.ssl).toEqual({ ca: PEM, rejectUnauthorized: true });
    const url = new URL(config.connectionString!);
    expect(url.searchParams.has("sslmode")).toBe(false);
    expect(url.searchParams.has("sslrootcert")).toBe(false);
    expect(url.searchParams.get("application_name")).toBe("tm");
    expect(url.password).toBe("p");
  });

  it("accepts a PEM pasted with literal \\n escapes, as single-line secret stores need", () => {
    const config = poolConfig(URL_WITH_TLS, { DATABASE_CA_CERT: PEM.replaceAll("\n", "\\n") });
    expect(config.ssl).toMatchObject({ ca: PEM });
  });

  it("takes the pool size from DATABASE_POOL_MAX", () => {
    expect(poolConfig(URL_WITH_TLS, { DATABASE_POOL_MAX: "2" }).max).toBe(2);
    expect(poolConfig(URL_WITH_TLS, { DATABASE_POOL_MAX: "nonsense" }).max).toBe(10);
  });
});
