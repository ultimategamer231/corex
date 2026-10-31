// Settings → Company details and Invoicing and payments (SPEC-ADMIN.md 4, settings.config).
// Shared by pages, server actions and the database defaults; keep free of server-only imports.
import { z } from "zod";
import { optionalText, requiredText } from "./fields";

export type BillingSettings = {
  company: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    taxId: string | null;
  };
  invoicePrefix: string;
  receiptPrefix: string;
  termsDays: number;
  taxEnabled: boolean;
  taxRateBp: number;
  taxLabel: string;
  paymentInstructions: string | null;
  invoiceTerms: string | null;
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Billing settings with the defaults the database uses (7-day terms, CX/RC, no tax). */
export function billingFrom(orgName: string, config: unknown): BillingSettings {
  const c = (config && typeof config === "object" ? config : {}) as Record<string, unknown>;
  const terms = Number(c.payment_terms_days);
  const rate = Number(c.tax_rate_bp);
  return {
    company: {
      name: orgName,
      address: text(c.company_address),
      phone: text(c.company_phone),
      email: text(c.company_email),
      website: text(c.company_website),
      taxId: text(c.company_tax_id),
    },
    invoicePrefix: text(c.invoice_prefix) ?? "CX",
    receiptPrefix: text(c.receipt_prefix) ?? "RC",
    termsDays: Number.isInteger(terms) && terms >= 0 && terms <= 365 ? terms : 7,
    taxEnabled: c.tax_enabled === true,
    taxRateBp: Number.isInteger(rate) && rate >= 0 && rate <= 10000 ? rate : 0,
    taxLabel: text(c.tax_label) ?? "Tax",
    paymentInstructions: text(c.payment_instructions),
    invoiceTerms: text(c.invoice_terms),
  };
}

/** "10%" from basis points. */
export function percentText(bp: number): string {
  return `${(bp / 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}

const short = (max: number) =>
  optionalText.pipe(z.string().max(max, `Use at most ${max} characters`).nullable());

export const companySchema = z.object({
  name: requiredText("the company name", 150),
  address: short(300),
  phone: short(60),
  email: optionalText.pipe(z.email("Enter a valid email address").nullable()),
  website: short(200),
  taxId: short(60),
});

export const invoicingSchema = z
  .object({
    termsDays: z.coerce
      .number({ error: "Enter the number of days" })
      .int("Use whole days")
      .min(0, "Use 0 or more days")
      .max(365, "Use at most 365 days"),
    invoicePrefix: z
      .string()
      .trim()
      .regex(/^[A-Z]{1,6}$/, "Use 1 to 6 capital letters"),
    receiptPrefix: z
      .string()
      .trim()
      .regex(/^[A-Z]{1,6}$/, "Use 1 to 6 capital letters"),
    taxEnabled: z
      .string()
      .optional()
      .transform((v) => v === "on"),
    taxRate: optionalText,
    taxLabel: short(30),
    paymentInstructions: short(2000),
    invoiceTerms: short(1000),
  })
  .transform((v, ctx) => {
    let taxRateBp = 0;
    if (v.taxEnabled) {
      const rate = Number(v.taxRate);
      if (!v.taxRate || !Number.isFinite(rate) || rate <= 0 || rate > 100) {
        ctx.addIssue({
          code: "custom",
          path: ["taxRate"],
          message: "Enter a rate above 0 and up to 100",
        });
      } else {
        taxRateBp = Math.round(rate * 100);
      }
    }
    if (v.invoicePrefix === v.receiptPrefix) {
      ctx.addIssue({
        code: "custom",
        path: ["receiptPrefix"],
        message: "Use a different prefix from invoices",
      });
    }
    return { ...v, taxRateBp };
  });
