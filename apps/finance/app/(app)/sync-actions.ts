"use server";

import { AuthError, requireMember, SESSION_HOURS } from "@corex/core/auth";
import { type ItemHandler, receiveOutboxItem, SyncError } from "@corex/core/offline/server";
import type { SyncResponse } from "@corex/core/offline/transport";
import { revalidatePath } from "next/cache";
import { ActionError, dbMessage, demoWriteAllowed } from "@/lib/action";
import { financeEnv } from "@/lib/env";
import { toMinor } from "@/lib/finance";
import { uploadReceipt } from "@/lib/files";
import { hasAnyRole, RECORDERS } from "@/lib/roles";
import { offlineEntrySchema } from "@/lib/schemas";
import { asAuthClient, getSupabase } from "@/lib/supabase";

/**
 * Records one entry saved on a device while offline (SPEC.md 10.2). The member's
 * current access is checked for every item, so someone suspended while offline cannot
 * sync (OFF-03); an entry already recorded is not recorded again (OFF-02).
 */
export async function syncOutbox(form: FormData): Promise<SyncResponse> {
  const supabase = await getSupabase();
  let roles: string[];
  let userId: string;
  try {
    const member = await requireMember(asAuthClient(supabase), {
      sessionHours: SESSION_HOURS.finance,
    });
    roles = member.roles;
    userId = member.userId;
  } catch (error) {
    if (error instanceof AuthError) return { status: "error", message: error.message };
    throw error;
  }
  if (financeEnv().demo && !(await demoWriteAllowed(supabase))) {
    return { status: "error", message: "Too many changes in a short time. Try again in a minute." };
  }

  const handlers: Record<string, ItemHandler> = {
    transactions: async ({ payload, files }) => {
      if (!hasAnyRole(roles, RECORDERS)) throw new SyncError("Your role cannot record entries.");
      const parsed = offlineEntrySchema.safeParse(payload);
      if (!parsed.success) {
        throw new SyncError(parsed.error.issues[0]?.message ?? "Some values are not valid.");
      }
      const d = parsed.data;
      const existing = await supabase
        .from("transactions")
        .select("id")
        .eq("id", d.id)
        .maybeSingle();
      if (existing.data) return "exists";
      const account = await supabase
        .from("accounts")
        .select("currency")
        .eq("id", d.account_id)
        .maybeSingle();
      if (!account.data) throw new SyncError("Choose an account.");
      const receipt = files.receipt;
      let fileId: string | null = null;
      try {
        fileId = receipt ? await uploadReceipt(receipt, d.id, userId) : null;
      } catch (error) {
        if (error instanceof ActionError) throw new SyncError(error.message);
        throw error;
      }
      const { error } = await supabase.rpc("record_transaction", {
        p_id: d.id,
        p_type: d.type,
        p_date: d.date,
        p_account_id: d.account_id,
        p_amount_minor: toMinor(d.amount, account.data.currency),
        p_category_id: d.category_id,
        p_counterparty_id: d.counterparty_id || undefined,
        p_fx_rate: d.fx_rate ? Number(d.fx_rate) : undefined,
        p_memo: d.memo ?? undefined,
        p_receipt_file_id: fileId ?? undefined,
      });
      if (error) throw new SyncError(dbMessage(error));
      return "created";
    },
  };

  const result = await receiveOutboxItem(form, handlers);
  if (result.status === "created") revalidatePath("/", "layout");
  return result;
}
