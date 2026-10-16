"use client";

import { useActionState, useState } from "react";
import {
  connectCalendar,
  disconnectCalendar,
  type CalendarFormState,
} from "@/app/actions/calendar";
import { Button, Input } from "@/components/ui";
import { EyeIcon, EyeOffIcon } from "@/components/shell/icons";

export interface ConnectedCalendar {
  id: string;
  label: string;
  error: string | null;
}

const PROVIDERS = [
  {
    name: "Google Calendar",
    mark: "31",
    color: "#1a73e8",
    steps: "Settings › your calendar › Integrate calendar › Secret address in iCal format.",
  },
  {
    name: "Outlook",
    mark: "O",
    color: "#0f6cbd",
    steps: "Settings › Calendar › Shared calendars › Publish a calendar › ICS link.",
  },
  {
    name: "Apple Calendar",
    mark: "17",
    color: "#c4302b",
    steps: "Calendar on iCloud.com › Share › Public calendar › copy the link.",
  },
];

// Calendar integration (PRD §4.1): paste a private iCal address and Today
// plans around your meetings. No address is ever shown back.
export function CalendarSettings({ calendars }: { calendars: ConnectedCalendar[] }) {
  const [state, action, pending] = useActionState<CalendarFormState, FormData>(
    connectCalendar,
    {}
  );
  const [shown, setShown] = useState(false);
  return (
    <section className="settings-card" aria-labelledby="calendar-heading">
      <h3 id="calendar-heading">
        Calendar connection <span className="settings-pill">Read-only</span>
      </h3>
      <p className="settings-card-lede">
        Plan tasks around meetings. Your calendar is never changed.
      </p>

      {calendars.length > 0 && (
        <ul className="settings-list">
          {calendars.map((calendar) => (
            <li key={calendar.id}>
              <span>
                <strong>{calendar.label}</strong>
                <span className={calendar.error ? "settings-list-error" : "field-hint"}>
                  {calendar.error ?? "Connected"}
                </span>
              </span>
              <form action={disconnectCalendar.bind(null, calendar.id)}>
                <Button type="submit" variant="secondary" className="btn-sm">
                  Disconnect
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={action}>
        <label className="field-label settings-inline-label" htmlFor="calendar-url">
          Private iCal address
        </label>
        <div className="settings-secret">
          <Input
            id="calendar-url"
            name="url"
            type={shown ? "url" : "password"}
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
            required
          />
          <button
            type="button"
            className="settings-secret-toggle"
            aria-label={shown ? "Hide address" : "Show address"}
            aria-pressed={shown}
            onClick={() => setShown((s) => !s)}
          >
            {shown ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
          </button>
        </div>

        <ul className="settings-providers" aria-label="Works with">
          {PROVIDERS.map((p) => (
            <li key={p.name}>
              <span
                className="settings-provider-mark"
                style={{ background: p.color }}
                aria-hidden="true"
              >
                {p.mark}
              </span>
              {p.name}
            </li>
          ))}
        </ul>

        <details className="settings-help">
          <summary>Where do I find my calendar link?</summary>
          <dl>
            {PROVIDERS.map((p) => (
              <div key={p.name}>
                <dt>{p.name}</dt>
                <dd>{p.steps}</dd>
              </div>
            ))}
          </dl>
          <p className="field-hint">
            Use the private (secret) address, so only you can read it. It’s stored encrypted.
          </p>
        </details>

        {state.message && (
          <p className={state.ok ? "notice" : "notice notice-danger"} role="status">
            {state.message}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Connecting…" : "Connect calendar"}
        </Button>
      </form>
    </section>
  );
}
