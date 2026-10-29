/** Dates and times in Monrovia time (GMT, no daylight saving), as in the mockup. */
const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Monrovia",
});

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? "—" : dateTime.format(date);
}

const dayMonth = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const dayMonthYear = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** Today's date in Monrovia (GMT) as YYYY-MM-DD. */
export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "3 Nov", or "3 Nov 2025" outside the current year. Accepts a date or a timestamp. */
export function formatDay(value: string | null | undefined, now = new Date()): string {
  if (!value) return "—";
  const day = value.length > 10 ? new Date(value).toISOString().slice(0, 10) : value;
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "—";
  return day.slice(0, 4) === todayIso(now).slice(0, 4)
    ? dayMonth.format(date)
    : dayMonthYear.format(date);
}

/** "Today", "Tomorrow", "Yesterday" or the day, for follow-ups and arrivals. */
export function relativeDay(value: string | null | undefined, now = new Date()): string {
  if (!value) return "—";
  const day = value.length > 10 ? new Date(value).toISOString().slice(0, 10) : value;
  const today = todayIso(now);
  if (day === today) return "Today";
  if (day === addDays(today, 1)) return "Tomorrow";
  if (day === addDays(today, -1)) return "Yesterday";
  return formatDay(day, now);
}

/** Whether a follow-up date is before today. */
export function isOverdue(day: string | null | undefined, now = new Date()): boolean {
  return !!day && day < todayIso(now);
}
