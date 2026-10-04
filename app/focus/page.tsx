import Link from "next/link";
import { EmptyState } from "@/components/ui";

export default function FocusPage() {
  return (
    <div className="wrap">
      <header className="hero">
        <p className="eyebrow">Shell — Phase 2</p>
        <h1>Focus</h1>
        <p>
          Distraction-minimised execution view for one current task (PRD_v2.md §2.4 User Flow
          4).
        </p>
      </header>
      <EmptyState
        title="Not built yet"
        description="Focus Mode arrives in Phase 7. Until then, Today shows your Next Best Action with Complete and Postpone."
        action={
          <Link href="/" className="btn btn-secondary">
            Go to Today
          </Link>
        }
      />
    </div>
  );
}
