import { productOptions } from "@/content/contact";
import type { Lead } from "./schema";

/**
 * Emails the team about a new lead through Resend's HTTP API when RESEND_API_KEY,
 * LEAD_NOTIFY_TO and LEAD_NOTIFY_FROM are set; otherwise does nothing (SPEC.md 6.6).
 * Never throws: the lead is already stored.
 */
export async function notifyTeam(
  lead: Lead,
  env: Record<string, string | undefined> = process.env,
): Promise<boolean> {
  const { RESEND_API_KEY: apiKey, LEAD_NOTIFY_TO: to, LEAD_NOTIFY_FROM: from } = env;
  if (!apiKey || !to || !from) return false;
  const product = productOptions.find((o) => o.value === lead.product)?.label ?? lead.product;
  const text = [
    `New quote request from ${lead.name} (${lead.organization}, ${lead.country})`,
    `Product: ${product}`,
    `Plan interest: ${lead.plan}`,
    `Phone/WhatsApp: ${lead.phone}`,
    `Email: ${lead.email || "not given"}`,
    `Page: ${lead.sourcePage ?? "unknown"}`,
    "",
    lead.message,
  ].join("\n");
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: to.split(",").map((s) => s.trim()),
        subject: `Quote request: ${lead.organization}`,
        text,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
