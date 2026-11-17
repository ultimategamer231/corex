// Ready WhatsApp messages for a lead (audit round A2), filled in with the person's name,
// organization, product and quote. Shared by pages; keep free of server-only imports.
import { productLabel } from "./leads";

export type TemplateLead = {
  name: string;
  organization: string;
  product: string | null;
  quoteText: string;
  quoteNumber: string | null;
  quoteValidUntil: string | null;
};

export type WhatsAppTemplate = { key: string; label: string; text: string };

/** The public demo for a product, or null when it has none. */
export function demoUrl(product: string | null, rootDomain = "corexlr.com"): string | null {
  const sub: Record<string, string> = {
    "school-college": "demo-college",
    "school-highschool": "demo-school",
    clinic: "demo-clinic",
    finance: "demo-finance",
  };
  const s = product ? sub[product] : undefined;
  return s ? `https://${s}.${rootDomain}` : null;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function leadTemplates(
  lead: TemplateLead,
  sender: string,
  rootDomain?: string,
): WhatsAppTemplate[] {
  const hello = `Hello ${firstName(lead.name)},`;
  const product =
    lead.product && productLabel(lead.product) !== "Not given"
      ? productLabel(lead.product)
      : "our systems";
  const demo = demoUrl(lead.product, rootDomain);
  const templates: WhatsAppTemplate[] = [
    {
      key: "reply",
      label: "Reply to a new request",
      text: `${hello} thank you for your request about ${product} for ${lead.organization}. I am ${firstName(sender)} from Corex Digital Solutions. When is a good time for a short call this week?`,
    },
  ];
  if (demo) {
    templates.push({
      key: "demo",
      label: "Send the demo",
      text: `${hello} you can try ${product} now at ${demo}. Pick a role and you are signed in straight away, with sample data. I am happy to walk you through it on a call.`,
    });
  }
  if (lead.quoteText) {
    templates.push({
      key: "quote",
      label: "Send the quote",
      text: `${hello} here is our quote${lead.quoteNumber ? ` ${lead.quoteNumber}` : ""} for ${lead.organization}: ${lead.quoteText}${lead.quoteValidUntil ? `, valid until ${lead.quoteValidUntil}` : ""}. Payment is 70% when you approve the mock-up and design, and 30% when you approve the finished system. I will send the PDF here.`,
    });
  }
  templates.push({
    key: "follow_up",
    label: "Follow up",
    text: `${hello} I am following up on ${product} for ${lead.organization}. Do you have any questions I can answer, or would a short call help?`,
  });
  return templates;
}

/** A WhatsApp link that opens the chat with the message typed in. */
export function withText(link: string, text: string): string {
  return `${link}?text=${encodeURIComponent(text)}`;
}
