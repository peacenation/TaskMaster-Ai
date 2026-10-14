import Link from "next/link";
import type { ReactNode } from "react";
import { chooseNext } from "@/app/actions/planning";
import { StartFocus } from "@/components/execution/StartFocus";
import { TaskActions } from "@/components/execution/TaskActions";
import { SparkleIcon } from "@/components/shell/icons";
import { Badge, Button } from "@/components/ui";
import type { Recommendation } from "@/lib/domain/nextBestAction";

/** Decorative sun-over-hills, echoing "a calmer day". */
function Hills() {
  return (
    <svg className="nba-hills" viewBox="0 0 220 120" aria-hidden="true" focusable="false">
      <circle cx="150" cy="38" r="17" fill="var(--accent)" opacity="0.75" />
      <path
        d="M0 120 C40 70 80 60 120 82 S190 50 220 60 V120Z"
        fill="var(--accent)"
        opacity="0.28"
      />
      <path
        d="M30 120 C80 84 130 90 160 100 S205 84 220 90 V120Z"
        fill="var(--accent)"
        opacity="0.38"
      />
    </svg>
  );
}

function Hero({
  confirmed,
  labelledBy,
  children,
}: {
  confirmed?: boolean;
  labelledBy: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={["nba-hero", confirmed && "nba-hero-confirmed"].filter(Boolean).join(" ")}
    >
      <Hills />
      <div className="nba-hero-top">
        <span className="nba-hero-icon">
          <SparkleIcon size={26} />
        </span>
        <div className="nba-hero-body">{children}</div>
      </div>
    </section>
  );
}

/**
 * The AI suggestion and a confirmed user choice must stay visually
 * distinct (PRD_v2.md §2.8): the hero is caramel while it is a
 * recommendation and turns sage once the user has picked their own.
 */
export function NextBestAction({
  recommendation,
  overridden,
  meta,
}: {
  recommendation: Recommendation;
  overridden: boolean;
  meta?: string;
}) {
  return (
    <Hero confirmed={overridden} labelledBy="nba-heading">
      <div className="nba-hero-label">
        <h2>What to do next</h2>
        <span className="card-kicker">Next Best Action</span>
      </div>
      <p className="nba-title">
        <span id="nba-heading">{recommendation.task.title}</span>
      </p>
      {meta && <p className="nba-meta">{meta}</p>}
      {overridden && <Badge tone="success">Your choice is in effect</Badge>}
      <p className="card-reason">{recommendation.message}</p>
      <details>
        <summary>Explain this recommendation</summary>
        <ul>
          {recommendation.reasons.map((r) => (
            <li key={r.code}>{r.text}</li>
          ))}
        </ul>
        {recommendation.displaced && (
          <p>Return to {recommendation.displaced.title} when you are ready.</p>
        )}
        {recommendation.reasons.length === 0 && (
          <p>
            Earlier deadlines and older tasks break ties when there are no other priority
            signals.
          </p>
        )}
      </details>
      <div className="button-row nba-actions">
        <StartFocus taskId={recommendation.task.id} />
        <TaskActions taskId={recommendation.task.id} />
        <Link href={`/tasks/${recommendation.task.id}`} className="btn btn-secondary">
          Edit
        </Link>
        {overridden && (
          <form action={chooseNext.bind(null, null)}>
            <Button type="submit" variant="secondary">
              Use recommendation
            </Button>
          </form>
        )}
      </div>
    </Hero>
  );
}

/** Same hero frame when there is nothing actionable to recommend. */
export function NextBestActionEmpty({ title, action }: { title: string; action: ReactNode }) {
  return (
    <Hero labelledBy="nba-empty-heading">
      <div className="nba-hero-label">
        <h2>What to do next</h2>
      </div>
      <p className="nba-title" id="nba-empty-heading">
        {title}
      </p>
      <p className="card-reason">Capture new work or organise your Inbox to get started.</p>
      <div className="button-row nba-actions">{action}</div>
    </Hero>
  );
}
