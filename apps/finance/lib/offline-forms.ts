// Forms that also work offline (SPEC.md 10.1, Finance): new income and expense entries
// with a receipt photo of up to 2 MB. Offline, the form is checked with the same rules
// as the server and kept on the device; the sync action records it when the connection
// is back.
import type { z } from "zod";
import { offlineEntrySchema } from "./schemas";

export type OfflineForm = {
  table: string;
  schema: z.ZodType;
  /** Message after saving on the device. */
  saved: (raw: Record<string, unknown>) => string;
  /** Largest file kept on the device with the record; no files when unset. */
  maxFileBytes?: number;
  /** Keep the values after saving (a register or score sheet), instead of clearing the form. */
  keepValues?: boolean;
};

export const OFFLINE_FORMS = {
  entries: {
    table: "transactions",
    schema: offlineEntrySchema,
    saved: (raw) =>
      `${raw.type === "income" ? "Income" : "Expense"} saved on this device. It is recorded when you are back online.`,
    maxFileBytes: 2_000_000,
  },
} satisfies Record<string, OfflineForm>;

export type OfflineFormName = keyof typeof OFFLINE_FORMS;
