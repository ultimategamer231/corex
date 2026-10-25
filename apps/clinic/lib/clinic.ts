import { isCurrency, MoneyError, parseMajor } from "@corex/core/money";
import { z } from "zod";
import type { ClinicDb } from "./supabase";

export const SEX = { female: "Female", male: "Male" } as const;

export const APPOINTMENT_STATUS = {
  booked: { label: "Booked", variant: "info" },
  checked_in: { label: "Checked in", variant: "brand" },
  completed: { label: "Completed", variant: "neutral" },
  cancelled: { label: "Cancelled", variant: "danger" },
  no_show: { label: "No show", variant: "warning" },
} as const;

export const QUEUE_STATUS = {
  waiting: { label: "Waiting", variant: "warning" },
  with_nurse: { label: "With nurse", variant: "info" },
  with_clinician: { label: "With clinician", variant: "brand" },
  done: { label: "Done", variant: "neutral" },
} as const;

export const PAYERS = { self: "Self pay", insurance: "Insurance", company: "Company" } as const;

export const METHODS = {
  cash: "Cash",
  mobile_money: "Mobile money",
  bank: "Bank transfer",
  other: "Other",
} as const;

export function appointmentStatus(status: string) {
  return APPOINTMENT_STATUS[status as keyof typeof APPOINTMENT_STATUS] ?? APPOINTMENT_STATUS.booked;
}

export function queueStatus(status: string) {
  return QUEUE_STATUS[status as keyof typeof QUEUE_STATUS] ?? QUEUE_STATUS.waiting;
}

/** "RCT-000012". */
export const receiptNo = (n: number | string) => `RCT-${String(n).padStart(6, "0")}`;

// Times ---------------------------------------------------------------------------

function zoneParts(instant: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

/** The instant of a wall-clock date and time (YYYY-MM-DD, HH:MM) in `timezone`. */
export function zonedInstant(date: string, time: string, timezone: string): Date {
  const wall = Date.parse(`${date}T${time}:00Z`);
  let guess = wall;
  // Two passes settle the offset, including across daylight-saving changes.
  for (let i = 0; i < 2; i += 1) {
    const p = zoneParts(new Date(guess), timezone);
    guess -= Date.parse(`${p.date}T${p.time}:00Z`) - wall;
  }
  return new Date(guess);
}

/** Start (inclusive) and end (exclusive) of a calendar day in `timezone`, as ISO strings. */
export function dayBounds(date: string, timezone: string): { start: string; end: string } {
  const next = new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return {
    start: zonedInstant(date, "00:00", timezone).toISOString(),
    end: zonedInstant(next, "00:00", timezone).toISOString(),
  };
}

/** "09:30" in `timezone`. */
export function timeOf(value: string | Date, timezone: string): string {
  return zoneParts(new Date(value), timezone).time;
}

/** "2026-10-24" in `timezone`. */
export function dateOf(value: string | Date, timezone: string): string {
  return zoneParts(new Date(value), timezone).date;
}

/** The day before or after `date` (YYYY-MM-DD). */
export function shiftDay(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** "34 years", "7 months" or "12 days" on `today`. */
export function ageText(dateOfBirth: string | null, today: string): string | null {
  if (!dateOfBirth) return null;
  const [by, bm, bd] = dateOfBirth.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  const months = (ty - by) * 12 + (tm - bm) - (td < bd ? 1 : 0);
  if (months < 0) return null;
  if (months >= 24) return `${Math.floor(months / 12)} years`;
  if (months >= 1) return `${months} month${months === 1 ? "" : "s"}`;
  const days = Math.round((Date.parse(today) - Date.parse(dateOfBirth)) / 86_400_000);
  return `${days} day${days === 1 ? "" : "s"}`;
}

// Forms ---------------------------------------------------------------------------

export function toMinor(input: string, currency: string): number {
  if (!isCurrency(currency)) throw new MoneyError("Unknown currency");
  return Number(parseMajor(input.replace(/,/g, ""), currency).amountMinor);
}

/** Form field: an amount greater than zero, kept as typed for conversion per currency. */
export const amountText = z
  .string({ error: "Enter the amount" })
  .trim()
  .regex(/^\d{1,3}(,?\d{3})*(\.\d{1,2})?$/, "Enter an amount like 1250.50")
  .refine((v) => Number(v.replace(/,/g, "")) > 0, "The amount must be greater than zero");

export const timeText = (label: string) =>
  z.string({ error: `Enter ${label}` }).regex(/^([01]\d|2[0-3]):[0-5]\d$/, `Enter ${label}`);

// Lookups -------------------------------------------------------------------------

/** Active clinicians with their names; members cannot read each other's memberships. */
export async function loadClinicians(db: ClinicDb): Promise<{ id: string; name: string }[]> {
  const { data, error } = await db.rpc("clinicians");
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({ id: c.user_id, name: c.display_name }));
}

export const PATIENT_COLUMNS =
  "id, patient_number, first_name, middle_name, last_name, sex, date_of_birth, phone, has_allergies, allergy_notes, possible_duplicate_of";
