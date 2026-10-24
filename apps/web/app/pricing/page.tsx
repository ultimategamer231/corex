import { Badge } from "@corex/ui/components/badge";
import { Breadcrumb } from "@/components/breadcrumb";
import { CheckList } from "@/components/check-list";
import { CtaBand } from "@/components/cta-band";
import { Faq } from "@/components/faq";
import { Container, Section, SectionTitle } from "@/components/layout";
import { Reveal } from "@/components/reveal";
import { TableScroll } from "@/components/table-scroll";
import {
  addOns,
  comparison,
  formatUsd,
  paymentMethods,
  paymentSchedule,
  plans,
  prices,
  pricingFaqs,
} from "@/content/pricing";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Pricing",
  description:
    "Managed (we host it) or Handover (you host it). Starting prices in US dollars, add-ons and payment terms.",
  path: "/pricing",
});

const th = "px-5 py-4 text-[13px] tracking-[0.06em] text-ink-soft uppercase";

export default function PricingPage() {
  return (
    <>
      <section className="pt-[clamp(32px,5vw,72px)] pb-[clamp(24px,4vw,48px)]">
        <Container className="flex flex-col gap-5">
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Pricing" }]} />
          <h1 className="max-w-[18ch] text-[clamp(36px,4.8vw,58px)] leading-[1.06] font-extrabold tracking-[-0.03em]">
            Two ways to own your system
          </h1>
          <p className="max-w-[640px] text-[clamp(17px,1.5vw,19px)] leading-relaxed text-muted">
            Let us host and maintain it, or take it over and run it yourself. Either way you get
            your own separate system and own all of your data.
          </p>
        </Container>
      </section>

      <section className="pb-[clamp(56px,7vw,96px)]">
        <Container className="grid gap-6 md:grid-cols-2">
          {[plans.managed, plans.handover].map((plan, i) => (
            <Reveal
              key={plan.key}
              delay={i * 0.06}
              className={
                i === 0
                  ? "flex flex-col gap-5 rounded-3xl border-2 border-primary p-[clamp(24px,3vw,36px)]"
                  : "flex flex-col gap-5 rounded-3xl border border-border p-[clamp(24px,3vw,36px)]"
              }
            >
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-bold tracking-[0.06em] text-primary uppercase">
                    {plan.label}
                  </span>
                  <Badge variant="brand">{plan.tag}</Badge>
                </div>
                <h2 className="text-[28px] font-bold">{plan.name}</h2>
                <p className="text-[15px] leading-relaxed text-muted">{plan.bestFor}</p>
              </div>
              <div className="rounded-xl bg-surface px-5 py-4">
                <p className="text-[13px] font-bold tracking-[0.06em] text-ink-soft uppercase">
                  You pay
                </p>
                <p className="mt-1 text-[15px] leading-relaxed">{plan.youPay}</p>
              </div>
              <CheckList items={plan.points} />
            </Reveal>
          ))}
        </Container>
      </section>

      <Section tone="surface" aria-labelledby="compare-title">
        <Container className="flex flex-col gap-6">
          <SectionTitle id="compare-title">Side by side</SectionTitle>
          <TableScroll labelledBy="compare-title" className="bg-background">
            <table className="w-full min-w-[560px] border-collapse text-[15px]">
              <thead>
                <tr className="bg-tint text-left">
                  <td className="w-[34%] px-5 py-4" />
                  <th scope="col" className="px-5 py-4 font-display text-base">
                    Managed
                  </th>
                  <th scope="col" className="px-5 py-4 font-display text-base">
                    Handover
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.feature} className="border-t border-border-subtle">
                    <th scope="row" className="px-5 py-3.5 text-left font-semibold text-ink-soft">
                      {row.feature}
                    </th>
                    <td className="px-5 py-3.5">{row.managed}</td>
                    <td className="px-5 py-3.5">{row.handover}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </Container>
      </Section>

      <Section aria-labelledby="prices-title">
        <Container className="flex flex-col gap-6">
          <div className="flex max-w-[640px] flex-col gap-3">
            <SectionTitle id="prices-title">Starting prices</SectionTitle>
            <p className="text-base leading-relaxed text-muted">
              In US dollars. Your quote depends on the changes you need, the number of branches and
              how much data we move in.
            </p>
          </div>
          <TableScroll labelledBy="prices-title">
            <table className="w-full min-w-[680px] border-collapse text-[15px]">
              <thead>
                <tr className="bg-surface">
                  <th scope="col" className={`${th} text-left`}>
                    System
                  </th>
                  <th scope="col" className={`${th} text-right`}>
                    Managed: first year (USD)
                  </th>
                  <th scope="col" className={`${th} text-right`}>
                    Managed: yearly renewal (USD)
                  </th>
                  <th scope="col" className={`${th} text-right`}>
                    Handover: one time (USD)
                  </th>
                </tr>
              </thead>
              <tbody>
                {prices.map((row) => (
                  <tr key={row.id} className="border-t border-border-subtle">
                    <th scope="row" className="px-5 py-4 text-left font-bold">
                      {row.name}
                    </th>
                    <td className="px-5 py-4 text-right font-display text-lg font-bold">
                      {formatUsd(row.managedFirstYear)}
                    </td>
                    <td className="px-5 py-4 text-right font-display text-lg font-bold">
                      {formatUsd(row.managedRenewal)}
                    </td>
                    <td className="px-5 py-4 text-right font-display text-lg font-bold">
                      {formatUsd(row.handover)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </Container>
      </Section>

      <Section tone="tint" aria-label="Add-ons and payment">
        <Container className="grid gap-10 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <SectionTitle className="text-[clamp(24px,2.6vw,32px)]">Add-ons</SectionTitle>
            <dl className="flex flex-col divide-y divide-border rounded-2xl bg-background px-5">
              {addOns.map((a) => (
                <div
                  key={a.name}
                  className="flex flex-wrap items-baseline justify-between gap-3 py-4"
                >
                  <dt className="text-[15px]">{a.name}</dt>
                  <dd className="font-display font-bold">{a.price}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-ink-soft">Training outside Monrovia adds travel costs.</p>
          </div>
          <div className="flex flex-col gap-5">
            <SectionTitle className="text-[clamp(24px,2.6vw,32px)]">How you pay</SectionTitle>
            <div className="flex flex-col gap-4 rounded-2xl bg-background p-5">
              <div className="flex h-3 overflow-hidden rounded-full" aria-hidden="true">
                <span className="w-1/2 bg-primary" />
                <span className="w-[30%] bg-primary/60" />
                <span className="w-1/5 bg-accent" />
              </div>
              <ol className="flex flex-col gap-2 text-[15px]">
                {paymentSchedule.map((p) => (
                  <li key={p.percent}>
                    <strong>{p.percent}%</strong> {p.when}
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-2xl bg-background p-5">
              <h3 className="mb-3 font-display font-bold">Payment methods</h3>
              <CheckList items={paymentMethods} />
            </div>
          </div>
        </Container>
      </Section>

      <section aria-labelledby="pricing-faq" className="py-[clamp(56px,7vw,96px)]">
        <div className="mx-auto flex w-full max-w-[860px] flex-col gap-6 px-[clamp(16px,4vw,40px)]">
          <h2
            id="pricing-faq"
            className="text-[clamp(24px,2.6vw,32px)] font-bold tracking-[-0.02em]"
          >
            Pricing questions
          </h2>
          <Faq items={pricingFaqs} defaultOpen={false} />
        </div>
      </section>

      <CtaBand
        title="Get an exact price for your organization"
        primary={{ label: "Request a quote", href: "/contact" }}
      />
    </>
  );
}
