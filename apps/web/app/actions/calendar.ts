"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CalendarFetchError } from "@/lib/calendar/fetch";
import { connectFeed } from "@/lib/calendar/sync";
import { withRepositories } from "@/lib/repo";
import { getCurrentUserId } from "@/lib/server/session";

export interface CalendarFormState {
  message?: string;
  ok?: boolean;
}

export async function connectCalendar(
  _previous: CalendarFormState,
  form: FormData
): Promise<CalendarFormState> {
  const url = z.string().trim().min(8).max(2000).safeParse(form.get("url"));
  if (!url.success) return { message: "Paste your calendar's private iCal address." };
  const userId = await getCurrentUserId();
  try {
    const { events } = await connectFeed(userId, url.data);
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: `Connected. ${events} upcoming event${events === 1 ? "" : "s"} found.`,
    };
  } catch (error) {
    return {
      message:
        error instanceof CalendarFetchError
          ? error.message
          : "Couldn't connect that calendar. Try again.",
    };
  }
}

export async function disconnectCalendar(id: string): Promise<void> {
  const feedId = z.string().uuid().parse(id);
  const userId = await getCurrentUserId();
  await withRepositories(userId, (repos) => repos.calendar.removeFeed(feedId));
  revalidatePath("/", "layout");
}
