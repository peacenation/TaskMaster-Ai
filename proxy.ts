import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// A fast, optimistic gate: is there a session cookie at all? It does NOT
// prove the session is valid — every page and API verifies that against
// the database (lib/server/session.ts getCurrentUserId), so a forged or
// revoked cookie gets past here and is rejected there.
//
// Must not read Better Auth's cookie *cache* (getCookieCache): the cache is
// deliberately disabled so revocation is immediate (lib/auth/server.ts), and
// with it off that cookie never exists — every request would look signed out.

const PUBLIC = new Set(["/signin", "/signup", "/reset", "/magic", "/design", "/privacy"]);

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (PUBLIC.has(path) || path.startsWith("/api/auth/")) return NextResponse.next();
  if (!getSessionCookie(request)) {
    if (path.startsWith("/api/"))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.redirect(new URL("/signin", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico)$).*)"],
};
