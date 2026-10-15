// The MVP success metrics (PRD_v2.md §2.9) from product_events, for the
// last N days. Read-only; aggregates only — no task or Brain Dump text is
// ever recorded, so none can be printed.
//
//   npm run metrics                 # last 30 days, local database
//   npm run metrics -- --days 7
//   DATABASE_URL=<production owner URL> npm run metrics   # production
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};

const pct = (part: number, whole: number) =>
  whole === 0 ? "—" : `${Math.round((part / whole) * 100)}%`;

const duration = (seconds: number | null) => {
  if (seconds === null) return "—";
  if (seconds < 120) return `${Math.round(seconds)} s`;
  if (seconds < 7200) return `${Math.round(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(1)} h`;
};

async function main() {
  const days = Number(arg("--days") ?? 30);
  if (!Number.isInteger(days) || days < 1) throw new Error("--days must be a whole number.");
  const { sql } = await import("drizzle-orm");
  const { getAdminDb } = await import("../lib/db/client");
  const db = getAdminDb();
  const since = new Date(Date.now() - days * 86_400_000);

  const one = async <T>(query: ReturnType<typeof sql>) =>
    (await db.execute(query)).rows[0] as T;
  const n = (value: unknown) => Number(value ?? 0);

  const signups = await one<{ count: string }>(
    sql`SELECT count(*) FROM users WHERE created_at >= ${since}`
  );
  const onboarded = await one<{ count: string; median: string | null }>(sql`
    SELECT count(*) AS count,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY (properties->>'seconds_since_signup')::numeric) AS median
    FROM product_events e JOIN users u ON u.id = e.user_id
    WHERE e.name = 'onboarding_completed' AND u.created_at >= ${since}`);
  const dumps = await one<{ organised: string; ai: string; committed: string }>(sql`
    SELECT count(*) FILTER (WHERE name = 'brain_dump_organised') AS organised,
           count(*) FILTER (WHERE name = 'brain_dump_organised' AND properties->>'engine' = 'ai') AS ai,
           count(*) FILTER (WHERE name = 'brain_dump_committed') AS committed
    FROM product_events WHERE occurred_at >= ${since}`);
  const corrections = await one<{ proposed: string; corrected: string; removed: string }>(sql`
    SELECT sum((properties->>'proposed')::int) AS proposed,
           sum((properties->>'corrected')::int) AS corrected,
           sum((properties->>'removed')::int) AS removed
    FROM product_events
    WHERE name = 'brain_dump_committed' AND occurred_at >= ${since}
      AND (properties->>'proposed')::int > 0`);
  // A "planning day": a user opened Today that day (once per day by design).
  const days_ = await one<{
    planning_days: string;
    active_days: string;
    with_recommendation: string;
    accepted: string;
    overridden: string;
  }>(sql`
    WITH viewed AS (
      SELECT user_id, occurred_at::date AS day, properties
      FROM product_events WHERE name = 'today_viewed' AND occurred_at >= ${since}
    ),
    acted AS (
      SELECT DISTINCT user_id, occurred_at::date AS day, properties->>'task_id' AS task_id
      FROM product_events
      WHERE name IN ('task_started', 'task_completed') AND occurred_at >= ${since}
    )
    SELECT count(*) AS planning_days,
           count(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM acted a WHERE a.user_id = v.user_id AND a.day = v.day)) AS active_days,
           count(*) FILTER (WHERE v.properties->>'recommended_task_id' IS NOT NULL) AS with_recommendation,
           count(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM acted a WHERE a.user_id = v.user_id AND a.day = v.day
               AND a.task_id = v.properties->>'recommended_task_id')) AS accepted,
           count(*) FILTER (WHERE (v.properties->>'overridden')::boolean) AS overridden
    FROM viewed v`);
  const repeat = await one<{ planners: string; returning: string }>(sql`
    SELECT count(*) AS planners, count(*) FILTER (WHERE days >= 2) AS returning
    FROM (SELECT user_id, count(DISTINCT occurred_at::date) AS days
          FROM product_events WHERE name = 'today_viewed' AND occurred_at >= ${since}
          GROUP BY user_id) per_user`);
  const totals = await one<Record<string, string>>(sql`
    SELECT count(*) FILTER (WHERE name = 'task_completed') AS completed,
           count(*) FILTER (WHERE name = 'recovery_resolved') AS recoveries,
           count(*) FILTER (WHERE name = 'planner_applied') AS planner,
           count(DISTINCT user_id) FILTER (WHERE name = 'calendar_connected') AS calendars,
           count(*) FILTER (WHERE name = 'waiting_marked') AS waiting
    FROM product_events WHERE occurred_at >= ${since}`);

  const proposed = n(corrections.proposed);
  const rows: Array<[string, string, string]> = [
    ["New accounts", String(n(signups.count)), ""],
    [
      "Onboarding completion",
      pct(n(onboarded.count), n(signups.count)),
      "reached their first plan",
    ],
    [
      "Time to first value (median)",
      duration(onboarded.median === null ? null : Number(onboarded.median)),
      "sign-up → first saved Brain Dump",
    ],
    [
      "Brain Dump conversion",
      pct(n(dumps.committed), n(dumps.organised)),
      "organised dumps that were saved",
    ],
    ["Organised by AI", pct(n(dumps.ai), n(dumps.organised)), "the rest by built-in rules"],
    [
      "AI correction rate",
      pct(n(corrections.corrected) + n(corrections.removed), proposed),
      "proposed items changed or removed in review",
    ],
    [
      "Plan activation",
      pct(n(days_.active_days), n(days_.planning_days)),
      "planning days with a task started or done",
    ],
    [
      "Next Best Action accepted",
      pct(n(days_.accepted), n(days_.with_recommendation)),
      "recommended task started or done that day",
    ],
    [
      "Recommendation overridden",
      pct(n(days_.overridden), n(days_.planning_days)),
      "user chose their own next task",
    ],
    [
      "Repeat planning",
      pct(n(repeat.returning), n(repeat.planners)),
      "planners who came back on another day",
    ],
    ["Tasks completed", String(n(totals.completed)), ""],
    ["Recovery check-ins resolved", String(n(totals.recoveries)), ""],
    ["AI Planner plans applied", String(n(totals.planner)), ""],
    ["Users with a calendar connected", String(n(totals.calendars)), ""],
    ["Tasks marked waiting on someone", String(n(totals.waiting)), ""],
  ];
  const width = Math.max(...rows.map(([label]) => label.length));
  console.log(`TaskMasterAi — last ${days} day${days === 1 ? "" : "s"}\n`);
  for (const [label, value, note] of rows)
    console.log(`${label.padEnd(width)}  ${value.padStart(6)}  ${note}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
