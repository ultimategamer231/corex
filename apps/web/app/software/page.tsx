import { Badge } from "@corex/ui/components/badge";
import { Button } from "@corex/ui/components/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { AppPreview } from "@/components/app-preview";
import { Breadcrumb } from "@/components/breadcrumb";
import { CheckList } from "@/components/check-list";
import { CtaBand } from "@/components/cta-band";
import { Container, Section, SectionHeader } from "@/components/layout";
import { Reveal } from "@/components/reveal";
import { onRequestSystems } from "@/content/on-request";
import { productOrder, products } from "@/content/products";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Software you can try today",
  description:
    "School, Clinic and Financial Management systems with live demos, plus systems we build on request.",
  path: "/software",
});

export default function SoftwarePage() {
  return (
    <>
      <section className="pt-[clamp(32px,5vw,72px)] pb-[clamp(24px,4vw,48px)]">
        <Container className="flex flex-col gap-5">
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Software" }]} />
          <h1 className="max-w-[16ch] text-[clamp(36px,4.8vw,58px)] leading-[1.06] font-extrabold tracking-[-0.03em]">
            Systems you can try today
          </h1>
          <p className="max-w-[620px] text-[clamp(17px,1.5vw,19px)] leading-relaxed text-muted">
            Each system has a live demo with sample data. Choose a role, log in, and work through it
            the way your staff would.
          </p>
        </Container>
      </section>

      <section className="pb-[clamp(56px,7vw,96px)]">
        <Container className="flex flex-col gap-8">
          {productOrder.map((slug, i) => {
            const p = products[slug];
            return (
              <Reveal key={slug}>
                <article
                  aria-labelledby={`product-${slug}`}
                  className="grid items-center gap-8 rounded-3xl border border-border p-[clamp(20px,3vw,40px)] lg:grid-cols-2"
                >
                  <div
                    className={
                      i % 2 === 1 ? "flex flex-col gap-5 lg:order-2" : "flex flex-col gap-5"
                    }
                  >
                    <div className="flex flex-wrap gap-2">
                      {p.badges.map((b) => (
                        <Badge key={b} variant="brand">
                          {b}
                        </Badge>
                      ))}
                    </div>
                    <h2
                      id={`product-${slug}`}
                      className="text-[clamp(26px,3vw,36px)] font-bold tracking-[-0.02em]"
                    >
                      {p.name}
                    </h2>
                    <p className="text-base leading-relaxed text-muted">{p.catalog.description}</p>
                    <CheckList items={p.catalog.highlights} />
                    <div className="flex flex-wrap gap-2.5">
                      {p.catalog.demoButtons.map((label) => (
                        <Button key={label} asChild variant="accent">
                          <Link href={`/software/${slug}#demo`}>{label}</Link>
                        </Button>
                      ))}
                      <Button asChild variant="secondary">
                        <Link href={`/software/${slug}`} aria-label={`Learn more about ${p.name}`}>
                          Learn more
                        </Link>
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-3xl bg-tint p-[clamp(12px,2vw,20px)]">
                    <AppPreview kind={slug} />
                  </div>
                </article>
              </Reveal>
            );
          })}
        </Container>
      </section>

      <Section tone="tint" aria-labelledby="demo-steps">
        <Container>
          <h2 id="demo-steps" className="sr-only">
            How the demos work
          </h2>
          <ol className="grid gap-6 md:grid-cols-3">
            {[
              ["Pick a role", "Admin, registrar, teacher, doctor, cashier, accountant and more."],
              ["Log in with one click", "Every demo account uses the password Demo@2026."],
              ["Change anything", "The sample data resets every night, so you cannot break it."],
            ].map(([title, text], i) => (
              <li key={title} className="flex gap-4">
                <span
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-white"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <div>
                  <p className="font-display text-lg font-bold">{title}</p>
                  <p className="text-[15px] leading-relaxed text-ink-soft">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      <Section aria-labelledby="on-request-title">
        <Container className="flex flex-col gap-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeader
              titleId="on-request-title"
              eyebrow="Built on request"
              title="Need a different system?"
              lead="We build these on the same tested foundation. We scope each one with you first."
            />
            <Link
              href="/software/on-request"
              className="inline-flex min-h-11 items-center gap-2 font-bold text-primary hover:underline"
            >
              See all {onRequestSystems.length} systems
              <ArrowRight className="size-[18px]" aria-hidden="true" />
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {onRequestSystems.slice(0, 8).map((s) => (
              <li
                key={s.name}
                className="rounded-xl border border-border bg-surface px-4 py-3.5 text-[15px] font-semibold"
              >
                {s.name}
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <CtaBand
        title="Not sure which system fits? Tell us what you do."
        primary={{ label: "Request a quote", href: "/contact" }}
      />
    </>
  );
}
