import { afterEach, describe, expect, it, vi } from "vitest";
import { encryptSecret, decryptSecret } from "./secret";
import { CalendarFetchError, fetchFeed, isPrivate, normaliseFeedUrl } from "./fetch";

describe("normaliseFeedUrl", () => {
  it("turns webcal:// into https:// and keeps the secret path", () => {
    expect(normaliseFeedUrl("webcal://p01-caldav.icloud.com/published/2/abc").href).toBe(
      "https://p01-caldav.icloud.com/published/2/abc"
    );
  });

  it("refuses plain http, credentials in the URL, and non-URLs", () => {
    expect(() => normaliseFeedUrl("http://example.com/cal.ics")).toThrow(CalendarFetchError);
    expect(() => normaliseFeedUrl("https://me:pw@example.com/cal.ics")).toThrow(
      CalendarFetchError
    );
    expect(() => normaliseFeedUrl("my calendar")).toThrow(CalendarFetchError);
  });
});

describe("isPrivate", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "::1",
    "fd00::1",
    "::ffff:127.0.0.1",
    "100.64.0.1",
    "0.0.0.0",
  ])("blocks %s", (address) => expect(isPrivate(address)).toBe(true));
  it.each(["142.250.187.206", "2a00:1450:4009:81f::200e"])("allows %s", (address) =>
    expect(isPrivate(address)).toBe(false)
  );
});

describe("fetchFeed", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("refuses addresses that resolve to the local machine", async () => {
    await expect(fetchFeed("https://localhost/cal.ics")).rejects.toThrow(/isn't reachable/);
    await expect(fetchFeed("https://127.0.0.1/cal.ics")).rejects.toThrow(/isn't reachable/);
  });

  it("re-checks every redirect hop", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(null, {
            status: 302,
            headers: { location: "https://169.254.169.254/latest" },
          })
      )
    );
    await expect(fetchFeed("https://8.8.8.8/cal.ics")).rejects.toThrow(/isn't reachable/);
  });

  it("explains a refused secret address", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("no", { status: 404 }))
    );
    await expect(fetchFeed("https://8.8.8.8/cal.ics")).rejects.toThrow(
      /secret\) iCal address/
    );
  });
});

describe("calendar secrets", () => {
  it("round-trips and never stores the address in the clear", () => {
    process.env.CALENDAR_ENCRYPTION_KEY = "test-key";
    const url = "https://calendar.google.com/calendar/ical/me/private-abc/basic.ics";
    const sealed = encryptSecret(url);
    expect(sealed).not.toContain("private-abc");
    expect(decryptSecret(sealed)).toBe(url);
    expect(encryptSecret(url)).not.toBe(sealed);
  });

  it("detects tampering", () => {
    process.env.CALENDAR_ENCRYPTION_KEY = "test-key";
    const sealed = encryptSecret("https://example.com/a.ics").split(".");
    sealed[3] = Buffer.from("https://evil.example/").toString("base64url");
    expect(() => decryptSecret(sealed.join("."))).toThrow();
  });
});
