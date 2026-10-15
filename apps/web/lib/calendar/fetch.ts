import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Fetching a user-supplied URL from the server is a classic SSRF risk: the
// address could point at localhost or a cloud metadata endpoint. Calendar
// feeds must be public HTTPS hosts, every hop of a redirect is re-checked,
// and responses are size- and time-limited.

export class CalendarFetchError extends Error {}

const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 6000;
const MAX_REDIRECTS = 3;

/**
 * End-to-end tests serve a feed from this machine. Only the e2e server sets
 * this (scripts/e2e-server.mjs), and it only opens 127.0.0.1 over http.
 */
const allowLoopback = () => process.env.E2E_CALENDAR_LOOPBACK === "1";
const isTestFeed = (url: URL) =>
  allowLoopback() && url.protocol === "http:" && url.hostname === "127.0.0.1";

/** webcal:// is how calendar apps share feeds; it's HTTPS underneath. */
export function normaliseFeedUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input.trim().replace(/^webcals?:\/\//i, "https://"));
  } catch {
    throw new CalendarFetchError("That doesn't look like a calendar address.");
  }
  if (url.protocol !== "https:" && !isTestFeed(url))
    throw new CalendarFetchError("Use the calendar's https:// or webcal:// address.");
  if (url.username || url.password)
    throw new CalendarFetchError("That doesn't look like a calendar address.");
  return url;
}

export function isPrivate(address: string): boolean {
  if (isIP(address) === 6) {
    const a = address.toLowerCase();
    if (a === "::1" || a === "::") return true;
    if (a.startsWith("fc") || a.startsWith("fd") || a.startsWith("fe80")) return true;
    const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivate(mapped[1]) : false;
  }
  const [a, b] = address.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

async function assertPublicHost(url: URL) {
  if (isTestFeed(url)) return;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal"))
    throw new CalendarFetchError("That calendar address isn't reachable.");
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true }).catch(() => [])).map((r) => r.address);
  if (addresses.length === 0)
    throw new CalendarFetchError("Couldn't find that calendar server. Check the address.");
  if (addresses.some(isPrivate))
    throw new CalendarFetchError("That calendar address isn't reachable.");
}

/** Download an iCal feed as text. */
export async function fetchFeed(input: string): Promise<string> {
  let url = normaliseFeedUrl(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    for (let hop = 0; ; hop++) {
      await assertPublicHost(url);
      const response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: { accept: "text/calendar, text/plain;q=0.8, */*;q=0.1" },
      });
      if (response.status >= 300 && response.status < 400) {
        const next = response.headers.get("location");
        if (!next || hop >= MAX_REDIRECTS)
          throw new CalendarFetchError("The calendar server redirected too many times.");
        url = normaliseFeedUrl(new URL(next, url).toString());
        continue;
      }
      if (response.status === 401 || response.status === 403 || response.status === 404)
        throw new CalendarFetchError(
          "The calendar server refused that address. Copy the private (secret) iCal address again."
        );
      if (!response.ok)
        throw new CalendarFetchError("The calendar server didn't respond. Try again later.");
      const length = Number(response.headers.get("content-length") ?? 0);
      if (length > MAX_BYTES)
        throw new CalendarFetchError("That calendar is too large to read.");
      const reader = response.body?.getReader();
      if (!reader) return "";
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) {
          await reader.cancel();
          throw new CalendarFetchError("That calendar is too large to read.");
        }
        chunks.push(value);
      }
      return Buffer.concat(chunks).toString("utf8");
    }
  } catch (error) {
    if (error instanceof CalendarFetchError) throw error;
    throw new CalendarFetchError("Couldn't reach the calendar server. Try again later.");
  } finally {
    clearTimeout(timer);
  }
}
