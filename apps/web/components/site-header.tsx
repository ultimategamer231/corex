"use client";

import { CorexLogo } from "@corex/ui/brand";
import { Button } from "@corex/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@corex/ui/components/dropdown-menu";
import { cn } from "@corex/ui/lib/utils";
import { ChevronDown, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { serviceOrder, services } from "@/content/services";
import { site } from "@/content/site";

type NavLink = { href: string; label: string; match: string };

const navLinkClass =
  "inline-flex min-h-11 items-center rounded-lg px-3.5 text-[15px] font-semibold text-ink hover:bg-surface-muted aria-[current=page]:bg-tint aria-[current=page]:text-primary-dark";

export function SiteHeader({ showWork }: { showWork: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const links: NavLink[] = [
    { href: "/software", label: "Software", match: "/software" },
    ...(showWork ? [{ href: "/work", label: "Our work", match: "/work" }] : []),
    { href: "/pricing", label: "Pricing", match: "/pricing" },
    { href: "/about", label: "About", match: "/about" },
  ];
  const isCurrent = (match: string) => pathname === match || pathname.startsWith(`${match}/`);
  const inServices = pathname.startsWith("/services/");

  return (
    <header className="relative z-40 border-b border-border bg-background">
      <div className="mx-auto flex min-h-[76px] w-full max-w-[1200px] items-center justify-between gap-6 px-[clamp(16px,4vw,40px)]">
        <Link
          href="/"
          aria-label={`${site.name} home`}
          className="inline-flex min-h-11 items-center"
          onClick={() => setOpen(false)}
        >
          <CorexLogo />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 nav:flex">
          <Link
            href={links[0]?.href ?? "/software"}
            className={navLinkClass}
            aria-current={isCurrent("/software") ? "page" : undefined}
          >
            Software
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(navLinkClass, "gap-1", inServices && "bg-tint text-primary-dark")}
            >
              Services
              <ChevronDown className="size-4" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              {serviceOrder.map((slug) => (
                <DropdownMenuItem key={slug} asChild>
                  <Link
                    href={`/services/${slug}`}
                    className="flex min-h-14 flex-col items-start justify-center gap-0.5"
                  >
                    <span className="font-semibold text-ink">{services[slug].name}</span>
                    <span className="text-[13px] font-normal text-muted">
                      {services[slug].summary}
                    </span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {links.slice(1).map((link) => (
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

        <div className="hidden items-center gap-2 nav:flex">
          <Link
            href="/contact"
            className="inline-flex min-h-11 items-center px-3.5 text-[15px] font-semibold text-primary hover:underline"
          >
            Contact
          </Link>
          <Button asChild variant="accent">
            <Link href="/software">Try a live demo</Link>
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-lg border-[1.5px] border-border-strong bg-background px-3.5 text-[15px] font-semibold text-ink nav:hidden"
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
          className="border-t border-border bg-background px-4 pt-2 pb-5 nav:hidden"
        >
          <ul className="flex flex-col">
            {[
              { href: "/software", label: "Software" },
              ...serviceOrder.map((slug) => ({
                href: `/services/${slug}`,
                label: services[slug].name,
              })),
              ...links.slice(1).map(({ href, label }) => ({ href, label })),
              { href: "/contact", label: "Contact" },
            ].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={pathname === link.href ? "page" : undefined}
                  className="flex min-h-13 items-center border-b border-surface-muted text-[17px] font-semibold text-ink aria-[current=page]:text-primary"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <Button asChild variant="accent" size="lg" className="mt-3 w-full">
            <Link href="/software" onClick={() => setOpen(false)}>
              Try a live demo
            </Link>
          </Button>
        </nav>
      ) : null}
    </header>
  );
}
