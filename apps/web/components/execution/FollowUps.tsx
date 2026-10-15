import Link from "next/link";
import { followUpLater, stopWaiting } from "@/app/actions/waiting";

export interface FollowUp {
  id: string;
  title: string;
  waitingOn: string;
}

// Waiting On: the follow-up date has come for work someone else owes you.
export function FollowUps({ items }: { items: FollowUp[] }) {
  if (items.length === 0) return null;
  return (
    <section className="dash-card" aria-labelledby="follow-ups-heading">
      <p className="eyebrow">Time to follow up</p>
      <h2 id="follow-ups-heading">
        {items.length === 1 ? "Something you’re waiting on" : "Things you’re waiting on"}
      </h2>
      <ul className="review-list">
        {items.map((item) => (
          <li className="review-item" key={item.id}>
            <span className="review-item-text">
              <Link href={`/tasks/${item.id}`}>{item.title}</Link>
              <span className="field-hint"> · waiting on {item.waitingOn}</span>
            </span>
            <div className="button-row">
              <form action={stopWaiting.bind(null, item.id)}>
                <button className="btn btn-secondary" type="submit">
                  It’s arrived
                </button>
              </form>
              <form action={followUpLater.bind(null, item.id, 2)}>
                <button className="btn btn-secondary" type="submit">
                  Chased · check in 2 days
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
