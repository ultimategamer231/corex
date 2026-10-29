"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldErrorsOf } from "@/lib/action";
import { parseIdentifier, passwordSchema, sessionIdOf } from "@/lib/auth/identity";
import { codeKey, codesPaused, recordFailure, signInKeys, signInPaused } from "@/lib/auth/limits";
import { findLink } from "@/lib/auth/links";
import { hashToken, hoursFromNow, LINK_HOURS, randomToken } from "@/lib/auth/tokens";
import {
  deviceCookieOptions,
  readDeviceCookie,
  signDeviceCookie,
  TRUSTED_DEVICE_COOKIE,
} from "@/lib/auth/trusted-device";
import { sendEmail, simpleEmailHtml } from "@/lib/email";
import { adminEnv, trustedDeviceSecret } from "@/lib/env";
import { formObject } from "@/lib/fields";
import type { FormState } from "@/lib/form-state";
import { logEvent } from "@/lib/log";
import { requestContext, type RequestContext } from "@/lib/request-context";
import { securitySettings } from "@/lib/settings";
import { signOutEverywhere } from "@/lib/team";
import { type AdminDb, getServiceSupabase, getSupabase } from "@/lib/supabase";

const GENERIC_SIGN_IN_ERROR = "The email or username, or the password, is not correct.";
const PAUSED = "Sign-in is paused for 15 minutes after too many failed attempts. Try again later.";

/** Supabase Auth's own password rules (for example letters and numbers) are shown as they are. */
function passwordProblem(error: { code?: string; message: string }): string {
  return error.code === "weak_password"
    ? error.message
    : "This password cannot be used. Try another one.";
}

/** Only same-site paths are followed after sign-in. */
function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login")
    ? next
    : "/";
}

type AdminRow = {
  id: string;
  user_id: string;
  username: string;
  name: string;
  email: string | null;
  status: string;
};

async function findAdmin(service: AdminDb, input: string): Promise<AdminRow | null> {
  const id = parseIdentifier(input);
  if (!id) return null;
  const { data } = await service
    .from("admins")
    .select("id, user_id, username, name, email, status")
    .eq(id.kind === "email" ? "email" : "username", id.value)
    .maybeSingle();
  return data;
}

async function authEmail(service: AdminDb, userId: string): Promise<string | null> {
  const { data } = await service.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

/** Records that this browser session passed the second step (AUTH-01). */
async function recordVerifiedSession(
  service: AdminDb,
  userId: string,
  accessToken: string,
  method: "authenticator" | "trusted_device",
  context: RequestContext,
): Promise<void> {
  const sessionId = sessionIdOf(accessToken);
  if (!sessionId) throw new Error("The sign-in session has no id.");
  const { error } = await service.from("admin_sessions").upsert(
    {
      user_id: userId,
      session_id: sessionId,
      method,
      verified_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      revoked_at: null,
      ip: context.ip,
      user_agent: context.userAgent,
    },
    { onConflict: "session_id" },
  );
  if (error) throw new Error(`Could not record the session: ${error.message}`);
}

/** The trusted-device cookie, when it is valid for this admin (AUTH-06). */
async function trustedDevice(service: AdminDb, userId: string): Promise<string | null> {
  const store = await cookies();
  const cookie = readDeviceCookie(trustedDeviceSecret(), store.get(TRUSTED_DEVICE_COOKIE)?.value);
  if (!cookie || cookie.userId !== userId) return null;
  const { data } = await service
    .from("trusted_devices")
    .select("id, token_hash, expires_at, revoked_at")
    .eq("id", cookie.deviceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (
    !data ||
    data.revoked_at ||
    new Date(data.expires_at) <= new Date() ||
    data.token_hash !== hashToken(cookie.token)
  ) {
    return null;
  }
  return data.id;
}

const signInSchema = z.object({
  identifier: z
    .string({ error: "Enter your email or username" })
    .trim()
    .min(1, "Enter your email or username")
    .max(254),
  password: z.string({ error: "Enter your password" }).min(1, "Enter your password").max(128),
  next: z.string().optional(),
});

/** Step 1: email or username and password (SPEC-ADMIN.md 3.1, AUTH-04). */
export async function signIn(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse(formObject(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error.issues),
    };
  }
  const { identifier, password, next } = parsed.data;
  const context = await requestContext();
  const service = getServiceSupabase(context);

  if (await signInPaused(service, identifier, context.ip)) {
    await logEvent(service, {
      area: "sign_in",
      action: "sign_in_paused",
      summary: `Sign-in refused while paused for "${identifier.toLowerCase().slice(0, 80)}"`,
      context,
    });
    return { status: "error", message: PAUSED };
  }

  const admin = await findAdmin(service, identifier);
  const email = admin?.status === "active" ? await authEmail(service, admin.user_id) : null;
  const supabase = await getSupabase();
  const result = email
    ? await supabase.auth.signInWithPassword({ email, password })
    : { data: { session: null }, error: new Error("unknown") };

  if (result.error || !result.data.session || !admin) {
    const keys = signInKeys(identifier, context.ip);
    await recordFailure(service, keys.identifier);
    await recordFailure(service, keys.ip);
    await logEvent(service, {
      area: "sign_in",
      action: "sign_in_failed",
      summary: `Failed sign-in for "${identifier.toLowerCase().slice(0, 80)}"`,
      actorId: admin?.user_id ?? null,
      context,
    });
    return { status: "error", message: GENERIC_SIGN_IN_ERROR };
  }

  const factors = await supabase.auth.mfa.listFactors();
  if (!factors.data?.totp.some((f) => f.status === "verified")) {
    await supabase.auth.signOut({ scope: "local" });
    return {
      status: "error",
      message:
        "This account has no authenticator app set up yet. Ask another admin for a set-up link.",
    };
  }

  const deviceId = await trustedDevice(service, admin.user_id);
  if (deviceId) {
    const actor = getServiceSupabase(context, admin.user_id);
    await recordVerifiedSession(
      actor,
      admin.user_id,
      result.data.session.access_token,
      "trusted_device",
      context,
    );
    await actor
      .from("trusted_devices")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", deviceId);
    await logEvent(actor, {
      area: "sign_in",
      action: "sign_in",
      summary: "Signed in with password on a trusted device",
      actorId: admin.user_id,
      context,
    });
    redirect(safeNext(next));
  }

  redirect(next ? `/login/verify?next=${encodeURIComponent(safeNext(next))}` : "/login/verify");
}

const verifySchema = z.object({
  code: z
    .string({ error: "Enter the 6-digit code" })
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app"),
  trust: z.string().optional(),
  next: z.string().optional(),
});

/** Step 2: the code from the authenticator app, optionally trusting this device. */
export async function verifyCode(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = verifySchema.safeParse(formObject(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error.issues),
    };
  }
  const context = await requestContext();
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?reason=signed-out");
  const service = getServiceSupabase(context, user.id);

  if (await codesPaused(service, user.id)) {
    await supabase.auth.signOut({ scope: "local" });
    return { status: "error", message: PAUSED };
  }

  const factors = await supabase.auth.mfa.listFactors();
  const factor = factors.data?.totp.find((f) => f.status === "verified");
  if (!factor) {
    await supabase.auth.signOut({ scope: "local" });
    redirect("/login?reason=no-access");
  }
  const verified = await supabase.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code: parsed.data.code,
  });
  if (verified.error) {
    await recordFailure(service, codeKey(user.id));
    await logEvent(service, {
      area: "sign_in",
      action: "code_failed",
      summary: "Wrong authenticator code",
      actorId: user.id,
      context,
    });
    return {
      status: "error",
      message: "That code is not correct. Codes change every 30 seconds; enter the current one.",
      fieldErrors: { code: "Enter the current 6-digit code" },
    };
  }

  await recordVerifiedSession(
    service,
    user.id,
    verified.data.access_token,
    "authenticator",
    context,
  );

  const trust = parsed.data.trust === "on";
  const { trustedDeviceDays } = await securitySettings(service);
  if (trust) {
    const token = randomToken();
    const { data: device, error } = await service
      .from("trusted_devices")
      .insert({
        user_id: user.id,
        token_hash: hashToken(token),
        label: context.userAgent,
        expires_at: hoursFromNow(trustedDeviceDays * 24),
      })
      .select("id")
      .single();
    if (!error && device) {
      const store = await cookies();
      store.set(
        TRUSTED_DEVICE_COOKIE,
        signDeviceCookie(trustedDeviceSecret(), { deviceId: device.id, userId: user.id, token }),
        deviceCookieOptions(process.env.NODE_ENV === "production", trustedDeviceDays),
      );
    }
  }

  await logEvent(service, {
    area: "sign_in",
    action: "sign_in",
    summary: trust
      ? `Signed in with password and authenticator code; trusted this device for ${trustedDeviceDays} days`
      : "Signed in with password and authenticator code",
    actorId: user.id,
    context,
  });
  redirect(safeNext(parsed.data.next));
}

/** Ends this session everywhere it is checked: the session row and the Supabase cookie. */
export async function signOut(): Promise<void> {
  const context = await requestContext();
  const supabase = await getSupabase();
  const { data: session } = await supabase.auth.getSession();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const sessionId = session.session ? sessionIdOf(session.session.access_token) : null;
  if (user) {
    const service = getServiceSupabase(context, user.id);
    if (sessionId) {
      await service
        .from("admin_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("session_id", sessionId)
        .is("revoked_at", null);
    }
    await logEvent(service, {
      area: "sign_in",
      action: "sign_out",
      summary: "Signed out",
      actorId: user.id,
      context,
    });
  }
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?reason=signed-out-now");
}

/** Goes back to the first step from the code step. */
export async function cancelSignIn(): Promise<void> {
  const supabase = await getSupabase();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}

const forgotSchema = z.object({
  identifier: z
    .string({ error: "Enter your email or username" })
    .trim()
    .min(1, "Enter your email or username")
    .max(254),
});

const RESET_SENT =
  "If this account has an email address, we sent it a link to reset the password. It works for 1 hour. Admins without an email address: ask another admin for a reset link.";

/** Password reset by email, for admins with an email address (owner decision). */
export async function requestPasswordReset(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = forgotSchema.safeParse(formObject(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }
  const context = await requestContext();
  const service = getServiceSupabase(context);
  const key = `admin_reset:${parsed.data.identifier.toLowerCase()}`;
  const { data: allowed } = await service.rpc("hit_rate_limit", {
    p_key: key,
    p_limit: 3,
    p_window_seconds: 3600,
  });
  const admin = await findAdmin(service, parsed.data.identifier);
  if (allowed === true && admin?.status === "active" && admin.email) {
    const token = randomToken();
    await service.from("admin_tokens").insert({
      admin_id: admin.id,
      kind: "password_reset",
      token_hash: hashToken(token),
      expires_at: hoursFromNow(LINK_HOURS.password_reset_email),
    });
    const url = `${adminEnv().adminUrl}/reset-password?token=${token}`;
    await sendEmail(service, {
      to: admin.email,
      subject: "Reset your Corex Admin password",
      template: "password_reset",
      entityType: "admins",
      entityId: admin.id,
      audience: "team",
      text: `Hello ${admin.name},\n\nUse this link within 1 hour to choose a new password for Corex Admin:\n${url}\n\nIf you did not ask for this, ignore this email; your password stays the same.`,
      html: simpleEmailHtml(
        "Reset your Corex Admin password",
        [
          `Hello ${admin.name},`,
          "Use the button below within 1 hour to choose a new password.",
          "If you did not ask for this, ignore this email; your password stays the same.",
        ],
        { label: "Choose a new password", url },
      ),
    });
    await logEvent(service, {
      area: "team",
      action: "password_reset_requested",
      summary: `Password reset link emailed to ${admin.name}`,
      actorId: admin.user_id,
      entityType: "admins",
      entityId: admin.id,
      context,
    });
  }
  return { status: "success", message: RESET_SENT };
}

const resetSchema = z
  .object({
    token: z.string().min(20).max(100),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "The passwords do not match",
  });

/** Sets a new password from a reset link and signs the admin out everywhere. */
export async function resetPassword(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse(formObject(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error.issues),
    };
  }
  const context = await requestContext();
  const service = getServiceSupabase(context);
  const link = await findLink(service, parsed.data.token, ["password_reset"]);
  if (!link) {
    return { status: "error", message: "This link is no longer valid. Ask for a new one." };
  }
  const { error } = await service.auth.admin.updateUserById(link.admin.user_id, {
    password: parsed.data.password,
  });
  if (error) return { status: "error", fieldErrors: { password: passwordProblem(error) } };
  const now = new Date().toISOString();
  const actor = getServiceSupabase(context, link.admin.user_id);
  await actor.from("admin_tokens").update({ used_at: now }).eq("id", link.id);
  await signOutEverywhere(actor, link.admin.user_id);
  await logEvent(actor, {
    area: "team",
    action: "password_reset",
    summary: `${link.admin.name} set a new password from a reset link; signed out everywhere`,
    actorId: link.admin.user_id,
    entityType: "admins",
    entityId: link.admin.id,
    context,
  });
  redirect("/login?reason=password-changed");
}

const startSetupSchema = z.object({
  token: z.string().min(20).max(100),
  password: z.string({ error: "Enter a password" }).min(1, "Enter a password").max(128),
  confirm: z.string().optional(),
});

/**
 * Account set-up from an invite or an authenticator reset link, step 1: an invite
 * chooses the password; an authenticator reset confirms it. Then a new authenticator
 * is enrolled and its QR code returned.
 */
export async function startSetup(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = startSetupSchema.safeParse(formObject(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error.issues),
    };
  }
  const context = await requestContext();
  const service = getServiceSupabase(context);
  const link = await findLink(service, parsed.data.token, ["invite", "authenticator_setup"]);
  if (!link)
    return { status: "error", message: "This link is no longer valid. Ask for a new one." };

  if (link.kind === "invite") {
    const password = passwordSchema.safeParse(parsed.data.password);
    if (!password.success) {
      return {
        status: "error",
        fieldErrors: {
          password: password.error.issues[0]?.message ?? "Use at least 12 characters",
        },
      };
    }
    if (parsed.data.password !== parsed.data.confirm) {
      return { status: "error", fieldErrors: { confirm: "The passwords do not match" } };
    }
    const { error } = await service.auth.admin.updateUserById(link.admin.user_id, {
      password: parsed.data.password,
    });
    if (error) return { status: "error", fieldErrors: { password: passwordProblem(error) } };
  } else if (await signInPaused(service, link.admin.username, context.ip)) {
    // An authenticator reset confirms the password by signing in below; failures
    // count towards the same pause as the sign-in page (AUTH-04).
    return { status: "error", message: PAUSED };
  }

  const email = await authEmail(service, link.admin.user_id);
  const supabase = await getSupabase();
  const signedIn = email
    ? await supabase.auth.signInWithPassword({ email, password: parsed.data.password })
    : { error: new Error("no account") };
  if (signedIn.error) {
    const keys = signInKeys(link.admin.username, context.ip);
    await recordFailure(service, keys.identifier);
    await recordFailure(service, keys.ip);
    return { status: "error", fieldErrors: { password: "This password is not correct" } };
  }

  // Leftover unfinished enrolments are removed before a new one starts.
  const factors = await supabase.auth.mfa.listFactors();
  for (const factor of factors.data?.all ?? []) {
    if (factor.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }
  const enrolled = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Corex Admin ${new Date().toISOString().slice(0, 10)}`,
    issuer: "Corex Admin",
  });
  if (enrolled.error) {
    return {
      status: "error",
      message:
        "The authenticator could not be set up. If one is already set up, ask another admin to reset it.",
    };
  }
  return {
    status: "success",
    data: {
      factorId: enrolled.data.id,
      qr: enrolled.data.totp.qr_code,
      secret: enrolled.data.totp.secret,
    },
  };
}

const finishSetupSchema = z.object({
  token: z.string().min(20).max(100),
  factorId: z.uuid(),
  code: z
    .string({ error: "Enter the 6-digit code" })
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app"),
});

/** Step 2: the first code from the new authenticator finishes the set-up. */
export async function finishSetup(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = finishSetupSchema.safeParse(formObject(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: fieldErrorsOf(parsed.error.issues),
    };
  }
  const context = await requestContext();
  const service = getServiceSupabase(context);
  const link = await findLink(service, parsed.data.token, ["invite", "authenticator_setup"]);
  if (!link)
    return { status: "error", message: "This link is no longer valid. Ask for a new one." };
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== link.admin.user_id) {
    return { status: "error", message: "Start again from the link." };
  }
  const verified = await supabase.auth.mfa.challengeAndVerify({
    factorId: parsed.data.factorId,
    code: parsed.data.code,
  });
  if (verified.error) {
    return {
      status: "error",
      fieldErrors: { code: "That code is not correct. Enter the current 6-digit code." },
    };
  }

  const now = new Date().toISOString();
  const actor = getServiceSupabase(context, link.admin.user_id);
  await actor.from("admin_tokens").update({ used_at: now }).eq("id", link.id);
  if (link.kind === "invite") {
    await actor.from("admins").update({ status: "active" }).eq("id", link.admin.id);
  }
  await recordVerifiedSession(actor, user.id, verified.data.access_token, "authenticator", context);
  await logEvent(actor, {
    area: "team",
    action: link.kind === "invite" ? "invite_accepted" : "authenticator_set_up",
    summary:
      link.kind === "invite"
        ? `${link.admin.name} accepted the invite and set up an authenticator app`
        : `${link.admin.name} set up a new authenticator app`,
    actorId: user.id,
    entityType: "admins",
    entityId: link.admin.id,
    context,
  });
  redirect("/");
}
