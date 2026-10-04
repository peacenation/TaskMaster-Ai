import { zonedParts } from "@/lib/domain/dates";
export function localDate(now: Date, timeZone: string) {
  const p = zonedParts(now, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
