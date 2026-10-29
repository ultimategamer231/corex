"use server";

import { z } from "zod";
import { ActionError, must, runAction } from "@/lib/action";
import { uuid } from "@/lib/fields";
import type { FormState } from "@/lib/form-state";
import {
  activitySchema,
  leadStatusSchema,
  manualLeadSchema,
  moveSchema,
  quoteSchema,
  stageLabel,
} from "@/lib/leads";
import type { AdminSession } from "@/lib/session";

const LEADS = ["/leads"];

async function activeAdminOrNull(session: AdminSession, adminId: string | null) {
  if (!adminId) return null;
  const row = must(
    await session.supabase.from("admins").select("id, status").eq("id", adminId).maybeSingle(),
  );
  if (row?.status !== "active") throw new ActionError("Choose an active admin.");
  return row.id;
}

/** LEAD-02: a lead added by hand. Returns its id so the form can open it. */
export async function addLead(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { schema: manualLeadSchema, revalidate: LEADS },
    async (data, session): Promise<FormState> => {
      const lead = must(
        await session.supabase
          .from("leads")
          .insert({
            source: "manual",
            name: data.name,
            organization: data.organization,
            phone: data.phone,
            email: data.email,
            country: data.country,
            product: data.product,
            plan_interest: data.plan,
            message: data.message,
          })
          .select("id")
          .single(),
      );
      return { status: "success", message: "Lead added.", data: { leadId: lead.id } };
    },
  );
}

const editSchema = z.intersection(z.object({ leadId: uuid("a lead") }), manualLeadSchema);

/** Corrects a lead added by hand. Website requests stay as sent (LEAD-01). */
export async function editLead(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, { schema: editSchema, revalidate: LEADS }, async (data, session) => {
    const lead = must(
      await session.supabase.from("leads").select("source").eq("id", data.leadId).maybeSingle(),
    );
    if (!lead) throw new ActionError("This lead was not found.");
    if (lead.source !== "manual") {
      throw new ActionError("A website request stays as it was sent. Add a note instead.");
    }
    must(
      await session.supabase
        .from("leads")
        .update({
          name: data.name,
          organization: data.organization,
          phone: data.phone,
          email: data.email,
          country: data.country,
          product: data.product,
          plan_interest: data.plan,
          message: data.message,
        })
        .eq("id", data.leadId),
    );
    return "Details saved.";
  });
}

/** LEAD-04: stage (Lost needs a reason), assignment, follow-up and next step. */
export async function saveLeadStatus(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { schema: leadStatusSchema, revalidate: LEADS },
    async (data, session) => {
      const assigned = await activeAdminOrNull(session, data.assigned);
      const updated = must(
        await session.supabase
          .from("leads")
          .update({
            stage: data.stage,
            lost_reason: data.stage === "lost" ? data.lostReason : null,
            assigned_admin_id: assigned,
            follow_up_on: data.followUp,
            next_step: data.nextStep,
          })
          .eq("id", data.leadId)
          .select("id"),
      );
      if (updated.length === 0) throw new ActionError("This lead was not found.");
      return "Saved.";
    },
  );
}

/** The board's "Move to" menu. Lost needs a reason, so it is set on the lead's page. */
export async function moveLead(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, { schema: moveSchema, revalidate: LEADS }, async (data, session) => {
    const updated = must(
      await session.supabase
        .from("leads")
        .update({ stage: data.stage })
        .eq("id", data.leadId)
        .select("organization"),
    );
    const lead = updated[0];
    if (!lead) throw new ActionError("This lead was not found.");
    return `${lead.organization} moved to ${stageLabel(data.stage)}.`;
  });
}

/** Records the quote sent to a lead; the timeline gets a Quote entry. */
export async function saveQuote(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, { schema: quoteSchema, revalidate: LEADS }, async (data, session) => {
    const amount = Number(data.amountMinor);
    if (!Number.isSafeInteger(amount)) throw new ActionError("This amount is too large.");
    const updated = must(
      await session.supabase
        .from("leads")
        .update({
          quote_amount_minor: amount,
          quote_currency: data.currency,
          quote_sent_on: data.sentOn,
          quote_note: data.note,
        })
        .eq("id", data.leadId)
        .select("id"),
    );
    if (updated.length === 0) throw new ActionError("This lead was not found.");
    return "Quote saved.";
  });
}

/** LEAD-05: adds a note, call, WhatsApp, meeting or demo. Entries cannot be edited. */
export async function addLeadActivity(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return runAction(
    formData,
    { schema: activitySchema, revalidate: LEADS },
    async (data, session) => {
      must(
        await session.supabase
          .from("lead_activities")
          .insert({ lead_id: data.leadId, type: data.type, body: data.body }),
      );
      return "Added to the timeline.";
    },
  );
}
