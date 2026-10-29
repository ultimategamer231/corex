// Lead stages, labels, filters and form rules (SPEC-ADMIN.md 8.1). Shared by pages,
// server actions and client forms; keep free of server-only imports.
import { CURRENCIES, MoneyError, parseMajor } from "@corex/core/money";
import { z } from "zod";
import { isoDate, optionalText, requiredText, uuid } from "./fields";

export const STAGES = [
  ["new", "New"],
  ["contacted", "Contacted"],
  ["demo_booked", "Demo booked"],
  ["quoted", "Quoted"],
  ["won", "Won"],
  ["lost", "Lost"],
] as const;

export type Stage = (typeof STAGES)[number][0];
export const STAGE_KEYS = STAGES.map(([key]) => key) as [Stage, ...Stage[]];

export function stageLabel(stage: string): string {
  return STAGES.find(([key]) => key === stage)?.[1] ?? stage;
}

/** Badge colour per stage, after the mockup's chips. */
export function stageBadge(stage: string): "info" | "brand" | "warning" | "neutral" | "danger" {
  switch (stage) {
    case "new":
    case "demo_booked":
      return "info";
    case "contacted":
    case "won":
      return "brand";
    case "quoted":
      return "warning";
    default:
      return "neutral";
  }
}

/** The website's quote form options (apps/web/content/contact.ts), plus short labels. */
export const PRODUCTS = [
  ["school-college", "School: College"],
  ["school-highschool", "School: High School"],
  ["clinic", "Clinic Management"],
  ["finance", "Financial Management"],
  ["on-request", "Built on request"],
  ["website", "Website"],
  ["ai-automation", "AI Automation"],
  ["it-consultancy", "IT Consultancy"],
  ["training", "Training"],
] as const;

export type Product = (typeof PRODUCTS)[number][0];
const PRODUCT_KEYS = PRODUCTS.map(([key]) => key) as [Product, ...Product[]];

export function productLabel(product: string | null): string {
  if (!product) return "Not given";
  return PRODUCTS.find(([key]) => key === product)?.[1] ?? product;
}

export const PLANS = [
  ["managed", "Managed (we host it)"],
  ["handover", "Handover (you host it)"],
  ["unsure", "Not sure"],
] as const;

export function planLabel(plan: string, short = false): string {
  if (short) return plan === "managed" ? "Managed" : plan === "handover" ? "Handover" : "Not sure";
  return PLANS.find(([key]) => key === plan)?.[1] ?? plan;
}

/** Entries an admin adds to a lead's timeline; the database adds the rest. */
export const ACTIVITY_TYPES = [
  ["note", "Note"],
  ["call", "Call"],
  ["whatsapp", "WhatsApp"],
  ["meeting", "Meeting"],
  ["demo", "Demo"],
] as const;

const TIMELINE_LABELS: Record<string, string> = {
  note: "Note",
  call: "Call",
  whatsapp: "WhatsApp",
  meeting: "Meeting",
  demo: "Demo",
  stage_change: "Stage",
  form: "Form",
  quote: "Quote",
};

export function activityLabel(type: string): string {
  return TIMELINE_LABELS[type] ?? type;
}

export const VIEWS = ["table", "board"] as const;

/** Leads list filters from the query string (SPEC-ADMIN.md 6; LEAD-07 exports them). */
export const leadFiltersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  stage: z.enum(STAGE_KEYS).optional().catch(undefined),
  product: z.enum(PRODUCT_KEYS).optional().catch(undefined),
  assigned: z
    .union([z.uuid(), z.literal("none")])
    .optional()
    .catch(undefined),
  view: z.enum(VIEWS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

export type LeadFilters = z.infer<typeof leadFiltersSchema>;

export function parseLeadFilters(
  params: Record<string, string | string[] | undefined>,
): LeadFilters {
  const flat = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v || undefined]),
  );
  return leadFiltersSchema.parse(flat);
}

/** Query string for links that keep the current filters. */
export function leadsQuery(filters: LeadFilters, overrides: Partial<LeadFilters> = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, ...overrides })) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** Last 8 digits of a phone number; the database's lead_phone_key (LEAD-03). */
export function phoneKey(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 7 ? digits.slice(-8) : null;
}

const CALLING_CODES: Record<string, string> = {
  liberia: "231",
  "sierra leone": "232",
  ghana: "233",
  nigeria: "234",
  guinea: "224",
  "côte d'ivoire": "225",
  "cote d'ivoire": "225",
  "ivory coast": "225",
};

/**
 * A wa.me link for a lead's phone. Numbers starting with 0 get the country's calling
 * code; without a known country they get no link rather than a wrong one.
 */
export function whatsappLink(phone: string | null, country: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null;
  if (phone.trim().startsWith("+")) return `https://wa.me/${digits}`;
  if (digits.startsWith("00")) return `https://wa.me/${digits.slice(2)}`;
  const code = CALLING_CODES[(country ?? "").trim().toLowerCase()];
  if (digits.startsWith("0")) return code ? `https://wa.me/${code}${digits.slice(1)}` : null;
  if (code && digits.startsWith(code)) return `https://wa.me/${digits}`;
  return null;
}

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[\d\s()-]{7,24}$/, "Enter a phone number, for example +231 770 000 000");

/** LEAD-02: a lead added by hand needs a name, an organization and a phone or email. */
export const manualLeadSchema = z
  .object({
    name: requiredText("a name", 100).refine((v) => v.length >= 2, "Enter a name"),
    organization: requiredText("an organization", 150).refine(
      (v) => v.length >= 2,
      "Enter an organization",
    ),
    phone: optionalText.pipe(phoneSchema.nullable()),
    email: optionalText.pipe(z.email("Enter a valid email address").nullable()),
    country: optionalText.pipe(
      z
        .string()
        .min(2, "Use at least 2 characters")
        .max(60, "Use at most 60 characters")
        .nullable(),
    ),
    product: z
      .union([z.enum(PRODUCT_KEYS), z.literal("")])
      .optional()
      .transform((v) => v || null),
    plan: z.enum(["managed", "handover", "unsure"]).catch("unsure"),
    message: optionalText.pipe(z.string().max(2000, "Use at most 2000 characters").nullable()),
  })
  .refine((v) => v.phone !== null || v.email !== null, {
    path: ["phone"],
    message: "Enter a phone number or an email address",
  });

export type ManualLead = z.output<typeof manualLeadSchema>;

/** LEAD-04: stage, assignment and follow-up; Lost needs a reason. */
export const leadStatusSchema = z
  .object({
    leadId: uuid("a lead"),
    stage: z.enum(STAGE_KEYS, { error: "Choose a stage" }),
    lostReason: optionalText.pipe(z.string().max(500, "Use at most 500 characters").nullable()),
    assigned: z
      .union([z.uuid(), z.literal("")])
      .optional()
      .transform((v) => v || null),
    followUp: z
      .union([isoDate("a date"), z.literal("")])
      .optional()
      .transform((v) => v || null),
    nextStep: optionalText.pipe(z.string().max(300, "Use at most 300 characters").nullable()),
  })
  .refine((v) => v.stage !== "lost" || (v.lostReason !== null && v.lostReason.length >= 3), {
    path: ["lostReason"],
    message: "Say why this lead was lost",
  });

/** A quote: amount in the chosen currency, kept as minor units (CORE-04). */
export const quoteSchema = z
  .object({
    leadId: uuid("a lead"),
    currency: z.enum(CURRENCIES, { error: "Choose a currency" }),
    amount: requiredText("an amount", 20),
    sentOn: z
      .union([isoDate("a date"), z.literal("")])
      .optional()
      .transform((v) => v || null),
    note: optionalText.pipe(z.string().max(500, "Use at most 500 characters").nullable()),
  })
  .transform((v, ctx) => {
    try {
      const money = parseMajor(v.amount, v.currency);
      if (money.amountMinor <= 0n) throw new MoneyError("not positive");
      return { ...v, amountMinor: money.amountMinor };
    } catch {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "Enter an amount above zero, for example 4,000.00",
      });
      return z.NEVER;
    }
  });

export const activitySchema = z.object({
  leadId: uuid("a lead"),
  type: z.enum(["note", "call", "whatsapp", "meeting", "demo"], { error: "Choose a type" }),
  body: requiredText("what happened", 2000),
});

export const moveSchema = z.object({
  leadId: uuid("a lead"),
  stage: z.enum(STAGE_KEYS, { error: "Choose a stage" }).exclude(["lost"]),
});
