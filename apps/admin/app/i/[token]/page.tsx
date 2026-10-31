import { buttonVariants } from "@corex/ui/components/button";
import { Download } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { BillingPreview } from "@/components/invoices/invoice-preview";
import { InvoiceStatusBadge } from "@/components/invoices/status-badge";
import { openClientLink } from "@/lib/client-link";
import { money } from "@/lib/clients";

export const metadata: Metadata = {
  title: { absolute: "Invoice" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Props = { params: Promise<{ token: string }> };

/**
 * The client view of one invoice (SPEC-ADMIN.md 9.5): the invoice, its status and
 * balance, how to pay, and the PDF. Nothing else about the client or Corex (LINK-02).
 */
export default async function ClientInvoicePage({ params }: Props) {
  await connection();
  const { token } = await params;
  const result = await openClientLink(token);
  if (result.kind !== "ok") {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-3 px-4 py-12">
        <h1 className="font-display text-2xl font-bold text-ink">
          {result.kind === "limited" ? "Please try again later" : "This link is no longer valid"}
        </h1>
        <p className="text-[15px] text-ink-soft">
          {result.kind === "limited"
            ? "This page was opened too many times from your network. Try again in an hour."
            : "This link is no longer valid. Contact Corex."}
        </p>
      </main>
    );
  }
  const { invoice, doc } = result.loaded;
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:py-12">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
            Invoice {invoice.display_number}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-[15px] text-ink-soft">
            <InvoiceStatusBadge status={invoice.shownStatus} />
            <span>
              Balance due:{" "}
              <strong className="text-ink">{money(invoice.balanceMinor, invoice.currency)}</strong>
            </span>
          </div>
        </div>
        <a href={`/i/${token}/pdf`} className={buttonVariants({ variant: "accent" })}>
          <Download aria-hidden="true" />
          Download PDF
        </a>
      </header>
      <BillingPreview doc={doc} />
    </main>
  );
}
