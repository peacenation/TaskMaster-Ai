import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withRepositories } from "@/lib/repo";
import { SharingError } from "@/lib/repo/sharing-repository";
import { ApiError, apiRoute, json, readJson } from "@/lib/server/api";

export const dynamic = "force-dynamic";

// Accept or decline an invitation to your email address.
export const POST = apiRoute(
  async ({ userId }, request, { params }: { params: Promise<{ id: string }> }) => {
    const id = z
      .string()
      .uuid()
      .safeParse((await params).id);
    const body = z
      .object({ action: z.enum(["accept", "decline"]) })
      .safeParse(await readJson(request));
    if (!id.success || !body.success) throw new ApiError(400, "Accept or decline.");
    try {
      const projectId = await withRepositories(userId, async (repos) => {
        if (body.data.action === "decline") {
          if (!(await repos.sharing.decline(id.data)))
            throw new SharingError("This invitation has expired or isn't for you.");
          return null;
        }
        const joined = await repos.sharing.accept(id.data);
        await repos.events.track("project_joined", { project_id: joined });
        return joined;
      });
      revalidatePath("/", "layout");
      return json({ ok: true, projectId });
    } catch (error) {
      if (error instanceof SharingError) throw new ApiError(410, error.message);
      throw error;
    }
  }
);
