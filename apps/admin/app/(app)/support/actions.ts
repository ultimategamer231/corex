"use server";

import { must, runAction } from "@/lib/action";
import type { FormState } from "@/lib/form-state";
import { supportSchema, supportUpdateSchema } from "@/lib/money-report";

const SUPPORT = ["/support", "/clients"];

/** Support → Add an item for a client. */
export async function addSupportItem(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { schema: supportSchema, revalidate: SUPPORT },
    async (data, session) => {
      must(
        await session.supabase
          .from("support_tickets")
          .insert({
            client_id: data.clientId,
            kind: data.kind,
            priority: data.priority,
            title: data.title,
            details: data.details,
          })
          .select("id")
          .single(),
      );
      return "Support item added.";
    },
  );
}

/** Support → Update an item's status, priority and what was done. */
export async function updateSupportItem(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  return runAction(
    formData,
    { schema: supportUpdateSchema, revalidate: SUPPORT },
    async (data, session) => {
      must(
        await session.supabase
          .from("support_tickets")
          .update({ status: data.status, priority: data.priority, resolution: data.resolution })
          .eq("id", data.id)
          .select("id")
          .single(),
      );
      return data.status === "resolved" ? "Marked resolved." : "Support item saved.";
    },
  );
}
