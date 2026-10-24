import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

/** Default timezone for every Corex app (SPEC.md 2). */
export const DEFAULT_TIMEZONE = "Africa/Monrovia";

/** "24 Oct 2026, 01:30" in the organization's timezone. */
export function formatDateTime(value: Date | string, timezone = DEFAULT_TIMEZONE): string {
  return format(new TZDate(new Date(value), timezone), "d MMM yyyy, HH:mm");
}

/** "24 Oct 2026" in the organization's timezone. */
export function formatDate(value: Date | string, timezone = DEFAULT_TIMEZONE): string {
  return format(new TZDate(new Date(value), timezone), "d MMM yyyy");
}
