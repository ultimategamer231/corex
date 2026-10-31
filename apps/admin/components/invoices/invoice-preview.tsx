import type { BillingDocData } from "@corex/pdf";
import { cn } from "@corex/ui/lib/utils";

const TITLES = { invoice: "INVOICE", receipt: "RECEIPT", quote: "QUOTE" } as const;

/**
 * An invoice, receipt or quote as the client sees it (InvoiceDoc.dc.html). The PDF is
 * drawn from the same data (lib/billing-document.ts), so the two match (SPEC-ADMIN.md 9.4).
 */
export function BillingPreview({ doc, label }: { doc: BillingDocData; label?: string }) {
  return (
    <article
      aria-label={label ?? "Invoice preview"}
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-background p-5 text-[15px] sm:p-8",
        doc.watermark === "VOID" && "opacity-70",
      )}
    >
      {doc.watermark ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -rotate-12 font-display text-7xl font-bold text-border sm:text-8xl"
        >
          {doc.watermark}
        </span>
      ) : null}
      <header className="relative flex flex-col gap-4 sm:flex-row sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="font-display text-xl font-bold text-primary-dark">{doc.company.name}</p>
          {doc.company.lines.map((l) => (
            <p key={l} className="text-sm whitespace-pre-line text-ink-soft">
              {l}
            </p>
          ))}
        </div>
        <div className="flex flex-col gap-1 sm:items-end">
          <p className="font-display text-3xl font-bold tracking-wide text-ink">
            {TITLES[doc.kind]}
          </p>
          <p className="font-semibold">{doc.number ?? "Number assigned on sending"}</p>
          {doc.meta.map((m) => (
            <p key={m.label} className="text-sm text-ink-soft">
              {m.label}: {m.value}
            </p>
          ))}
        </div>
      </header>

      <section className="relative mt-6 flex flex-col gap-0.5">
        <p className="text-sm font-semibold text-muted">To:</p>
        <p className="font-semibold">{doc.billTo.name}</p>
        {doc.billTo.lines.map((l) => (
          <p key={l} className="break-all text-ink-soft">
            {l}
          </p>
        ))}
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
            {doc.lines.map((l, i) => (
              <tr key={i} className="border-b border-border-subtle align-top">
                <td className="px-3 py-2">
                  <span className="font-semibold">{l.title}</span>
                  {l.details ? (
                    <span className="block text-sm text-ink-soft">{l.details}</span>
                  ) : null}
                  {l.quantity !== "1" ? (
                    <span className="block text-sm text-ink-soft sm:hidden">
                      {l.quantity} × {l.unit}
                    </span>
                  ) : null}
                </td>
                <td className="hidden px-3 py-2 text-right sm:table-cell">{l.quantity}</td>
                <td className="hidden px-3 py-2 text-right whitespace-nowrap sm:table-cell">
                  {l.unit}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{l.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="relative mt-4 flex flex-col gap-4 sm:flex-row sm:justify-between">
        <div className="max-w-sm text-sm text-ink-soft">
          {doc.note ? <p className="whitespace-pre-line">{doc.note}</p> : null}
          <p className="mt-2 font-semibold text-ink">Thank you for your business.</p>
        </div>
        <dl className="flex w-full flex-col gap-1 sm:w-72">
          {doc.totals.map((t) => (
            <div key={t.label} className="flex justify-between">
              <dt>{t.label}</dt>
              <dd>{t.value}</dd>
            </div>
          ))}
          <div
            className={cn(
              "mt-1 flex justify-between rounded-md px-3 py-2 font-bold text-white",
              doc.grand.tone === "paid" ? "bg-primary" : "bg-primary-dark",
            )}
          >
            <dt>{doc.grand.label}</dt>
            <dd>{doc.grand.value}</dd>
          </div>
        </dl>
      </div>

      <footer className="relative mt-8 grid gap-4 border-t border-border pt-4 text-sm text-ink-soft sm:grid-cols-3">
        <div>
          <p className="font-semibold text-ink">Questions</p>
          {doc.questions.map((q) => (
            <p key={q} className="break-all">
              {q}
            </p>
          ))}
        </div>
        {doc.paymentInfo ? (
          <div>
            <p className="font-semibold text-ink">Payment info</p>
            <p className="whitespace-pre-line">{doc.paymentInfo}</p>
          </div>
        ) : null}
        {doc.terms ? (
          <div>
            <p className="font-semibold text-ink">Terms and notes</p>
            <p className="whitespace-pre-line">{doc.terms}</p>
          </div>
        ) : null}
      </footer>
    </article>
  );
}
