"use client";
import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { Button, Field, Input } from "@/components/ui";

export function AuthForm({
  mode,
  token,
  emailReady,
}: {
  mode: "signin" | "signup" | "reset" | "magic";
  token?: string;
  emailReady: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    try {
      const result =
        mode === "signup"
          ? await authClient.signUp.email({ name: String(form.get("name")), email, password })
          : mode === "signin"
            ? await authClient.signIn.email({ email, password })
            : mode === "magic"
              ? await authClient.signIn.magicLink({
                  email,
                  callbackURL: "/",
                  errorCallbackURL: "/magic",
                })
              : token
                ? await authClient.resetPassword({ newPassword: password, token })
                : await authClient.requestPasswordReset({ email, redirectTo: "/reset" });
      if (result.error) {
        setError(result.error.message || "Could not finish. Please try again.");
        return;
      }
      // A full page load, not router.push: it drops the client router cache,
      // so nothing rendered for a previous user survives the account change.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      if (mode === "signup") window.location.assign("/dump");
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      else if (mode === "signin") window.location.assign("/");
      else if (token) {
        setMessage("Password updated. You can sign in now.");
      } else setMessage("If this email belongs to an account, a link will arrive shortly.");
    } catch {
      setError("Could not connect. Your entries are still here — try again.");
    } finally {
      setPending(false);
    }
  }
  const needsEmail = mode === "magic" || (mode === "reset" && !token);
  return (
    <>
      {needsEmail && !emailReady && (
        <p className="notice">
          Email delivery is awaiting configuration. Password sign-in is available.
        </p>
      )}
      <form onSubmit={submit} className="auth-form">
        {mode === "signup" && (
          <Field label="Name" htmlFor="name">
            <Input id="name" name="name" autoComplete="name" required maxLength={100} />
          </Field>
        )}
        {!token && (
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
        {(mode === "signin" || mode === "signup" || token) && (
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
        <Button type="submit" disabled={pending || (needsEmail && !emailReady)}>
          {pending
            ? "Please wait…"
            : mode === "signup"
              ? "Create account"
              : mode === "signin"
                ? "Sign in"
                : mode === "magic"
                  ? "Send sign-in link"
                  : token
                    ? "Set new password"
                    : "Send reset link"}
        </Button>
      </form>
      <div className="auth-links">
        <Link href="/signin">Sign in</Link>
        <Link href="/signup">Create account</Link>
        <Link href="/reset">Reset password</Link>
        <Link href="/magic">Email me a sign-in link</Link>
      </div>
    </>
  );
}
