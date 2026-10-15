import { entitlementsFor } from "@/lib/billing/plans";
import { withRepositories } from "@/lib/repo";
import { CalendarFetchError, fetchFeed, normaliseFeedUrl } from "./fetch";
import { parseIcs } from "./ics";
import { decryptSecret, encryptSecret } from "./secret";

// Calendar feeds are fetched outside any database transaction (a slow
// calendar server must never hold a connection), then written in one.

const DAY_MS = 86_400_000;
/** Refresh a feed when its cache is older than this. */
export const STALE_MS = 15 * 60_000;

/** The window cached per feed: yesterday through the next five weeks. */
function window(now: Date) {
  return { from: new Date(now.getTime() - DAY_MS), to: new Date(now.getTime() + 35 * DAY_MS) };
}

async function download(url: string, now: Date) {
  const { from, to } = window(now);
  const text = await fetchFeed(url);
  try {
    return parseIcs(text, from, to);
  } catch (error) {
    throw new CalendarFetchError(error instanceof Error ? error.message : "Not a calendar.");
  }
}

/** A short name for the feed from its host ("Google Calendar"). */
export function labelFor(url: URL): string {
  const host = url.hostname;
  if (host.endsWith("google.com")) return "Google Calendar";
  if (host.includes("outlook") || host.includes("office365")) return "Outlook";
  if (host.endsWith("icloud.com")) return "Apple Calendar";
  return host;
}

/** Validate, download and store a new feed. Throws CalendarFetchError with a message for the user. */
export async function connectFeed(userId: string, input: string, label?: string) {
  const url = normaliseFeedUrl(input);
  const now = new Date();
  const events = await download(url.toString(), now);
  return withRepositories(userId, async (repos) => {
    const { calendars, plan } = entitlementsFor((await repos.users.profile())?.plan ?? "free");
    if ((await repos.calendar.feeds()).length >= calendars)
      throw new CalendarFetchError(
        plan === "free" && calendars === 1
          ? "Free includes one calendar. Upgrade to Pro to connect up to five."
          : `You can connect up to ${calendars} calendars.`
      );
    const id = await repos.calendar.addFeed({
      label: label?.trim() || labelFor(url),
      urlEncrypted: encryptSecret(url.toString()),
    });
    await repos.calendar.replaceEvents(id, events, now);
    await repos.events.track("calendar_connected", { events: events.length });
    return { id, events: events.length };
  });
}

/** Refresh every feed whose cache is stale. Failures keep the old events. */
export async function syncStaleFeeds(userId: string, now = new Date()) {
  const feeds = await withRepositories(userId, (repos) => repos.calendar.feeds());
  const stale = feeds.filter(
    (feed) => !feed.lastSyncedAt || now.getTime() - feed.lastSyncedAt.getTime() > STALE_MS
  );
  for (const feed of stale) {
    try {
      const events = await download(decryptSecret(feed.urlEncrypted), now);
      await withRepositories(userId, (repos) =>
        repos.calendar.replaceEvents(feed.id, events, now)
      );
    } catch (error) {
      const message =
        error instanceof CalendarFetchError
          ? error.message
          : "Couldn't refresh this calendar.";
      await withRepositories(userId, (repos) =>
        repos.calendar.syncFailed(feed.id, message, now)
      );
    }
  }
  return stale.length;
}
