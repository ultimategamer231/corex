import { z } from "zod";
import { planOptions, productOptions } from "@/content/contact";

const productValues = productOptions.map((o) => o.value) as [string, ...string[]];
const planValues = planOptions.map((o) => o.value) as [string, ...string[]];

/** Quote form (SPEC.md 6.6). The same schema validates in the browser and on the server. */
export const quoteSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(100, "Use at most 100 characters"),
  organization: z
    .string()
    .trim()
    .min(2, "Enter your organization")
    .max(150, "Use at most 150 characters"),
  country: z.string().trim().min(2, "Enter your country").max(60, "Use at most 60 characters"),
  product: z.enum(productValues, { error: "Choose what you need" }),
  plan: z.enum(planValues).default("unsure"),
  phone: z
    .string()
    .trim()
    .regex(
      /^\+?[\d\s()-]{7,24}$/,
      "Enter a phone or WhatsApp number, for example +231 770 000 000",
    ),
  email: z.union([z.literal(""), z.email("Enter a valid email address")]).default(""),
  message: z
    .string()
    .trim()
    .min(10, "Tell us a little more (at least 10 characters)")
    .max(2000, "Use at most 2000 characters"),
  consent: z.literal(true, { error: "Please agree so we can contact you" }),
});

export type QuoteInput = z.input<typeof quoteSchema>;
export type Quote = z.output<typeof quoteSchema>;

/** A stored lead (SPEC.md 6.6: fields above plus source page). */
export type Lead = Quote & { sourcePage: string | null };
