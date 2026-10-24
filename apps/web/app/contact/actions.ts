"use server";

import { headers } from "next/headers";
import { notifyTeam } from "@/lib/leads/notify";
import { quoteSchema } from "@/lib/leads/schema";
import { leadStoreFromEnv } from "@/lib/leads/store";

export type QuoteState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

/** Quote requests per IP per hour (SPEC.md 6.6). */
const LIMIT = 5;
const WINDOW_SECONDS = 3600;

function clientIp(h: Headers): string {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** Server action behind the quote form: validate, drop bots, rate-limit, store, notify. */
export async function submitQuote(_previous: QuoteState, form: FormData): Promise<QuoteState> {
  // Honeypot: people never see this field; bots fill it. Pretend success, store nothing.
  if (String(form.get("website") ?? "") !== "") return { status: "success" };

  const parsed = quoteSchema.safeParse({
    name: form.get("name"),
    organization: form.get("organization"),
    country: form.get("country"),
    product: form.get("product"),
    plan: form.get("plan") || undefined,
    phone: form.get("phone"),
    email: form.get("email") ?? "",
    message: form.get("message"),
    consent: form.get("consent") === "on" || form.get("consent") === "true",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { status: "error", message: "Please check the highlighted fields.", fieldErrors };
  }

  const sourcePage = String(form.get("sourcePage") ?? "").slice(0, 200) || null;
  try {
    const store = leadStoreFromEnv();
    const h = await headers();
    if (!(await store.allow(`quote:${clientIp(h)}`, LIMIT, WINDOW_SECONDS))) {
      return {
        status: "error",
        message:
          "You have sent several requests in the last hour. Please message us on WhatsApp instead.",
      };
    }
    const lead = { ...parsed.data, sourcePage };
    await store.save(lead);
    await notifyTeam(lead);
    return { status: "success" };
  } catch {
    return {
      status: "error",
      message:
        "We could not send your request just now. Please try again, or message us on WhatsApp.",
    };
  }
}
