import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withRepositories } from "@/lib/repo";
import { SharingError } from "@/lib/repo/sharing-repository";
import { ApiError, apiRoute, json } from "@/lib/server/api";

export const dynamic = "force-dynamic";

// The owner removes someone, or a member leaves (their own id).
export const DELETE = apiRoute(
  async (
    { userId },
    _request,
    { params }: { params: Promise<{ id: string; memberId: string }> }
  ) => {
    const p = await params;
    const ids = z.object({ id: z.string().uuid(), memberId: z.string().uuid() }).safeParse(p);
    if (!ids.success) throw new ApiError(404, "Not found.");
    try {
      await withRepositories(userId, (repos) =>
        repos.sharing.remove(ids.data.id, ids.data.memberId)
      );
    } catch (error) {
      if (error instanceof SharingError) throw new ApiError(403, error.message);
      throw error;
    }
    revalidatePath("/", "layout");
    return json({ ok: true });
  }
);
