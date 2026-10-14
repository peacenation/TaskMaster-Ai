// Supabase Auth configuration (docs/adr/ADR-013-supabase-auth.md).
// URL and publishable key are public by design (they ship to the browser);
// the secret key is server-only and checked by `npm run check:client-bundle`.

/**
 * The project's origin (`https://<ref>.supabase.co`). Only the origin is
 * used, so a value pasted from the dashboard's REST endpoint
 * (`…supabase.co/rest/v1/`) still reaches Auth at `/auth/v1`.
 */
export function supabaseOrigin(value: string | undefined): string {
  if (!value) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL.");
  return new URL(value).origin;
}

export function supabaseUrl(): string {
  return supabaseOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabasePublishableKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error("Configure NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  return key;
}

export function supabaseSecretKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Configure SUPABASE_SECRET_KEY (server-only).");
  return key;
}
