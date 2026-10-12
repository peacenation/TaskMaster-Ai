import { getAuth } from "@/lib/auth/server";
import { emailConfigured } from "@/lib/auth/email";
export async function GET(request: Request) {
  return getAuth().handler(request);
}
export async function POST(request: Request) {
  const path = new URL(request.url).pathname;
  if (
    (path.endsWith("/request-password-reset") || path.endsWith("/sign-in/magic-link")) &&
    !emailConfigured()
  )
    return Response.json(
      { message: "Email delivery is not configured yet. Sign in with your password." },
      { status: 503 }
    );
  return getAuth().handler(request);
}
