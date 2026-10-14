"use client";
import { createBrowserClient } from "@supabase/ssr";

// Client components: sign-in forms, sign-out, Connect Google. Sessions live
// in cookies (not localStorage) so the server sees the same session.
let client: ReturnType<typeof createBrowserClient> | undefined;

export function supabaseBrowser() {
  return (client ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  ));
}
