import { revalidatePath } from "next/cache";
import type { z } from "zod";
import type { FormState } from "./form-state";
import { formObject } from "./fields";
import { AdminAuthError, type AdminSession, requireAdmin } from "./session";

/** An error whose message is safe and useful to show the admin. */
export class ActionError extends Error {
  override name = "ActionError";
}

type DbError = { message: string; code?: string };

/** User-facing text for a database error. Our own rule messages are shown as they are. */
export function dbMessage(error: DbError): string {
  const { message, code } = error;
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

export function fieldErrorsOf(issues: z.core.$ZodIssue[]): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
  return fieldErrors;
}

/**
 * Runs a server action for a signed-in admin (SPEC-ADMIN.md 12): checks the verified
 * session (AUTH-01; row-level security checks again), validates the form with zod, runs
 * `handler`, revalidates and reports.
 */
export async function runAction<T>(
  formData: FormData,
  options: { schema: z.ZodType<T>; revalidate?: string[] },
  handler: (data: T, session: AdminSession) => Promise<string | FormState | void>,
): Promise<FormState> {
  let session: AdminSession;
  try {
    session = await requireAdmin();
  } catch (error) {
    if (error instanceof AdminAuthError) return { status: "error", message: error.message };
    throw error;
  }

  const parsed = options.schema.safeParse(formObject(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error.issues),
    };
  }

  try {
    const result = await handler(parsed.data, session);
    for (const path of options.revalidate ?? []) revalidatePath(path, "layout");
    if (typeof result === "string") return { status: "success", message: result };
    return result ?? { status: "success", message: "Saved." };
  } catch (error) {
    if (error instanceof ActionError) return { status: "error", message: error.message };
    throw error;
  }
}
