import { z } from "zod";
import { withRepositories } from "@/lib/repo";
import { ApiError, apiRoute, json } from "@/lib/server/api";

export const dynamic = "force-dynamic";

// Withdraw an invitation you sent.
export const DELETE = apiRoute(
  async ({ userId }, _request, { params }: { params: Promise<{ inviteId: string }> }) => {
    const id = z
      .string()
      .uuid()
      .safeParse((await params).inviteId);
    if (!id.success) throw new ApiError(404, "Invitation not found.");
    await withRepositories(userId, (repos) => repos.sharing.withdraw(id.data));
    return json({ ok: true });
  }
);
