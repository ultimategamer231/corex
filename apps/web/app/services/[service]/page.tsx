import { Button } from "@corex/ui/components/button";
import { ArrowRight, Check, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/breadcrumb";
import { Container, Section, SectionHeader, SectionTitle } from "@/components/layout";
import { Reveal } from "@/components/reveal";
import { serviceOrder, services, type ServiceSlug } from "@/content/services";
import { whatsappLink } from "@/lib/contact";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ service: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return serviceOrder.map((service) => ({ service }));
}

function getService(slug: string) {
  return serviceOrder.includes(slug as ServiceSlug) ? services[slug as ServiceSlug] : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = getService((await params).service);
  return s
    ? pageMetadata({ title: s.name, description: s.tagline, path: `/services/${s.slug}` })
    : {};
}

export default async function ServicePage({ params }: Props) {
  const s = getService((await params).service);
  if (!s) notFound();
  const others = serviceOrder.filter((slug) => slug !== s.slug);
  return (
    <>
      <section className="pt-[clamp(32px,5vw,72px)] pb-[clamp(48px,6vw,88px)]">
        <Container className="grid items-start gap-[clamp(32px,5vw,64px)] lg:grid-cols-[1.2fr_1fr]">
          <div className="flex flex-col gap-5">
            <Breadcrumb
              items={[{ label: "Home", href: "/" }, { label: "Services" }, { label: s.name }]}
            />
            <h1 className="text-[clamp(36px,4.8vw,58px)] leading-[1.06] font-extrabold tracking-[-0.03em]">
              {s.name}
            </h1>
            <p className="max-w-[560px] text-[clamp(17px,1.5vw,19px)] leading-relaxed text-muted">
              {s.tagline}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="accent" size="lg">
                <a href={whatsappLink(`Hello Corex, I would like to talk about ${s.name}.`)}>
                  <MessageCircle aria-hidden="true" />
                  Talk to us on WhatsApp
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href={`/contact?product=${s.slug}`}>Request a quote</Link>
              </Button>
            </div>
          </div>
          <div className="rounded-3xl bg-tint p-[clamp(20px,3vw,32px)]">
            <h2 className="mb-4 text-[13px] font-bold tracking-[0.08em] text-primary-dark uppercase">
              Who it&apos;s for
            </h2>
            <ul className="flex flex-col gap-3 text-[15px] leading-relaxed">
              {s.audience.map((a) => (
                <li key={a} className="flex gap-2.5">
                  <Check
                    className="mt-0.5 size-[18px] shrink-0 text-primary"
                    strokeWidth={2.4}
                    aria-hidden="true"
                  />
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      <Section tone="surface" aria-labelledby="offers-title">
        <Container className="flex flex-col gap-10">
          <SectionHeader titleId="offers-title" eyebrow="What we do" title={s.offerTitle} />
          <ul className="grid gap-5 md:grid-cols-2">
            {s.offers.map((o, i) => (
              <Reveal
                as="li"
                key={o.title}
                delay={(i % 2) * 0.06}
                className="flex flex-col gap-2 rounded-2xl border border-border bg-background p-6"
              >
                <span className="font-display text-sm font-bold text-primary" aria-hidden="true">
                  0{i + 1}
                </span>
                <h3 className="text-[19px] font-bold">{o.title}</h3>
                <p className="text-[15px] leading-relaxed text-muted">{o.text}</p>
              </Reveal>
            ))}
          </ul>
        </Container>
      </Section>

      <Section aria-labelledby="how-title">
        <Container className="flex flex-col gap-8">
          <SectionTitle id="how-title">How we work</SectionTitle>
          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {s.steps.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-2 border-t-2 border-primary pt-4">
                <span className="text-xs font-bold tracking-[0.08em] text-primary uppercase">
                  Step {i + 1}
                </span>
                <p className="font-display text-lg font-bold">{step.title}</p>
                <p className="text-[15px] leading-relaxed text-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      <Section tone="surface" aria-labelledby="other-services" className="border-b-0">
        <Container className="flex flex-col gap-6">
          <SectionTitle id="other-services" className="text-[clamp(24px,2.6vw,32px)]">
            Other services
          </SectionTitle>
          <ul className="grid gap-4 md:grid-cols-3">
            {[
              ...others.map((slug) => ({
                href: `/services/${slug}`,
                name: services[slug].name,
                sub: services[slug].summary,
              })),
              {
                href: "/software",
                name: "Our software",
                sub: "School, Clinic and Finance systems",
              },
            ].map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex h-full items-center justify-between gap-4 rounded-xl border border-border bg-background px-6 py-5 hover:border-primary"
                >
                  <span className="flex flex-col gap-1">
                    <span className="font-display text-lg font-bold">{item.name}</span>
                    <span className="text-sm text-muted">{item.sub}</span>
                  </span>
                  <ArrowRight className="size-5 shrink-0 text-primary" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </Section>
    </>
  );
}
