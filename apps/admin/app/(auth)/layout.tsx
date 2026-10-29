import { CorexMark } from "@corex/ui/brand";
import type * as React from "react";

/** Sign-in pages: brand panel and form, side by side on wide screens (Login.dc.html). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background md:flex-row">
      <aside className="flex flex-col justify-between gap-10 bg-primary-dark px-6 py-8 text-white md:w-[44%] md:px-12 md:py-14 lg:px-16">
        <p className="flex items-center gap-3">
          <CorexMark className="size-10" />
          <span className="font-display text-2xl font-extrabold">
            Core<span className="text-accent-on-dark">X</span>{" "}
            <span className="font-semibold text-on-dark-muted">Admin</span>
          </span>
        </p>
        <div className="flex max-w-md flex-col gap-4">
          <p className="font-display text-[28px] leading-tight font-bold tracking-tight md:text-[36px]">
            Leads, clients and billing in one place
          </p>
          <p className="text-base leading-relaxed text-on-dark">
            For the Corex team only. Accounts are created by an admin, and every sign-in needs a
            code from your authenticator app.
          </p>
        </div>
        <p className="hidden text-[13px] text-on-dark-muted md:block">
          © {new Date().getFullYear()} Corex Digital Solutions
        </p>
      </aside>
      <main
        id="main"
        tabIndex={-1}
        className="flex flex-1 items-start justify-center px-4 py-10 outline-none md:items-center md:px-12"
      >
        <div className="flex w-full max-w-[400px] flex-col gap-7">{children}</div>
      </main>
    </div>
  );
}
