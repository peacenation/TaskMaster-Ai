"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { usePageRestore } from "@/lib/auth/use-page-restore";
import { Button, Field, Input } from "@/components/ui";

// What comes back in ?error= from Google (via /auth/callback) or an email
// link (via /auth/confirm), in plain English.
const RETURN_ERRORS: Record<string, string> = {
  access_denied: "Google sign-in was cancelled.",
  link_invalid: "That link is invalid or has expired. Request a new one.",
  otp_expired: "That link has expired. Request a new one.",
  email_not_confirmed: "Confirm your email first — check your inbox for the link.",
};

// Supabase Auth error codes worth explaining better than its default text.
function explain(code: string | undefined, fallback: string): string {
  switch (code) {
    case "invalid_credentials":
      return "That email and password don't match an account.";
    case "email_not_confirmed":
      return "Confirm your email first — check your inbox for the link.";
    case "weak_password":
      return "Choose a stronger password: at least 10 characters.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Wait a minute and try again.";
    case "same_password":
      return "Choose a password different from your current one.";
    default:
      return fallback;
  }
}

/** Email links and Google return to this origin's /auth/* routes. */
const back = (path: string) => `${window.location.origin}${path}`;

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export function AuthForm({
  mode,
  update = false,
  googleEnabled = false,
  oauthError,
}: {
  mode: "signin" | "signup" | "reset" | "magic";
  /** Reset, second step: signed in by the recovery link, choose a new password. */
  update?: boolean;
  googleEnabled?: boolean;
  /** `?error=` from a failed Google redirect. */
  oauthError?: string;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(
    oauthError ? (RETURN_ERRORS[oauthError] ?? "Sign-in didn't finish. Try again.") : ""
  );
  const [googlePending, setGooglePending] = useState(false);
  usePageRestore(
    useCallback(() => {
      setGooglePending(false);
      setPending(false);
    }, [])
  );
  async function google() {
    setGooglePending(true);
    setError("");
    try {
      // Redirects to Google via Supabase Auth; /auth/callback finishes the
      // sign-in. A new account then lands on the Brain Dump (Today redirects
      // until onboarding is done).
      const { error } = await supabaseBrowser().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: back("/auth/callback"),
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) {
        setError("Google sign-in didn't start. Try again.");
        setGooglePending(false);
      }
    } catch {
      setError("Could not connect. Try again.");
      setGooglePending(false);
    }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const auth = supabaseBrowser().auth;
    try {
      if (mode === "signup") {
        const { data, error } = await auth.signUp({
          email,
          password,
          options: {
            data: { name: String(form.get("name")).trim() },
            emailRedirectTo: back("/auth/confirm"),
          },
        });
        if (error) return setError(explain(error.code, error.message));
        // With confirmation on, there's no session until the email link is
        // used. An existing address gets the same answer (no account probing).
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        if (data.session) return window.location.assign("/dump");
        return setMessage(
          `Check ${email} for a link to confirm your account. It takes you straight to your Brain Dump.`
        );
      }
      if (mode === "signin") {
        const { error } = await auth.signInWithPassword({ email, password });
        if (error) return setError(explain(error.code, "Could not sign in. Try again."));
        // A full page load, not router.push: it drops the client router cache,
        // so nothing rendered for a previous user survives the account change.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        return window.location.assign("/");
      }
      if (mode === "magic") {
        const { error } = await auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false, emailRedirectTo: back("/auth/confirm") },
        });
        // Unknown addresses look the same as known ones (no account probing).
        if (error && error.code !== "otp_disabled" && error.status !== 422)
          return setError(explain(error.code, "Could not send the link. Try again."));
        return setMessage(
          "If this email belongs to an account, a sign-in link will arrive shortly."
        );
      }
      if (update) {
        const { error } = await auth.updateUser({ password });
        if (error)
          return setError(explain(error.code, "Could not set the password. Try again."));
        // Like before: a password reset signs out every other session.
        await auth.signOut({ scope: "others" });
        return setMessage("Password updated. You're signed in on this device.");
      }
      const { error } = await auth.resetPasswordForEmail(email, {
        redirectTo: back("/auth/confirm"),
      });
      if (error) return setError(explain(error.code, "Could not send the link. Try again."));
      setMessage("If this email belongs to an account, a reset link will arrive shortly.");
    } catch {
      setError("Could not connect. Your entries are still here — try again.");
    } finally {
      setPending(false);
    }
  }
  const showGoogle = googleEnabled && (mode === "signin" || mode === "signup");
  return (
    <>
      {showGoogle && (
        <>
          <button
            type="button"
            className="btn btn-google"
            onClick={google}
            disabled={googlePending || pending}
          >
            <GoogleLogo />
            {googlePending ? "Opening Google…" : "Continue with Google"}
          </button>
          <p className="auth-divider">
            <span>or {mode === "signup" ? "sign up" : "sign in"} with email</span>
          </p>
        </>
      )}
      <form onSubmit={submit} className="auth-form">
        {mode === "signup" && (
          <Field label="Name" htmlFor="name">
            <Input id="name" name="name" autoComplete="name" required maxLength={100} />
          </Field>
        )}
        {!update && (
          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </Field>
        )}
        {(mode === "signin" || mode === "signup" || update) && (
          <Field
            label="Password"
            htmlFor="password"
            hint={mode === "signin" ? undefined : "At least 10 characters."}
          >
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={mode === "signin" ? 1 : 10}
              maxLength={128}
            />
          </Field>
        )}
        {error && (
          <p className="notice notice-danger" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
        <Button type="submit" className="auth-submit" disabled={pending || googlePending}>
          {pending
            ? "Please wait…"
            : mode === "signup"
              ? "Create account"
              : mode === "signin"
                ? "Sign in"
                : mode === "magic"
                  ? "Send sign-in link"
                  : update
                    ? "Set new password"
                    : "Send reset link"}
        </Button>
      </form>
      <div className="auth-links">
        {mode === "signin" ? (
          <>
            <Link href="/reset">Forgot password?</Link>
            <Link href="/magic">Email me a sign-in link</Link>
          </>
        ) : (
          <Link href="/signin">
            {mode === "signup" ? "Already have an account? Sign in" : "Back to sign in"}
          </Link>
        )}
      </div>
    </>
  );
}
