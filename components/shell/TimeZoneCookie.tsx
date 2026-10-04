"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Tells the server the browser's timezone, so server-rendered pages read
// "due today" in the user's own day (lib/server/session.ts getTimeZone).
// Refreshes once if it changed, so the first render corrects itself.
export function TimeZoneCookie() {
  const router = useRouter();
  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const current = document.cookie.match(/(?:^|; )tz=([^;]*)/)?.[1];
    if (current && decodeURIComponent(current) === timeZone) return;
    document.cookie = `tz=${encodeURIComponent(timeZone)}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [router]);
  return null;
}
