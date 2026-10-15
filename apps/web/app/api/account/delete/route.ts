import { deleteAccount, deletionSchema } from "@/lib/server/account-deletion";
import { getSession } from "@/lib/server/session";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  const parsed = deletionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "Type DELETE to confirm." }, { status: 400 });
  const result = await deleteAccount(session, parsed.data);
  return result.ok
    ? Response.json({ ok: true })
    : Response.json({ error: result.error }, { status: result.status });
}
