import { sql } from "drizzle-orm";
import { getAppDb } from "@/lib/db/client";

export const dynamic = "force-dynamic";

// GET /api/health — for an uptime monitor (docs/OPERATIONS.md). Public and
// deliberately uninformative: it proves the app runs and the application
// role can reach the database, and reveals nothing else. No user context
// is set, so RLS would return no rows even if this queried a table.
export async function GET() {
  try {
    await getAppDb().execute(sql`SELECT 1`);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error(JSON.stringify({ event: "health.database_unreachable" }));
    return Response.json(
      { ok: false },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
