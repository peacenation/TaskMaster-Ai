import Link from "next/link";
import { QuickAdd } from "@/components/capture/QuickAdd";
import { InboxList } from "@/components/tasks/InboxList";
import { EmptyState } from "@/components/ui";
import { withRepositories } from "@/lib/repo";
import { getCurrentUserId, getTimeZone } from "@/lib/server/session";
import { formatDue } from "@/lib/server/views";

export const dynamic = "force-dynamic";

// The Inbox (PRD §2.2, P0): captured but not yet organised — Quick Add
// items, and Brain Dumps saved but never reviewed.

export default async function InboxPage() {
  const userId = await getCurrentUserId();
  const timeZone = await getTimeZone();
  const { inbox, dumps, projects } = await withRepositories(userId, async (repos) => ({
    inbox: await repos.tasks.list({ statuses: ["inbox"] }),
    dumps: await repos.brainDumps.listUncommitted(),
    projects: await repos.projects.list(),
  }));

  return (
    <div className="wrap">
      <header className="hero">
        <p className="eyebrow">Inbox</p>
        <h1>Captured, not yet organised</h1>
        <p>Get things out of your head fast, then decide where they belong.</p>
      </header>

      <section aria-labelledby="capture-heading">
        <h2 id="capture-heading">Quick Add</h2>
        <QuickAdd />
        <p className="field-hint">
          More than one thing? <Link href="/dump">Start a Brain Dump</Link>.
        </p>
      </section>

      {dumps.length > 0 && (
        <section aria-labelledby="dumps-heading">
          <h2 id="dumps-heading">Brain Dumps to review</h2>
          <ul className="review-list">
            {dumps.map((dump) => (
              <li className="review-item" key={dump.id}>
                <span className="review-item-text">
                  {dump.rawText.length > 90 ? `${dump.rawText.slice(0, 90)}…` : dump.rawText}
                  <span className="field-hint"> · {formatDue(dump.createdAt, timeZone)}</span>
                </span>
                <Link href={`/review/${dump.id}`} className="btn btn-secondary">
                  Review
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="inbox-heading">
        <h2 id="inbox-heading">Inbox</h2>
        {inbox.length === 0 ? (
          <EmptyState
            title="Inbox zero"
            description="Anything you Quick Add lands here first."
          />
        ) : (
          <InboxList
            items={inbox.map((t) => ({
              id: t.id,
              title: t.title,
              due: t.dueAt ? formatDue(t.dueAt, timeZone) : null,
            }))}
            projects={projects.map((p) => p.name)}
          />
        )}
      </section>
    </div>
  );
}
