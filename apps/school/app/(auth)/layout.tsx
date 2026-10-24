import { DemoBanner } from "@corex/ui/shell";
import type * as React from "react";
import { demoInstance, quoteUrl } from "@/lib/demo";

/** Centered card for sign-in pages. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const demo = demoInstance();
  return (
    <>
      {demo ? <DemoBanner quoteUrl={quoteUrl(demo)} /> : null}
      <main
        id="main"
        tabIndex={-1}
        className="flex min-h-dvh items-start justify-center bg-surface px-4 py-12 outline-none md:items-center"
      >
        <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-pop md:p-8">
          {children}
        </div>
      </main>
    </>
  );
}
