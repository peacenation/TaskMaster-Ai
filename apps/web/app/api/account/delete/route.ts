import { z } from "zod";
import { headers } from "next/headers";
import { getSession } from "@/lib/server/session";
import { getAuth } from "@/lib/auth/server";
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  const parsed = z
    .object({ confirmation: z.literal("DELETE"), password: z.string().min(1).max(128) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { error: "Confirm deletion and enter your password." },
      { status: 400 }
    );
  try {
    await getAuth().api.deleteUser({
      headers: await headers(),
      body: { password: parsed.data.password },
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { error: "Could not delete the account. Check your password and try again." },
      { status: 400 }
    );
  }
}
