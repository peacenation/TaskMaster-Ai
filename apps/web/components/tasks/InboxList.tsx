"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { organiseInbox } from "@/app/actions/tasks";
import { Button, Input } from "@/components/ui";

// The Inbox's batch "organise these" path (Phase 5 work item 8): pick
// captured items, optionally give them a project, move them onto the list.

export interface InboxItem {
  id: string;
  title: string;
  due: string | null;
}

export function InboxList({ items, projects }: { items: InboxItem[]; projects: string[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [project, setProject] = useState("");
  const [busy, setBusy] = useState(false);
  const listId = useId();

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = selected.size === items.length;

  async function organise() {
    setBusy(true);
    await organiseInbox({ ids: [...selected], project: project.trim() || null });
    setSelected(new Set());
    setProject("");
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <label className="inbox-select-all">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={() =>
            setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))
          }
        />{" "}
        Select all
      </label>
      <ul className="review-list">
        {items.map((item) => (
          <li className="review-item" key={item.id}>
            <input
              type="checkbox"
              checked={selected.has(item.id)}
              onChange={() => toggle(item.id)}
              aria-label={`Select "${item.title}"`}
            />
            <span className="review-item-text">
              <Link href={`/tasks/${item.id}`}>{item.title}</Link>
              {item.due && <span className="field-hint"> · due {item.due}</span>}
            </span>
          </li>
        ))}
      </ul>
      <div className="inbox-actions">
        <Input
          aria-label="Project for selected items (optional)"
          placeholder="Project (optional)"
          list={listId}
          value={project}
          onChange={(e) => setProject(e.target.value)}
        />
        <datalist id={listId}>
          {projects.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <Button onClick={organise} disabled={busy || selected.size === 0}>
          {busy ? "Moving…" : `Move ${selected.size || ""} to my list`}
        </Button>
      </div>
    </div>
  );
}
