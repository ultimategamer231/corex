import type { BillingDocData } from "@corex/pdf";
import { COREX_LOGO_PNG } from "@corex/pdf/logo";
import { cn } from "@corex/ui/lib/utils";

const TITLES = { invoice: "INVOICE", receipt: "PAYMENT RECEIPT", quote: "QUOTE" } as const;
const PARTY = { invoice: "Bill to", receipt: "Issued to", quote: "Prepared for" } as const;
const TONES = {
  paid: "bg-tint text-primary",
  part: "bg-notice-subtle text-warning",
  due: "bg-surface-muted text-ink-soft",
} as const;

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-xs font-bold tracking-wider text-primary uppercase">{children}</p>
  );
}

/**
 * An invoice, receipt or quote as the client sees it (owner-approved design, 18 Nov 2026).
 * The PDF is drawn from the same data (lib/billing-document.ts), so the two match
 * (SPEC-ADMIN.md 9.4).
 */
export function BillingPreview({ doc, label }: { doc: BillingDocData; label?: string }) {
  const receipt = doc.kind === "receipt";
  return (
    <article
      aria-label={label ?? "Invoice preview"}
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-background px-5 pt-7 pb-5 text-[15px] sm:px-8 sm:pt-9",
        doc.watermark === "VOID" && "opacity-70",
      )}
    >
      <div aria-hidden="true" className="absolute inset-x-0 top-0 flex h-1.5">
        <span className="flex-[4] bg-primary" />
        <span className="flex-1 bg-accent" />
      </div>
      {doc.watermark ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -rotate-12 font-display text-7xl font-bold text-border sm:text-8xl"
        >
          {doc.watermark}
        </span>
      ) : null}

      <header className="relative flex flex-col gap-4 border-b border-border-subtle pb-5 sm:flex-row sm:items-start sm:justify-between">
        {/* eslint-disable-next-line @next/next/no-img-element -- an embedded data image, no optimization needed */}
        <img src={COREX_LOGO_PNG} alt={doc.company.name} width={160} height={56} />
        <div className="flex flex-col gap-1 sm:items-end sm:text-right">
          <p
            className={cn(
              "font-display font-bold tracking-wide",
              receipt ? "text-sm text-primary" : "text-3xl text-ink",
            )}
          >
            {TITLES[doc.kind]}
          </p>
          <p className={cn("font-bold", receipt ? "text-xl text-ink" : "text-primary")}>
            {doc.number ?? "Number assigned on sending"}
          </p>
          <p className="text-sm text-ink-soft">
            {doc.meta.map((m) => `${m.label} ${m.value}`).join("  |  ")}
          </p>
          {!receipt && doc.status ? (
            <span
              className={cn(
                "mt-1 w-fit rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wider",
                TONES[doc.status.tone],
              )}
            >
              {doc.status.label}
            </span>
          ) : null}
        </div>
      </header>

      <section className="relative grid gap-5 border-b border-border-subtle py-5 sm:grid-cols-2">
        {receipt ? null : (
          <div>
            <Label>From</Label>
            <p className="font-bold text-ink">{doc.company.name}</p>
            {doc.company.lines.map((l) => (
              <p key={l} className="text-sm text-ink-soft">
                {l}
              </p>
            ))}
          </div>
        )}
        <div>
          <Label>{PARTY[doc.kind]}</Label>
          <p className="font-bold text-ink">{doc.billTo.name}</p>
          {doc.billTo.lines.map((l) => (
            <p key={l} className="text-sm break-all text-ink-soft">
              {l}
            </p>
          ))}
        </div>
        {receipt ? (
          <div>
            <Label>Payment details</Label>
            <dl className="flex flex-col gap-1 text-sm">
              {doc.facts.map((f) => (
                <div key={f.label} className="flex justify-between gap-3">
                  <dt className="text-ink-soft">{f.label}</dt>
                  <dd className="font-bold text-ink">{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </section>

      {receipt && doc.highlight ? (
        <section className="relative mt-5 flex flex-col gap-3 rounded-lg border-l-4 border-primary bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Label>Amount received</Label>
            <p className="font-display text-3xl font-bold text-ink">{doc.highlight.value}</p>
          </div>
          <div className="sm:text-right">
            <Label>Payment status</Label>
            {doc.status ? (
              <p
                className={cn(
                  "font-bold",
                  doc.status.tone === "part" ? "text-warning" : "text-primary",
                )}
              >
                {doc.status.label}
              </p>
            ) : null}
            {doc.highlight.note ? (
              <p className="text-sm text-ink-soft">{doc.highlight.note}</p>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="relative mt-5">
        {receipt ? <Label>Transaction summary</Label> : null}
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-primary text-left text-xs tracking-wider text-primary-foreground">
              <th scope="col" className="px-3 py-2 font-bold">
                DESCRIPTION
              </th>
              <th scope="col" className="hidden px-3 py-2 text-right font-bold sm:table-cell">
                QTY
              </th>
              <th scope="col" className="hidden px-3 py-2 text-right font-bold sm:table-cell">
                {receipt ? "UNIT PRICE" : "RATE"}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-bold">
                AMOUNT
              </th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l, i) => (
              <tr key={i} className="border-b border-border-subtle align-top">
                <td className="px-3 py-3">
                  <span className="font-bold text-ink">
                    {receipt ? null : (
                      <span className="mr-1.5 text-primary">{String(i + 1).padStart(2, "0")}</span>
                    )}
                    {l.title}
                  </span>
                  {l.details ? (
                    <span className="mt-0.5 block text-sm text-ink-soft">{l.details}</span>
                  ) : null}
                  {l.quantity !== "1" ? (
                    <span className="block text-sm text-ink-soft sm:hidden">
                      {l.quantity} × {l.unit}
                    </span>
                  ) : null}
                </td>
                <td className="hidden px-3 py-3 text-right sm:table-cell">{l.quantity}</td>
                <td className="hidden px-3 py-3 text-right whitespace-nowrap sm:table-cell">
                  {l.unit}
                </td>
                <td className="px-3 py-3 text-right font-bold whitespace-nowrap">{l.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="relative mt-5 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-4 sm:max-w-sm">
          {doc.note ? (
            <div>
              <Label>{doc.kind === "quote" ? "Notes and terms" : "Notes"}</Label>
              <p className="text-sm whitespace-pre-line text-ink-soft">{doc.note}</p>
            </div>
          ) : null}
          {doc.payments.length > 0 ? (
            <div>
              <Label>Payments received</Label>
              <ul className="flex flex-col text-sm">
                {doc.payments.map((p) => (
                  <li
                    key={p.label}
                    className="flex justify-between gap-3 border-b border-border-subtle py-1.5"
                  >
                    <span>{p.label}</span>
                    <span className="whitespace-nowrap">{p.amount}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <dl className="flex w-full flex-col gap-1 rounded-lg bg-surface p-4 sm:w-72">
          {doc.totals.map((t) => (
            <div
              key={t.label}
              className={cn(
                "flex justify-between gap-3",
                t.strong ? "font-bold text-ink" : "text-ink-soft",
              )}
            >
              <dt>{t.label}</dt>
              <dd>{t.value}</dd>
            </div>
          ))}
          <div className="mt-1 flex items-center justify-between gap-3 border-t border-border pt-2 text-primary">
            <dt className="text-sm font-bold">{doc.grand.label}</dt>
            <dd className="font-display text-2xl font-bold">{doc.grand.value}</dd>
          </div>
        </dl>
      </div>

      <footer className="relative mt-6 border-t border-border-subtle pt-4 text-sm">
        {receipt ? (
          <div className="flex flex-col gap-1">
            <p className="font-bold text-ink">Thank you for your business.</p>
            <p className="text-ink-soft">
              This receipt confirms payment received for the invoice above.
            </p>
            <p className="mt-2 text-ink-soft">{doc.questions.join("  |  ")}</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label>Payment methods</Label>
                <p className="whitespace-pre-line text-ink">{doc.paymentInfo}</p>
              </div>
              <div>
                <Label>Payment terms</Label>
                <p className="whitespace-pre-line text-ink">{doc.terms}</p>
              </div>
              <div>
                <Label>Questions?</Label>
                {doc.questions.map((q) => (
                  <p key={q} className="break-all text-ink">
                    {q}
                  </p>
                ))}
              </div>
            </div>
            <p className="mt-4 font-bold text-ink">Thank you for your business.</p>
          </>
        )}
      </footer>
    </article>
  );
}
