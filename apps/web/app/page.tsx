import { CorexLogo } from "@corex/ui/brand";
import { Button } from "@corex/ui/components/button";
import { SkipLink } from "@corex/ui/shell";
import { MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { site } from "@/content/site";
import { formatPhone, telLink, whatsappLink } from "@/lib/contact";

/** Placeholder home until the website is built in Phase 4. */
export default function HomePage() {
  const [primaryPhone] = site.phones;
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <header className="border-b border-border">
        <div className="mx-auto flex min-h-[76px] max-w-[1200px] items-center px-[clamp(16px,4vw,40px)]">
          <Link
            href="/"
            aria-label={`${site.name} home`}
            className="inline-flex min-h-11 items-center"
          >
            <CorexLogo />
          </Link>
        </div>
      </header>
      <main id="main" className="flex flex-1 items-center">
        <section className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-[clamp(16px,4vw,40px)] py-[clamp(40px,7vw,96px)]">
          <h1 className="max-w-[14ch] text-[clamp(38px,5.2vw,64px)] leading-[1.05] font-extrabold tracking-[-0.03em]">
            {site.tagline}
          </h1>
          <p className="max-w-[540px] text-[clamp(17px,1.5vw,19px)] leading-relaxed text-muted">
            Our new website is on the way. Message us on WhatsApp to try a live demo of our School,
            Clinic or Finance system.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="accent" size="lg">
              <a href={whatsappLink("Hello Corex, I'd like to try a demo.")}>
                <MessageCircle aria-hidden="true" />
                Talk to us on WhatsApp
              </a>
            </Button>
            {primaryPhone ? (
              <Button asChild variant="outline" size="lg">
                <a href={telLink(primaryPhone)}>
                  <Phone aria-hidden="true" />
                  Call {formatPhone(primaryPhone)}
                </a>
              </Button>
            ) : null}
          </div>
        </section>
      </main>
      <footer className="dark-surface bg-primary-darker text-on-dark-muted">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-[clamp(16px,4vw,40px)] py-8 text-sm">
          <CorexLogo tone="dark" tagline={false} />
          <p>
            © {new Date().getFullYear()} {site.name} · {site.address.street}, {site.address.city},{" "}
            {site.address.country}
          </p>
        </div>
      </footer>
    </div>
  );
}
