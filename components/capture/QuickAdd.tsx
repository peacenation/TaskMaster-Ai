"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { quickAdd } from "@/app/actions/capture";
import { Badge, Button, Input } from "@/components/ui";
import { systemClock } from "@/lib/domain/clock";
import { extractItem } from "@/lib/domain/extract";
import { LOW_CONFIDENCE } from "@/lib/domain/proposal";

// Quick Add (PRD §2.4 User Flow 2): type naturally, see how TaskMaster read
// it, correct or save. Interpretation runs locally as you type — the same
// heuristic extractor, no round trip. Saved items land in the Inbox.

export function QuickAdd() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [keepDate, setKeepDate] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const reading = useMemo(
    () => (text.trim() ? extractItem(text, { clock: systemClock, timeZone }) : null),
    [text, timeZone]
  );
  const title = reading?.title ?? text.trim();
  const deadline = keepDate ? (reading?.deadline ?? null) : null;

  async function save() {
    if (!title) return;
    setSaving(true);
    setError(false);
    const result = await quickAdd({ title, dueAt: deadline?.at ?? null }).catch(() => ({
      ok: false,
    }));
    setSaving(false);
    if (!result.ok) {
      setError(true);
      return;
    }
    setText("");
    setKeepDate(true);
    router.refresh();
  }

  return (
    <form
      className="quick-add"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="quick-add-row">
        <Input
          aria-label="Quick Add"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setKeepDate(true);
          }}
          placeholder="Send Sarah the figures Friday morning"
        />
        <Button type="submit" disabled={saving || !title}>
          {saving ? "Adding…" : "Add"}
        </Button>
      </div>
      {reading && (
        <p className="quick-add-reading" aria-live="polite">
          <span>
            Adds <strong>{title}</strong>
          </span>
          {reading.deadline && keepDate && (
            <>
              <span>
                {" "}
                · due{" "}
                {new Date(reading.deadline.at).toLocaleString(undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              {reading.deadline.confidence < LOW_CONFIDENCE && (
                <Badge tone="ai">Suggested</Badge>
              )}
              <button
                type="button"
                className="review-item-remove"
                onClick={() => setKeepDate(false)}
              >
                No date
              </button>
            </>
          )}
          <span className="field-hint"> → Inbox</span>
        </p>
      )}
      {error && (
        <p className="field-hint" role="alert">
          Couldn&apos;t add that — try again.
        </p>
      )}
    </form>
  );
}
