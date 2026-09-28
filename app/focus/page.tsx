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
        title="Enter Focus Mode from Today"
        description="Focus Mode is currently reached from the Next Best Action card on Today, not as a standalone destination. A dedicated /focus route is part of Phase 7."
        action={
          <Link href="/" className="btn btn-secondary">
            Go to Today
          </Link>
        }
      />
    </div>
  );
}
