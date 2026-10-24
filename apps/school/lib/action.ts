import { AuthError, requireMember, SESSION_HOURS } from "@corex/core/auth";
import type { CurrentMember } from "@corex/core/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "./form-state";
import { hasAnyRole, type Role } from "./roles";
import { asAuthClient, getSupabase, type SchoolDb } from "./supabase";

/** An error whose message is safe and useful to show the user. */
export class ActionError extends Error {
  override name = "ActionError";
}

type DbError = { message: string; code?: string };

/** User-facing text for a database error. Our own rule messages are shown as they are. */
export function dbMessage(error: DbError): string {
  const { message, code } = error;
  if (code === "42501" && !/^(Only|You )/.test(message))
    return "You do not have permission to do this.";
  if (/row-level security|permission denied/i.test(message))
    return "You do not have permission to do this.";
  if (code === "23505" && /duplicate key/i.test(message)) return "This already exists.";
  if (code === "23503") return "This is linked to other records and cannot be changed this way.";
  if (/violates check constraint|invalid input syntax/i.test(message))
    return "Some values are not valid.";
  return message;
}

/** Throws an ActionError for a failed Supabase call; returns the data otherwise. */
export function must<T>(result: { data: T; error: DbError | null }): NonNullable<T> {
  if (result.error) throw new ActionError(dbMessage(result.error));
  return result.data as NonNullable<T>;
}

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

type Context = { supabase: SchoolDb; member: CurrentMember };

/**
 * Runs a server action: checks the session and role (CORE-02; row-level security
 * checks again), validates the form, runs `handler`, revalidates and reports.
 */
export async function runAction<T>(
  formData: FormData,
  options: { roles: readonly Role[]; schema: z.ZodType<T>; revalidate?: string[] },
  handler: (data: T, ctx: Context) => Promise<string | FormState | void>,
): Promise<FormState> {
  let ctx: Context;
  try {
    const supabase = await getSupabase();
    const member = await requireMember(asAuthClient(supabase), {
      sessionHours: SESSION_HOURS.school,
    });
    if (!hasAnyRole(member.roles, options.roles)) {
      return { status: "error", message: "Your role cannot do this." };
    }
    ctx = { supabase, member };
  } catch (error) {
    if (error instanceof AuthError) return { status: "error", message: error.message };
    throw error;
  }

  const parsed: z.ZodSafeParseResult<T> = options.schema.safeParse(formObject(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { status: "error", message: "Please check the highlighted fields.", fieldErrors };
  }

  try {
    const result = await handler(parsed.data, ctx);
    for (const path of options.revalidate ?? []) revalidatePath(path, "layout");
    if (typeof result === "string") return { status: "success", message: result };
    return result ?? { status: "success", message: "Saved." };
  } catch (error) {
    if (error instanceof ActionError) return { status: "error", message: error.message };
    throw error;
  }
}

export { type FormState, idleState } from "./form-state";
