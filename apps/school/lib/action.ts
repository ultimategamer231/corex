import { AuthError, requireMember, SESSION_HOURS } from "@corex/core/auth";
import type { CurrentMember } from "@corex/core/auth";
import { revalidatePath } from "next/cache";
import { type z } from "zod";
import { DEMO_DISABLED } from "./demo";
import { schoolEnv } from "./env";
import type { FormState } from "./form-state";
import { formObject } from "./fields";
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

export { formObject, isoDate, optionalText, requiredText, uuid } from "./fields";

type Context = { supabase: SchoolDb; member: CurrentMember };

type ActionOptions<T> = {
  roles: readonly Role[];
  schema: z.ZodType<T>;
  revalidate?: string[];
  /** Turned off on the public demos: settings, users, roles (SPEC.md 11.3). */
  demoBlocked?: boolean;
};

/** Demo only: 60 writes per user per minute, counted by the demo database layer. */
export async function demoWriteAllowed(supabase: SchoolDb): Promise<boolean> {
  const db = supabase as unknown as {
    rpc(fn: "demo_write_allowed"): PromiseLike<{ data: unknown; error: unknown }>;
  };
  const { data, error } = await db.rpc("demo_write_allowed");
  return !error && data === true;
}

/**
 * Runs a server action: checks the session and role (CORE-02; row-level security
 * checks again), validates the form, runs `handler`, revalidates and reports. On a
 * public demo it also applies the demo restrictions and write limit.
 */
export async function runAction<T>(
  formData: FormData,
  options: ActionOptions<T>,
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
    if (schoolEnv().demo && options.demoBlocked) return { status: "error", message: DEMO_DISABLED };
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

  if (schoolEnv().demo && !(await demoWriteAllowed(ctx.supabase))) {
    return {
      status: "error",
      message: "Too many changes in a short time. Wait a minute and try again.",
    };
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
