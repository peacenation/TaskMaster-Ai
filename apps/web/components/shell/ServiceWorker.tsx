"use client";

import { useEffect } from "react";

// Registers public/sw.js so the app is installable as a PWA. Production
// only: in dev a service worker would serve stale fast-refresh assets.
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
