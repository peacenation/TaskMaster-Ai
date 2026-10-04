import Link from "next/link";
import { chooseNext } from "@/app/actions/planning";
import { StartFocus } from "@/components/execution/StartFocus";
import { TaskActions } from "@/components/execution/TaskActions";
import { Badge, Button, Card } from "@/components/ui";
import type { Recommendation } from "@/lib/domain/nextBestAction";

export function NextBestAction({
  recommendation,
  overridden,
}: {
  recommendation: Recommendation;
  overridden: boolean;
}) {
  return (
    <section aria-labelledby="nba-heading">
      <Card
        variant={overridden ? "confirmed" : "ai"}
        kicker="Next Best Action"
        title={<span id="nba-heading">{recommendation.task.title}</span>}
      >
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
        <div className="button-row" style={{ marginTop: "1rem" }}>
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
      </Card>
    </section>
  );
}
