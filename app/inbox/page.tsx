import { EmptyState } from "@/components/ui";

export default function InboxPage() {
  return (
    <div className="wrap">
      <header className="hero">
        <p className="eyebrow">Shell — Phase 2</p>
        <h1>Inbox</h1>
        <p>Universal place for captured, unprocessed work (PRD_v2.md §2.2).</p>
      </header>
      <EmptyState
        title="Not built yet"
        description="Inbox is part of Phase 5 (Capture: Brain Dump → review → commit). This is a navigation shell only."
      />
    </div>
  );
}
