// Supabase Auth configuration (docs/adr/ADR-013-supabase-auth.md).
// URL and publishable key are public by design (they ship to the browser);
// the secret key is server-only and checked by `npm run check:client-bundle`.

export function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL.");
  return url;
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
