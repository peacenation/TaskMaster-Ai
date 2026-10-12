"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveBreakdown } from "@/app/actions/execution";
import { Button, Input } from "@/components/ui";
export function BreakdownReview({
  taskId,
  suggested,
}: {
  taskId: string;
  suggested: string[];
}) {
  const [steps, setSteps] = useState(
    suggested.map((title, index) => ({ key: index, title, minutes: "" }))
  );
  const [nextKey, setNextKey] = useState(suggested.length);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const router = useRouter();
  return (
    <section>
      <h2>Break this into steps</h2>
      <p className="field-hint">
        Suggestions for review. Nothing is added until you save. The parent waits until its
        steps are finished.
      </p>
      {saved ? (
        <p role="status">Steps saved.</p>
      ) : (
        <>
          <ul className="review-list">
            {steps.map((step) => (
              <li key={step.key} className="breakdown-row">
                <label>
                  Step title
                  <Input
                    value={step.title}
                    maxLength={500}
                    onChange={(e) =>
                      setSteps((previous) =>
                        previous.map((s) =>
                          s.key === step.key ? { ...s, title: e.target.value } : s
                        )
                      )
                    }
                  />
                </label>
                <label>
                  Minutes
                  <Input
                    value={step.minutes}
                    type="number"
                    min={1}
                    max={1440}
                    onChange={(e) =>
                      setSteps((previous) =>
                        previous.map((s) =>
                          s.key === step.key ? { ...s, minutes: e.target.value } : s
                        )
                      )
                    }
                  />
                </label>
                <Button
                  variant="secondary"
                  onClick={() =>
                    setSteps((previous) => previous.filter((s) => s.key !== step.key))
                  }
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
          <div className="button-row">
            <Button
              variant="secondary"
              disabled={pending || steps.length >= 20}
              onClick={() => {
                setSteps((previous) => [
                  ...previous,
                  { key: nextKey, title: "", minutes: "" },
                ]);
                setNextKey((n) => n + 1);
              }}
            >
              Add step
            </Button>
            <Button
              disabled={pending || steps.length === 0 || steps.some((s) => !s.title.trim())}
              onClick={() =>
                start(async () => {
                  try {
                    const result = await saveBreakdown({
                      taskId,
                      steps: steps.map((s) => ({
                        title: s.title,
                        estimatedMinutes: s.minutes ? Number(s.minutes) : null,
                      })),
                    });
                    if (!result.ok) {
                      setError(result.message);
                      return;
                    }
                    setSaved(true);
                    router.refresh();
                  } catch {
                    setError("Could not connect. Your steps are still here — retry.");
                  }
                })
              }
            >
              Save steps
            </Button>
          </div>
          {error && (
            <p role="alert" className="notice notice-danger">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
