"use client";

import { useActionState, useState, type ReactNode } from "react";
import { savePreferences } from "@/app/actions/account";
import { Button, Input, Select } from "@/components/ui";

const FORM_ID = "preferences-form";

export interface Preferences {
  timezone: string;
  dayMinutes: number;
  planMode: "flexible" | "scheduled";
  notifications: "off" | "important";
}

function capacity(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = h === 1 ? "1 hour" : `${h} hours`;
  if (!m) return `${hours} per day`;
  return h ? `${hours} ${m} minutes per day` : `${m} minutes per day`;
}

// Planning preferences: time and availability, plan view and notifications,
// saved together from the bar at the foot. [calendar] sits between them, as
// its own form, on the Planning page. With [only] = "notifications" just
// that card is shown and saved; fields not shown keep their values.
export function PreferencesForm({
  initial,
  timezones,
  calendar,
  only,
}: {
  initial: Preferences;
  timezones: string[];
  calendar?: ReactNode;
  only?: "notifications";
}) {
  const [state, action, pending] = useActionState(savePreferences, {});
  const [hours, setHours] = useState(Math.floor(initial.dayMinutes / 60));
  const [minutes, setMinutes] = useState(initial.dayMinutes % 60);
  // Cancel puts every field back as it was loaded.
  const [version, setVersion] = useState(0);
  const total = hours * 60 + minutes;
  const showTime = only !== "notifications";

  return (
    <>
      <form id={FORM_ID} action={action} key={version}>
        {showTime && (
          <section className="settings-card" aria-labelledby="time-heading">
            <h3 id="time-heading">Time &amp; availability</h3>
            <p className="settings-card-lede">
              Set the defaults used to build your daily plan.
            </p>

            <div className="settings-row">
              <label className="settings-row-label" htmlFor="timezone">
                Timezone
              </label>
              <div className="settings-row-control">
                <Select id="timezone" name="timezone" defaultValue={initial.timezone}>
                  {timezones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone.replaceAll("_", " ")}
                    </option>
                  ))}
                </Select>
                <p className="field-hint">Times follow your local timezone.</p>
              </div>
            </div>

            <div className="settings-row" role="group" aria-labelledby="availability-label">
              <p className="settings-row-label" id="availability-label">
                Daily availability
              </p>
              <div className="settings-row-control">
                <div className="settings-duration">
                  <Input
                    id="day-hours"
                    type="number"
                    min={0}
                    max={24}
                    value={hours}
                    aria-label="Hours"
                    onChange={(e) =>
                      setHours(Math.max(0, Math.min(24, Number(e.target.value))))
                    }
                  />
                  <span aria-hidden="true">hours</span>
                  <Input
                    id="day-minutes"
                    type="number"
                    min={0}
                    max={55}
                    step={5}
                    value={String(minutes).padStart(2, "0")}
                    aria-label="Minutes"
                    onChange={(e) =>
                      setMinutes(Math.max(0, Math.min(59, Number(e.target.value))))
                    }
                  />
                  <span aria-hidden="true">minutes</span>
                </div>
                <input type="hidden" name="dayMinutes" value={total} />
                <p className="field-hint" aria-live="polite">
                  {total > 0
                    ? `Your default planning capacity is ${capacity(total)}.`
                    : "Set at least a few minutes so there's room to plan."}
                </p>
              </div>
            </div>

            <div className="settings-row">
              <p className="settings-row-label" id="plan-view-label">
                Default plan view
              </p>
              <div
                className="settings-row-control settings-choices"
                role="radiogroup"
                aria-labelledby="plan-view-label"
              >
                {(
                  [
                    ["flexible", "Flexible"],
                    ["scheduled", "Scheduled"],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="settings-choice">
                    <input
                      type="radio"
                      name="planMode"
                      value={value}
                      defaultChecked={initial.planMode === value}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>
        )}
      </form>

      {calendar}

      <section className="settings-card" aria-labelledby="notifications-heading">
        <h3 id="notifications-heading">
          Notifications <span className="settings-pill">Coming soon</span>
        </h3>
        <p className="settings-card-lede">
          Notification delivery on the web isn’t available yet. The phone app already reminds
          you before planned blocks.
        </p>
        <label className="sr-only" htmlFor="notifications">
          Notifications
        </label>
        <Select
          key={version}
          id="notifications"
          name="notifications"
          form={FORM_ID}
          defaultValue={initial.notifications}
        >
          <option value="off">Off</option>
          <option value="important">Important updates only</option>
        </Select>
        <p className="field-hint">
          Your preference will be saved for when notifications launch.
        </p>
      </section>

      <div className="settings-savebar">
        <p role="status">{state.message ?? "Changes apply to future daily plans."}</p>
        <div className="settings-savebar-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setHours(Math.floor(initial.dayMinutes / 60));
              setMinutes(initial.dayMinutes % 60);
              setVersion((v) => v + 1);
            }}
          >
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={pending || (showTime && total < 1)}>
            {pending ? "Saving…" : "Save preferences"}
          </Button>
        </div>
      </div>
    </>
  );
}
