import { CorexLogo } from "@corex/ui/brand";
import { Lock } from "lucide-react";
import type * as React from "react";

/** Sign-in pages: brand panel and form, side by side on wide screens. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background md:flex-row">
      <aside className="relative isolate flex flex-col overflow-hidden bg-primary-dark px-5 py-5 text-white md:w-[44%] md:px-12 md:py-14 lg:px-16">
        <div className="flex items-center gap-4 md:gap-5">
          <CorexLogo tone="dark" tagline={false} className="md:hidden" />
          <CorexLogo tone="dark" className="hidden md:inline-flex" />
          <span className="h-10 w-px bg-white/30" aria-hidden="true" />
          <span className="flex flex-col leading-tight">
            <span className="font-display text-lg font-bold md:text-xl">Corex Admin</span>
            <span className="text-[11px] font-semibold tracking-[0.18em] whitespace-nowrap text-on-dark uppercase">
              Internal workspace
            </span>
          </span>
        </div>

        <div className="my-auto hidden max-w-[480px] flex-col gap-5 py-16 md:flex">
          <span className="h-1 w-11 rounded-full bg-accent" aria-hidden="true" />
          <p className="text-[13px] font-bold tracking-[0.2em] text-on-dark uppercase">
            The Corex team portal
          </p>
          <p className="font-display text-[clamp(34px,3.6vw,48px)] leading-[1.08] font-bold tracking-[-0.02em]">
            Leads, clients and billing. One workspace.
          </p>
          <p className="text-[17px] leading-relaxed text-on-dark">
            Follow every request from the website to the paid invoice, in one place.
          </p>
          <p className="mt-6 flex gap-3 border-t border-white/20 pt-6 text-[15px] text-on-dark">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            For Corex team members only. Accounts are created by an administrator.
          </p>
        </div>

        {/* Soft waves at the bottom of the panel (decorative). */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 hidden md:block"
        >
          <div className="absolute -bottom-40 -left-[10%] h-64 w-[120%] rounded-[50%] bg-white/[0.05]" />
          <div className="absolute -bottom-48 -left-[25%] h-60 w-[150%] rounded-[50%] bg-white/[0.04]" />
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <main
          id="main"
          tabIndex={-1}
          className="flex flex-1 items-start justify-center px-5 py-8 outline-none md:items-center md:px-12"
        >
          <div className="flex w-full max-w-[440px] flex-col gap-7">{children}</div>
        </main>
        <footer className="mx-5 flex flex-col items-center border-t border-border py-4 text-center text-[14px] text-muted sm:flex-row sm:justify-center md:mx-12">
          <span>
            Developed by{" "}
            <a
              href="https://corexlr.com"
              className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-2 hover:underline"
            >
              Corex Digital Solutions
            </a>
          </span>
          <span className="mx-2 hidden text-border-strong sm:inline" aria-hidden="true">
            |
          </span>
          <a
            href="https://www.corexlr.com"
            className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-2 hover:underline"
          >
            www.corexlr.com
          </a>
        </footer>
      </div>
    </div>
  );
}
