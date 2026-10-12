"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveRecovery } from "@/app/actions/execution";
import { Button, Select } from "@/components/ui";
export function RecoveryCheckIn({ items }: { items: Array<{ id: string; title: string }> }) {
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <section className="notice" aria-labelledby="recovery-heading">
      <h2 id="recovery-heading">Your day changed. What should happen?</h2>
      <p>
        These planned blocks have passed and the tasks are still open. Nothing has been moved.
      </p>
      <ul className="review-list">
        {items.map((item) => (
          <li className="recovery-row" key={item.id}>
            <label htmlFor={`recovery-${item.id}`}>{item.title}</label>
            <Select
              id={`recovery-${item.id}`}
              value={choices[item.id] ?? ""}
              onChange={(e) =>
                setChoices((previous) => ({ ...previous, [item.id]: e.target.value }))
              }
            >
              <option value="">Choose…</option>
              <option value="keep">Keep open</option>
              <option value="postpone">Postpone</option>
              <option value="drop">Drop from my list</option>
            </Select>
          </li>
        ))}
      </ul>
      <p className="field-hint">
        Drop keeps the task in your history. Once you save these decisions, you can explicitly
        rebuild your plan.
      </p>
      <Button
        disabled={pending || items.some((item) => !choices[item.id])}
        onClick={() =>
          start(async () => {
            try {
              const result = await saveRecovery(
                items.map((item) => ({ id: item.id, choice: choices[item.id] }))
              );
              if (!result.ok) {
                setError(result.message);
                return;
              }
              router.refresh();
            } catch {
              setError("Could not connect. Your selections are still here — retry.");
            }
          })
        }
      >
        Save recovery decisions
      </Button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
