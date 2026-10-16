import { withRepositories } from "@/lib/repo";
import { apiRoute, json } from "@/lib/server/api";

export const dynamic = "force-dynamic";

// Open invitations to your email address.
export const GET = apiRoute(async ({ userId }) => {
  const invites = await withRepositories(userId, (repos) => repos.sharing.mine());
  return json({
    invites: invites.map((i) => ({
      id: i.id,
      projectName: i.projectName,
      inviterName: i.inviterName,
      expiresAt: i.expiresAt.toISOString(),
    })),
  });
});
