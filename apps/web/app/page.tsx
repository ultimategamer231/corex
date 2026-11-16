import { Button } from "@corex/ui/components/button";
import {
  ArrowRight,
  Check,
  Code,
  Headphones,
  MessageCircle,
  Play,
  Rocket,
  Search,
  Settings2,
  Users,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { AppPreview } from "@/components/app-preview";
import { ProductCard, WorkCard } from "@/components/cards";
import { CheckList } from "@/components/check-list";
import { CtaBand } from "@/components/cta-band";
import { Faq } from "@/components/faq";
import { Container, Eyebrow, Section, SectionHeader } from "@/components/layout";
import { Reveal } from "@/components/reveal";
import { home } from "@/content/home";
import { plans } from "@/content/pricing";
import { productOrder } from "@/content/products";
import { whatsappLink } from "@/lib/contact";
import { pageMetadata } from "@/lib/seo";
import { allWork } from "@/lib/work";

export const metadata = pageMetadata({
  title: "School, Clinic and Finance Software in Liberia | Corex Digital Solutions",
  description:
    "Software for schools, colleges, clinics, businesses and NGOs in Liberia. Try a live demo first, then we set it up, train your team and support you.",
  path: "/",
  absoluteTitle: true,
});

const trustIcons = { demo: Play, local: WifiOff, support: Headphones } as const;
const stepIcons = [Search, Settings2, Users, Rocket] as const;

function ArrowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="nudge inline-flex min-h-11 items-center gap-2 text-base font-bold whitespace-nowrap text-primary hover:underline"
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
      {/* 1. Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-background to-surface">
        {/* Brand diagonals behind the preview (decorative, wide screens only). */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
          <div className="shape-in absolute inset-y-0 right-0 w-[44%] bg-primary [clip-path:polygon(26%_0,100%_0,100%_100%,0_100%)]" />
          <div className="shape-in absolute inset-y-0 right-[36%] w-[5%] bg-accent [clip-path:polygon(70%_0,100%_0,30%_100%,0_100%)]" />
        </div>
        <Container className="relative grid items-center gap-[clamp(40px,5vw,64px)] py-[clamp(40px,7vw,96px)] lg:grid-cols-[1.05fr_1fr]">
          <div className="flex flex-col gap-6">
            <div className="rise-in">
              <Eyebrow>{home.hero.eyebrow}</Eyebrow>
            </div>
            <h1
              className="rise-in text-[clamp(38px,5.2vw,62px)] leading-[1.04] font-extrabold tracking-[-0.03em]"
              style={{ "--d": "80ms" } as React.CSSProperties}
            >
              {home.hero.title}
            </h1>
            <p
              className="rise-in max-w-[540px] text-[clamp(17px,1.5vw,19px)] leading-relaxed text-ink-soft"
              style={{ "--d": "160ms" } as React.CSSProperties}
            >
              {home.hero.lead}
            </p>
            <div
              className="rise-in flex flex-wrap gap-3"
              style={{ "--d": "240ms" } as React.CSSProperties}
            >
              <Button asChild size="lg" className="nudge">
                <Link href="/software">
                  Explore software
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="#demos">
                  <Play aria-hidden="true" />
                  Try a live demo
                </Link>
              </Button>
            </div>
            <ul
              className="rise-in flex flex-wrap gap-x-5 gap-y-2 pt-1 text-sm font-medium text-muted"
              style={{ "--d": "320ms" } as React.CSSProperties}
            >
              {home.hero.proof.map((item) => (
                <li key={item} className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-primary" strokeWidth={2.4} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="art-in rounded-3xl bg-tint p-3 shadow-[0_30px_60px_-30px_rgb(6_70_68/0.55)] lg:bg-background/70 lg:p-4">
            <AppPreview kind="school" />
          </div>
        </Container>
      </section>

      {/* 2. Three reasons, as a strip under the hero */}
      <section aria-labelledby="why-title" className="border-y border-border bg-background">
        <Container>
          <h2 id="why-title" className="sr-only">
            Why Corex
          </h2>
          <ul className="grid divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
            {home.trust.map((item, i) => {
              const Icon = trustIcons[item.icon as keyof typeof trustIcons];
              return (
                <Reveal
                  as="li"
                  key={item.title}
                  delay={i * 0.06}
                  className="flex gap-4 py-6 md:px-6 md:first:pl-0 md:last:pr-0"
                >
                  <span
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-tint text-primary"
                    aria-hidden="true"
                  >
                    <Icon className="size-5" />
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <h3 className="text-[17px] font-bold">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-muted">{item.text}</p>
                  </div>
                </Reveal>
              );
            })}
          </ul>
        </Container>
      </section>

      {/* 3. Our software, then "Try it" and "Built on request" */}
      <Section aria-labelledby="products-title">
        <Container className="flex flex-col gap-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeader
              titleId="products-title"
              eyebrow={home.products.eyebrow}
              title={home.products.title}
              lead={home.products.lead}
            />
            <ArrowLink href="/software">View all software</ArrowLink>
          </div>
          <ul id="demos" className="grid scroll-mt-24 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {productOrder.map((slug, i) => (
              <Reveal as="li" key={slug} delay={i * 0.08}>
                <ProductCard slug={slug} />
              </Reveal>
            ))}
          </ul>

          <Reveal className="mt-6 grid items-center gap-8 rounded-3xl border border-border bg-surface p-[clamp(24px,3.5vw,40px)] lg:grid-cols-[1fr_2fr]">
            <div className="flex flex-col gap-3">
              <h2 className="text-[clamp(24px,2.4vw,30px)] leading-tight font-bold tracking-[-0.02em]">
                {home.tryIt.title}
              </h2>
              <p className="leading-relaxed text-ink-soft">{home.tryIt.lead}</p>
            </div>
            <ol className="grid gap-6 sm:grid-cols-3">
              {home.tryIt.steps.map((step, i) => (
                <li key={step.title} className="flex flex-col gap-1.5">
                  <span
                    className="mb-1.5 inline-flex size-9 items-center justify-center rounded-lg bg-primary font-display text-sm font-extrabold text-white"
                    aria-hidden="true"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-bold">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-muted">{step.text}</p>
                  {i === 2 ? (
                    <a
                      href={whatsappLink("Hello Corex, I'd like to talk about your software")}
                      className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-primary hover:underline"
                    >
                      <MessageCircle className="size-4" aria-hidden="true" />
                      Talk to us on WhatsApp
                    </a>
                  ) : null}
                </li>
              ))}
            </ol>
          </Reveal>

          <Reveal className="flex flex-col gap-3 rounded-2xl border border-border p-6 md:flex-row md:items-center md:gap-6">
            <h2 className="flex items-center gap-2.5 text-lg font-bold whitespace-nowrap md:border-r md:border-border md:pr-6">
              <Code className="size-5 text-primary" aria-hidden="true" />
              {home.onRequest.title}
            </h2>
            <p className="grow leading-relaxed text-ink-soft">{home.onRequest.text}</p>
            <ArrowLink href="/software/on-request">{home.onRequest.link}</ArrowLink>
          </Reveal>
        </Container>
      </Section>

      {/* 4. How we work */}
      <Section tone="surface" aria-labelledby="steps-title">
        <Container className="grid gap-10 lg:grid-cols-[1fr_3fr]">
          <SectionHeader
            titleId="steps-title"
            eyebrow={home.steps.eyebrow}
            title={home.steps.title}
            lead={home.steps.lead}
          />
          <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {home.steps.items.map((step, i) => {
              const Icon = stepIcons[i] ?? Rocket;
              return (
                <Reveal as="li" key={step.title} delay={i * 0.08} className="flex flex-col gap-2">
                  <span className="flex items-center gap-3" aria-hidden="true">
                    <span className="inline-flex size-11 items-center justify-center rounded-xl bg-background text-primary ring-1 ring-border">
                      <Icon className="size-5" />
                    </span>
                    {i < home.steps.items.length - 1 ? (
                      <span className="hidden h-px grow bg-border lg:block" />
                    ) : null}
                  </span>
                  <h3 className="mt-2 text-lg font-bold">
                    <span className="sr-only">Step {i + 1}: </span>
                    {step.title}
                  </h3>
                  <p className="text-[15px] leading-relaxed text-muted">{step.text}</p>
                </Reveal>
              );
            })}
          </ol>
        </Container>
      </Section>

      {/* 5. Plans (stay on the home page until there are case studies and testimonials) */}
      <Section aria-labelledby="plans-title">
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
                delay={i * 0.08}
                className={
                  i === 0
                    ? "lift flex flex-col gap-5 rounded-3xl border-2 border-primary bg-background p-[clamp(24px,3vw,36px)]"
                    : "lift flex flex-col gap-5 rounded-3xl border border-border bg-background p-[clamp(24px,3vw,36px)]"
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

      {/* 6. Our work (hidden when nothing is published, SPEC.md 6.5) */}
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
                <li key={entry.slug} className="lift rounded-2xl">
                  <WorkCard work={entry} />
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}

      {/* 7. FAQ */}
      <Section tone="surface" aria-labelledby="faq-title" className="border-b-0">
        <div className="mx-auto flex w-full max-w-[860px] flex-col gap-8 px-[clamp(16px,4vw,40px)]">
          <SectionHeader titleId="faq-title" eyebrow={home.faq.eyebrow} title={home.faq.title} />
          <Faq items={home.faq.items} />
        </div>
      </Section>

      {/* 8. Final call to action (footer follows in the layout) */}
      <CtaBand
        title={home.finalCta.title}
        lead={home.finalCta.lead}
        primary={{ label: "Try a live demo", href: "/software" }}
        secondary={{ label: "Request a quote", href: "/contact" }}
      />
    </>
  );
}
