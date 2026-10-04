import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth/server";

const PUBLIC = new Set(["/signin", "/signup", "/reset", "/magic", "/design"]);
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (PUBLIC.has(path) || path.startsWith("/api/auth/")) return NextResponse.next();
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) {
    if (path.startsWith("/api/"))
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.redirect(new URL("/signin", request.url));
  }
  return NextResponse.next();
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico)$).*)"],
};
