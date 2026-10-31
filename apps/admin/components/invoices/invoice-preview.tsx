import { cn } from "@corex/ui/lib/utils";
import type { BillingSettings } from "@/lib/billing-settings";
import { percentText } from "@/lib/billing-settings";
import { money } from "@/lib/clients";
import { formatDay } from "@/lib/format";
import type { InvoiceLineRow, InvoiceSummary } from "@/lib/invoices-data";

export type BillTo = {
  name: string;
  contact: string | null;
  email: string | null;
  address: string | null;
};

/**
 * The invoice as the client will see it (InvoiceDoc.dc.html). The PDF is drawn from the
 * same data; drafts carry a DRAFT mark and no number (SPEC-ADMIN.md 9.4).
 */
export function InvoicePreview({
  invoice,
  lines,
  billing,
  billTo,
}: {
  invoice: InvoiceSummary;
  lines: InvoiceLineRow[];
  billing: BillingSettings;
  billTo: BillTo;
}) {
  const draft = invoice.status === "draft";
  const voided = invoice.status === "void";
  const c = invoice.currency;
  return (
    <article
      aria-label="Invoice preview"
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-background p-5 text-[15px] sm:p-8",
        voided && "opacity-70",
      )}
    >
      {draft || voided ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -rotate-12 font-display text-7xl font-bold text-border sm:text-8xl"
        >
          {draft ? "DRAFT" : "VOID"}
        </span>
      ) : null}
      <header className="relative flex flex-col gap-4 sm:flex-row sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="font-display text-xl font-bold text-primary-dark">{billing.company.name}</p>
          {billing.company.address ? (
            <p className="text-sm whitespace-pre-line text-ink-soft">{billing.company.address}</p>
          ) : null}
          {billing.company.taxId ? (
            <p className="text-sm text-ink-soft">TIN {billing.company.taxId}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1 sm:items-end">
          <p className="font-display text-3xl font-bold tracking-wide text-ink">INVOICE</p>
          <p className="font-semibold">{invoice.display_number ?? "Number assigned on sending"}</p>
          <p className="text-sm text-ink-soft">
            Date: {invoice.issue_date ? formatDay(invoice.issue_date) : "On sending"}
          </p>
          <p className="text-sm text-ink-soft">
            Due:{" "}
            {invoice.due_date
              ? formatDay(invoice.due_date)
              : `${invoice.payment_terms_days ?? billing.termsDays} days after sending`}
          </p>
        </div>
      </header>

      <section className="relative mt-6 flex flex-col gap-0.5">
        <p className="text-sm font-semibold text-muted">To:</p>
        <p className="font-semibold">{billTo.name}</p>
        {billTo.contact ? <p className="text-ink-soft">{billTo.contact}</p> : null}
        {billTo.email ? <p className="break-all text-ink-soft">{billTo.email}</p> : null}
        {billTo.address ? <p className="text-ink-soft">{billTo.address}</p> : null}
      </section>

      <div className="relative mt-6">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-primary text-left text-primary-foreground">
              <th scope="col" className="px-3 py-2 font-semibold">
                Description
              </th>
              <th scope="col" className="hidden px-3 py-2 text-right font-semibold sm:table-cell">
                Qty
              </th>
              <th scope="col" className="hidden px-3 py-2 text-right font-semibold sm:table-cell">
                Price
              </th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-border-subtle align-top">
                <td className="px-3 py-2">
                  <span className="font-semibold">{l.description}</span>
                  {l.details ? (
                    <span className="block text-sm text-ink-soft">{l.details}</span>
                  ) : null}
                  {Number(l.quantity) !== 1 ? (
                    <span className="block text-sm text-ink-soft sm:hidden">
                      {Number(l.quantity)} × {money(l.unit_amount_minor, c)}
                    </span>
                  ) : null}
                </td>
                <td className="hidden px-3 py-2 text-right sm:table-cell">{Number(l.quantity)}</td>
                <td className="hidden px-3 py-2 text-right whitespace-nowrap sm:table-cell">
                  {money(l.unit_amount_minor, c)}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {money(l.amount_minor, c)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="relative mt-4 flex flex-col gap-4 sm:flex-row sm:justify-between">
        <div className="max-w-sm text-sm text-ink-soft">
          {invoice.notes ? <p className="whitespace-pre-line">{invoice.notes}</p> : null}
          <p className="mt-2 font-semibold text-ink">Thank you for your business.</p>
        </div>
        <dl className="flex w-full flex-col gap-1 sm:w-72">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{money(invoice.subtotal_minor, c)}</dd>
          </div>
          {invoice.discount_minor > 0 ? (
            <div className="flex justify-between">
              <dt>
                Discount
                {invoice.discount_type === "percent" && invoice.discount_value !== null
                  ? ` (${Number(invoice.discount_value)}%)`
                  : ""}
              </dt>
              <dd>-{money(invoice.discount_minor, c)}</dd>
            </div>
          ) : null}
          {invoice.tax_minor > 0 ? (
            <div className="flex justify-between">
              <dt>
                {billing.taxLabel} ({percentText(invoice.tax_rate_bp)})
              </dt>
              <dd>{money(invoice.tax_minor, c)}</dd>
            </div>
          ) : null}
          {invoice.paidMinor > 0 ? (
            <div className="flex justify-between">
              <dt>Paid</dt>
              <dd>-{money(invoice.paidMinor, c)}</dd>
            </div>
          ) : null}
          <div className="mt-1 flex justify-between rounded-md bg-primary-dark px-3 py-2 font-bold text-white">
            <dt>TOTAL DUE</dt>
            <dd>
              {money(
                invoice.status === "draft" || invoice.status === "void"
                  ? invoice.total_minor
                  : invoice.balanceMinor,
                c,
              )}
            </dd>
          </div>
        </dl>
      </div>

      <footer className="relative mt-8 grid gap-4 border-t border-border pt-4 text-sm text-ink-soft sm:grid-cols-3">
        <div>
          <p className="font-semibold text-ink">Questions</p>
          {billing.company.email ? <p className="break-all">{billing.company.email}</p> : null}
          {billing.company.phone ? <p>{billing.company.phone}</p> : null}
        </div>
        <div>
          <p className="font-semibold text-ink">Payment info</p>
          <p className="whitespace-pre-line">
            {billing.paymentInstructions ?? "Add payment instructions in Settings."}
          </p>
        </div>
        <div>
          <p className="font-semibold text-ink">Terms and notes</p>
          <p className="whitespace-pre-line">
            {billing.invoiceTerms ??
              `Payment is due within ${invoice.payment_terms_days ?? billing.termsDays} days.`}
          </p>
        </div>
      </footer>
    </article>
  );
}
