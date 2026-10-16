import { describe, expect, it } from "vitest";
import { buildErrorReport } from "./report-error";
import { parseDsn, toEnvelope } from "./sentry";

describe("Sentry forwarding", () => {
  it("reads a DSN, and ignores missing or malformed ones", () => {
    expect(parseDsn("https://abc123@o42.ingest.de.sentry.io/4507")).toEqual({
      endpoint: "https://o42.ingest.de.sentry.io/api/4507/envelope/",
      publicKey: "abc123",
    });
    expect(parseDsn(undefined)).toBeNull();
    expect(parseDsn("not a url")).toBeNull();
    expect(parseDsn("https://o42.ingest.sentry.io/4507")).toBeNull();
  });

  it("sends only the scrubbed report, never the error message or request", () => {
    const error = Object.assign(
      new Error("duplicate key: Key (title)=(Call my therapist about the divorce)"),
      { name: "DatabaseError", code: "23505" }
    );
    const report = buildErrorReport(
      error,
      { path: "/api/v1/tasks?q=secret", method: "POST" },
      { routePath: "/api/v1/tasks", routeType: "route" }
    );
    const envelope = toEnvelope(report);
    const [header, item, event] = envelope.split("\n").map((line) => JSON.parse(line));
    expect(item).toEqual({ type: "event" });
    expect(header.event_id).toBe(event.event_id);
    expect(event.tags).toMatchObject({ route: "/api/v1/tasks", postgres_code: "23505" });
    expect(event.message.formatted).toBe("DatabaseError in POST /api/v1/tasks");
    expect(envelope).not.toMatch(/therapist|divorce|secret/);
  });
});
