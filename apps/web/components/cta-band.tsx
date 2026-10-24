import { Button } from "@corex/ui/components/button";
import Link from "next/link";
import type * as React from "react";

/** Dark call-to-action band at the end of a page. */
export function CtaBand({
  title,
  lead,
  primary,
  secondary,
}: {
  title: string;
  lead?: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
}) {
  const link = (href: string, children: React.ReactNode) =>
    href.startsWith("http") ? <a href={href}>{children}</a> : <Link href={href}>{children}</Link>;
  return (
    <section className="dark-surface bg-primary-dark py-[clamp(48px,6vw,88px)] text-white">
      <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-8 px-[clamp(16px,4vw,40px)]">
        <div className="flex max-w-[620px] flex-col gap-3">
          <h2 className="text-[clamp(26px,3vw,40px)] leading-[1.15] font-bold tracking-[-0.02em] text-white">
            {title}
          </h2>
          {lead ? <p className="text-[17px] leading-relaxed text-on-dark">{lead}</p> : null}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="accent" size="lg">
            {link(primary.href, primary.label)}
          </Button>
          {secondary ? (
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-on-dark bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              {link(secondary.href, secondary.label)}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
