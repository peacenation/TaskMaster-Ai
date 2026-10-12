import type { Capacity } from "@/lib/domain/plan";

export function CapacityMeter({
  capacity,
  bufferMinutes,
  gapMinutes,
}: {
  capacity: Capacity;
  bufferMinutes: number;
  gapMinutes: number;
}) {
  const available = capacity.availableMinutes ?? 0;
  const usable = capacity.usableMinutes ?? 0;
  return (
    <section className="capacity-panel" aria-labelledby="capacity-heading">
      <h2 id="capacity-heading">What is realistic</h2>
      <p>
        {capacity.plannedMinutes} minutes of work planned from {available} minutes available.
      </p>
      <meter
        aria-label="Planned work against available time"
        min={0}
        max={Math.max(1, available)}
        value={capacity.plannedMinutes}
      />
      <p className="field-hint">
        {bufferMinutes} minutes held back as buffer, with {gapMinutes}-minute gaps between
        blocks. Unestimated tasks use a suggested 30 minutes.
      </p>
      {capacity.overloaded && (
        <p className="notice" role="status">
          Work due within 24 hours or overdue needs {capacity.mustDoMinutes} minutes —{" "}
          {capacity.mustDoMinutes - usable} minutes more than your usable time. Some deadline
          work cannot fit today. You decide what to move.
        </p>
      )}
    </section>
  );
}
