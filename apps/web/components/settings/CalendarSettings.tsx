"use client";

import { useActionState } from "react";
import {
  connectCalendar,
  disconnectCalendar,
  type CalendarFormState,
} from "@/app/actions/calendar";
import { Button, Field, Input } from "@/components/ui";

export interface ConnectedCalendar {
  id: string;
  label: string;
  error: string | null;
}

// Calendar integration (PRD §4.1): paste a private iCal address and Today
// plans around your meetings. No address is ever shown back.
export function CalendarSettings({ calendars }: { calendars: ConnectedCalendar[] }) {
  const [state, action, pending] = useActionState<CalendarFormState, FormData>(
    connectCalendar,
    {}
  );
  return (
    <section aria-labelledby="calendar-heading">
      <h2 id="calendar-heading">Calendar</h2>
      <p className="field-hint">
        Today plans around your meetings: their time comes out of your day and work is
        scheduled between them. TaskMasterAi only reads your calendar.
      </p>
      {calendars.length > 0 && (
        <ul className="review-list">
          {calendars.map((calendar) => (
            <li className="review-item" key={calendar.id}>
              <span className="review-item-text">
                <strong>{calendar.label}</strong>
                {calendar.error && <span className="field-hint"> · {calendar.error}</span>}
              </span>
              <form action={disconnectCalendar.bind(null, calendar.id)}>
                <Button type="submit" variant="secondary">
                  Disconnect
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <form action={action} className="auth-form">
        <Field
          label="Private iCal address"
          htmlFor="calendar-url"
          hint="Google Calendar: Settings › your calendar › Integrate calendar › Secret address in iCal format. Outlook: Settings › Calendar › Shared calendars › Publish › ICS. Apple: Calendar › Share › Public calendar."
        >
          <Input
            id="calendar-url"
            name="url"
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
            required
          />
        </Field>
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
