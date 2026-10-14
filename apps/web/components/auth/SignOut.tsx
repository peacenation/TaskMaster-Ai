"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
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
            // This device only; the session is revoked server-side too.
            const { error } = await supabaseBrowser().auth.signOut({ scope: "local" });
            if (error) throw error;
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
