import { renderBillingPdf } from "@corex/pdf";
import { z } from "zod";
import { loadInvoiceDocument } from "@/lib/invoice-document-data";
import { pdfResponse } from "@/lib/pdf-response";
import { AdminAuthError, requireAdmin } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

/** The invoice PDF (SPEC-ADMIN.md 9.4), from the same data as the on-screen preview. */
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
  const loaded = await loadInvoiceDocument(session.supabase, id);
  if (!loaded) return new Response("Not found.", { status: 404 });
  const pdf = await renderBillingPdf(loaded.doc);
  return pdfResponse(pdf, `${loaded.invoice.display_number ?? "draft-invoice"}.pdf`);
}
