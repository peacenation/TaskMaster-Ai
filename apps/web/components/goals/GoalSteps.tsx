"use client";

import { useState } from "react";
import { saveSteps, suggestSteps } from "@/app/actions/goal-steps";
import { Button, Input } from "@/components/ui";

type Step = { title: string; estimatedMinutes: number | null };

// "Suggest steps" for a goal: AI (or built-in rules) proposes the next few
// concrete actions; edit or remove them, then save them as to-dos.
export function GoalSteps({ goalId, goalTitle }: { goalId: string; goalTitle: string }) {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function suggest() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await suggestSteps(goalId);
      if (!result) return setMessage("That goal no longer exists.");
      setSteps(result.steps);
      setNote(
        result.engine === "ai"
          ? result.reply
          : `${result.reply} (Suggested by TaskMaster's built-in rules.)`
      );
    } catch {
      setMessage("Couldn't suggest steps. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!steps) return;
    setBusy(true);
    const kept = steps.filter((s) => s.title.trim());
    const result = await saveSteps(goalId, { steps: kept });
    setBusy(false);
    if (result.ok) {
      setSteps(null);
      setMessage(`Added ${kept.length} step${kept.length === 1 ? "" : "s"} to your list.`);
    } else setMessage(result.message ?? "Couldn't save. Try again.");
  }

  if (!steps)
    return (
      <div className="goal-steps">
        <Button type="button" variant="secondary" onClick={suggest} disabled={busy}>
          {busy ? "Thinking…" : "Suggest next steps"}
        </Button>
        {message && (
          <p className="field-hint" role="status">
            {message}
          </p>
        )}
      </div>
    );

  return (
    <div className="goal-steps" aria-label={`Suggested steps for ${goalTitle}`}>
      {note && <p className="field-hint">{note}</p>}
      <ol>
        {steps.map((s, i) => (
          <li key={i}>
            <Input
              aria-label={`Step ${i + 1}`}
              value={s.title}
              onChange={(e) =>
                setSteps(steps.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))
              }
            />
            <button
              type="button"
              className="review-item-remove"
              onClick={() => setSteps(steps.filter((_, j) => j !== i))}
            >
              Remove
            </button>
          </li>
        ))}
      </ol>
      <div className="button-row">
        <Button
          type="button"
          onClick={save}
          disabled={busy || steps.every((s) => !s.title.trim())}
        >
          {busy ? "Saving…" : "Add these to my list"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setSteps(null)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
