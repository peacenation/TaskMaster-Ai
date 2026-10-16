import { randomUUID } from "node:crypto";
import type { ErrorReport } from "./report-error";

// Forwards scrubbed error reports (report-error.ts) to Sentry when
// SENTRY_DSN is set — and only those: the error class, route, Postgres
// code and digest. No messages, stacks, request data or task text, so
// nothing a user wrote can reach a vendor. Uses Sentry's envelope endpoint
// directly; an SDK would capture far more than we want to send.

export interface Dsn {
  endpoint: string;
  publicKey: string;
}

/** https://<key>@o123.ingest.sentry.io/456 → envelope endpoint and key. */
export function parseDsn(dsn: string | undefined): Dsn | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, "");
    if (!url.username || !/^\d+$/.test(projectId)) return null;
    return {
      endpoint: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
      publicKey: url.username,
    };
  } catch {
    return null;
  }
}

export function toEnvelope(report: ErrorReport, now = new Date()): string {
  const eventId = randomUUID().replaceAll("-", "");
  const event = {
    event_id: eventId,
    timestamp: now.toISOString(),
    platform: "node",
    level: "error",
    logger: "taskmaster.server",
    environment: process.env.CONTEXT ?? process.env.NODE_ENV ?? "production",
    release: process.env.COMMIT_REF?.slice(0, 12),
    // Groups by error class and route, not by any message content.
    fingerprint: [report.errorName, report.route],
    message: { formatted: `${report.errorName} in ${report.method} ${report.route}` },
    tags: {
      route: report.route,
      route_type: report.routeType,
      method: report.method,
      error_name: report.errorName,
      postgres_code: report.postgresCode ?? "none",
    },
    extra: { path: report.path, digest: report.digest },
  };
  return [
    JSON.stringify({ event_id: eventId, sent_at: now.toISOString() }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");
}

/** Fire and forget, with a short timeout: reporting must never slow a response. */
export async function sendToSentry(report: ErrorReport): Promise<void> {
  const dsn = parseDsn(process.env.SENTRY_DSN);
  if (!dsn) return;
  try {
    await fetch(dsn.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-sentry-envelope",
        "x-sentry-auth": `Sentry sentry_version=7, sentry_key=${dsn.publicKey}, sentry_client=taskmaster/1.0`,
      },
      body: toEnvelope(report),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Monitoring is best-effort; the stdout line is still in the host's logs.
  }
}
