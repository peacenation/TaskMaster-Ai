import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

// Whether "Continue with Google" should show: asked of Supabase Auth itself
// (its public /settings endpoint), so enabling Google in the Supabase
// dashboard is the only switch. Fetched fresh each time: a cached "off"
// (e.g. from before a key was fixed) would otherwise outlive the fix, and
// it's one small request per sign-in page view. On any failure the button
// hides rather than offering a sign-in that can't work, and the reason is
// logged (status only, no keys).
export async function googleConfigured(): Promise<boolean> {
  try {
    const response = await fetch(`${supabaseUrl()}/auth/v1/settings`, {
      headers: { apikey: supabasePublishableKey() },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) {
      console.warn(
        JSON.stringify({ event: "auth.settings_unavailable", status: response.status })
      );
      return false;
    }
    const settings = (await response.json()) as { external?: Record<string, boolean> };
    return settings.external?.google === true;
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "auth.settings_unavailable",
        errorName: error instanceof Error ? error.name : "unknown",
      })
    );
    return false;
  }
}
