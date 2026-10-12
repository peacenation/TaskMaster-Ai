"use client";

import { useState } from "react";
import type { ReactNode } from "react";

// Presentation only: both views receive the same server-planned rows and times.
export function PlanView({
  flexible,
  scheduled,
  defaultMode = "flexible",
}: {
  flexible: ReactNode;
  scheduled: ReactNode;
  defaultMode?: string;
}) {
  const [mode, setMode] = useState(defaultMode);
  return (
    <section aria-labelledby="plan-heading">
      <div className="plan-header">
        <h2 id="plan-heading">What matters today</h2>
        <div className="button-row" aria-label="Plan view">
          <button
            type="button"
            className="btn btn-secondary"
            aria-pressed={mode === "flexible"}
            onClick={() => setMode("flexible")}
          >
            Flexible
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            aria-pressed={mode === "scheduled"}
            onClick={() => setMode("scheduled")}
          >
            Scheduled
          </button>
        </div>
      </div>
      <p className="field-hint">
        Switching views keeps the same work and order. Blocks are suggestions; tasks move only
        when you decide.
      </p>
      {mode === "flexible" ? flexible : scheduled}
    </section>
  );
}
