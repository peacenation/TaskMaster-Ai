import { describe, expect, it } from "vitest";
import { buildErrorReport } from "./report-error";

const request = { path: "/tasks/abc?secret=1", method: "POST" };
const context = { routePath: "/tasks/[id]", routeType: "action" };

describe("buildErrorReport", () => {
  it("keeps what's needed to find the failure", () => {
    const error = Object.assign(new TypeError("boom"), { digest: "123456789" });
    expect(buildErrorReport(error, request, context)).toEqual({
      event: "request.error",
      route: "/tasks/[id]",
      routeType: "action",
      method: "POST",
      path: "/tasks/abc",
      errorName: "TypeError",
      postgresCode: null,
      digest: "123456789",
    });
  });

  it("never includes the message, the stack, or the query string", () => {
    const content = "Key (title)=(Call my therapist about the divorce) already exists";
    const error = Object.assign(new Error(content), { code: "23505" });
    const serialized = JSON.stringify(buildErrorReport(error, request, context));
    expect(serialized).not.toContain("therapist");
    expect(serialized).not.toContain("at ");
    expect(serialized).not.toContain("secret=1");
  });

  it("reads the Postgres code from the error or its cause", () => {
    expect(buildErrorReport({ code: "23505" }, request, context).postgresCode).toBe("23505");
    const wrapped = Object.assign(new Error("Failed query"), { cause: { code: "42P01" } });
    expect(buildErrorReport(wrapped, request, context).postgresCode).toBe("42P01");
    expect(buildErrorReport({ code: "ECONNRESET" }, request, context).postgresCode).toBeNull();
  });

  it("handles thrown non-errors", () => {
    expect(buildErrorReport("a string", request, context)).toMatchObject({
      errorName: "string",
      digest: null,
    });
  });
});
