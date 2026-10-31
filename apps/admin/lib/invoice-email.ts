import { renderBillingPdf } from "@corex/pdf";
import { hashToken, randomToken } from "./auth/tokens";
import { type EmailStatus, sendEmail, simpleEmailHtml } from "./email";
import { adminEnv } from "./env";
import { loadInvoiceDocument } from "./invoice-document-data";
import { logEvent } from "./log";
import type { RequestContext } from "./request-context";
import type { AdminDb } from "./supabase";

/** Where invoices for a client go: the billing contact, else the primary one. */
export async function billingEmail(db: AdminDb, clientId: string): Promise<string | null> {
  const { data } = await db
    .from("client_contacts")
    .select("email")
    .eq("client_id", clientId)
    .not("email", "is", null)
    .order("is_billing", { ascending: false })
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.email ?? null;
}

export type InvoiceEmailResult =
  { kind: "not_sendable" } | { kind: "done"; status: EmailStatus; number: string };

/**
 * SPEC-ADMIN.md 9.6: emails a sent invoice with its PDF attached and a fresh client view
 * link (any older link stops working). A reminder says so in the subject and text. The
 * service role reads and writes: callers check who may send first. While client email
 * is off nothing leaves; the email log records it as skipped.
 */
export async function emailInvoice(
  service: AdminDb,
  invoiceId: string,
  to: string,
  options: {
    reminder?: "14d" | "3d";
    actorId?: string | null;
    context?: RequestContext;
  } = {},
): Promise<InvoiceEmailResult> {
  const loaded = await loadInvoiceDocument(service, invoiceId);
  if (!loaded || loaded.invoice.status === "draft" || loaded.invoice.status === "void") {
    return { kind: "not_sendable" };
  }
  const token = randomToken();
  const { error } = await service.rpc("create_invoice_link", {
    p_invoice_id: invoiceId,
    p_token_hash: hashToken(token),
  });
  if (error) throw new Error(error.message);
  const link = `${adminEnv().adminUrl}/i/${token}`;
  const { invoice, doc, billing } = loaded;
  const number = invoice.display_number ?? "";
  const amount = doc.grand.value;
  const due = doc.meta[1]?.value ?? "";
  const company = billing.company.name;
  const subject = options.reminder
    ? `Reminder: invoice ${number} from ${company} is due ${due}`
    : `Invoice ${number} from ${company}`;
  const opening = options.reminder
    ? `A reminder that invoice ${number} for ${amount} is due ${due}. If you have already paid, thank you, and please ignore this message.`
    : `Please find invoice ${number} for ${amount}, due ${due}. The PDF is attached.`;
  const pdf = await renderBillingPdf(doc);
  const status = await sendEmail(service, {
    to,
    subject,
    template: options.reminder ? `renewal_reminder_${options.reminder}` : "invoice",
    entityType: "invoices",
    entityId: invoice.id,
    audience: "client",
    attachments: [{ filename: `${number}.pdf`, content: pdf }],
    text: `Hello,\n\n${opening}\nView it online and download the PDF here (valid 30 days):\n${link}\n\n${company}`,
    html: simpleEmailHtml(
      options.reminder ? `Reminder: invoice ${number}` : `Invoice ${number}`,
      ["Hello,", opening],
      {
        label: "View the invoice",
        url: link,
      },
    ),
  });
  if (status === "sent") {
    await logEvent(service, {
      area: "invoices",
      action: options.reminder ? "renewal_reminder_emailed" : "invoice_emailed",
      summary: options.reminder
        ? `Emailed a renewal reminder (${options.reminder === "14d" ? "14" : "3"} days before due) for invoice ${number} to ${to}`
        : `Emailed invoice ${number} to ${to}`,
      actorId: options.actorId ?? null,
      actorType: options.actorId ? "admin" : "system",
      entityType: "invoices",
      entityId: invoice.id,
      context: options.context,
    });
  }
  return { kind: "done", status, number };
}
