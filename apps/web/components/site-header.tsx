"use client";

import { CorexLogo } from "@corex/ui/brand";
import { Button } from "@corex/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@corex/ui/components/dropdown-menu";
import { cn } from "@corex/ui/lib/utils";
import { ChevronDown, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { productOrder, products } from "@/content/products";
import { serviceOrder, services } from "@/content/services";
import { site } from "@/content/site";

type NavLink = { href: string; label: string; match: string };

/** Desktop nav item: the current page is marked with an orange underline. */
const navLinkClass =
  "relative inline-flex min-h-11 items-center rounded-md px-3 text-[15px] font-semibold text-ink transition-colors hover:text-primary after:absolute after:inset-x-3 after:bottom-0.5 after:h-[3px] after:rounded-full after:bg-accent after:opacity-0 after:transition-opacity aria-[current=page]:text-primary aria-[current=page]:after:opacity-100 data-[active=true]:text-primary data-[active=true]:after:opacity-100";

function NavMenu({
  label,
  active,
  items,
  footer,
}: {
  label: string;
  active: boolean;
  items: { href: string; name: string; summary: string }[];
  footer?: { href: string; label: string };
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(navLinkClass, "gap-1")} data-active={active}>
        {label}
        <ChevronDown className="size-4 text-accent-hover" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-76">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.href}
            asChild
            className="flex-col items-start justify-center gap-0.5 py-2.5"
          >
            <Link href={item.href}>
              <span className="font-semibold text-ink">{item.name}</span>
              <span className="text-[13px] leading-snug font-normal text-muted">
                {item.summary}
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
        {footer ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="font-semibold text-primary">
              <Link href={footer.href}>{footer.label}</Link>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SiteHeader({ showWork }: { showWork: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // A soft shadow once the page scrolls under the header.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links: NavLink[] = [
    ...(showWork ? [{ href: "/work", label: "Our work", match: "/work" }] : []),
    { href: "/pricing", label: "Pricing", match: "/pricing" },
    { href: "/about", label: "About", match: "/about" },
    { href: "/contact", label: "Contact", match: "/contact" },
  ];
  const isCurrent = (match: string) =>
    match === "/" ? pathname === "/" : pathname === match || pathname.startsWith(`${match}/`);

  const softwareItems = [
    ...productOrder.map((slug) => ({
      href: `/software/${slug}`,
      name: products[slug].name,
      summary: products[slug].audience,
    })),
    {
      href: "/software/on-request",
      name: "Custom software",
      summary: "Point of sale, pharmacy, church, hotel and more",
    },
  ];
  const serviceItems = serviceOrder.map((slug) => ({
    href: `/services/${slug}`,
    name: services[slug].name,
    summary: services[slug].summary,
  }));

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b bg-background/95 backdrop-blur transition-shadow duration-200 supports-[backdrop-filter]:bg-background/85",
        scrolled
          ? "border-transparent shadow-[0_8px_24px_-12px_rgb(6_70_68/0.25)]"
          : "border-border",
      )}
    >
      <div className="mx-auto flex min-h-[76px] w-full max-w-[1200px] items-center justify-between gap-5 px-[clamp(16px,4vw,40px)] lg:justify-start">
        <Link
          href="/"
          aria-label={`${site.name} home`}
          className="inline-flex min-h-11 shrink-0 items-center"
          onClick={() => setOpen(false)}
        >
          <CorexLogo />
        </Link>

        <nav
          aria-label="Main"
          className="hidden items-center gap-0.5 lg:flex lg:border-l lg:border-border lg:pl-3"
        >
          <Link
            href="/"
            className={navLinkClass}
            aria-current={isCurrent("/") ? "page" : undefined}
          >
            Home
          </Link>
          <NavMenu
            label="Software"
            active={isCurrent("/software")}
            items={softwareItems}
            footer={{ href: "/software", label: "See all software" }}
          />
          <NavMenu
            label="Services"
            active={pathname.startsWith("/services/")}
            items={serviceItems}
          />
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={navLinkClass}
              aria-current={isCurrent(link.match) ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 lg:ml-auto lg:flex">
          <Button asChild variant="accent">
            <Link href="/software">Try a live demo</Link>
          </Button>
          <Button asChild variant="outline" className="hidden xl:inline-flex">
            <Link href="/contact">Get a quote</Link>
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-lg border-[1.5px] border-border-strong bg-background px-3.5 text-[15px] font-semibold text-ink lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <X className="size-5" aria-hidden="true" />
          ) : (
            <Menu className="size-5" aria-hidden="true" />
          )}
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {open ? (
        <nav
          id="mobile-menu"
          aria-label="Main"
          className="max-h-[calc(100dvh-76px)] overflow-y-auto border-t border-border bg-background px-4 pt-2 pb-5 lg:hidden"
        >
          <ul className="flex flex-col">
            {[
              { href: "/", label: "Home" },
              { href: "/software", label: "Software" },
              ...softwareItems.map(({ href, name }) => ({ href, label: name, sub: true })),
              { href: "", label: "Services" },
              ...serviceItems.map(({ href, name }) => ({ href, label: name, sub: true })),
              ...links.map(({ href, label }) => ({ href, label })),
            ].map((link) =>
              link.href === "" ? (
                <li
                  key={link.label}
                  className="flex min-h-13 items-center border-b border-surface-muted text-[17px] font-semibold text-ink"
                >
                  {link.label}
                </li>
              ) : (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    aria-current={pathname === link.href ? "page" : undefined}
                    className={cn(
                      "flex min-h-13 items-center border-b border-surface-muted text-[17px] font-semibold text-ink aria-[current=page]:text-primary",
                      "sub" in link && link.sub && "pl-4 text-[16px] font-medium text-ink-soft",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ),
            )}
          </ul>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            <Button asChild variant="accent" size="lg">
              <Link href="/software" onClick={() => setOpen(false)}>
                Try a live demo
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/contact" onClick={() => setOpen(false)}>
                Get a quote
              </Link>
            </Button>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
