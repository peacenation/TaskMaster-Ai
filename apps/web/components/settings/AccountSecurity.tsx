"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { usePageRestore } from "@/lib/auth/use-page-restore";
import { Button, Field, Input } from "@/components/ui";

/**
 * Connecting Google and re-confirming with Google both leave for Google and
 * come back to [returnTo]. Errors from the return arrive as `?error=`.
 */
function useGoogle(returnTo: string, linkError?: string) {
  const [error, setError] = useState(
    linkError === "identity_already_exists"
      ? "That Google account is already connected to a different TaskMasterAi account."
      : linkError === "access_denied"
        ? "Google sign-in was cancelled."
        : linkError
          ? "Google didn't finish connecting. Try again."
          : ""
  );
  const [pending, setPending] = useState(false);
  usePageRestore(useCallback(() => setPending(false), []));
  async function go(intent: "link" | "confirm") {
    setPending(true);
    setError("");
    const options = {
      redirectTo: `${window.location.origin}/auth/callback?next=${returnTo}`,
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
      setError("Could not reach Google. Try again.");
      setPending(false);
    }
  }
  return { error, pending, go };
}

export function SignInMethods({
  hasPassword,
  googleEnabled,
  googleLinked,
  linkError,
}: {
  hasPassword: boolean;
  googleEnabled: boolean;
  googleLinked: boolean;
  /** `?error=` from a failed Google redirect. */
  linkError?: string;
}) {
  const google = useGoogle("/settings/security", linkError);
  return (
    <section className="settings-card" aria-labelledby="methods-heading">
      <h3 id="methods-heading">Sign-in methods</h3>
      <p className="settings-card-lede">The ways you can sign in to TaskMasterAi.</p>
      <ul className="settings-list">
        <li>
          <span>
            <strong>Password</strong>
            <span className="field-hint">{hasPassword ? "Set" : "Not set"}</span>
          </span>
          <Link className="btn btn-secondary btn-sm" href="/reset">
            {hasPassword ? "Reset password" : "Add a password"}
          </Link>
        </li>
        {googleEnabled && (
          <li>
            <span>
              <strong>Google</strong>
              <span className="field-hint">
                {googleLinked ? "Connected" : "Not connected"}
              </span>
            </span>
            {!googleLinked && (
              <Button
                variant="secondary"
                className="btn-sm"
                disabled={google.pending}
                onClick={() => google.go("link")}
              >
                Connect Google
              </Button>
            )}
          </li>
        )}
      </ul>
      {google.error && (
        <p className="notice notice-danger" role="alert">
          {google.error}
        </p>
      )}
    </section>
  );
}

export function DeleteAccount({
  hasPassword,
  recentSignIn,
  linkError,
}: {
  hasPassword: boolean;
  /** Signed in within the re-auth window (lib/auth/reauth.ts). */
  recentSignIn: boolean;
  linkError?: string;
}) {
  const google = useGoogle("/settings/data", linkError);
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const canDelete = confirmation === "DELETE" && (hasPassword ? !!password : recentSignIn);
  return (
    <section className="settings-card settings-danger" aria-labelledby="delete-heading">
      <h3 id="delete-heading">Delete your account</h3>
      <p className="settings-card-lede">
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
            Your account uses Google sign-in. For your security, confirm with Google first — it
            brings you back here.
          </p>
          <Button
            variant="secondary"
            disabled={google.pending}
            onClick={() => google.go("confirm")}
          >
            Confirm with Google
          </Button>
          {google.error && (
            <p className="notice notice-danger" role="alert">
              {google.error}
            </p>
          )}
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
  );
}
