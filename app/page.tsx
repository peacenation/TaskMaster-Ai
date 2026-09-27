"use client";

import { useState } from "react";
import { Button, Card, EmptyState, Field, Input, Textarea } from "@/components/ui";

type Item = {
  id: string;
  text: string;
  approved: boolean;
};

type Stage = "capture" | "review" | "plan";

function extractItems(rawText: string): Item[] {
  // Local heuristic fallback (no AI call in this milestone — see
  // docs/IMPLEMENTATION_PLAN.md "Named stack for the current milestone").
  // Splits on line breaks and sentence-ending punctuation, drops blanks.
  return rawText
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((text) => ({ id: crypto.randomUUID(), text, approved: true }));
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("capture");
  const [rawText, setRawText] = useState("");
  const [reviewItems, setReviewItems] = useState<Item[]>([]);
  const [planItems, setPlanItems] = useState<Item[]>([]);
  const [quickAddText, setQuickAddText] = useState("");
  const [focusMode, setFocusMode] = useState(false);

  function handleOrganise() {
    const items = extractItems(rawText);
    if (items.length === 0) return;
    setReviewItems(items);
    setStage("review");
  }

  function toggleApproved(id: string) {
    setReviewItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, approved: !i.approved } : i))
    );
  }

  function removeReviewItem(id: string) {
    setReviewItems((prev) => prev.filter((i) => i.id !== id));
  }

  function handleBuildPlan() {
    const approved = reviewItems.filter((i) => i.approved);
    if (approved.length === 0) return;
    setPlanItems(approved);
    setStage("plan");
  }

  function handleQuickAdd() {
    const text = quickAddText.trim();
    if (!text) return;
    setPlanItems((prev) => [...prev, { id: crypto.randomUUID(), text, approved: true }]);
    setQuickAddText("");
  }

  function completeCurrent() {
    setPlanItems((prev) => prev.slice(1));
    setFocusMode(false);
  }

  function postponeCurrent() {
    setPlanItems((prev) => (prev.length > 1 ? [...prev.slice(1), prev[0]] : prev));
    setFocusMode(false);
  }

  function startOver() {
    setRawText("");
    setReviewItems([]);
    setPlanItems([]);
    setQuickAddText("");
    setFocusMode(false);
    setStage("capture");
  }

  const nextBestAction = planItems[0];
  const backlog = planItems.slice(1);

  return (
    <div className="wrap">
      <header className="hero">
        <p className="eyebrow">Prototype — Initial Working Page</p>
        <h1>TaskMaster</h1>
        <p>
          Tell TaskMaster everything you need to get done. It will work out
          what matters, build you a realistic plan, and tell you what to do
          next.
        </p>
      </header>

      <p className="phase-banner">
        Local prototype, no backend yet: this page runs entirely in the
        browser with a simple heuristic in place of the AI extraction call
        (see PRD_v2.md §2.7). No sign-in, no database, nothing deployed.
        Built from the same primitives and tokens as{" "}
        <a href="/design">/design</a>.
      </p>

      {stage === "capture" && (
        <section id="capture">
          <h2>What&apos;s taking up space in your head right now?</h2>
          <p className="section-note">
            Add work, personal tasks, deadlines, things you&apos;ve been
            putting off, projects, or anything else you need to get done.
            Don&apos;t organise it first.
          </p>
          <Field label="Brain Dump" htmlFor="braindump">
            <Textarea
              id="braindump"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={
                "Call John tomorrow at 2pm.\nFinish the client proposal draft, due Friday.\nBook the car in for a service."
              }
            />
          </Field>
          <div className="button-row">
            <Button onClick={handleOrganise} disabled={rawText.trim().length === 0}>
              Organise It
            </Button>
          </div>
        </section>
      )}

      {stage === "review" && (
        <section id="review">
          <h2>Review before you commit</h2>
          <p className="section-note">
            TaskMaster split your Brain Dump into {reviewItems.length}{" "}
            proposed item{reviewItems.length === 1 ? "" : "s"}. Uncheck or
            remove anything that isn&apos;t right before it&apos;s saved.
          </p>
          {reviewItems.length === 0 ? (
            <EmptyState title="No items left to review" />
          ) : (
            <ul className="review-list">
              {reviewItems.map((item) => (
                <li className="review-item" key={item.id}>
                  <input
                    type="checkbox"
                    checked={item.approved}
                    onChange={() => toggleApproved(item.id)}
                    aria-label={`Approve "${item.text}"`}
                  />
                  <span className="review-item-text">{item.text}</span>
                  <button
                    className="review-item-remove"
                    onClick={() => removeReviewItem(item.id)}
                    aria-label={`Remove "${item.text}"`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="button-row" style={{ marginTop: "1.5rem" }}>
            <Button variant="secondary" onClick={() => setStage("capture")}>
              Back
            </Button>
            <Button
              onClick={handleBuildPlan}
              disabled={reviewItems.filter((i) => i.approved).length === 0}
            >
              Build My Plan
            </Button>
          </div>
        </section>
      )}

      {stage === "plan" && (
        <>
          <section id="today">
            <h2>Today</h2>
            {!nextBestAction ? (
              <EmptyState
                title="Nothing left in your plan"
                description="Add something with Quick Add below, or start a new Brain Dump."
              />
            ) : (
              <div className="card-row">
                <Card variant="ai" kicker="Next Best Action" title={nextBestAction.text}>
                  <p className="card-reason">
                    Recommended first because it&apos;s next in your Brain
                    Dump order — priority scoring is a later milestone.
                  </p>
                  <div className="button-row" style={{ marginTop: "1rem" }}>
                    <Button onClick={completeCurrent}>Complete</Button>
                    <Button variant="secondary" onClick={postponeCurrent}>
                      Postpone
                    </Button>
                    {!focusMode && (
                      <Button variant="secondary" onClick={() => setFocusMode(true)}>
                        Focus Mode
                      </Button>
                    )}
                  </div>
                </Card>
              </div>
            )}
          </section>

          {focusMode && nextBestAction && (
            <section id="focus">
              <h2>Focus Mode</h2>
              <p className="section-note">
                One task, minimal distractions. The rest of your backlog is
                out of the way until you complete or postpone this.
              </p>
              <Card variant="confirmed" kicker="✓ Focused on" title={nextBestAction.text}>
                <div className="button-row" style={{ marginTop: "1rem" }}>
                  <Button onClick={completeCurrent}>Complete</Button>
                  <Button variant="secondary" onClick={postponeCurrent}>
                    Postpone
                  </Button>
                  <Button variant="secondary" onClick={() => setFocusMode(false)}>
                    Exit Focus
                  </Button>
                </div>
              </Card>
            </section>
          )}

          {!focusMode && (
            <section id="backlog">
              <h2>Backlog</h2>
              {backlog.length === 0 ? (
                <EmptyState title="Nothing else queued" />
              ) : (
                <ul className="review-list">
                  {backlog.map((item) => (
                    <li className="review-item" key={item.id}>
                      <span className="review-item-text">{item.text}</span>
                      <button
                        className="review-item-remove"
                        onClick={() =>
                          setPlanItems((prev) => prev.filter((i) => i.id !== item.id))
                        }
                        aria-label={`Remove "${item.text}"`}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {!focusMode && (
            <section id="quick-add">
              <h2>Quick Add</h2>
              <p className="section-note">
                Fast natural-language entry, added straight to your backlog —
                no review step.
              </p>
              <div className="field" style={{ display: "flex", gap: "0.75rem", marginBottom: 0 }}>
                <Input
                  type="text"
                  value={quickAddText}
                  onChange={(e) => setQuickAddText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleQuickAdd()}
                  placeholder="Send Sarah the figures Friday morning"
                />
                <Button onClick={handleQuickAdd}>Add</Button>
              </div>
            </section>
          )}

          {!focusMode && (
            <div className="button-row">
              <Button variant="danger" onClick={startOver}>
                Start Over
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
