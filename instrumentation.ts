import type { Instrumentation } from "next";
import { buildErrorReport } from "@/lib/observability/report-error";

// Every server-side request error, reported without user content. One JSON
// line per error goes to stdout, which the host's log drain (e.g. Vercel)
// collects and can alert on. To add a vendor such as Sentry, forward this
// same scrubbed report — never the raw error (docs/OPERATIONS.md).
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  console.error(JSON.stringify(buildErrorReport(error, request, context)));
};
