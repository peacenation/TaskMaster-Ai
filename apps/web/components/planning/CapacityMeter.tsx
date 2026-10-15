import type { Capacity } from "@/lib/domain/plan";

export function CapacityMeter({
  capacity,
  bufferMinutes,
  gapMinutes,
  meetingMinutes = 0,
}: {
  capacity: Capacity;
  bufferMinutes: number;
  gapMinutes: number;
  /** Calendar time still ahead today, already taken out of `available`. */
  meetingMinutes?: number;
}) {
  const available = capacity.availableMinutes ?? 0;
  const usable = capacity.usableMinutes ?? 0;
  return (
    <section
      className={["dash-card", "capacity-panel", capacity.overloaded && "capacity-overloaded"]
        .filter(Boolean)
        .join(" ")}
      aria-labelledby="capacity-heading"
    >
      <h2 id="capacity-heading">What is realistic</h2>
      <p className="capacity-figure">
        <strong>{capacity.plannedMinutes}</strong> of {available} min planned
      </p>
      <meter
        aria-label="Planned work against available time"
        min={0}
        max={Math.max(1, available)}
        value={capacity.plannedMinutes}
      />
      {meetingMinutes > 0 && (
        <p className="field-hint">
          {meetingMinutes} minutes of meetings from your calendar are already taken out.
        </p>
      )}
      <p className="field-hint">
        {bufferMinutes} minutes held back as buffer, with {gapMinutes}-minute gaps between
        blocks. Unestimated tasks use a suggested 30 minutes.
      </p>
      {capacity.overloaded && (
        <p className="notice notice-danger" role="status">
          Work due within 24 hours or overdue needs {capacity.mustDoMinutes} minutes —{" "}
          {capacity.mustDoMinutes - usable} minutes more than your usable time. Some deadline
          work cannot fit today. You decide what to move.
        </p>
      )}
    </section>
  );
}
