import { z } from "zod";
import { withRepositories } from "@/lib/repo";
import { SharingError } from "@/lib/repo/sharing-repository";
import { ApiError, apiRoute, json, readJson } from "@/lib/server/api";
import { inviteLink, originOf } from "@/lib/server/sharing";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// Invite someone to a project you own. They'll see it in the app when they
// sign in with that email; the link is for sending it yourself.
export const POST = apiRoute(async ({ userId }, request, { params }: Params) => {
  const id = z
    .string()
    .uuid()
    .safeParse((await params).id);
  const body = z.object({ email: z.email() }).safeParse(await readJson(request));
  if (!id.success) throw new ApiError(404, "Project not found.");
  if (!body.success) throw new ApiError(400, "Enter their email address.");
  try {
    const invite = await withRepositories(userId, async (repos) => {
      const created = await repos.sharing.invite(id.data, body.data.email);
      await repos.events.track("project_invite_sent", { project_id: id.data });
      return created;
    });
    return json(
      {
        id: invite.id,
        email: body.data.email.toLowerCase(),
        link: inviteLink(originOf(request), invite.token),
      },
      201
    );
  } catch (error) {
    if (error instanceof SharingError) throw new ApiError(409, error.message);
    throw error;
  }
});
