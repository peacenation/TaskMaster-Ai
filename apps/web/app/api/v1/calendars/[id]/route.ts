import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withRepositories } from "@/lib/repo";
import { ApiError, apiRoute, json } from "@/lib/server/api";

export const dynamic = "force-dynamic";

// Disconnect a calendar; its cached events go with it.
export const DELETE = apiRoute(
  async ({ userId }, _request, { params }: { params: Promise<{ id: string }> }) => {
    const id = z
      .string()
      .uuid()
      .safeParse((await params).id);
    if (!id.success) throw new ApiError(404, "Calendar not found.");
    const removed = await withRepositories(userId, (repos) =>
      repos.calendar.removeFeed(id.data)
    );
    if (!removed) throw new ApiError(404, "Calendar not found.");
    revalidatePath("/", "layout");
    return json({ ok: true });
  }
);
