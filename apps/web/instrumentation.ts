import type { Instrumentation } from "next";
import { buildErrorReport } from "@/lib/observability/report-error";
import { sendToSentry } from "@/lib/observability/sentry";

// Every server-side request error, reported without user content. One JSON
// line per error goes to stdout, which the host's log drain collects, and
// the same scrubbed report goes to Sentry when SENTRY_DSN is set — never
// the raw error (docs/OPERATIONS.md).
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context
) => {
  const report = buildErrorReport(error, request, context);
  console.error(JSON.stringify(report));
  await sendToSentry(report);
};
