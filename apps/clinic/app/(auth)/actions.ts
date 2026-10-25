"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { formObject } from "@/lib/action";
import { DEMO_DISABLED } from "@/lib/demo";
import { clinicEnv } from "@/lib/env";
import type { FormState } from "@/lib/form-state";
import { getAdminSupabase, getSupabase } from "@/lib/supabase";

const signInSchema = z.object({
  email: z.email("Enter your email address"),
  password: z.string().min(1, "Enter your password"),
  next: z.string().optional(),
});

/**
 * Demo only: 10 sign-in attempts per IP address per 15 minutes (SPEC.md 11.3). The
 * counter lives in the demo schema and is updated with the service-role key.
 */
async function demoLoginAllowed(): Promise<boolean> {
  const forwarded = (await headers()).get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  const db = getAdminSupabase() as unknown as {
    rpc(
      fn: "demo_rate_hit",
      args: { p_key: string; p_limit: number; p_window_seconds: number },
    ): PromiseLike<{ data: unknown; error: unknown }>;
  };
  const { data, error } = await db.rpc("demo_rate_hit", {
    p_key: `login:${ip}`,
    p_limit: 10,
    p_window_seconds: 900,
  });
  return !error && data === true;
}

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
  if (clinicEnv().demo && !(await demoLoginAllowed())) {
    return {
      status: "error",
      message: "Too many sign-in attempts. Wait 15 minutes and try again.",
    };
  }
  const supabase = await getSupabase();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { status: "error", message: "The email or password is not correct." };

  // A valid login without an active membership in this organization is refused (SPEC.md 5.3).
  const { error: loginError } = await supabase.rpc("log_login");
  if (loginError) {
    await supabase.auth.signOut();
    return { status: "error", message: "This account does not have access to this organization." };
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
  // The demo sends no email (SPEC.md 11.3).
  if (clinicEnv().demo) return { status: "error", message: DEMO_DISABLED };
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
  if (clinicEnv().demo) return { status: "error", message: DEMO_DISABLED };
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
