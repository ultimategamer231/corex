// Validation shared by the server actions and the offline forms (SPEC.md 10): an entry
// saved on the device is checked with the same rules before and after sync.
import { z } from "zod";
import { isoDate, optionalText, uuid } from "./fields";
import { amountText, rateText } from "./finance";

export const entrySchema = z
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

/** Offline, only new income and expense entries are recorded; transfers need a connection. */
export const offlineEntrySchema = entrySchema.refine((v) => v.type !== "transfer", {
  path: ["type"],
  message: "Transfers need a connection.",
});
