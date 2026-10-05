"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui";
export function SignOut() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            const result = await authClient.signOut();
            if (result.error) throw new Error();
            // Full load (see AuthForm): no cached pages outlive the session.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.assign("/signin");
          } catch {
            setError("Could not sign out. Try again.");
            setPending(false);
          }
        }}
      >
        Sign out
      </Button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
