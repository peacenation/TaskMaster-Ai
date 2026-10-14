import { NextRequest, NextResponse } from "next/server";
import { refreshSession } from "@/lib/supabase/proxy";

// A fast, optimistic gate: is there a Supabase session cookie at all? It
// also refreshes an expired access token so pages see a current one. It does
// NOT prove the session is valid — every page and API verifies that with the
// Auth server (lib/server/session.ts), so a forged or revoked cookie gets
// past here and is rejected there.

const PUBLIC = new Set([
  "/signin",
  "/signup",
  "/reset",
  "/magic",
  "/design",
  "/privacy",
  "/api/health",
  // Supabase Auth returns here: email links (token hash) and Google (code).
  "/auth/confirm",
  "/auth/callback",
  // PWA files: the browser fetches these without a session to install the app.
  "/manifest.webmanifest",
  "/sw.js",
  "/offline.html",
  // Android app link verification for the TaskMaster TWA (android/).
  "/.well-known/assetlinks.json",
]);

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (PUBLIC.has(path)) return NextResponse.next();
  // Mobile app: same optimistic check, for a bearer token instead of a cookie.
  // apiRoute (lib/server/api.ts) verifies it with the Auth server.
  if (
    path.startsWith("/api/v1/") &&
    request.headers.get("authorization")?.startsWith("Bearer ")
  )
    return NextResponse.next();
  const { response, signedIn } = await refreshSession(request);
  if (!signedIn) {
    if (path.startsWith("/api/"))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.redirect(new URL("/signin", request.url));
  }
  return response();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico)$).*)"],
};
