"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { ActionError, isoDate, must, optionalText, runAction, uuid } from "@/lib/action";
import { amountText, rateText, toMinor } from "@/lib/finance";
import { uploadReceipt } from "@/lib/files";
import type { FormState } from "@/lib/form-state";
import { MANAGER, RECORDERS } from "@/lib/roles";

const entrySchema = z
  .object({
    id: z.uuid(),
    type: z.enum(["income", "expense", "transfer"]),
    date: isoDate("the date"),
    account_id: uuid("an account"),
    to_account_id: z.string().optional(),
    category_id: z.string().optional(),
    counterparty_id: z.string().optional(),
    amount: amountText,
    fx_rate: rateText,
    memo: optionalText,
  })
  .superRefine((v, ctx) => {
    if (v.type === "transfer" && !z.uuid().safeParse(v.to_account_id).success)
      ctx.addIssue({
        code: "custom",
        path: ["to_account_id"],
        message: "Choose the account to transfer to",
      });
    if (v.type !== "transfer" && !z.uuid().safeParse(v.category_id).success)
      ctx.addIssue({ code: "custom", path: ["category_id"], message: "Choose a category" });
  });

/**
 * Records an income, expense or transfer (FIN-01). The form carries an id made when it
 * was opened, so a retried submission records one entry (FIN-02).
 */
export async function recordEntry(_p: FormState, formData: FormData): Promise<FormState> {
  let saved: string | null = null;
  const result = await runAction(
    formData,
    { roles: RECORDERS, schema: entrySchema, revalidate: ["/"] },
    async (d, { supabase, member, formData: raw }) => {
      const account = must(
        await supabase.from("accounts").select("currency").eq("id", d.account_id).maybeSingle(),
      );
      if (!account) throw new ActionError("Choose an account.");
      const receipt = raw.get("receipt");
      const fileId =
        receipt instanceof File && receipt.size > 0
          ? await uploadReceipt(receipt, d.id, member.userId)
          : null;
      must(
        await supabase.rpc("record_transaction", {
          p_id: d.id,
          p_type: d.type,
          p_date: d.date,
          p_account_id: d.account_id,
          p_amount_minor: toMinor(d.amount, account.currency),
          p_category_id: d.type === "transfer" ? undefined : d.category_id,
          p_to_account_id: d.type === "transfer" ? d.to_account_id : undefined,
          p_counterparty_id: d.counterparty_id || undefined,
          p_fx_rate: d.fx_rate ? Number(d.fx_rate) : undefined,
          p_memo: d.memo ?? undefined,
          p_receipt_file_id: fileId ?? undefined,
        }),
      );
      saved = d.id;
    },
  );
  if (saved && result.status === "success") redirect(`/transactions/${saved}?saved=1`);
  return result;
}

const voidSchema = z.object({
  id: uuid(),
  reason: z.string().trim().min(1, "Enter the reason"),
});

/** Voids an entry with a reason; its reversal keeps the history (FIN-05). */
export async function voidEntry(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: MANAGER, schema: voidSchema, revalidate: ["/"] },
    async (d, { supabase }) => {
      must(await supabase.rpc("void_transaction", { p_id: d.id, p_reason: d.reason }));
      return "Entry voided. A reversal was added.";
    },
  );
}
