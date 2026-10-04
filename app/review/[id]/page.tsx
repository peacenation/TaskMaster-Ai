import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ExtractionReview } from "@/components/capture/ExtractionReview";
import { EmptyState } from "@/components/ui";
import { systemClock } from "@/lib/domain/clock";
import { extract } from "@/lib/domain/extract";
import { withRepositories } from "@/lib/repo";
import { getCurrentUserId, getTimeZone } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// Resume reviewing a saved Brain Dump — e.g. after closing the tab, or
// when extraction never finished. The raw text was saved first, so it's
// always recoverable here.

export default async function ResumeReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const userId = await getCurrentUserId();
  const timeZone = await getTimeZone();
  const { dump, projects } = await withRepositories(userId, async (repos) => ({
    dump: await repos.brainDumps.get(id),
    projects: await repos.projects.list(),
  }));
  if (!dump) notFound();

  if (dump.committedAt) {
    return (
      <div className="wrap">
        <EmptyState
          title="Already saved"
          description="This Brain Dump has been reviewed and saved."
          action={
            <Link href="/" className="btn btn-primary" style={{ marginTop: "1rem" }}>
              Go to Today
            </Link>
          }
        />
      </div>
    );
  }

  // Extraction never completed: organise it now with the heuristic, which
  // needs nothing external and can't fail.
  const proposal = dump.proposal ?? extract(dump.rawText, { clock: systemClock, timeZone });

  return (
    <div className="wrap wrap-wide">
      <header className="hero">
        <p className="eyebrow">Brain Dump</p>
        <h1>Pick up where you left off</h1>
        <details className="raw-dump">
          <summary>What you wrote</summary>
          <p>{dump.rawText}</p>
        </details>
      </header>
      <ExtractionReview
        dumpId={dump.id}
        rawText={dump.rawText}
        proposal={proposal}
        fallbackReason={null}
        existingProjects={projects.map((p) => p.name)}
      />
    </div>
  );
}
