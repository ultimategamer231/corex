import { Badge } from "@corex/ui/components/badge";
import { Button } from "@corex/ui/components/button";
import { ArrowRight, Info, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppPreview } from "@/components/app-preview";
import { Breadcrumb } from "@/components/breadcrumb";
import { CheckList } from "@/components/check-list";
import { CtaBand } from "@/components/cta-band";
import { Faq } from "@/components/faq";
import { JsonLd } from "@/components/json-ld";
import { Container, Section, SectionHeader } from "@/components/layout";
import { Reveal } from "@/components/reveal";
import { TableScroll } from "@/components/table-scroll";
import { formatUsd, prices } from "@/content/pricing";
import { productOrder, products, type ProductSlug } from "@/content/products";
import { site } from "@/content/site";
import { whatsappLink } from "@/lib/contact";
import { demoHost, demoLoginUrl } from "@/lib/demo";
import { pageMetadata, siteUrl } from "@/lib/seo";

type Props = { params: Promise<{ product: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return productOrder.map((product) => ({ product }));
}

function getProduct(slug: string) {
  return productOrder.includes(slug as ProductSlug) ? products[slug as ProductSlug] : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = getProduct((await params).product);
  if (!p) return {};
  return pageMetadata({ title: p.name, description: p.tagline, path: `/software/${p.slug}` });
}

export default async function ProductPage({ params }: Props) {
  const p = getProduct((await params).product);
  if (!p) notFound();
  const request = whatsappLink(`Hello Corex, I would like a quote for ${p.name}.`);
  const priceRows = prices.filter((row) => p.priceIds.includes(row.id));

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: p.name,
          description: p.tagline,
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          url: `${siteUrl()}/software/${p.slug}`,
          offers: priceRows.map((row) => ({
            "@type": "Offer",
            name: `${row.productLabel}: Managed, first year`,
            price: row.managedFirstYear,
            priceCurrency: "USD",
          })),
          provider: { "@type": "Organization", name: site.name },
        }}
      />

      {/* Hero */}
      <section className="pt-[clamp(32px,5vw,72px)] pb-[clamp(48px,6vw,88px)]">
        <Container className="flex flex-col gap-7">
          <Breadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "Software", href: "/software" },
              { label: p.name },
            ]}
          />
          <div className="grid items-center gap-[clamp(36px,5vw,64px)] lg:grid-cols-2">
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap gap-2">
                {p.badges.map((b) => (
                  <Badge key={b} variant="brand">
                    {b}
                  </Badge>
                ))}
              </div>
              <h1 className="text-[clamp(36px,4.8vw,58px)] leading-[1.06] font-extrabold tracking-[-0.03em]">
                {p.name}
              </h1>
              <p className="max-w-[540px] text-[clamp(17px,1.5vw,19px)] leading-relaxed text-muted">
                {p.tagline}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="accent" size="lg">
                  <a href="#demo">{p.demoCta}</a>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <a href={request}>Request this system</a>
                </Button>
              </div>
            </div>
            <div className="rounded-4xl bg-tint p-[clamp(12px,2vw,24px)]">
              <AppPreview kind={p.slug} />
            </div>
          </div>
        </Container>
      </section>

      {/* Problem */}
      <section className="dark-surface bg-primary-dark py-[clamp(48px,6vw,80px)] text-white">
        <Container className="grid items-start gap-x-14 gap-y-6 lg:grid-cols-2">
          <h2 className="text-[clamp(26px,3vw,36px)] leading-[1.2] font-bold tracking-[-0.02em] text-white">
            {p.problemTitle}
          </h2>
          <p className="text-lg leading-relaxed text-on-dark">{p.problemText}</p>
        </Container>
      </section>

      {/* Features by module */}
      <Section aria-labelledby="modules-title">
        <Container className="flex flex-col gap-10">
          <SectionHeader
            titleId="modules-title"
            eyebrow="What's included"
            title="Features by module"
          />
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {p.modules.map((m, i) => (
              <Reveal
                as="li"
                key={m.title}
                delay={(i % 3) * 0.06}
                className="flex flex-col gap-3.5 rounded-2xl border border-border p-6"
              >
                <h3 className="text-[19px] font-bold">{m.title}</h3>
                <CheckList items={m.items} className="text-ink-soft" />
              </Reveal>
            ))}
          </ul>
          {p.note ? (
            <p className="flex items-start gap-3.5 rounded-xl border border-notice-border bg-notice-subtle px-5 py-4 text-[15px] leading-relaxed text-notice">
              <Info className="mt-0.5 size-5 shrink-0 text-notice-icon" aria-hidden="true" />
              {p.note}
            </p>
          ) : null}
        </Container>
      </Section>

      {/* Editions (School) */}
      {p.editions ? (
        <Section tone="surface" aria-labelledby="editions-title">
          <Container className="flex flex-col gap-8">
            <SectionHeader
              titleId="editions-title"
              eyebrow="Two editions"
              title="College or High School"
              lead="Both share admissions, attendance, fees and portals. They differ in how classes, grading and course choice work."
            />
            <TableScroll labelledBy="editions-title" className="bg-background">
              <table className="w-full min-w-[620px] border-collapse text-[15px]">
                <thead>
                  <tr className="bg-tint text-left">
                    <th
                      scope="col"
                      className="w-[28%] px-5 py-4 text-[13px] tracking-[0.06em] text-primary-dark uppercase"
                    >
                      Feature
                    </th>
                    <th scope="col" className="px-5 py-4 font-display text-base">
                      College / University
                    </th>
                    <th scope="col" className="px-5 py-4 font-display text-base">
                      High School
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {p.editions.map((e) => (
                    <tr key={e.feature} className="border-t border-border-subtle">
                      <th scope="row" className="px-5 py-3.5 text-left font-semibold text-ink-soft">
                        {e.feature}
                      </th>
                      <td className="px-5 py-3.5 leading-normal">{e.college}</td>
                      <td className="px-5 py-3.5 leading-normal">{e.highSchool}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </Container>
        </Section>
      ) : null}

      {/* Roles */}
      <Section aria-labelledby="roles-title">
        <Container className="flex flex-col gap-8">
          <SectionHeader
            titleId="roles-title"
            eyebrow="Who uses it"
            title="Each role sees only what it needs"
          />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {p.roles.map((r) => (
              <li
                key={r.role}
                className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface px-5 py-5"
              >
                <p className="font-display text-[17px] font-bold">{r.role}</p>
                <p className="text-[15px] leading-relaxed text-ink-soft">{r.can}</p>
              </li>
            ))}
          </ul>
          {p.callout ? (
            <p className="flex items-start gap-3.5 rounded-xl bg-tint px-5 py-5 text-[15px] leading-relaxed text-primary-dark">
              <Lock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              {p.callout}
            </p>
          ) : null}
        </Container>
      </Section>

      {/* Screenshots (SPEC.md 6.3) */}
      <Section tone="surface" aria-labelledby="screens-title">
        <Container className="flex flex-col gap-8">
          <SectionHeader
            titleId="screens-title"
            title="Screens from the system"
            lead="Illustrations with sample data. Log in to the demo to use the real screens."
          />
          <ul className="grid gap-6 md:grid-cols-3">
            {p.screens.map((screen) => (
              <li key={screen.title} className="flex flex-col gap-3">
                <AppPreview kind={p.slug} size="compact" />
                <p className="font-display font-bold">{screen.title}</p>
                <p className="text-sm leading-relaxed text-muted">{screen.description}</p>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* Demo credentials (SPEC.md 6.3) */}
      <section
        id="demo"
        aria-labelledby="demo-title"
        className="scroll-mt-4 bg-tint py-[clamp(56px,7vw,96px)]"
      >
        <Container className="flex flex-col gap-8">
          <SectionHeader
            titleId="demo-title"
            eyebrow="Live demo"
            title="Log in as any role"
            lead="Every demo account uses the same password. The sample data resets every night at 2:00 a.m. Monrovia time."
          />
          <div className="grid gap-6 lg:grid-cols-2">
            {p.demos.map((demo) => (
              <div
                key={demo.subdomain}
                className="flex flex-col gap-5 rounded-3xl border border-border bg-background p-[clamp(22px,3vw,32px)]"
              >
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-[22px] font-bold">{demo.title}</h3>
                  <p className="font-mono text-sm text-muted">{demoHost(demo)}</p>
                </div>
                <p className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border-strong bg-surface px-4 py-3">
                  <span className="text-sm text-ink-soft">Password for every role</span>
                  <span className="font-mono text-base font-bold text-primary-dark">Demo@2026</span>
                </p>
                <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {demo.roles.map((role) => (
                    <li key={role.slug}>
                      <a
                        href={demoLoginUrl(demo, role)}
                        className="flex min-h-14 flex-col justify-center gap-0.5 rounded-lg border-[1.5px] border-primary px-3.5 py-2 text-primary hover:bg-tint"
                      >
                        <span className="text-xs font-semibold text-ink-soft">Log in as</span>
                        <span className="text-[15px] font-bold">{role.label}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Pricing */}
      <Section aria-labelledby="price-title">
        <Container className="flex flex-col gap-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeader
              titleId="price-title"
              eyebrow="Pricing"
              title="Starting prices"
              lead="In US dollars. Your quote depends on the changes and data migration you need."
            />
            <Link
              href="/pricing"
              className="inline-flex min-h-11 items-center gap-2 font-bold text-primary hover:underline"
            >
              How the plans work
              <ArrowRight className="size-[18px]" aria-hidden="true" />
            </Link>
          </div>
          <TableScroll labelledBy="price-title">
            <table className="w-full min-w-[620px] border-collapse text-[15px]">
              <thead>
                <tr className="bg-surface text-[13px] tracking-[0.06em] text-ink-soft uppercase">
                  <th scope="col" className="px-5 py-4 text-left">
                    Edition
                  </th>
                  <th scope="col" className="px-5 py-4 text-right">
                    Managed: first year (USD)
                  </th>
                  <th scope="col" className="px-5 py-4 text-right">
                    Managed: yearly renewal (USD)
                  </th>
                  <th scope="col" className="px-5 py-4 text-right">
                    Handover: one time (USD)
                  </th>
                </tr>
              </thead>
              <tbody>
                {priceRows.map((row) => (
                  <tr key={row.id} className="border-t border-border-subtle">
                    <th scope="row" className="px-5 py-4 text-left font-bold">
                      {row.productLabel}
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

      {/* FAQ */}
      <section aria-labelledby="product-faq" className="pb-[clamp(56px,7vw,96px)]">
        <div className="mx-auto flex w-full max-w-[860px] flex-col gap-6 px-[clamp(16px,4vw,40px)]">
          <h2
            id="product-faq"
            className="text-[clamp(24px,2.6vw,32px)] font-bold tracking-[-0.02em]"
          >
            Questions about {p.name}
          </h2>
          <Faq items={p.faqs} defaultOpen={false} />
        </div>
      </section>

      <CtaBand
        title={`Ready to set up ${p.name}?`}
        lead="Send us a message with your organization's size and what you want changed."
        primary={{ label: "Request this system", href: request }}
        secondary={{
          label: "Use the quote form",
          href: `/contact?product=${p.slug === "school" ? "school-highschool" : p.slug}`,
        }}
      />
    </>
  );
}
