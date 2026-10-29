// Clients, contracts, deployments and subscriptions (SPEC-ADMIN.md 4, 8.2, 9.1):
// labels, derived status, payment milestones, the hosting-cost check and form rules.
// Shared by pages, server actions and client forms; keep free of server-only imports.
import { type Currency, CURRENCIES, formatMoney, parseMajor } from "@corex/core/money";
import { z } from "zod";
import { isoDate, optionalText, requiredText, uuid } from "./fields";

export const CONTRACT_PRODUCTS = [
  ["school_college", "School: College"],
  ["school_highschool", "School: High School"],
  ["clinic", "Clinic Management"],
  ["finance", "Financial Management"],
  ["custom", "Built on request"],
] as const;
export type ContractProduct = (typeof CONTRACT_PRODUCTS)[number][0];
const CONTRACT_PRODUCT_KEYS = CONTRACT_PRODUCTS.map(([k]) => k) as [
  ContractProduct,
  ...ContractProduct[],
];

export function contractProductLabel(product: string): string {
  return CONTRACT_PRODUCTS.find(([k]) => k === product)?.[1] ?? product;
}

/** The contract product for a lead's "interested in" (website form values). */
export function productFromLead(product: string | null): ContractProduct {
  switch (product) {
    case "school-college":
      return "school_college";
    case "school-highschool":
      return "school_highschool";
    case "clinic":
      return "clinic";
    case "finance":
      return "finance";
    default:
      return "custom";
  }
}

export const CLIENT_PLANS = [
  ["managed", "Managed (we host it)"],
  ["handover", "Handover (they host it)"],
] as const;
export type ClientPlan = (typeof CLIENT_PLANS)[number][0];

export function clientPlanLabel(plan: string): string {
  return plan === "managed" ? "Managed" : plan === "handover" ? "Handover" : plan;
}

export const ENVIRONMENTS = [
  ["setup", "Setting up"],
  ["staging", "Staging"],
  ["live", "Live"],
  ["paused", "Paused"],
  ["ended", "Ended"],
] as const;
export type Environment = (typeof ENVIRONMENTS)[number][0];
const ENVIRONMENT_KEYS = ENVIRONMENTS.map(([k]) => k) as [Environment, ...Environment[]];

export function environmentLabel(environment: string): string {
  return ENVIRONMENTS.find(([k]) => k === environment)?.[1] ?? environment;
}

/** Payment splits offered on forms; any other split can be typed as "40/40/20". */
export const SCHEME_CHOICES = ["50/30/20", "50/50", "40/30/30", "100"] as const;

/** "50/30/20" → [50, 30, 20]; null unless whole percentages above 0 adding up to 100. */
export function parseScheme(text: string): number[] | null {
  const parts = text
    .split(/[/,\s]+/)
    .filter(Boolean)
    .map((p) => Number(p.replace("%", "")));
  if (parts.length < 1 || parts.length > 6) return null;
  if (parts.some((p) => !Number.isInteger(p) || p <= 0)) return null;
  return parts.reduce((a, b) => a + b, 0) === 100 ? parts : null;
}

/**
 * Milestone amounts in minor units (SPEC-ADMIN.md 9.1): each share rounded half up,
 * the last one takes the remainder so they add up to the total. The database's
 * milestone_amounts() follows the same rule.
 */
export function milestoneAmounts(totalMinor: bigint, scheme: number[]): bigint[] {
  const shares = scheme.map((p) => (totalMinor * BigInt(p) + 50n) / 100n);
  const allButLast = shares.slice(0, -1).reduce((a, b) => a + b, 0n);
  return [...shares.slice(0, -1), totalMinor - allButLast];
}

export type ClientStatus =
  "setting_up" | "active" | "renewal_due" | "grace_period" | "paused" | "ended" | "in_warranty";

export const STATUS_LABELS: Record<ClientStatus, string> = {
  setting_up: "Setting up",
  active: "Active",
  renewal_due: "Renewal due",
  grace_period: "Grace period",
  paused: "Paused",
  ended: "Ended",
  in_warranty: "In warranty",
};

export function statusBadge(
  status: ClientStatus,
): "info" | "brand" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "setting_up":
    case "in_warranty":
      return "info";
    case "active":
      return "brand";
    case "renewal_due":
      return "warning";
    case "grace_period":
      return "danger";
    default:
      return "neutral";
  }
}

export type StatusInput = {
  plan: string | null;
  environment: string | null;
  warrantyEndsOn: string | null;
  nextRenewalOn: string | null;
  subscriptionPaused: boolean;
  subscriptionEnded: boolean;
};

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * A client's status, derived and never stored (SPEC-ADMIN.md 8.2). `today` is the date
 * in Monrovia as YYYY-MM-DD.
 */
export function clientStatus(input: StatusInput, today: string): ClientStatus {
  if (input.environment === "ended" || input.subscriptionEnded) return "ended";
  if (input.environment === "paused" || input.subscriptionPaused) return "paused";
  if (input.environment !== "live") return "setting_up";
  if (input.plan === "handover") {
    return input.warrantyEndsOn && today <= input.warrantyEndsOn ? "in_warranty" : "active";
  }
  if (input.nextRenewalOn) {
    const days = daysBetween(today, input.nextRenewalOn);
    if (days < 0) return "grace_period";
    if (days <= 30) return "renewal_due";
  }
  return "active";
}

/** The status tabs on the clients list (Clients.dc.html). */
export const STATUS_GROUPS = [
  ["all", "All"],
  ["active", "Active"],
  ["setup", "Setting up"],
  ["due", "Renewal due or overdue"],
] as const;
export type StatusGroup = (typeof STATUS_GROUPS)[number][0];

export function inGroup(status: ClientStatus, group: StatusGroup): boolean {
  switch (group) {
    case "active":
      return status === "active" || status === "in_warranty";
    case "setup":
      return status === "setting_up";
    case "due":
      return status === "renewal_due" || status === "grace_period";
    default:
      return true;
  }
}

export type HostingCheck =
  | { kind: "none" }
  | { kind: "cannot_compare" }
  | { kind: "ok" | "low"; multiple: number; minimum: number };

/**
 * SPEC-ADMIN.md 8.2: warn when the yearly renewal is below monthly hosting × 12 ×
 * the minimum multiple from Settings. Different currencies are never compared.
 */
export function hostingCheck(
  renewal: { amountMinor: bigint; currency: string } | null,
  hosting: { monthlyMinor: bigint; currency: string } | null,
  minimum: number,
): HostingCheck {
  if (!renewal || !hosting || hosting.monthlyMinor <= 0n) return { kind: "none" };
  if (renewal.currency !== hosting.currency) return { kind: "cannot_compare" };
  const yearly = hosting.monthlyMinor * 12n;
  const multiple = Number((renewal.amountMinor * 100n) / yearly) / 100;
  return {
    kind: renewal.amountMinor >= yearly * BigInt(minimum) ? "ok" : "low",
    multiple,
    minimum,
  };
}

export function money(amountMinor: bigint | number | string, currency: string): string {
  return (CURRENCIES as readonly string[]).includes(currency)
    ? formatMoney({ amountMinor: BigInt(amountMinor), currency: currency as Currency })
    : `${currency} ${String(amountMinor)}`;
}

/** An amount typed in major units, as minor units; for zod transforms. */
function minorAmount(
  text: string | null,
  currency: Currency,
  ctx: z.RefinementCtx,
  path: string,
  { allowZero = false } = {},
): bigint | null {
  if (text === null) return null;
  try {
    const value = parseMajor(text, currency).amountMinor;
    if (value < 0n || (!allowZero && value === 0n)) throw new Error("not positive");
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("too large");
    return value;
  } catch {
    ctx.addIssue({
      code: "custom",
      path: [path],
      message: "Enter an amount above zero, for example 2,500.00",
    });
    return null;
  }
}

const phone = z
  .string()
  .trim()
  .regex(/^\+?[\d\s()-]{7,24}$/, "Enter a phone number, for example +231 770 000 000");
const optionalPhone = optionalText.pipe(phone.nullable());
const optionalEmail = optionalText.pipe(z.email("Enter a valid email address").nullable());
const optionalDate = z
  .union([isoDate("a date"), z.literal("")])
  .optional()
  .transform((v) => v || null);
const optionalShort = (max: number) =>
  optionalText.pipe(z.string().max(max, `Use at most ${max} characters`).nullable());

/** LEAD-06 and "Add client": the client, its first contact, contract and deployment. */
export const newClientSchema = z
  .object({
    leadId: z
      .union([z.uuid(), z.literal("")])
      .optional()
      .transform((v) => v || null),
    name: requiredText("the organization", 150).refine((v) => v.length >= 2, "Enter a name"),
    country: optionalShort(60),
    city: optionalShort(80),
    contactName: requiredText("the contact's name", 100).refine(
      (v) => v.length >= 2,
      "Enter a name",
    ),
    contactTitle: optionalShort(100),
    contactPhone: optionalPhone,
    contactEmail: optionalEmail,
    product: z.enum(CONTRACT_PRODUCT_KEYS, { error: "Choose a product" }),
    plan: z.enum(["managed", "handover"], { error: "Choose a plan" }),
    currency: z.enum(CURRENCIES, { error: "Choose a currency" }),
    total: requiredText("the contract amount", 20),
    signedOn: isoDate("the signing date"),
    scheme: requiredText("the payment split", 30),
    renewal: optionalText,
    targetGoLive: optionalDate,
    hostingCost: optionalText,
    hostingCurrency: z.enum(CURRENCIES).catch("USD"),
  })
  .transform((v, ctx) => {
    if (!v.contactPhone && !v.contactEmail) {
      ctx.addIssue({
        code: "custom",
        path: ["contactPhone"],
        message: "Enter a phone number or an email address",
      });
    }
    const scheme = parseScheme(v.scheme);
    if (!scheme) {
      ctx.addIssue({
        code: "custom",
        path: ["scheme"],
        message: "Use whole percentages that add up to 100, for example 50/30/20",
      });
    }
    const totalMinor = minorAmount(v.total, v.currency, ctx, "total");
    const renewalMinor = minorAmount(v.renewal, v.currency, ctx, "renewal");
    if (v.plan === "managed" && v.renewal === null) {
      ctx.addIssue({
        code: "custom",
        path: ["renewal"],
        message: "Enter the yearly renewal for the Managed plan",
      });
    }
    const hostingMinor = minorAmount(v.hostingCost, v.hostingCurrency, ctx, "hostingCost", {
      allowZero: true,
    });
    return { ...v, scheme: scheme ?? [], totalMinor, renewalMinor, hostingMinor };
  });

export type NewClient = z.output<typeof newClientSchema>;

/** The JSON that create_client() takes. */
export function createClientPayload(data: NewClient): Record<string, unknown> {
  return {
    name: data.name,
    country: data.country,
    city: data.city,
    contact_name: data.contactName,
    contact_title: data.contactTitle,
    contact_phone: data.contactPhone,
    contact_email: data.contactEmail,
    product: data.product,
    plan: data.plan,
    total_minor: data.totalMinor === null ? null : Number(data.totalMinor),
    currency: data.currency,
    signed_on: data.signedOn,
    milestone_scheme: data.scheme,
    renewal_minor:
      data.plan === "managed" && data.renewalMinor !== null ? Number(data.renewalMinor) : null,
    target_go_live: data.targetGoLive,
    hosting_cost_minor: data.hostingMinor === null ? null : Number(data.hostingMinor),
    hosting_cost_currency: data.hostingMinor === null ? null : data.hostingCurrency,
  };
}

export const clientDetailsSchema = z.object({
  clientId: uuid("a client"),
  name: requiredText("the organization", 150).refine((v) => v.length >= 2, "Enter a name"),
  country: optionalShort(60),
  city: optionalShort(80),
  address: optionalShort(300),
  notes: optionalShort(2000),
});

export const contactSchema = z
  .object({
    clientId: uuid("a client"),
    contactId: z
      .union([z.uuid(), z.literal("")])
      .optional()
      .transform((v) => v || null),
    name: requiredText("a name", 100).refine((v) => v.length >= 2, "Enter a name"),
    title: optionalShort(100),
    phone: optionalPhone,
    email: optionalEmail,
    isPrimary: z
      .string()
      .optional()
      .transform((v) => v === "on"),
    isBilling: z
      .string()
      .optional()
      .transform((v) => v === "on"),
  })
  .refine((v) => v.phone !== null || v.email !== null, {
    path: ["phone"],
    message: "Enter a phone number or an email address",
  });

export const contractSchema = z
  .object({
    contractId: uuid("a contract"),
    product: z.enum(CONTRACT_PRODUCT_KEYS, { error: "Choose a product" }),
    plan: z.enum(["managed", "handover"], { error: "Choose a plan" }),
    currency: z.enum(CURRENCIES, { error: "Choose a currency" }),
    total: requiredText("the contract amount", 20),
    signedOn: isoDate("the signing date"),
    scheme: requiredText("the payment split", 30),
    notes: optionalShort(2000),
  })
  .transform((v, ctx) => {
    const scheme = parseScheme(v.scheme);
    if (!scheme) {
      ctx.addIssue({
        code: "custom",
        path: ["scheme"],
        message: "Use whole percentages that add up to 100, for example 50/30/20",
      });
    }
    return {
      ...v,
      scheme: scheme ?? [],
      totalMinor: minorAmount(v.total, v.currency, ctx, "total"),
    };
  });

export const deploymentSchema = z
  .object({
    deploymentId: uuid("a deployment"),
    environment: z.enum(ENVIRONMENT_KEYS, { error: "Choose a state" }),
    productVersion: requiredText("the version", 30),
    appUrl: optionalShort(200),
    supabaseProjectRef: optionalShort(100),
    schemaName: optionalText.pipe(
      z
        .string()
        .regex(/^[a-z][a-z0-9_]{0,62}$/, "Use lowercase letters, digits and _")
        .nullable(),
    ),
    hosting: optionalShort(100),
    targetGoLive: optionalDate,
    wentLiveOn: optionalDate,
    warrantyEndsOn: optionalDate,
    hostingCost: optionalText,
    hostingCurrency: z.enum(CURRENCIES).catch("USD"),
  })
  .transform((v, ctx) => {
    if (v.warrantyEndsOn && v.wentLiveOn && v.warrantyEndsOn < v.wentLiveOn) {
      ctx.addIssue({
        code: "custom",
        path: ["warrantyEndsOn"],
        message: "The warranty ends after the go-live date",
      });
    }
    return {
      ...v,
      hostingMinor: minorAmount(v.hostingCost, v.hostingCurrency, ctx, "hostingCost", {
        allowZero: true,
      }),
    };
  });

export const subscriptionSchema = z
  .object({
    subscriptionId: uuid("a subscription"),
    renewal: requiredText("the yearly renewal", 20),
    nextRenewalOn: optionalDate,
  })
  .transform((v, ctx) => ({ ...v, renewalMinor: minorAmount(v.renewal, "USD", ctx, "renewal") }));

export const DOCUMENT_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const documentStartSchema = z.object({
  clientId: uuid("a client"),
  name: requiredText("a file name", 200),
  size: z.coerce
    .number()
    .int()
    .min(1, "The file is empty")
    .max(MAX_DOCUMENT_BYTES, "Use a file of at most 10 MB"),
  type: z.string().refine((t) => t in DOCUMENT_TYPES, "Upload a PDF, JPG or PNG file"),
});
