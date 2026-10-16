import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/redirect";
import { supabaseServer } from "@/lib/supabase/server";

// Google sign-in (and Settings → Connect Google) returns here with a PKCE
// code, exchanged for a session on this browser. Failures come back as
// ?error=…&error_code=… and are explained on the page we return to.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  // Settings pages (Connect Google, confirm before deleting) get their
  // errors back where they started.
  const back = next === "/settings" || next.startsWith("/settings/") ? next : "/signin";
  const providerError = url.searchParams.get("error_code") ?? url.searchParams.get("error");
  if (providerError)
    return NextResponse.redirect(
      new URL(`${back}?error=${encodeURIComponent(providerError)}`, url.origin)
    );
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    return NextResponse.redirect(
      new URL(`${back}?error=${encodeURIComponent(error.code ?? "oauth_failed")}`, url.origin)
    );
  }
  return NextResponse.redirect(new URL(`${back}?error=oauth_failed`, url.origin));
}
