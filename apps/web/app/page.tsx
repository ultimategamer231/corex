import { Button } from "@corex/ui/components/button";
import {
  ArrowRight,
  Check,
  Coins,
  Headphones,
  MessageCircle,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { AppPreview } from "@/components/app-preview";
import { ProductCard, WorkCard } from "@/components/cards";
import { CheckList } from "@/components/check-list";
import { CtaBand } from "@/components/cta-band";
import { Faq } from "@/components/faq";
import { JsonLd } from "@/components/json-ld";
import { Container, Section, SectionHeader } from "@/components/layout";
import { Reveal } from "@/components/reveal";
import { home } from "@/content/home";
import { plans } from "@/content/pricing";
import { productOrder } from "@/content/products";
import { serviceOrder, services } from "@/content/services";
import { site } from "@/content/site";
import { whatsappLink } from "@/lib/contact";
import { pageMetadata, siteUrl } from "@/lib/seo";
import { allWork } from "@/lib/work";

export const metadata = pageMetadata({
  title: `${site.shortName}: ${site.tagline}`,
  description: site.description,
  path: "/",
});

const whyIcons = {
  offline: WifiOff,
  currency: Coins,
  support: Headphones,
  data: ShieldCheck,
} as const;

function ArrowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-2 text-base font-bold text-primary hover:underline"
    >
      {children}
      <ArrowRight className="size-[18px]" aria-hidden="true" />
    </Link>
  );
}

export default function HomePage() {
  const work = allWork().slice(0, 3);
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: site.name,
          url: siteUrl(),
          logo: `${siteUrl()}/brand/corex-logo.png`,
          telephone: `+${site.whatsapp.primary}`,
          address: {
            "@type": "PostalAddress",
            streetAddress: site.address.street,
            addressLocality: site.address.city,
            addressCountry: "LR",
          },
        }}
      />

      {/* 1. Hero */}
      <section className="py-[clamp(40px,7vw,96px)]">
        <Container className="grid items-center gap-[clamp(40px,5vw,64px)] lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <p className="inline-flex items-center gap-2 self-start rounded-full bg-tint px-3 py-1.5 text-[13px] font-semibold text-primary-dark">
              <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
              {home.hero.badge}
            </p>
            <h1 className="text-[clamp(38px,5.2vw,64px)] leading-[1.05] font-extrabold tracking-[-0.03em]">
              {home.hero.title}
            </h1>
            <p className="max-w-[540px] text-[clamp(17px,1.5vw,19px)] leading-relaxed text-muted">
              {home.hero.lead}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="accent" size="lg">
                <Link href="/software">
                  Try a live demo
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href={whatsappLink("Hello Corex, I'd like to talk about your software")}>
                  <MessageCircle aria-hidden="true" />
                  Talk to us on WhatsApp
                </a>
              </Button>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-2 text-sm font-medium text-muted">
              {home.hero.proof.map((item) => (
                <li key={item} className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-primary" strokeWidth={2.4} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-4xl bg-tint p-[clamp(12px,2vw,24px)]">
            <AppPreview kind="school" />
          </div>
        </Container>
      </section>

      {/* 2-3. Products and "See all systems" */}
      <Section tone="surface" aria-labelledby="products-title">
        <Container className="flex flex-col gap-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeader
              titleId="products-title"
              eyebrow={home.products.eyebrow}
              title={home.products.title}
              lead={home.products.lead}
            />
            <ArrowLink href="/software">See all systems</ArrowLink>
          </div>
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {productOrder.map((slug, i) => (
              <Reveal as="li" key={slug} delay={i * 0.06}>
                <ProductCard slug={slug} />
              </Reveal>
            ))}
          </ul>
        </Container>
      </Section>

      {/* 4. How it works */}
      <Section aria-labelledby="steps-title">
        <Container className="flex flex-col gap-10">
          <SectionHeader
            titleId="steps-title"
            eyebrow={home.steps.eyebrow}
            title={home.steps.title}
          />
          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {home.steps.items.map((step, i) => (
              <Reveal
                as="li"
                key={step.title}
                delay={i * 0.06}
                className="flex flex-col gap-3 rounded-2xl border border-border p-6"
              >
                <span
                  className={
                    i === 3
                      ? "inline-flex size-10 items-center justify-center rounded-full bg-accent font-bold text-accent-foreground"
                      : "inline-flex size-10 items-center justify-center rounded-full bg-primary font-bold text-white"
                  }
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <h3 className="text-[19px] font-bold">{step.title}</h3>
                <p className="text-[15px] leading-relaxed text-muted">{step.text}</p>
              </Reveal>
            ))}
          </ol>
        </Container>
      </Section>

      {/* 5. Plans */}
      <Section tone="tint" aria-labelledby="plans-title">
        <Container className="flex flex-col gap-10">
          <SectionHeader
            titleId="plans-title"
            eyebrow={home.plans.eyebrow}
            title={home.plans.title}
            lead={home.plans.lead}
          />
          <div className="grid gap-6 md:grid-cols-2">
            {[plans.managed, plans.handover].map((plan, i) => (
              <Reveal
                key={plan.key}
                delay={i * 0.06}
                className={
                  i === 0
                    ? "flex flex-col gap-5 rounded-3xl border-2 border-primary bg-background p-[clamp(24px,3vw,36px)]"
                    : "flex flex-col gap-5 rounded-3xl border border-border bg-background p-[clamp(24px,3vw,36px)]"
                }
              >
                <div className="flex flex-col gap-2">
                  <p className="text-[13px] font-bold tracking-[0.06em] text-primary uppercase">
                    {plan.label}
                  </p>
                  <h3 className="text-[26px] font-bold">{plan.name}</h3>
                  <p className="text-[15px] leading-relaxed text-muted">{plan.homeSummary}</p>
                </div>
                <CheckList items={plan.homePoints} />
              </Reveal>
            ))}
          </div>
          <ArrowLink href="/pricing">Compare plans and starting prices</ArrowLink>
        </Container>
      </Section>

      {/* 6. Why Corex */}
      <Section aria-labelledby="why-title">
        <Container className="flex flex-col gap-10">
          <SectionHeader titleId="why-title" eyebrow={home.why.eyebrow} title={home.why.title} />
          <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {home.why.items.map((item, i) => {
              const Icon = whyIcons[item.icon as keyof typeof whyIcons];
              return (
                <Reveal as="li" key={item.title} delay={i * 0.06} className="flex flex-col gap-3">
                  <span
                    className="inline-flex size-12 items-center justify-center rounded-xl bg-tint text-primary"
                    aria-hidden="true"
                  >
                    <Icon className="size-6" />
                  </span>
                  <h3 className="text-lg font-bold">{item.title}</h3>
                  <p className="text-[15px] leading-relaxed text-muted">{item.text}</p>
                </Reveal>
              );
            })}
          </ul>
        </Container>
      </Section>

      {/* 7. Our work (hidden when nothing is published, SPEC.md 6.5) */}
      {work.length > 0 ? (
        <Section tone="surface" aria-labelledby="work-title">
          <Container className="flex flex-col gap-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <SectionHeader
                titleId="work-title"
                eyebrow={home.work.eyebrow}
                title={home.work.title}
              />
              <ArrowLink href="/work">View all work</ArrowLink>
            </div>
            <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {work.map((entry) => (
                <li key={entry.slug}>
                  <WorkCard work={entry} />
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}

      {/* 8. Services strip */}
      <Section aria-labelledby="services-title">
        <Container className="flex flex-col gap-8">
          <SectionHeader
            titleId="services-title"
            eyebrow={home.services.eyebrow}
            title={home.services.title}
          />
          <ul className="grid gap-4 md:grid-cols-3">
            {serviceOrder.map((slug) => (
              <li key={slug}>
                <Link
                  href={`/services/${slug}`}
                  className="flex h-full items-center justify-between gap-4 rounded-xl border border-border px-6 py-5 hover:border-primary"
                >
                  <span className="flex flex-col gap-1">
                    <span className="font-display text-lg font-bold">{services[slug].name}</span>
                    <span className="text-sm text-muted">{services[slug].summary}</span>
                  </span>
                  <ArrowRight className="size-5 shrink-0 text-primary" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* 9. FAQ */}
      <Section tone="surface" aria-labelledby="faq-title" className="border-b-0">
        <div className="mx-auto flex w-full max-w-[860px] flex-col gap-8 px-[clamp(16px,4vw,40px)]">
          <SectionHeader titleId="faq-title" eyebrow={home.faq.eyebrow} title={home.faq.title} />
          <Faq items={home.faq.items} />
        </div>
      </Section>

      {/* 10. Final call to action (footer follows in the layout) */}
      <CtaBand
        title={home.finalCta.title}
        lead={home.finalCta.lead}
        primary={{ label: "Try a live demo", href: "/software" }}
        secondary={{ label: "Request a quote", href: "/contact" }}
      />
    </>
  );
}
