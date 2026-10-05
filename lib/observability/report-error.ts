// Scrubbed error reports (ADR-010; Phase 11 "error monitoring with content
// scrubbing"). Pure: builds the report; instrumentation.ts decides where it
// goes (console now — captured by the host's log drain — or a vendor later).
//
// What it never includes, by design: error messages, stack traces, request
// bodies, headers, or query strings. Postgres errors put row values in
// their messages ("Key (title)=(Call my therapist about…)"), and request
// data here is people's tasks and Brain Dumps. The error *class*, the
// Postgres code, the route, and Next's digest are enough to find the
// failure in the server logs that hold the full detail.

export interface ErrorReport {
  event: "request.error";
  route: string;
  routeType: string;
  method: string;
  /** Path with any query string removed. */
  path: string;
  errorName: string;
  /** SQLSTATE, e.g. "23505" (unique violation), when the error came from Postgres. */
  postgresCode: string | null;
  /** Next.js's error digest — matches the id shown to the user and in server logs. */
  digest: string | null;
}

function field(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function postgresCode(error: unknown): string | null {
  for (const candidate of [error, field(error, "cause")]) {
    const code = field(candidate, "code");
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
  }
  return null;
}

export function buildErrorReport(
  error: unknown,
  request: { path: string; method: string },
  context: { routePath: string; routeType: string }
): ErrorReport {
  const name = field(error, "name");
  const digest = field(error, "digest");
  return {
    event: "request.error",
    route: context.routePath,
    routeType: context.routeType,
    method: request.method,
    path: request.path.split("?")[0],
    errorName: typeof name === "string" ? name : typeof error,
    postgresCode: postgresCode(error),
    digest: typeof digest === "string" ? digest : null,
  };
}
