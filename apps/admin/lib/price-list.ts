// Price list (Settings → Price list, SPEC-ADMIN.md 4): items that prefill invoice lines.
// Shared by pages, server actions and client forms; keep free of server-only imports.
import { type Currency, CURRENCIES, MoneyError, parseMajor } from "@corex/core/money";
import { z } from "zod";
import { money } from "./clients";
import { JOB_RULES } from "./dashboard";
import { optionalText, requiredText, uuid } from "./fields";
import type { AdminDb } from "./supabase";

export const PRICE_KINDS = [
  ["product", "Product"],
  ["addon", "Add-on"],
] as const;

export const PRICE_COLUMNS = [
  ["managed", "Managed: year 1"],
  ["renewal", "Renewal per year"],
  ["handover", "Handover"],
] as const;

export type PriceItem = {
  id: string;
  name: string;
  kind: string;
  currency: string;
  managed_year1_minor: number | null;
  renewal_minor: number | null;
  handover_minor: number | null;
  unit_label: string | null;
  active: boolean;
};

export function priceText(minor: number | null, currency: string): string {
  return minor === null ? "—" : money(minor, currency);
}

/** "Clinic Management, Managed: year 1 · US$2,500.00" for the invoice editor's picker. */
export function priceOptions(items: PriceItem[]) {
  return items
    .filter((i) => i.active)
    .flatMap((i) =>
      (
        [
          ["Managed: year 1", i.managed_year1_minor],
          ["Renewal per year", i.renewal_minor],
          ["Handover", i.handover_minor],
        ] as const
      )
        .filter(([, minor]) => minor !== null)
        .map(([plan, minor]) => ({
          key: `${i.id}:${plan}`,
          label: `${i.name}, ${plan} · ${money(minor ?? 0, i.currency)}${i.unit_label ? ` ${i.unit_label}` : ""}`,
          description: i.name,
          details: i.kind === "product" ? plan : (i.unit_label ?? null),
          unitMinor: minor ?? 0,
          currency: i.currency,
        })),
    );
}

const optionalPrice = optionalText;

export const priceItemSchema = z
  .object({
    id: z.union([uuid("an item"), z.literal("")]).transform((v) => v || null),
    name: requiredText("the item name", 120),
    kind: z.enum(["product", "addon"]),
    currency: z.enum(CURRENCIES as unknown as [Currency, ...Currency[]]),
    managed: optionalPrice,
    renewal: optionalPrice,
    handover: optionalPrice,
    unitLabel: optionalText.pipe(z.string().max(60, "Keep the unit short").nullable()),
    active: z
      .string()
      .optional()
      .transform((v) => v === "on"),
  })
  .transform((v, ctx) => {
    const price = (text: string | null, path: string): number | null => {
      if (text === null) return null;
      try {
        const minor = parseMajor(text, v.currency).amountMinor;
        if (minor < 0n) throw new MoneyError("negative");
        if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new MoneyError("too large");
        return Number(minor);
      } catch {
        ctx.addIssue({
          code: "custom",
          path: [path],
          message: "Enter an amount like 1200 or 1200.50",
        });
        return null;
      }
    };
    const managed = price(v.managed, "managed");
    const renewal = price(v.renewal, "renewal");
    const handover = price(v.handover, "handover");
    if (managed === null && renewal === null && handover === null && !ctx.issues?.length) {
      ctx.addIssue({ code: "custom", path: ["managed"], message: "Enter at least one price" });
    }
    return { ...v, managed, renewal, handover };
  });

export function priceItemRow(data: z.infer<typeof priceItemSchema>) {
  return {
    name: data.name,
    kind: data.kind,
    currency: data.currency,
    managed_year1_minor: data.managed,
    renewal_minor: data.renewal,
    handover_minor: data.handover,
    unit_label: data.unitLabel,
    active: data.active,
  };
}

export const MULTIPLE_CHOICES = ["2", "3", "4"] as const;

const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on");

/** Settings → Renewals: the daily job's rules and the hosting-cost warning. */
export const renewalsSchema = z.object({
  renewal_invoice: checkbox,
  reminders: checkbox,
  pause_flag: checkbox,
  warranty_flag: checkbox,
  multiple: z.enum(MULTIPLE_CHOICES, "Choose 2×, 3× or 4×").transform(Number),
});

export function renewalsConfig(
  data: z.infer<typeof renewalsSchema>,
): Record<string, string | number> {
  return {
    ...Object.fromEntries(
      JOB_RULES.map(([rule]) => [`job_${rule}`, data[rule] ? "true" : "false"]),
    ),
    renewal_min_hosting_multiple: data.multiple,
  };
}

export type PriceOption = ReturnType<typeof priceOptions>[number];

/** Active price list items, for the invoice editor's "Add from price list". */
export async function fetchPriceItems(db: AdminDb): Promise<PriceItem[]> {
  const { data } = await db
    .from("price_list_items")
    .select(
      "id, name, kind, currency, managed_year1_minor, renewal_minor, handover_minor, unit_label, active",
    )
    .eq("active", true)
    .order("kind")
    .order("position")
    .order("name");
  return (data ?? []) as PriceItem[];
}
