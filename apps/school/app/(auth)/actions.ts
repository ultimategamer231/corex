"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { formObject } from "@/lib/action";
import type { FormState } from "@/lib/form-state";
import { getSupabase } from "@/lib/supabase";

const signInSchema = z.object({
  email: z.email("Enter your email address"),
  password: z.string().min(1, "Enter your password"),
  next: z.string().optional(),
});

/** Only same-site paths are followed after sign-in. */
function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function signIn(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse(formObject(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { status: "error", message: "Please check the highlighted fields.", fieldErrors };
  }
  const supabase = await getSupabase();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { status: "error", message: "The email or password is not correct." };

  // A valid login without an active membership in this school is refused (SPEC.md 5.3).
  const { error: loginError } = await supabase.rpc("log_login");
  if (loginError) {
    await supabase.auth.signOut();
    return { status: "error", message: "This account does not have access to this school." };
  }
  redirect(safeNext(parsed.data.next));
}

export async function signOut(): Promise<void> {
  const supabase = await getSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}

const resetSchema = z.object({ email: z.email("Enter your email address") });

export async function requestPasswordReset(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resetSchema.safeParse(formObject(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: { email: "Enter your email address" } };
  }
  const supabase = await getSupabase();
  const origin = process.env.APP_URL ?? "http://localhost:3001";
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  // Same answer whether or not the address exists, so accounts cannot be discovered.
  return {
    status: "success",
    message: "If this email has an account, we sent a link to reset the password.",
  };
}

const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .regex(/[a-z]/, "Include a lowercase letter")
      .regex(/[A-Z]/, "Include an uppercase letter")
      .regex(/[0-9]/, "Include a number"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "The passwords do not match",
  });

export async function updatePassword(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse(formObject(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { status: "error", fieldErrors };
  }
  const supabase = await getSupabase();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: "error", message: "The reset link has expired. Request a new one." };
  redirect("/");
}
