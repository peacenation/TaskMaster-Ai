import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// A calendar's private iCal address is a credential: anyone holding it can
// read the calendar. It's encrypted at rest with AES-256-GCM. The key is
// CALENDAR_ENCRYPTION_KEY (any long random string) or, when that isn't
// set, derived from SUPABASE_SECRET_KEY so it works without extra setup —
// rotating that secret then means reconnecting calendars.

function key(): Buffer {
  const secret = process.env.CALENDAR_ENCRYPTION_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("No calendar encryption key is configured.");
  return createHash("sha256").update(`taskmaster-calendar:${secret}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), body]
    .map((p) => (typeof p === "string" ? p : p.toString("base64url")))
    .join(".");
}

export function decryptSecret(sealed: string): string {
  const [version, iv, tag, body] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !body) throw new Error("Unreadable calendar secret.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(body, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
