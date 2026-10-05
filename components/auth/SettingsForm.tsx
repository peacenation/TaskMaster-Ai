"use client";
import { useActionState, useState } from "react";
import { savePreferences } from "@/app/actions/account";
import { Button, Field, Input, Select } from "@/components/ui";
import { SignOut } from "./SignOut";
export function SettingsForm({
  timezone,
  preferences,
  email,
}: {
  timezone: string;
  preferences: Record<string, unknown>;
  email: string;
}) {
  const [state, action, pending] = useActionState(savePreferences, {});
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <p>Signed in as {email}</p>
      <form action={action} className="auth-form">
        <Field
          label="Timezone"
          htmlFor="timezone"
          hint="IANA timezone, e.g. Europe/London or America/New_York."
        >
          <Input id="timezone" name="timezone" defaultValue={timezone} required />
        </Field>
        <Field label="Default time available today (minutes)" htmlFor="dayMinutes">
          <Input
            id="dayMinutes"
            name="dayMinutes"
            type="number"
            min={1}
            max={1440}
            defaultValue={Number(preferences.dayMinutes) || 240}
            required
          />
        </Field>
        <Field label="Default plan view" htmlFor="planMode">
          <Select
            id="planMode"
            name="planMode"
            defaultValue={String(preferences.planMode ?? "flexible")}
          >
            <option value="flexible">Flexible</option>
            <option value="scheduled">Scheduled</option>
          </Select>
        </Field>
        <Field
          label="Notifications"
          htmlFor="notifications"
          hint="Preference saved for future notifications. No notifications are sent yet."
        >
          <Select
            id="notifications"
            name="notifications"
            defaultValue={String(preferences.notifications ?? "off")}
          >
            <option value="off">Off</option>
            <option value="important">Important updates only</option>
          </Select>
        </Field>
        <Button type="submit" disabled={pending}>
          Save preferences
        </Button>
        {state.message && <p role="status">{state.message}</p>}
      </form>
      <section>
        <h2>Your data</h2>
        <a href="/api/account/export" className="btn btn-secondary">
          Export my data
        </a>
      </section>
      <section>
        <h2>Session</h2>
        <SignOut />
      </section>
      <section className="danger-zone">
        <h2>Delete your account</h2>
        <p>
          This permanently deletes your account, sessions, tasks, Brain Dumps, plans, projects
          and goals. Export your data first if you want a copy.
        </p>
        <Field label="Type DELETE to confirm" htmlFor="confirmation">
          <Input
            id="confirmation"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </Field>
        <Field label="Current password" htmlFor="delete-password">
          <Input
            id="delete-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button
          variant="danger"
          disabled={deleting || confirmation !== "DELETE" || !password}
          onClick={async () => {
            setDeleting(true);
            setError("");
            try {
              const response = await fetch("/api/account/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ confirmation, password }),
              });
              if (!response.ok) {
                setError("Could not delete your account. Check your password and try again.");
                return;
              }
              for (const key of Object.keys(localStorage))
                if (key.startsWith("taskmaster:timer:")) localStorage.removeItem(key);
              // Full load (see AuthForm): no cached pages outlive the account.
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              window.location.assign("/signup");
            } catch {
              setError("Could not connect. Try again.");
            } finally {
              setDeleting(false);
            }
          }}
        >
          Permanently delete account
        </Button>
        {error && <p role="alert">{error}</p>}
      </section>
    </>
  );
}
