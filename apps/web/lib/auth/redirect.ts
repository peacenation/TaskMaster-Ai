/**
 * Where to send someone after an email link or Google sign-in. Only paths on
 * this site: an absolute or protocol-relative URL here would be an open
 * redirect.
 */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\"))
    return fallback;
  return next;
}
