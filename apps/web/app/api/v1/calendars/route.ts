import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CalendarFetchError } from "@/lib/calendar/fetch";
import { connectFeed, syncStaleFeeds } from "@/lib/calendar/sync";
import { withRepositories } from "@/lib/repo";
import { ApiError, apiRoute, json, readJson } from "@/lib/server/api";

export const dynamic = "force-dynamic";

// Connected calendars. The private address is never returned — only a
// label and how the last refresh went.
export const GET = apiRoute(async ({ userId }) => {
  const feeds = await withRepositories(userId, (repos) => repos.calendar.feeds());
  return json({
    calendars: feeds.map((feed) => ({
      id: feed.id,
      label: feed.label,
      lastSyncedAt: feed.lastSyncedAt?.toISOString() ?? null,
      error: feed.lastError,
    })),
  });
});

const connectSchema = z.object({
  url: z.string().trim().min(8).max(2000),
  label: z.string().trim().max(80).optional(),
});

// Connect a calendar by its private iCal address. It's read once now, so a
// wrong address fails here with a clear message rather than silently.
export const POST = apiRoute(async ({ userId }, request) => {
  const parsed = connectSchema.safeParse(await readJson(request));
  if (!parsed.success) throw new ApiError(400, "Paste your calendar's private iCal address.");
  try {
    const result = await connectFeed(userId, parsed.data.url, parsed.data.label);
    revalidatePath("/", "layout");
    return json(result, 201);
  } catch (error) {
    if (error instanceof CalendarFetchError) throw new ApiError(422, error.message);
    throw error;
  }
});

// Refresh now ("pull to refresh" on the calendars list).
export const PUT = apiRoute(async ({ userId }) => {
  await syncStaleFeeds(userId, new Date(Date.now() + 60 * 60_000));
  revalidatePath("/", "layout");
  return json({ ok: true });
});
