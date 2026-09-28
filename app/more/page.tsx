import Link from "next/link";
import { EmptyState } from "@/components/ui";

export default function MorePage() {
  return (
    <div className="wrap">
      <header className="hero">
        <p className="eyebrow">Shell — Phase 2</p>
        <h1>More / Settings</h1>
        <p>Preferences and account controls (PRD_v2.md §2.5).</p>
      </header>
      <EmptyState
        title="Not built yet"
        description="Basic Preferences and Account/Data Deletion land in Phase 8, alongside real accounts. This is a navigation shell only."
        action={
          <Link href="/design" className="btn btn-secondary">
            View design system
          </Link>
        }
      />
    </div>
  );
}
