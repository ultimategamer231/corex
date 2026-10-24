import { MapPin, MessageCircle, Phone } from "lucide-react";
import { Breadcrumb } from "@/components/breadcrumb";
import { Container } from "@/components/layout";
import { QuoteForm } from "@/components/quote-form";
import { contactCopy } from "@/content/contact";
import { site } from "@/content/site";
import { formatPhone, telLink, whatsappLink } from "@/lib/contact";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Request a quote",
  description:
    "Tell Corex about your organization and what you need. We reply on WhatsApp or by email with questions or a quote.",
  path: "/contact",
});

type Props = { searchParams: Promise<{ product?: string; from?: string }> };

export default async function ContactPage({ searchParams }: Props) {
  const { product, from } = await searchParams;
  const sourcePage = `/contact${from ? `?from=${from.slice(0, 60)}` : ""}`;
  const [primary, ...others] = site.phones;
  return (
    <section className="pt-[clamp(32px,5vw,72px)] pb-[clamp(56px,7vw,96px)]">
      <Container className="flex flex-col gap-8">
        <div className="flex flex-col gap-5">
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Contact" }]} />
          <h1 className="text-[clamp(36px,4.8vw,58px)] leading-[1.06] font-extrabold tracking-[-0.03em]">
            {contactCopy.title}
          </h1>
          <p className="max-w-[620px] text-[clamp(17px,1.5vw,19px)] leading-relaxed text-muted">
            {contactCopy.lead}
          </p>
        </div>
        <div className="grid items-start gap-8 lg:grid-cols-[1.6fr_1fr]">
          <QuoteForm defaultProduct={product} sourcePage={sourcePage} />
          <aside className="flex flex-col gap-5" aria-label="Other ways to reach us">
            {primary ? (
              <a
                href={whatsappLink("Hello Corex")}
                className="flex flex-col gap-2 rounded-2xl bg-primary-dark p-6 text-white hover:bg-primary"
              >
                <span className="inline-flex items-center gap-2 font-display text-lg font-bold">
                  <MessageCircle className="size-5" aria-hidden="true" />
                  Prefer WhatsApp?
                </span>
                <span className="text-[15px] text-on-dark">
                  Message us directly. It is usually the fastest way to reach us.
                </span>
                <span className="font-bold">{formatPhone(primary)}</span>
              </a>
            ) : null}
            <div className="flex flex-col gap-3 rounded-2xl border border-border p-6 text-[15px]">
              <p className="font-display font-bold">Call or WhatsApp</p>
              <ul>
                {others.map((phone) => (
                  <li key={phone}>
                    <a
                      href={telLink(phone)}
                      className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary hover:underline"
                    >
                      <Phone className="size-4" aria-hidden="true" />
                      {formatPhone(phone)}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="font-display font-bold">Email</p>
              <a
                href={`mailto:${site.email.address}`}
                className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
              >
                {site.email.address}
              </a>
              <p className="font-display font-bold">Location</p>
              <p className="inline-flex items-center gap-2 text-ink-soft">
                <MapPin className="size-4 text-primary" aria-hidden="true" />
                {site.address.street}, {site.address.city}, {site.address.country}
              </p>
            </div>
            <div className="rounded-2xl bg-tint p-6">
              <p className="mb-3 font-display font-bold">What happens next</p>
              <ol className="flex list-decimal flex-col gap-2 pl-5 text-[15px] leading-relaxed text-ink-soft">
                {contactCopy.nextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          </aside>
        </div>
      </Container>
    </section>
  );
}
