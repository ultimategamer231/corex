"use server";

import { z } from "zod";
import { must, runAction } from "@/lib/action";
import { uuid } from "@/lib/fields";
import type { FormState } from "@/lib/form-state";
import { expenseRow, expenseSchema } from "@/lib/money-report";

const MONEY = ["/money"];

/** Money report → Add or edit an expense. */
export async function saveExpense(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { schema: expenseSchema, revalidate: MONEY },
    async (data, session) => {
      const row = expenseRow(data);
      if (data.id) {
        must(
          await session.supabase
            .from("expenses")
            .update(row)
            .eq("id", data.id)
            .select("id")
            .single(),
        );
        return "Expense saved.";
      }
      must(await session.supabase.from("expenses").insert(row).select("id").single());
      return "Expense added.";
    },
  );
}

/** Money report → Remove an expense entered by mistake (the activity log keeps it). */
export async function removeExpense(_previous: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { schema: z.object({ id: uuid("an expense") }), revalidate: MONEY },
    async (data, session) => {
      must(
        await session.supabase.from("expenses").delete().eq("id", data.id).select("id").single(),
      );
      return "Expense removed.";
    },
  );
}
