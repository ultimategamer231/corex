// Form helpers shared by server actions and client forms; keep free of server-only imports.
import { z } from "zod";

/** Converts form data to a plain object; repeated names become arrays. */
export function formObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(formData.keys())) {
    const values = formData.getAll(key).filter((v): v is string => typeof v === "string");
    out[key] = values.length > 1 ? values : values[0];
  }
  return out;
}

/** Trimmed text; empty becomes null. */
export const optionalText = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : null));
export const requiredText = (label: string, max = 200) =>
  z
    .string({ error: `Enter ${label}` })
    .trim()
    .min(1, `Enter ${label}`)
    .max(max, `Use at most ${max} characters`);
export const uuid = (label = "an option") => z.uuid({ error: `Choose ${label}` });
export const isoDate = (label: string) =>
  z.string({ error: `Enter ${label}` }).regex(/^\d{4}-\d{2}-\d{2}$/, `Enter ${label}`);
