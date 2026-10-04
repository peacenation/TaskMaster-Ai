import Link from "next/link";
import { setTaskStatus } from "@/app/actions/tasks";
import { QuickAdd } from "@/components/capture/QuickAdd";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { nextBestAction } from "@/lib/domain/nextBestAction";
import { buildPlan } from "@/lib/domain/plan";
import { withRepositories } from "@/lib/repo";
import { getCurrentUserId, getTimeZone } from "@/lib/server/session";
import { formatDue, toPlannable } from "@/lib/server/views";

export const dynamic = "force-dynamic";

// Today: the recommendation and the day's plan, from the Phase 4 engine
// over the user's real tasks. Phase 6 builds this out (available-time
// input, scheduled view, capacity warning, overriding the recommendation);
// this is the minimum that makes committed Brain Dumps visible and
// actionable.

export default async function TodayPage() {
  const userId = await getCurrentUserId();
  const timeZone = await getTimeZone();
  const now = new Date();

  const { open, dependencies, inboxCount } = await withRepositories(userId, async (repos) => ({
    open: await repos.tasks.list({ statuses: ["todo", "in_progress"] }),
    dependencies: await repos.tasks.dependencies(),
    inboxCount: (await repos.tasks.list({ statuses: ["inbox"] })).length,
  }));

  const tasks = toPlannable(open, dependencies);
  const context = { now, timeZone };
  const recommendation = nextBestAction(tasks, context);
  const plan = buildPlan(tasks, context, { mode: "flexible" });
  const rest = plan.items.filter((item) => item.task.id !== recommendation?.task.id);

  return (
    <div className="wrap">
      <header className="hero">
        <p className="eyebrow">Today</p>
        <h1>What to do next</h1>
      </header>

      {inboxCount > 0 && (
        <p className="notice">
          {inboxCount} item{inboxCount === 1 ? "" : "s"} waiting in your{" "}
          <Link href="/inbox">Inbox</Link>.
        </p>
      )}

      {!recommendation ? (
        <EmptyState
          title="Nothing planned yet"
          description="Empty your head into a Brain Dump and TaskMaster will organise it."
          action={
            <Link href="/dump" className="btn btn-primary" style={{ marginTop: "1rem" }}>
              Start a Brain Dump
            </Link>
          }
        />
      ) : (
        <section aria-labelledby="nba-heading">
          <Card
            variant="ai"
            kicker="Next Best Action"
            title={<span id="nba-heading">{recommendation.task.title}</span>}
          >
            <p className="card-reason">{recommendation.message}</p>
            <div className="button-row" style={{ marginTop: "1rem" }}>
              <form action={setTaskStatus.bind(null, recommendation.task.id, "completed")}>
                <Button type="submit">Complete</Button>
              </form>
              <form action={setTaskStatus.bind(null, recommendation.task.id, "postponed")}>
                <Button type="submit" variant="secondary">
                  Postpone
                </Button>
              </form>
              <Link href={`/tasks/${recommendation.task.id}`} className="btn btn-secondary">
                Edit
              </Link>
            </div>
          </Card>
        </section>
      )}

      {rest.length > 0 && (
        <section aria-labelledby="plan-heading">
          <h2 id="plan-heading">Also today</h2>
          <ul className="review-list">
            {rest.map((item) => (
              <li className="review-item" key={item.task.id}>
                <span className="review-item-text">
                  <Link href={`/tasks/${item.task.id}`}>{item.task.title}</Link>
                  {item.task.dueAt && (
                    <span className="field-hint">
                      {" "}
                      · due {formatDue(item.task.dueAt, timeZone)}
                    </span>
                  )}
                  {item.protected && (
                    <span title="Protected so urgent work doesn't crowd out your longer-term goal">
                      {" "}
                      <Badge tone="success">Protected</Badge>
                    </span>
                  )}
                </span>
                <form action={setTaskStatus.bind(null, item.task.id, "completed")}>
                  <button type="submit" className="review-item-remove">
                    Done
                  </button>
                </form>
              </li>
            ))}
          </ul>
          {plan.deferred.length > 0 && (
            <p className="field-hint">
              {plan.deferred.length} more task{plan.deferred.length === 1 ? "" : "s"} can wait
              — see <Link href="/projects">all tasks</Link>.
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="capture-heading">
        <h2 id="capture-heading">Capture</h2>
        <QuickAdd />
        <p className="field-hint">
          Got a lot on your mind? <Link href="/dump">Start a Brain Dump</Link>.
        </p>
      </section>
    </div>
  );
}
