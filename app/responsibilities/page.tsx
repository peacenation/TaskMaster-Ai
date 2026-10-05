import Link from "next/link";
import { setTaskStatus } from "@/app/actions/tasks";
import { stopRecurrenceRule } from "@/app/actions/recurring";
import { EmptyState } from "@/components/ui";
import { localDate } from "@/lib/execution/date";
import { withRepositories } from "@/lib/repo";
import { getCurrentUserId, getTimeZone } from "@/lib/server/session";

export const dynamic = "force-dynamic";

function addDays(date: string, count: number): string {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + count);
  return result.toISOString().slice(0, 10);
}

const frequencyLabel: Record<string, string> = {
  daily: "daily",
  weekly: "weekly",
  monthly: "monthly",
};

export default async function ResponsibilitiesPage() {
  const userId = await getCurrentUserId();
  const timeZone = await getTimeZone();
  const today = localDate(new Date(), timeZone);
  const rules = await withRepositories(userId, async (repos) => {
    await repos.recurrenceRules.generateThrough(today, addDays(today, 30));
    const active = await repos.recurrenceRules.list();
    return Promise.all(
      active.map(async (rule) => ({
        ...rule,
        occurrences: await repos.recurrenceRules.occurrences(rule.id),
      }))
    );
  });
  const activeRules = rules.filter((rule) => !rule.stoppedAt);

  return (
    <div className="wrap">
      <header className="hero">
        <p className="eyebrow">Responsibilities</p>
        <h1>Repeating work, kept in its own lane</h1>
        <p>Upcoming instances are generated for the next 30 days and do not crowd Today.</p>
        <div className="button-row" style={{ marginTop: "1rem" }}>
          <Link href="/dump" className="btn btn-primary">
            Add from Brain Dump
          </Link>
        </div>
      </header>

      {activeRules.length === 0 ? (
        <EmptyState
          title="No active responsibilities"
          description="Capture a repeating commitment in a Brain Dump, such as “go to the gym three times a week.”"
          action={
            <Link href="/dump" className="btn btn-primary">
              Start a Brain Dump
            </Link>
          }
        />
      ) : (
        activeRules.map((rule) => {
          const upcoming = rule.occurrences.filter(
            (item) => item.occurrenceDate !== null && item.occurrenceDate >= today
          );
          return (
            <section key={rule.id} aria-labelledby={`rule-${rule.id}`}>
              <div className="section-heading-row">
                <div>
                  <h2 id={`rule-${rule.id}`}>{rule.title}</h2>
                  <p className="field-hint">
                    {rule.timesPerPeriod > 1
                      ? `${rule.timesPerPeriod} times `
                      : ""}
                    {frequencyLabel[rule.frequency]}
                    {rule.intervalCount > 1 ? `, every ${rule.intervalCount} periods` : ""}
                    {rule.endDate ? ` · ends ${rule.endDate}` : ""}
                  </p>
                </div>
                <form action={stopRecurrenceRule.bind(null, rule.id)}>
                  <button className="btn btn-secondary" type="submit">
                    Stop future instances
                  </button>
                </form>
              </div>
              {upcoming.length === 0 ? (
                <p className="field-hint">No upcoming instances in the next 30 days.</p>
              ) : (
                <ul className="review-list">
                  {upcoming.map((item) => (
                    <li className="review-item" key={item.id}>
                      <span className="review-item-text">
                        <Link href={`/tasks/${item.id}`}>{item.title}</Link>
                        <span className="field-hint"> · {item.occurrenceDate}</span>
                        {item.status === "completed" && (
                          <span className="field-hint"> · completed</span>
                        )}
                      </span>
                      {item.status !== "completed" && item.status !== "dropped" && (
                        <form action={setTaskStatus.bind(null, item.id, "completed")}>
                          <button type="submit" className="review-item-remove">
                            Done
                          </button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}

      {rules.some((rule) => rule.stoppedAt) && (
        <section aria-labelledby="stopped-heading">
          <h2 id="stopped-heading">Stopped responsibilities</h2>
          <p className="field-hint">Existing instances remain in your history; no new ones are generated.</p>
          <ul className="review-list">
            {rules
              .filter((rule) => rule.stoppedAt)
              .map((rule) => (
                <li className="review-item" key={rule.id}>
                  <span className="review-item-text">{rule.title}</span>
                  <span className="field-hint">Stopped {rule.stoppedAt?.toLocaleDateString()}</span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}