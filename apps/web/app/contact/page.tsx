import { Button } from "@corex/ui/components/button";
import {
  ArrowRight,
  ArrowUpRight,
  Info,
  Mail,
  MapPin,
  MonitorPlay,
  Phone,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { Breadcrumb } from "@/components/breadcrumb";
import { Container } from "@/components/layout";
import { QuoteForm } from "@/components/quote-form";
import { contactCopy } from "@/content/contact";
import { site } from "@/content/site";
import { formatPhone, telLink, whatsappLink } from "@/lib/contact";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Contact Corex",
  description:
    "Contact Corex Digital Solutions in Monrovia by phone, WhatsApp or email, or request a quote for school, clinic or finance software.",
  path: "/contact",
});

type Props = { searchParams: Promise<{ product?: string; from?: string }> };

function Channel({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span
        className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-tint text-primary"
        aria-hidden="true"
      >
        <Icon className="size-5" />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-sm text-muted">{label}</span>
        {children}
      </div>
    </li>
  );
}

export default async function ContactPage({ searchParams }: Props) {
  const { product, from } = await searchParams;
  const sourcePage = `/contact${from ? `?from=${from.slice(0, 60)}` : ""}`;
  const [primary, ...others] = site.phones;
  return (
    <>
      <section className="pt-[clamp(28px,5vw,64px)] pb-[clamp(40px,5vw,64px)]">
        <Container className="grid items-start gap-[clamp(32px,5vw,56px)] lg:grid-cols-[1fr_1.25fr]">
          {/* Left: introduction and direct channels */}
          <div className="flex flex-col">
            <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Contact" }]} />
            <h1 className="mt-3 text-[clamp(36px,4.6vw,56px)] leading-[1.04] font-extrabold tracking-[-0.03em]">
              {contactCopy.pageTitle}
            </h1>
            <span className="my-5 h-1 w-14 rounded-full bg-accent" aria-hidden="true" />
            <p className="max-w-[460px] text-lg leading-relaxed text-ink-soft">
              {contactCopy.pageLead}
            </p>

            <h2 className="mt-9 text-[13px] font-extrabold tracking-[0.12em] text-primary uppercase">
              Reach us directly
            </h2>
            <ul className="mt-5 flex flex-col gap-5">
              <Channel icon={Mail} label="Email">
                <a
                  href={`mailto:${site.email.address}`}
                  className="inline-flex min-h-11 items-center text-lg font-bold break-all text-ink hover:text-primary hover:underline"
                >
                  {site.email.address}
                </a>
              </Channel>
              {primary ? (
                <Channel icon={Phone} label="Phone and WhatsApp">
                  <a
                    href={telLink(primary)}
                    className="inline-flex min-h-11 items-center text-lg font-bold text-ink hover:text-primary hover:underline"
                  >
                    {formatPhone(primary)}
                  </a>
                  <span className="flex flex-wrap gap-x-4 text-[15px] text-muted">
                    {others.map((phone) => (
                      <a
                        key={phone}
                        href={telLink(phone)}
                        className="inline-flex min-h-11 items-center font-semibold text-ink-soft hover:text-primary hover:underline"
                      >
                        {formatPhone(phone)}
                      </a>
                    ))}
                  </span>
                </Channel>
              ) : null}
              <Channel icon={MapPin} label="Office">
                <span className="text-lg font-bold">
                  {site.address.street}, {site.address.city}, {site.address.country}
                </span>
              </Channel>
            </ul>

            {primary ? (
              <div className="mt-8 flex flex-wrap items-center gap-4 rounded-2xl bg-primary-dark p-6 text-white">
                <div className="flex grow flex-col gap-1">
                  <p className="font-display text-lg font-bold">Prefer WhatsApp?</p>
                  <p className="text-[15px] text-on-dark">
                    It is usually the fastest way to reach us.
                  </p>
                </div>
                <Button asChild variant="accent">
                  <a href={whatsappLink("Hello Corex")}>
                    Message us on WhatsApp
                    <ArrowUpRight aria-hidden="true" />
                  </a>
                </Button>
              </div>
            ) : null}

            <p className="mt-8 flex gap-3 border-t border-border pt-6 text-[15px] leading-relaxed text-ink-soft">
              <Info className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <span>
                <strong className="text-ink">{contactCopy.support.title}</strong>{" "}
                {contactCopy.support.text}
              </span>
            </p>
          </div>

          {/* Right: the quote form, then what happens next */}
          <div className="flex flex-col gap-6">
            <div className="rounded-3xl border border-border bg-background p-[clamp(20px,3vw,34px)] shadow-[0_24px_48px_-32px_rgb(6_70_68/0.4)]">
              <div className="mb-6 flex flex-col gap-1.5">
                <h2 className="text-[clamp(24px,2.4vw,30px)] font-bold tracking-[-0.02em]">
                  {contactCopy.title}
                </h2>
                <p className="leading-relaxed text-ink-soft">{contactCopy.lead}</p>
              </div>
              <QuoteForm defaultProduct={product} sourcePage={sourcePage} />
              <p className="mt-5 flex gap-2 text-sm text-muted">
                <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
                {contactCopy.privacyNote}
              </p>
            </div>
            <div className="rounded-2xl bg-tint p-6">
              <h2 className="mb-3 font-display font-bold">What happens next</h2>
              <ol className="flex list-decimal flex-col gap-2 pl-5 text-[15px] leading-relaxed text-ink-soft">
                {contactCopy.nextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          </div>
        </Container>
      </section>

      <section aria-labelledby="explore-title" className="pb-[clamp(48px,6vw,80px)]">
        <Container>
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 md:flex-row md:items-center md:gap-6 md:px-8">
            <h2
              id="explore-title"
              className="flex items-center gap-3 font-display text-[19px] font-bold whitespace-nowrap"
            >
              <MonitorPlay className="size-6 text-primary" aria-hidden="true" />
              {contactCopy.explore.title}
            </h2>
            <p className="grow leading-relaxed text-ink-soft">{contactCopy.explore.text}</p>
            <Button asChild variant="outline" className="nudge self-start md:self-auto">
              <Link href="/software">
                View live demos
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </Container>
      </section>
    </>
  );
}
