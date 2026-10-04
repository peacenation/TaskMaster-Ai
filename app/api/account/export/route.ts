import { getSession } from "@/lib/server/session";
import { withRepositories } from "@/lib/repo";
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const data = await withRepositories(session.user.id, (repos) => repos.account.export());
  return Response.json(data, {
    headers: {
      "Content-Disposition": 'attachment; filename="TaskMaster-data.json"',
      "Cache-Control": "private, no-store",
    },
  });
}
