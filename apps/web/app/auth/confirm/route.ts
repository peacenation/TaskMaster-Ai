import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/redirect";
import { supabaseServer } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = ["email", "signup", "magiclink", "recovery", "email_change"];

// Email links (confirm sign-up, magic link, password reset) land here with a
// one-time token hash. Verifying it signs the person in on this browser —
// it works even when the link is opened somewhere other than where the
// request started, unlike a PKCE code. Templates: supabase/templates/.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(url.searchParams.get("next"));
  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  const back = type === "recovery" ? "/reset" : "/signin";
  return NextResponse.redirect(new URL(`${back}?error=link_invalid`, url.origin));
}
