import { EmptyState } from "@/components/ui";

export default function ProjectsPage() {
  return (
    <div className="wrap">
      <header className="hero">
        <p className="eyebrow">Shell — Phase 2</p>
        <h1>Projects</h1>
        <p>Grouped multi-step work (PRD_v2.md §2.2).</p>
      </header>
      <EmptyState
        title="Not built yet"
        description="Project organisation is part of Phase 9. This is a navigation shell only."
      />
    </div>
  );
}
