import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { supabaseOrigin } from "./env";

/**
 * Reads the session from cookies, refreshing an expired access token (and
 * writing the new cookies onto both the request, for the page about to
 * render, and the response). Optimistic only: pages verify with the Auth
 * server via lib/server/session.ts.
 */
export async function refreshSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    supabaseOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL),
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list)
            response.cookies.set(name, value, options);
        },
      },
    }
  );
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return { response: () => response, signedIn: !!session };
}
