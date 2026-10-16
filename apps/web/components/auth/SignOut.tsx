"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Button } from "@/components/ui";
import { SignOutIcon } from "@/components/shell/icons";
export function SignOut({ className, withIcon }: { className?: string; withIcon?: boolean }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        className={className}
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
        {withIcon && <SignOutIcon size={18} />}
        Sign out
      </Button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
