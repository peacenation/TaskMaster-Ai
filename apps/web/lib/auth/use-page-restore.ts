"use client";
import { useEffect } from "react";

/**
 * Runs `reset` when the browser restores this page from its back/forward
 * cache (Safari does this readily). Without it, pressing Back from Google
 * brings the page back exactly as it was left: "Opening Google…", disabled.
 */
export function usePageRestore(reset: () => void) {
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) reset();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [reset]);
}
