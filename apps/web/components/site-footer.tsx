import { CorexLogo } from "@corex/ui/brand";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { productOrder, products } from "@/content/products";
import { serviceOrder, services } from "@/content/services";
import { site } from "@/content/site";
import { formatPhone, telLink, whatsappLink } from "@/lib/contact";

const linkClass =
  "min-w-11 inline-flex min-h-11 items-center text-[15px] text-white hover:underline";
const headingClass = "mb-2 text-[13px] font-bold tracking-[0.08em] text-on-dark-muted uppercase";

export function SiteFooter({ showWork }: { showWork: boolean }) {
  const [primary, ...others] = site.phones;
  return (
    <footer className="dark-surface bg-primary-darker pt-[clamp(48px,6vw,72px)] pb-8 text-white">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-12 px-[clamp(16px,4vw,40px)]">
        <div className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-4">
            <Link
              href="/"
              aria-label={`${site.name} home`}
              className="inline-flex min-h-11 items-center self-start"
            >
              <CorexLogo tone="dark" tagline={false} />
            </Link>
            <p className="max-w-[280px] text-[15px] leading-relaxed text-on-dark-muted">
              Business software for schools, clinics, businesses and NGOs. Tested before you pay.
            </p>
            <ul className="flex flex-col text-[15px] font-semibold">
              {primary ? (
                <li>
                  <a href={whatsappLink()} className={linkClass}>
                    <MessageCircle className="mr-2 size-[18px]" aria-hidden="true" />
                    WhatsApp {formatPhone(primary)}
                  </a>
                </li>
              ) : null}
              {others.map((phone) => (
                <li key={phone}>
                  <a href={telLink(phone)} className={linkClass}>
                    <Phone className="mr-2 size-[18px]" aria-hidden="true" />
                    {formatPhone(phone)}
                  </a>
                </li>
              ))}
              <li>
                <a href={`mailto:${site.email.address}`} className={linkClass}>
                  <Mail className="mr-2 size-[18px]" aria-hidden="true" />
                  {site.email.address}
                </a>
              </li>
              <li className="inline-flex min-h-11 items-center font-normal text-on-dark-muted">
                <MapPin className="mr-2 size-[18px] text-white" aria-hidden="true" />
                {site.address.street}, {site.address.city}
              </li>
            </ul>
          </div>

          <nav aria-labelledby="footer-software">
            <h2 id="footer-software" className={headingClass}>
              Software
            </h2>
            <ul>
              {productOrder.map((slug) => (
                <li key={slug}>
                  <Link href={`/software/${slug}`} className={linkClass}>
                    {products[slug].name}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/software/on-request" className={linkClass}>
                  Built on request
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-labelledby="footer-services">
            <h2 id="footer-services" className={headingClass}>
              Services
            </h2>
            <ul>
              {serviceOrder.map((slug) => (
                <li key={slug}>
                  <Link href={`/services/${slug}`} className={linkClass}>
                    {services[slug].name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-company">
            <h2 id="footer-company" className={headingClass}>
              Company
            </h2>
            <ul>
              {showWork ? (
                <li>
                  <Link href="/work" className={linkClass}>
                    Our work
                  </Link>
                </li>
              ) : null}
              <li>
                <Link href="/pricing" className={linkClass}>
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/about" className={linkClass}>
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className={linkClass}>
                  Contact
                </Link>
              </li>
              {site.social.map((s) => (
                <li key={s.href}>
                  <a href={s.href} className={linkClass} rel="me noopener">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-white/15 pt-6 text-sm text-on-dark-muted">
          <p>
            © {new Date().getFullYear()} {site.name} · {site.address.city}, {site.address.country}
          </p>
          <nav aria-label="Legal">
            <ul className="flex flex-wrap gap-x-5">
              <li>
                <Link
                  href="/legal/terms"
                  className="inline-flex min-h-11 min-w-11 items-center hover:underline"
                >
                  Terms
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/privacy"
                  className="inline-flex min-h-11 min-w-11 items-center hover:underline"
                >
                  Privacy
                </Link>
              </li>
              <li>
                <Link
                  href="/legal/license"
                  className="inline-flex min-h-11 min-w-11 items-center hover:underline"
                >
                  Software license
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
