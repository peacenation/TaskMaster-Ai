"use client";
import Link from "next/link";
import { useActionState, useCallback, useState } from "react";
import { savePreferences } from "@/app/actions/account";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { usePageRestore } from "@/lib/auth/use-page-restore";
import { Button, Field, Input, Select } from "@/components/ui";
import { SignOut } from "./SignOut";
export function SettingsForm({
  timezone,
  preferences,
  email,
  hasPassword,
  googleEnabled,
  googleLinked,
  recentSignIn,
  linkError,
}: {
  timezone: string;
  preferences: Record<string, unknown>;
  email: string;
  hasPassword: boolean;
  googleEnabled: boolean;
  googleLinked: boolean;
  /** Signed in within the re-auth window (lib/auth/reauth.ts). */
  recentSignIn: boolean;
  /** `?error=` from a failed Google redirect. */
  linkError?: string;
}) {
  const [state, action, pending] = useActionState(savePreferences, {});
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [googleError, setGoogleError] = useState(
    linkError === "identity_already_exists"
      ? "That Google account is already connected to a different TaskMasterAi account."
      : linkError === "access_denied"
        ? "Google sign-in was cancelled."
        : linkError
          ? "Google didn't finish connecting. Try again."
          : ""
  );
  const [googlePending, setGooglePending] = useState(false);
  usePageRestore(useCallback(() => setGooglePending(false), []));
  // Both connecting and re-confirming go to Google and come back here.
  async function goToGoogle(intent: "link" | "confirm") {
    setGooglePending(true);
    setGoogleError("");
    const options = {
      redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
      queryParams: { prompt: "select_account" },
    };
    try {
      const auth = supabaseBrowser().auth;
      const { error } =
        intent === "link"
          ? await auth.linkIdentity({ provider: "google", options })
          : await auth.signInWithOAuth({ provider: "google", options });
      if (error) throw error;
    } catch {
      setGoogleError("Could not reach Google. Try again.");
      setGooglePending(false);
    }
  }
  const canDelete = confirmation === "DELETE" && (hasPassword ? !!password : recentSignIn);
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
        <p className="field-hint">
          <Link href="/privacy">What TaskMaster stores and where AI is used</Link>
        </p>
      </section>
      {googleEnabled && (
        <section>
          <h2>Sign-in methods</h2>
          <ul className="review-list">
            <li className="review-item">
              <span className="review-item-text">
                <strong>Password</strong>
                <span className="field-hint">
                  {" "}
                  · {hasPassword ? "Set" : "Not set — use Reset password to add one"}
                </span>
              </span>
            </li>
            <li className="review-item">
              <span className="review-item-text">
                <strong>Google</strong>
                <span className="field-hint">
                  {" "}
                  · {googleLinked ? "Connected" : "Not connected"}
                </span>
              </span>
              {!googleLinked && (
                <Button
                  variant="secondary"
                  className="btn-sm"
                  disabled={googlePending}
                  onClick={() => goToGoogle("link")}
                >
                  Connect Google
                </Button>
              )}
            </li>
          </ul>
          {googleError && (
            <p className="notice notice-danger" role="alert">
              {googleError}
            </p>
          )}
        </section>
      )}
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
        {hasPassword ? (
          <Field label="Current password" htmlFor="delete-password">
            <Input
              id="delete-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        ) : recentSignIn ? (
          <p className="field-hint">You confirmed with Google just now.</p>
        ) : (
          <div className="field">
            <p className="field-hint">
              Your account uses Google sign-in. For your security, confirm with Google first —
              it brings you back here.
            </p>
            <Button
              variant="secondary"
              disabled={googlePending}
              onClick={() => goToGoogle("confirm")}
            >
              Confirm with Google
            </Button>
          </div>
        )}
        <Button
          variant="danger"
          disabled={deleting || !canDelete}
          onClick={async () => {
            setDeleting(true);
            setError("");
            try {
              const response = await fetch("/api/account/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                  hasPassword ? { confirmation, password } : { confirmation }
                ),
              });
              if (!response.ok) {
                const body = await response.json().catch(() => null);
                setError(body?.error ?? "Could not delete your account. Try again.");
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
