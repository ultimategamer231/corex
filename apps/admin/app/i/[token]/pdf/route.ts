import { renderBillingPdf } from "@corex/pdf";
import { openClientLink } from "@/lib/client-link";
import { pdfResponse } from "@/lib/pdf-response";

type Context = { params: Promise<{ token: string }> };

/** The invoice PDF through the client view link (LINK-02); same checks as the page. */
export async function GET(_request: Request, { params }: Context) {
  const { token } = await params;
  const result = await openClientLink(token);
  if (result.kind === "limited") return new Response("Please try again later.", { status: 429 });
  if (result.kind !== "ok") {
    return new Response("This link is no longer valid. Contact Corex.", { status: 404 });
  }
  const { loaded } = result;
  return pdfResponse(
    await renderBillingPdf(loaded.doc),
    `${loaded.invoice.display_number ?? "invoice"}.pdf`,
  );
}
