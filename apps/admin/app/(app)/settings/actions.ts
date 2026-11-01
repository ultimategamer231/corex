"use server";

import { z } from "zod";
import { ActionError, must, runAction } from "@/lib/action";
import { authEmailFor, emailSchema, usernameSchema } from "@/lib/auth/identity";
import { companySchema, invoicingSchema } from "@/lib/billing-settings";
import { LINK_HOURS, randomToken } from "@/lib/auth/tokens";
import { sendEmail, simpleEmailHtml } from "@/lib/email";
import { optionalText, requiredText, uuid } from "@/lib/fields";
import type { FormState } from "@/lib/form-state";
import { logEvent } from "@/lib/log";
import { runDailyJob } from "@/lib/daily-job";
import { priceItemRow, priceItemSchema, renewalsConfig, renewalsSchema } from "@/lib/price-list";
import { DEVICE_DAY_CHOICES, TIMEOUT_CHOICES } from "@/lib/settings";
import type { AdminSession } from "@/lib/session";
import { issueLink, signOutEverywhere } from "@/lib/team";

const TEAM = ["/settings"];

async function targetAdmin(session: AdminSession, adminId: string) {
  const row = must(
    await session
      .service()
      .from("admins")
      .select("id, user_id, username, name, email, status")
      .eq("id", adminId)
      .maybeSingle(),
  );
  if (!row) throw new ActionError("This admin was not found.");
  return row;
}

const inviteSchema = z.object({
  name: requiredText("a name", 100).refine((v) => v.length >= 2, "Enter a name"),
  username: usernameSchema,
  email: optionalText.pipe(emailSchema.nullable()),
});

/** Settings → Team: invite an admin (SPEC-ADMIN.md 3.1). Returns a 72-hour set-up link. */
export async function inviteAdmin(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { schema: inviteSchema, revalidate: TEAM },
    async (data, session): Promise<FormState> => {
      const service = session.service();
      const { count: usernameTaken } = await service
        .from("admins")
        .select("id", { count: "exact", head: true })
        .eq("username", data.username);
      if (usernameTaken) {
        return { status: "error", fieldErrors: { username: "This username is taken" } };
      }
      if (data.email) {
        const { count: emailTaken } = await service
          .from("admins")
          .select("id", { count: "exact", head: true })
          .eq("email", data.email);
        if (emailTaken) {
          return { status: "error", fieldErrors: { email: "An admin already uses this email" } };
        }
      }

      const created = await service.auth.admin.createUser({
        email: authEmailFor(data.username, data.email),
        // Replaced when the invite is accepted; never shown to anyone.
        password: `${randomToken()}Aa1!`,
        email_confirm: true,
        user_metadata: { name: data.name },
      });
      if (created.error || !created.data.user) {
        throw new ActionError("This email address already has an account. Use another one.");
      }
      const admin = must(
        await service
          .from("admins")
          .insert({
            user_id: created.data.user.id,
            username: data.username,
            name: data.name,
            email: data.email,
            status: "invited",
            invited_by: session.admin.id,
          })
          .select("id")
          .single(),
      );
      const link = await issueLink(service, admin.id, "invite", LINK_HOURS.invite);
      let emailed = false;
      if (data.email) {
        const status = await sendEmail(service, {
          to: data.email,
          subject: "You are invited to Corex Admin",
          template: "invite",
          entityType: "admins",
          entityId: admin.id,
          audience: "team",
          text: `Hello ${data.name},\n\n${session.admin.name} invited you to Corex Admin. Open this link within 72 hours to choose a password and set up an authenticator app:\n${link}\n\nYour username is ${data.username}.`,
          html: simpleEmailHtml(
            "You are invited to Corex Admin",
            [
              `Hello ${data.name},`,
              `${session.admin.name} invited you to Corex Admin. Open the link within 72 hours to choose a password and set up an authenticator app.`,
              `Your username is ${data.username}.`,
            ],
            { label: "Set up my account", url: link },
          ),
        });
        emailed = status === "sent";
      }
      await logEvent(service, {
        area: "team",
        action: "invite_created",
        summary: `Invited ${data.name} (${data.username})${emailed ? "; invite emailed" : ""}`,
        actorId: session.admin.userId,
        entityType: "admins",
        entityId: admin.id,
        context: session.context,
      });
      return {
        status: "success",
        message: emailed
          ? `Invite emailed to ${data.email}. You can also send this link.`
          : "Send this link to them, for example on WhatsApp.",
        data: { link },
      };
    },
  );
}

const adminIdSchema = z.object({ adminId: uuid("an admin") });

/** A new 72-hour invite link for someone who has not accepted yet. */
export async function newInviteLink(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { schema: adminIdSchema, revalidate: TEAM },
    async ({ adminId }, session) => {
      const target = await targetAdmin(session, adminId);
      if (target.status !== "invited")
        throw new ActionError("This admin already accepted the invite.");
      const service = session.service();
      const link = await issueLink(service, target.id, "invite", LINK_HOURS.invite);
      await logEvent(service, {
        area: "team",
        action: "invite_renewed",
        summary: `New invite link for ${target.name}; the old one no longer works`,
        actorId: session.admin.userId,
        entityType: "admins",
        entityId: target.id,
        context: session.context,
      });
      return {
        status: "success",
        message: "Send this new link. The old one no longer works.",
        data: { link },
      };
    },
  );
}

/** A 24-hour password reset link to pass on, for admins without email (owner decision). */
export async function passwordResetLink(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return runAction(
    formData,
    { schema: adminIdSchema, revalidate: TEAM },
    async ({ adminId }, session) => {
      const target = await targetAdmin(session, adminId);
      if (target.status !== "active")
        throw new ActionError("Only active admins can reset a password.");
      const service = session.service();
      const link = await issueLink(
        service,
        target.id,
        "password_reset",
        LINK_HOURS.password_reset_link,
      );
      await logEvent(service, {
        area: "team",
        action: "password_reset_link_created",
        summary: `Created a password reset link for ${target.name}`,
        actorId: session.admin.userId,
        entityType: "admins",
        entityId: target.id,
        context: session.context,
      });
      return {
        status: "success",
        message: "Send this link to them. It works once, for 24 hours.",
        data: { link },
      };
    },
  );
}

/**
 * For a lost phone: removes the admin's authenticator, signs them out everywhere,
 * forgets their trusted devices and returns a 72-hour set-up link.
 */
export async function resetAuthenticator(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return runAction(
    formData,
    { schema: adminIdSchema, revalidate: TEAM },
    async ({ adminId }, session) => {
      const target = await targetAdmin(session, adminId);
      if (target.status !== "active")
        throw new ActionError("Only active admins have an authenticator.");
      const service = session.service();
      const factors = await service.auth.admin.mfa.listFactors({ userId: target.user_id });
      for (const factor of factors.data?.factors ?? []) {
        await service.auth.admin.mfa.deleteFactor({ id: factor.id, userId: target.user_id });
      }
      await signOutEverywhere(service, target.user_id);
      const link = await issueLink(
        service,
        target.id,
        "authenticator_setup",
        LINK_HOURS.authenticator_setup,
      );
      await logEvent(service, {
        area: "team",
        action: "authenticator_reset",
        summary: `Reset the authenticator of ${target.name}; signed them out everywhere`,
        actorId: session.admin.userId,
        entityType: "admins",
        entityId: target.id,
        context: session.context,
      });
      return {
        status: "success",
        message:
          "Send this link to them to set up their authenticator again. It works for 72 hours.",
        data: { link },
      };
    },
  );
}

/** AUTH-07: blocks sign-in at once; the past stays in the activity log. */
export async function removeAdmin(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { schema: adminIdSchema, revalidate: TEAM },
    async ({ adminId }, session) => {
      const target = await targetAdmin(session, adminId);
      if (target.id === session.admin.id) {
        throw new ActionError("You cannot remove yourself. Ask another admin.");
      }
      if (target.status === "removed") throw new ActionError("This admin was already removed.");
      const service = session.service();
      must(await service.from("admins").update({ status: "removed" }).eq("id", target.id));
      // Refresh tokens stop working too, so no new session can start.
      await service.auth.admin.updateUserById(target.user_id, { ban_duration: "876000h" });
      await logEvent(service, {
        area: "team",
        action: "admin_removed",
        summary: `Removed ${target.name} (${target.username}); signed out everywhere`,
        actorId: session.admin.userId,
        entityType: "admins",
        entityId: target.id,
        context: session.context,
      });
      return `${target.name} was removed.`;
    },
  );
}

const securitySchema = z.object({
  timeout: z.coerce
    .number()
    .refine((v) => (TIMEOUT_CHOICES as readonly number[]).includes(v), "Choose a time"),
  deviceDays: z.coerce
    .number()
    .refine((v) => (DEVICE_DAY_CHOICES as readonly number[]).includes(v), "Choose a period"),
});

/** Settings → Security (AUTH-05, AUTH-06). */
export async function saveSecurity(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { schema: securitySchema, revalidate: TEAM },
    async (data, session) => {
      const current = must(await session.supabase.from("settings").select("config").single());
      const config = {
        ...(current.config as Record<string, unknown>),
        session_timeout_minutes: data.timeout,
        trusted_device_days: data.deviceDays,
      };
      must(await session.supabase.from("settings").update({ config }).eq("id", true));
      return "Security settings saved.";
    },
  );
}

/** Forgets every device this admin trusted; the next sign-in on each asks for a code. */
export async function forgetMyDevices(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return runAction(formData, { schema: z.object({}), revalidate: TEAM }, async (_data, session) => {
    const service = session.service();
    must(
      await service
        .from("trusted_devices")
        .update({ revoked_at: new Date().toISOString() })
        .eq("user_id", session.admin.userId)
        .is("revoked_at", null),
    );
    return "Your trusted devices were forgotten. Each will ask for a code next time.";
  });
}

/** Settings → Company details: printed on invoices, receipts and emails. */
export async function saveCompany(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, { schema: companySchema, revalidate: TEAM }, async (data, session) => {
    const current = must(await session.supabase.from("settings").select("config").single());
    const config = {
      ...(current.config as Record<string, unknown>),
      company_address: data.address,
      company_phone: data.phone,
      company_email: data.email,
      company_website: data.website,
      company_tax_id: data.taxId,
    };
    must(
      await session.supabase
        .from("settings")
        .update({ org_name: data.name, config })
        .eq("id", true),
    );
    return "Company details saved.";
  });
}

/** Settings → Invoicing and payments: terms, numbering, tax and payment instructions. */
export async function saveInvoicing(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { schema: invoicingSchema, revalidate: TEAM },
    async (data, session) => {
      const current = must(await session.supabase.from("settings").select("config").single());
      const config = {
        ...(current.config as Record<string, unknown>),
        payment_terms_days: data.termsDays,
        invoice_prefix: data.invoicePrefix,
        receipt_prefix: data.receiptPrefix,
        tax_enabled: data.taxEnabled,
        tax_rate_bp: data.taxRateBp,
        tax_label: data.taxLabel,
        payment_instructions: data.paymentInstructions,
        invoice_terms: data.invoiceTerms,
      };
      must(await session.supabase.from("settings").update({ config }).eq("id", true));
      return "Invoicing settings saved. They apply to new drafts and invoices sent from now on.";
    },
  );
}

/** Settings → Price list: add or change an item. Past invoices keep their prices. */
export async function savePriceItem(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { schema: priceItemSchema, revalidate: ["/settings", "/invoices"] },
    async (data, session) => {
      const row = priceItemRow(data);
      if (data.id) {
        must(
          await session.supabase
            .from("price_list_items")
            .update(row)
            .eq("id", data.id)
            .select("id")
            .single(),
        );
        return `${data.name} saved.`;
      }
      must(await session.supabase.from("price_list_items").insert(row).select("id").single());
      return `${data.name} added to the price list.`;
    },
  );
}

const priceRef = z.object({ id: uuid("an item") });

/** Settings → Price list: remove an item. Invoices already drafted keep their lines. */
export async function removePriceItem(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return runAction(
    formData,
    { schema: priceRef, revalidate: ["/settings", "/invoices"] },
    async (data, session) => {
      must(
        await session.supabase
          .from("price_list_items")
          .delete()
          .eq("id", data.id)
          .select("id")
          .single(),
      );
      return "Item removed from the price list.";
    },
  );
}

/** Settings → Renewals: the daily job's rules and the hosting-cost warning. */
export async function saveRenewals(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { schema: renewalsSchema, revalidate: ["/settings", "/subscriptions", "/clients", "/"] },
    async (data, session) => {
      const current = must(await session.supabase.from("settings").select("config").single());
      const config = {
        ...(current.config as Record<string, string | number | boolean>),
        ...(renewalsConfig(data) as Record<string, string | number>),
      };
      must(await session.supabase.from("settings").update({ config }).eq("id", true));
      return "Renewal settings saved. The next daily check follows them.";
    },
  );
}

/** Settings → Renewals: run the daily check now (it changes nothing if it already ran). */
export async function runDailyCheck(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { schema: z.object({}), revalidate: ["/settings", "/subscriptions", "/invoices", "/"] },
    async (_data, session) => {
      const outcome = await runDailyJob(session.service(), "manual", session.context);
      const s = outcome.summary as Record<string, number | boolean>;
      const made = Number(s.renewal_invoices ?? 0);
      const reminders = Number(s.reminders ?? 0);
      const parts = [
        made
          ? `${made} renewal invoice${made === 1 ? "" : "s"} ${s.renewal_invoices_sent ? "sent" : "drafted"}`
          : null,
        reminders ? `${reminders} reminder${reminders === 1 ? "" : "s"} recorded` : null,
      ].filter(Boolean);
      return parts.length
        ? `Daily check done: ${parts.join(", ")}.`
        : "Daily check done: nothing new to do.";
    },
  );
}
