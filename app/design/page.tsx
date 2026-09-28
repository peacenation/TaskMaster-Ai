"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Chip,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Skeleton,
  Textarea,
  Toast,
} from "@/components/ui";
import { contrastRatio, parseRgb, type Rgb } from "@/lib/contrast";

type Theme = "system" | "light" | "dark";

const COLOR_TOKENS: { name: string; varName: string }[] = [
  { name: "surface-page", varName: "--surface-page" },
  { name: "surface-card", varName: "--surface-card" },
  { name: "surface-sunken", varName: "--surface-sunken" },
  { name: "text-primary", varName: "--text-primary" },
  { name: "text-muted", varName: "--text-muted" },
  { name: "text-subtle", varName: "--text-subtle" },
  { name: "action-primary", varName: "--action-primary" },
  { name: "ai-suggestion-border", varName: "--ai-suggestion-border" },
  { name: "danger", varName: "--danger" },
  { name: "success", varName: "--success" },
  { name: "border-strong", varName: "--border-strong" },
];

type AuditRequirement = "text" | "ui";

const AUDIT_PAIRS: {
  label: string;
  fg: string;
  bg: string;
  requirement: AuditRequirement;
}[] = [
  {
    label: "text-primary on surface-page",
    fg: "--text-primary",
    bg: "--surface-page",
    requirement: "text",
  },
  {
    label: "text-muted on surface-page",
    fg: "--text-muted",
    bg: "--surface-page",
    requirement: "text",
  },
  {
    label: "text-subtle on surface-page",
    fg: "--text-subtle",
    bg: "--surface-page",
    requirement: "text",
  },
  {
    label: "text-on-action on action-primary (Button)",
    fg: "--text-on-action",
    bg: "--action-primary",
    requirement: "text",
  },
  {
    label: "action-primary on surface-page (eyebrow)",
    fg: "--action-primary",
    bg: "--surface-page",
    requirement: "text",
  },
  {
    label: "ai-suggestion-text on ai-suggestion-bg",
    fg: "--ai-suggestion-text",
    bg: "--ai-suggestion-bg",
    requirement: "text",
  },
  {
    label: "danger on surface-card",
    fg: "--danger",
    bg: "--surface-card",
    requirement: "text",
  },
  {
    label: "success on surface-card",
    fg: "--success",
    bg: "--surface-card",
    requirement: "text",
  },
  {
    label: "border-strong on surface-card (Input/Button boundary)",
    fg: "--border-strong",
    bg: "--surface-card",
    requirement: "ui",
  },
  {
    label: "focus-ring on surface-page",
    fg: "--focus-ring",
    bg: "--surface-page",
    requirement: "ui",
  },
];

function resolveVarColor(varName: string): Rgb | null {
  const probe = document.createElement("div");
  probe.style.color = `var(${varName})`;
  probe.style.position = "absolute";
  probe.style.opacity = "0";
  probe.style.pointerEvents = "none";
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  document.body.removeChild(probe);
  return parseRgb(resolved);
}

interface AuditRow {
  label: string;
  fgRgb: string;
  bgRgb: string;
  ratio: number;
  requirement: AuditRequirement;
  threshold: number;
  pass: boolean;
}

export default function DesignSystemPage() {
  const [theme, setTheme] = useState<Theme>("system");
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(true);

  useEffect(() => {
    if (theme === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [theme]);

  useEffect(() => {
    const rows: AuditRow[] = AUDIT_PAIRS.map((pair) => {
      const fg = resolveVarColor(pair.fg);
      const bg = resolveVarColor(pair.bg);
      const ratio = fg && bg ? contrastRatio(fg, bg) : 0;
      const threshold = pair.requirement === "text" ? 4.5 : 3;
      return {
        label: pair.label,
        fgRgb: fg ? `rgb(${fg.join(",")})` : "?",
        bgRgb: bg ? `rgb(${bg.join(",")})` : "?",
        ratio,
        requirement: pair.requirement,
        threshold,
        pass: ratio >= threshold,
      };
    });
    // Syncing from an external system (resolved CSS custom properties can
    // only be read from the DOM after the theme-toggle effect above has
    // applied), not derivable during render — re-runs whenever the theme
    // toggle changes what the tokens resolve to.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAuditRows(rows);
  }, [theme]);

  return (
    <div className="wrap wrap-wide">
      <header className="hero">
        <p className="eyebrow">Design System — Phase 1</p>
        <h1>TaskMaster</h1>
        <p>
          Every token and primitive, rendered live from the same CSS custom properties the app
          uses — not a static screenshot. See PRD_v2.md §2.8 and docs/DESIGN_SYSTEM.md.
        </p>
        <div className="button-row" style={{ marginTop: "1rem" }}>
          {(["system", "light", "dark"] as Theme[]).map((t) => (
            <Button
              key={t}
              variant={theme === t ? "primary" : "secondary"}
              onClick={() => setTheme(t)}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </Button>
          ))}
        </div>
      </header>

      <section id="colors">
        <h2>Colour</h2>
        <p className="section-note">
          Semantic tokens. Values update with the theme toggle above.
        </p>
        <div className="swatch-grid">
          {COLOR_TOKENS.map((token) => (
            <div className="swatch" key={token.name}>
              <div className="swatch-color" style={{ background: `var(${token.varName})` }} />
              <div className="swatch-label">
                <span className="swatch-name">{token.name}</span>
                <span className="swatch-value">{token.varName}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="typography">
        <h2>Typography</h2>
        <p className="section-note">Mobile-first scale, system font stack.</p>
        <div className="type-row">
          <span className="type-token">--text-3xl / 700</span>
          <span className="type-sample-3xl">Turn mental clutter into clear action</span>
        </div>
        <div className="type-row">
          <span className="type-token">--text-2xl / 700</span>
          <span className="type-sample-2xl">Today</span>
        </div>
        <div className="type-row">
          <span className="type-token">--text-xl / 700</span>
          <span className="type-sample-xl">Next Best Action</span>
        </div>
        <div className="type-row">
          <span className="type-token">--text-lg / 600</span>
          <span className="type-sample-lg">Finish the client proposal draft</span>
        </div>
        <div className="type-row">
          <span className="type-token">--text-base / 400</span>
          <span className="type-sample-base">
            It&apos;s due tomorrow, marked important, and two other tasks depend on it.
          </span>
        </div>
        <div className="type-row">
          <span className="type-token">--text-sm / 400</span>
          <span className="type-sample-sm">Estimated 45 min · Deep work</span>
        </div>
        <div className="type-row">
          <span className="type-token">--text-xs / 400</span>
          <span className="type-sample-xs">Updated 2 minutes ago</span>
        </div>
      </section>

      <section id="buttons">
        <h2>Button</h2>
        <p className="section-note">
          One obvious primary action per screen. Destructive actions never styled as primary.
        </p>
        <div className="button-row">
          <Button variant="primary">Build My Plan</Button>
          <Button variant="secondary">Not now</Button>
          <Button variant="danger">Delete task</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
      </section>

      <section id="inputs">
        <h2>Input, Textarea, Select, Field</h2>
        <p className="section-note">
          Brain Dump composer and Quick Add reuse these directly — see app/page.tsx.
        </p>
        <Field label="Quick Add" htmlFor="demo-input" hint="Fast natural-language entry.">
          <Input id="demo-input" placeholder="Call John tomorrow at 2pm" />
        </Field>
        <Field label="Brain Dump" htmlFor="demo-textarea">
          <Textarea id="demo-textarea" placeholder="Add work, personal tasks, deadlines..." />
        </Field>
        <Field label="Energy required" htmlFor="demo-select">
          <Select id="demo-select" defaultValue="medium">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
        </Field>
      </section>

      <section id="cards">
        <h2>Card — AI suggestion vs. confirmed</h2>
        <p className="section-note">
          PRD_v2.md §2.8 requires these to read as unmistakably different, not just a subtle
          colour shift.
        </p>
        <div
          className="card-row"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}
        >
          <Card
            variant="ai"
            kicker="Suggested by TaskMaster"
            title="Finish the client proposal draft"
          >
            <p className="card-reason">
              Due tomorrow, marked important, and two other tasks depend on it.
            </p>
          </Card>
          <Card variant="confirmed" kicker="✓ In your plan" title="Pay the electricity bill">
            <p className="card-reason">Scheduled for today · confirmed by you</p>
          </Card>
        </div>
      </section>

      <section id="badges-chips">
        <h2>Badge &amp; Chip</h2>
        <div className="button-row">
          <Badge tone="neutral">Neutral</Badge>
          <Badge tone="ai">AI suggested</Badge>
          <Badge tone="success">Confirmed</Badge>
          <Badge tone="danger">Overdue</Badge>
        </div>
        <div className="button-row" style={{ marginTop: "1rem" }}>
          <Chip onRemove={() => {}}>Work</Chip>
          <Chip onRemove={() => {}}>Home</Chip>
          <Chip>Not removable</Chip>
        </div>
      </section>

      <section id="empty-skeleton">
        <h2>EmptyState &amp; Skeleton</h2>
        <EmptyState
          title="Nothing queued"
          description="Add something with Quick Add, or start a new Brain Dump."
        />
        <div
          style={{
            marginTop: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            maxWidth: 320,
          }}
        >
          <Skeleton height="1.25rem" width="70%" />
          <Skeleton height="1rem" width="100%" />
          <Skeleton height="1rem" width="90%" />
        </div>
      </section>

      <section id="modal-toast">
        <h2>Modal, ConfirmDialog &amp; Toast</h2>
        <div className="button-row">
          <Button variant="secondary" onClick={() => setModalOpen(true)}>
            Open Modal
          </Button>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Delete with confirmation
          </Button>
          {!toastVisible && (
            <Button variant="secondary" onClick={() => setToastVisible(true)}>
              Show Toast again
            </Button>
          )}
        </div>
        {toastVisible && (
          <div style={{ marginTop: "1rem" }}>
            <Toast tone="success" onDismiss={() => setToastVisible(false)}>
              Task completed. Plan updated.
            </Toast>
          </div>
        )}
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Example modal"
          description="Escape or a click on the backdrop closes this."
        >
          <Button variant="primary" onClick={() => setModalOpen(false)}>
            Close
          </Button>
        </Modal>
        <ConfirmDialog
          open={confirmOpen}
          title="Delete this task?"
          description="This can't be undone."
          confirmLabel="Delete"
          danger
          onConfirm={() => setConfirmOpen(false)}
          onCancel={() => setConfirmOpen(false)}
        />
      </section>

      <section id="contrast-audit">
        <h2>Contrast audit</h2>
        <p className="section-note">
          Computed live from the resolved CSS custom properties for the theme selected above —
          not a hardcoded snapshot. Text pairs require 4.5:1 (WCAG 2.1 AA normal text);
          non-text UI boundaries (borders, focus rings) require 3:1 (WCAG 1.4.11).
        </p>
        <table className="audit-table">
          <thead>
            <tr>
              <th>Pair</th>
              <th>Swatches</th>
              <th>Ratio</th>
              <th>Required</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {auditRows.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>
                  <span className="audit-swatch-pair">
                    <span style={{ background: row.fgRgb }} />
                    <span style={{ background: row.bgRgb }} />
                  </span>
                </td>
                <td>{row.ratio.toFixed(2)}:1</td>
                <td>
                  {row.threshold}:1 {row.requirement === "text" ? "(text)" : "(UI)"}
                </td>
                <td>
                  <Badge tone={row.pass ? "success" : "danger"}>
                    {row.pass ? "Pass" : "Fail"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
