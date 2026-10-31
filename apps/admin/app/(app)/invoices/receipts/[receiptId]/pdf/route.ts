import { renderBillingPdf } from "@corex/pdf";
import { z } from "zod";
import { pdfResponse } from "@/lib/pdf-response";
import { loadReceiptDocument } from "@/lib/receipt-document-data";
import { AdminAuthError, requireAdmin } from "@/lib/session";

type Context = { params: Promise<{ receiptId: string }> };

/** A receipt PDF (PAY-03), with the green AMOUNT PAID block. */
export async function GET(_request: Request, { params }: Context) {
  let session;
  try {
    session = await requireAdmin();
  } catch (error) {
    if (error instanceof AdminAuthError) return new Response("Please sign in.", { status: 401 });
    throw error;
  }
  const { receiptId } = await params;
  if (!z.uuid().safeParse(receiptId).success) return new Response("Not found.", { status: 404 });
  const loaded = await loadReceiptDocument(session.supabase, receiptId);
  if (!loaded) return new Response("Not found.", { status: 404 });
  return pdfResponse(await renderBillingPdf(loaded.doc), `${loaded.number ?? "receipt"}.pdf`);
}
