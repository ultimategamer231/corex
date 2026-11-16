import { CorexLogo } from "@corex/ui/brand";
import { Button } from "@corex/ui/components/button";
import {
  CircleArrowRight,
  FileText,
  Mail,
  MapPin,
  MessageCircle,
  MonitorPlay,
  Phone,
} from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { productOrder, products } from "@/content/products";
import { serviceOrder, services } from "@/content/services";
import { site } from "@/content/site";
import { formatPhone, telLink, whatsappLink } from "@/lib/contact";

const linkClass =
  "group inline-flex min-h-11 items-center gap-3 text-[15px] text-on-dark transition-colors hover:text-white xl:whitespace-nowrap";

function Column({
  id,
  title,
  children,
  as = "nav",
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  as?: "nav" | "div";
}) {
  const Tag = as;
  return (
    <Tag aria-labelledby={id} className="flex flex-col">
      <h2 id={id} className="font-display text-lg font-bold text-white">
        {title}
      </h2>
      <span className="mt-2.5 mb-3 h-[3px] w-10 rounded-full bg-accent" aria-hidden="true" />
      {children}
    </Tag>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className={linkClass}>
        <CircleArrowRight
          className="size-[18px] shrink-0 text-accent-on-dark transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
        {children}
      </Link>
    </li>
  );
}

export function SiteFooter({ showWork }: { showWork: boolean }) {
  const [primary, ...others] = site.phones;
  return (
    <footer className="dark-surface relative isolate overflow-hidden bg-primary-darker pt-[clamp(48px,6vw,80px)] pb-6 text-white">
      {/* Soft diagonal light in the corner (decorative). */}
      <div
        aria-hidden="true"
        className="absolute -top-24 -right-40 -z-10 h-[420px] w-[520px] rotate-[24deg] rounded-[48px] bg-white/[0.035]"
      />
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-12 px-[clamp(16px,4vw,40px)]">
        <div className="grid grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[minmax(260px,1.3fr)_auto_auto_auto_auto] xl:justify-between xl:gap-x-12">
          {/* Brand */}
          <div className="flex flex-col gap-5 sm:col-span-2 lg:col-span-4 xl:col-span-1">
            <Link
              href="/"
              aria-label={`${site.name} home`}
              className="inline-flex min-h-11 items-center self-start"
            >
              <CorexLogo tone="dark" />
            </Link>
            <p className="max-w-[320px] text-[15px] leading-relaxed text-on-dark">
              Management software for schools, clinics, businesses and NGOs in Liberia.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <Button asChild variant="accent" size="sm">
                <Link href="/software">
                  <MonitorPlay aria-hidden="true" />
                  Try a live demo
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-on-dark bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/contact">
                  <FileText aria-hidden="true" />
                  Get a quote
                </Link>
              </Button>
            </div>
          </div>

          <Column id="footer-software" title="Our software">
            <ul>
              {productOrder.map((slug) => (
                <FooterLink key={slug} href={`/software/${slug}`}>
                  {products[slug].name}
                </FooterLink>
              ))}
              <FooterLink href="/software/on-request">Custom software</FooterLink>
            </ul>
          </Column>

          <Column id="footer-services" title="Services">
            <ul>
              {serviceOrder.map((slug) => (
                <FooterLink key={slug} href={`/services/${slug}`}>
                  {services[slug].name}
                </FooterLink>
              ))}
            </ul>
          </Column>

          <Column id="footer-company" title="Company">
            <ul>
              <FooterLink href="/">Home</FooterLink>
              <FooterLink href="/about">About us</FooterLink>
              {showWork ? <FooterLink href="/work">Our work</FooterLink> : null}
              <FooterLink href="/pricing">Pricing</FooterLink>
              <FooterLink href="/contact">Contact</FooterLink>
            </ul>
          </Column>

          <Column id="footer-contact" title="Get in touch" as="div">
            <ul className="flex flex-col">
              {primary ? (
                <li>
                  <a href={whatsappLink()} className={linkClass}>
                    <MessageCircle
                      className="size-[18px] shrink-0 text-accent-on-dark"
                      aria-hidden="true"
                    />
                    <span>
                      {formatPhone(primary)}
                      <span className="sr-only"> on WhatsApp</span>
                    </span>
                  </a>
                </li>
              ) : null}
              {others.map((phone) => (
                <li key={phone}>
                  <a href={telLink(phone)} className={linkClass}>
                    <Phone
                      className="size-[18px] shrink-0 text-accent-on-dark"
                      aria-hidden="true"
                    />
                    {formatPhone(phone)}
                  </a>
                </li>
              ))}
              <li>
                <a href={`mailto:${site.email.address}`} className={linkClass}>
                  <Mail className="size-[18px] shrink-0 text-accent-on-dark" aria-hidden="true" />
                  {site.email.address}
                </a>
              </li>
              <li className="flex items-start gap-3 py-2.5 text-[15px] leading-relaxed text-on-dark">
                <MapPin
                  className="mt-0.5 size-[18px] shrink-0 text-accent-on-dark"
                  aria-hidden="true"
                />
                <span>
                  {site.address.street}, {site.address.city}, {site.address.country}
                </span>
              </li>
            </ul>
          </Column>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/15 pt-6 text-sm text-on-dark-muted md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {site.name}. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <nav aria-label="Legal">
              <ul className="flex flex-wrap gap-x-5">
                {[
                  ["/legal/terms", "Terms"],
                  ["/legal/privacy", "Privacy"],
                  ["/legal/license", "Software license"],
                ].map(([href, label]) => (
                  <li key={href}>
                    <Link
                      href={href ?? "/"}
                      className="inline-flex min-h-11 min-w-11 items-center hover:text-white hover:underline"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            {site.social.length > 0 ? (
              <ul className="flex gap-2" aria-label="Corex on social media">
                {site.social.map((s) => (
                  <li key={s.href}>
                    <a
                      href={s.href}
                      rel="me noopener"
                      className="inline-flex min-h-11 items-center rounded-full border border-white/40 px-4 font-semibold text-white hover:bg-white/10"
                    >
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </footer>
  );
}
