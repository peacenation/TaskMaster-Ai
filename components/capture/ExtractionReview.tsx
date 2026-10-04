"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { commitBrainDump } from "@/app/actions/capture";
import { Badge, Button, Input, Select } from "@/components/ui";
import type { CommitSummary } from "@/lib/capture/commit";
import { FALLBACK_MESSAGES, type OrganiseFailure } from "@/lib/capture/organise";
import { LOW_CONFIDENCE, type ExtractionProposal, type ItemKind } from "@/lib/domain/proposal";

// The extraction review screen (Phase 5 work item 4): "AI recommends, user
// decides" (PRD §1.5). Every proposed item is individually editable and
// removable, low-confidence dates are shown as suggestions, rows can be
// reordered, and nothing reaches the user's lists until they save.

interface Row {
  key: string;
  kind: ItemKind;
  title: string;
  /** <input type="datetime-local"> value in the browser's timezone, or "". */
  dueLocal: string;
  /** Null once the user has set or confirmed the date themselves. */
  dueConfidence: number | null;
  dueSource: string | null;
  frequency: "daily" | "weekly" | "monthly";
  timesPerPeriod: number;
  estimatedMinutes: string;
  project: string;
  importance: string;
}

const SECTIONS: Array<{ kind: ItemKind; heading: string; hint: string }> = [
  { kind: "task", heading: "Tasks", hint: "Single actions. These go on your list." },
  {
    kind: "project",
    heading: "Projects",
    hint: "Multi-step work. Saved as projects to break down later.",
  },
  { kind: "goal", heading: "Goals", hint: "Longer-term outcomes." },
  { kind: "recurring", heading: "Habits", hint: "Repeating commitments." },
  {
    kind: "note",
    heading: "Notes",
    hint: "Thoughts, not commitments. They stay with this Brain Dump unless you change them to a task.",
  },
];

const KIND_LABELS: Record<ItemKind, string> = {
  task: "Task",
  project: "Project",
  goal: "Goal",
  recurring: "Habit",
  note: "Note",
};

const pad = (n: number) => String(n).padStart(2, "0");

function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toRows(proposal: ExtractionProposal): Row[] {
  return proposal.items.map((item, i) => ({
    key: `item-${i}`,
    kind: item.kind,
    title: item.title,
    dueLocal: item.deadline ? isoToLocalInput(item.deadline.at) : "",
    dueConfidence: item.deadline?.confidence ?? null,
    dueSource: item.deadline?.source ?? null,
    frequency: item.recurrence?.frequency ?? "weekly",
    timesPerPeriod: item.recurrence?.timesPerPeriod ?? 1,
    estimatedMinutes: item.estimatedMinutes ? String(item.estimatedMinutes) : "",
    project: item.project ?? "",
    importance: "",
  }));
}

function toCommitItems(rows: Row[]) {
  return rows.map((row) => ({
    kind: row.kind,
    title: row.title.trim(),
    dueAt: row.dueLocal && row.kind !== "note" ? new Date(row.dueLocal).toISOString() : null,
    recurrence:
      row.kind === "recurring"
        ? { frequency: row.frequency, timesPerPeriod: row.timesPerPeriod }
        : null,
    estimatedMinutes:
      row.kind === "task" && row.estimatedMinutes ? Number(row.estimatedMinutes) : null,
    project: row.project.trim() || null,
    importance: row.kind === "task" && row.importance ? Number(row.importance) : null,
  }));
}

export interface ExtractionReviewProps {
  dumpId: string | null;
  rawText: string;
  proposal: ExtractionProposal;
  fallbackReason: OrganiseFailure | null;
  existingProjects: string[];
}

export function ExtractionReview({
  dumpId,
  rawText,
  proposal,
  fallbackReason,
  existingProjects,
}: ExtractionReviewProps) {
  const [rows, setRows] = useState<Row[]>(() => toRows(proposal));
  const [nextKey, setNextKey] = useState(proposal.items.length);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<CommitSummary | null>(null);
  const [splitting, setSplitting] = useState<string | null>(null);
  const [splitKeys, setSplitKeys] = useState<string[]>([]);
  const [splitName, setSplitName] = useState("");
  const listId = useId();

  const update = (key: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key));

  // Moves a row past its neighbour *of the same kind*, since rows are shown grouped.
  const move = (key: string, direction: -1 | 1) =>
    setRows((prev) => {
      const index = prev.findIndex((r) => r.key === key);
      let target = index + direction;
      while (target >= 0 && target < prev.length && prev[target].kind !== prev[index].kind) {
        target += direction;
      }
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        key: `new-${nextKey}`,
        kind: "task",
        title: "",
        dueLocal: "",
        dueConfidence: null,
        dueSource: null,
        frequency: "weekly",
        timesPerPeriod: 1,
        estimatedMinutes: "",
        project: "",
        importance: "",
      },
    ]);
    setNextKey((n) => n + 1);
  };

  const groupings = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const name = row.project.trim();
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()];
  }, [rows]);

  // Renaming a group to an existing name merges the two.
  const renameGroup = (from: string, to: string) =>
    setRows((prev) =>
      prev.map((r) => (r.project.trim() === from ? { ...r, project: to.trim() } : r))
    );

  const blankTitles = rows.some((r) => !r.title.trim());

  async function save() {
    setSaving(true);
    setError(null);
    const result = await commitBrainDump({
      dumpId,
      rawText,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      items: toCommitItems(rows),
    }).catch(() => ({
      ok: false as const,
      message:
        "Couldn't reach TaskMaster. Your review is still here — try again when you're back online.",
    }));
    setSaving(false);
    if (result.ok) setSaved(result.summary);
    else setError(result.message);
  }

  if (saved) {
    const parts = [
      [saved.tasks, "task"],
      [saved.projects, "project"],
      [saved.goals, "goal"],
      [saved.habits, "habit"],
    ]
      .filter(([n]) => (n as number) > 0)
      .map(([n, word]) => `${n} ${word}${n === 1 ? "" : "s"}`);
    return (
      <section aria-live="polite">
        <h2>Saved</h2>
        <p className="section-note">
          Added {parts.length ? parts.join(", ") : "nothing new"}
          {saved.notes > 0
            ? `, and kept ${saved.notes} note${saved.notes === 1 ? "" : "s"} with this Brain Dump`
            : ""}
          .
        </p>
        <div className="button-row">
          <Link href="/" className="btn btn-primary">
            See what to do next
          </Link>
          <Link href="/projects" className="btn btn-secondary">
            View all tasks
          </Link>
        </div>
      </section>
    );
  }

  const engineNotice =
    proposal.engine === "ai"
      ? "Organised by AI. Check it before you save — you have the final say."
      : fallbackReason
        ? FALLBACK_MESSAGES[fallbackReason]
        : "Organised by TaskMaster's built-in rules.";

  return (
    <section id="review">
      <h2>Review before you save</h2>
      <p className="notice" role="status">
        {engineNotice}
      </p>

      <datalist id={listId}>
        {[...new Set([...existingProjects, ...groupings.map(([name]) => name)])].map(
          (name) => (
            <option key={name} value={name} />
          )
        )}
      </datalist>

      {groupings.length > 0 && (
        <div className="review-groupings">
          <h3>Suggested groupings</h3>
          <p className="section-note">
            Rename to tidy up, rename to an existing one to merge, or clear.
          </p>
          <ul className="review-list">
            {groupings.map(([name, count]) => (
              <li className="review-item" key={name}>
                <Input
                  aria-label={`Rename grouping ${name}`}
                  defaultValue={name}
                  list={listId}
                  onBlur={(e) => e.target.value.trim() && renameGroup(name, e.target.value)}
                />
                <span className="review-count">{count}</span>
                {count > 1 && (
                  <button
                    type="button"
                    className="review-item-remove"
                    onClick={() => {
                      setSplitting(name);
                      setSplitKeys([]);
                      setSplitName("");
                    }}
                  >
                    Split
                  </button>
                )}
                <button
                  type="button"
                  className="review-item-remove"
                  onClick={() => renameGroup(name, "")}
                >
                  Clear
                </button>
              </li>
            ))}
          </ul>
          {splitting && (
            <div className="review-group">
              <h3>Split {splitting}</h3>
              <p className="field-hint">Select the items to move into a separate group.</p>
              {rows
                .filter((row) => row.project.trim() === splitting)
                .map((row) => (
                  <label key={row.key} style={{ display: "block" }}>
                    <input
                      type="checkbox"
                      checked={splitKeys.includes(row.key)}
                      onChange={(event) =>
                        setSplitKeys((keys) =>
                          event.target.checked
                            ? [...keys, row.key]
                            : keys.filter((key) => key !== row.key)
                        )
                      }
                    />{" "}
                    {row.title}
                  </label>
                ))}
              <Input
                aria-label="New group name"
                value={splitName}
                onChange={(event) => setSplitName(event.target.value)}
                maxLength={200}
              />
              <div className="button-row">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={
                    !splitName.trim() ||
                    splitName.trim() === splitting ||
                    splitKeys.length === 0 ||
                    splitKeys.length ===
                      rows.filter((row) => row.project.trim() === splitting).length
                  }
                  onClick={() => {
                    setRows((previous) =>
                      previous.map((row) =>
                        splitKeys.includes(row.key)
                          ? { ...row, project: splitName.trim() }
                          : row
                      )
                    );
                    setSplitting(null);
                  }}
                >
                  Split group
                </Button>
                <Button type="button" variant="secondary" onClick={() => setSplitting(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {rows.length === 0 && (
        <p className="empty-state-description">
          Nothing left to save. Add an item, or go back.
        </p>
      )}

      {SECTIONS.map(({ kind, heading, hint }) => {
        const sectionRows = rows.filter((r) => r.kind === kind);
        if (sectionRows.length === 0) return null;
        return (
          <div className="review-group" key={kind}>
            <h3>
              {heading} <span className="review-count">{sectionRows.length}</span>
            </h3>
            <p className="section-note">{hint}</p>
            <ul className="review-list">
              {sectionRows.map((row) => {
                const suggested =
                  row.dueConfidence !== null && row.dueConfidence < LOW_CONFIDENCE;
                const label = row.title || "new item";
                return (
                  <li className="review-row" key={row.key}>
                    <div className="review-row-main">
                      <Input
                        aria-label={`Title for ${label}`}
                        value={row.title}
                        placeholder="What needs doing?"
                        onChange={(e) => update(row.key, { title: e.target.value })}
                      />
                      <Select
                        aria-label={`Type of ${label}`}
                        value={row.kind}
                        onChange={(e) => update(row.key, { kind: e.target.value as ItemKind })}
                      >
                        {Object.entries(KIND_LABELS).map(([value, text]) => (
                          <option key={value} value={value}>
                            {text}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="review-row-fields">
                      {row.kind !== "note" && row.kind !== "recurring" && (
                        <label className="review-field">
                          <span>
                            {row.kind === "goal" ? "Target" : "Due"}
                            {suggested && (
                              <span title={`Read from "${row.dueSource}" — check it`}>
                                {" "}
                                <Badge tone="ai">Suggested</Badge>
                              </span>
                            )}
                          </span>
                          <Input
                            type="datetime-local"
                            value={row.dueLocal}
                            onChange={(e) =>
                              update(row.key, {
                                dueLocal: e.target.value,
                                dueConfidence: null,
                              })
                            }
                          />
                        </label>
                      )}

                      {row.kind === "recurring" && (
                        <label className="review-field">
                          <span>How often</span>
                          <span className="review-cadence">
                            <Input
                              type="number"
                              min={1}
                              max={31}
                              aria-label={`Times per period for ${label}`}
                              value={row.timesPerPeriod}
                              onChange={(e) =>
                                update(row.key, {
                                  timesPerPeriod: Math.max(1, Number(e.target.value) || 1),
                                })
                              }
                            />
                            <span>× a</span>
                            <Select
                              aria-label={`Period for ${label}`}
                              value={row.frequency}
                              onChange={(e) =>
                                update(row.key, {
                                  frequency: e.target.value as Row["frequency"],
                                })
                              }
                            >
                              <option value="daily">day</option>
                              <option value="weekly">week</option>
                              <option value="monthly">month</option>
                            </Select>
                          </span>
                        </label>
                      )}

                      {row.kind === "task" && (
                        <>
                          <label className="review-field">
                            <span>Importance</span>
                            <Select
                              value={row.importance}
                              onChange={(e) => update(row.key, { importance: e.target.value })}
                            >
                              <option value="">—</option>
                              <option value="5">5 · Critical</option>
                              <option value="4">4 · Important</option>
                              <option value="3">3 · Normal</option>
                              <option value="2">2 · Minor</option>
                              <option value="1">1 · Trivial</option>
                            </Select>
                          </label>
                          <label className="review-field">
                            <span>Minutes</span>
                            <Input
                              type="number"
                              min={1}
                              max={1440}
                              value={row.estimatedMinutes}
                              onChange={(e) =>
                                update(row.key, { estimatedMinutes: e.target.value })
                              }
                            />
                          </label>
                        </>
                      )}

                      {row.kind !== "goal" &&
                        row.kind !== "note" &&
                        row.kind !== "project" && (
                          <label className="review-field">
                            <span>Project</span>
                            <Input
                              list={listId}
                              value={row.project}
                              onChange={(e) => update(row.key, { project: e.target.value })}
                            />
                          </label>
                        )}
                    </div>

                    <div className="review-row-actions">
                      <button
                        type="button"
                        className="review-item-remove"
                        onClick={() => move(row.key, -1)}
                        aria-label={`Move ${label} up`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="review-item-remove"
                        onClick={() => move(row.key, 1)}
                        aria-label={`Move ${label} down`}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="review-item-remove"
                        onClick={() => remove(row.key)}
                        aria-label={`Remove ${label}`}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {error && (
        <p className="notice notice-danger" role="alert">
          {error}
        </p>
      )}

      <div className="button-row" style={{ marginTop: "1.5rem" }}>
        <Button variant="secondary" type="button" onClick={addRow}>
          Add item
        </Button>
        <Button
          type="button"
          onClick={save}
          disabled={saving || rows.length === 0 || blankTitles}
        >
          {saving ? "Saving…" : `Save ${rows.length} item${rows.length === 1 ? "" : "s"}`}
        </Button>
      </div>
      {blankTitles && (
        <p className="field-hint">Every item needs a title before you can save.</p>
      )}
    </section>
  );
}
