import { Button } from "@corex/ui/components/button";
import { ArrowRight } from "lucide-react";
import { Breadcrumb } from "@/components/breadcrumb";
import { CtaBand } from "@/components/cta-band";
import { Container, Section, SectionTitle } from "@/components/layout";
import { Reveal } from "@/components/reveal";
import { customBuildSteps, onRequestSystems } from "@/content/on-request";
import { whatsappLink } from "@/lib/contact";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Systems we build on request",
  description:
    "Point of sale, church, pharmacy, hotel, property, payroll, NGO and more, built on the same tested foundation as our ready-made systems.",
  path: "/software/on-request",
});

export default function OnRequestPage() {
  return (
    <>
      <section className="pt-[clamp(32px,5vw,72px)] pb-[clamp(24px,4vw,48px)]">
        <Container className="flex flex-col gap-5">
          <Breadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "Software", href: "/software" },
              { label: "Built on request" },
            ]}
          />
          <h1 className="max-w-[18ch] text-[clamp(36px,4.8vw,58px)] leading-[1.06] font-extrabold tracking-[-0.03em]">
            Systems we build on request
          </h1>
          <p className="max-w-[640px] text-[clamp(17px,1.5vw,19px)] leading-relaxed text-muted">
            These run on the same foundation as our ready-made systems. We start by understanding
            how your business works, then send a scope and quote.
          </p>
        </Container>
      </section>

      <section className="pb-[clamp(56px,7vw,96px)]">
        <Container>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {onRequestSystems.map((s, i) => (
              <Reveal
                as="li"
                key={s.name}
                delay={(i % 3) * 0.05}
                className="flex flex-col gap-3 rounded-2xl border border-border p-6"
              >
                <h2 className="text-lg font-bold">{s.name}</h2>
                <p className="grow text-[15px] leading-relaxed text-muted">{s.description}</p>
                <Button asChild variant="secondary" className="self-start">
                  <a href={whatsappLink(`Hello Corex, I am interested in a ${s.name} system.`)}>
                    Request this<span className="sr-only">: {s.name} on WhatsApp</span>
                    <ArrowRight aria-hidden="true" />
                  </a>
                </Button>
              </Reveal>
            ))}
          </ul>
        </Container>
      </section>

      <Section tone="tint" aria-labelledby="custom-build">
        <Container className="flex flex-col gap-8">
          <SectionTitle id="custom-build">How a custom build works</SectionTitle>
          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {customBuildSteps.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-2 rounded-2xl bg-background p-6">
                <span
                  className="inline-flex size-10 items-center justify-center rounded-full bg-primary font-bold text-white"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <p className="font-display text-lg font-bold">{step.title}</p>
                <p className="text-[15px] leading-relaxed text-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      <CtaBand
        title="Don't see your system?"
        lead="Describe what you need and we will tell you honestly whether we can build it."
        primary={{ label: "Describe your system", href: "/contact?product=on-request" }}
      />
    </>
  );
}
