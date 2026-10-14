import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

// Whether "Continue with Google" should show: asked of Supabase Auth itself
// (its public /settings endpoint), so enabling Google in the Supabase
// dashboard is the only switch. Cached briefly; on any failure the button
// hides rather than offering a sign-in that can't work.
export async function googleConfigured(): Promise<boolean> {
  try {
    const response = await fetch(`${supabaseUrl()}/auth/v1/settings`, {
      headers: { apikey: supabasePublishableKey() },
      next: { revalidate: 300 },
    });
    if (!response.ok) return false;
    const settings = (await response.json()) as { external?: Record<string, boolean> };
    return settings.external?.google === true;
  } catch {
    return false;
  }
}
