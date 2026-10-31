import { renderBillingPdf } from "@corex/pdf";
import { z } from "zod";
import { quoteDocument } from "@/lib/billing-document";
import { billingSettings } from "@/lib/invoice-document-data";
import { productLabel } from "@/lib/leads";
import { pdfResponse } from "@/lib/pdf-response";
import { AdminAuthError, requireAdmin } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

/** The quote recorded on a lead, as a PDF titled QUOTE (LeadDetail.dc.html). */
export async function GET(_request: Request, { params }: Context) {
  let session;
  try {
    session = await requireAdmin();
  } catch (error) {
    if (error instanceof AdminAuthError) return new Response("Please sign in.", { status: 401 });
    throw error;
  }
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response("Not found.", { status: 404 });
  const { data: lead } = await session.supabase
    .from("leads")
    .select(
      "organization, name, product, quote_amount_minor, quote_currency, quote_sent_on, quote_note",
    )
    .eq("id", id)
    .maybeSingle();
  if (!lead || lead.quote_amount_minor === null || !lead.quote_currency) {
    return new Response("This lead has no quote.", { status: 404 });
  }
  const doc = quoteDocument(
    {
      organization: lead.organization,
      contact: lead.name,
      amountMinor: lead.quote_amount_minor,
      currency: lead.quote_currency,
      sentOn: lead.quote_sent_on,
      note: lead.quote_note,
      product: productLabel(lead.product),
    },
    await billingSettings(session.supabase),
  );
  return pdfResponse(await renderBillingPdf(doc), `Quote ${lead.organization}.pdf`);
}
