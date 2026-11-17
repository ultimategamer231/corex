import { DemoBanner, DemoSignIn } from "@corex/ui/shell";
import { connection } from "next/server";
import type * as React from "react";
import { demoInstance, quoteUrl } from "@/lib/demo";

/** Sign-in pages: a centered card, or the demo's split screen with role cards. */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // DEMO_MODE is read per request, never fixed at build time.
  await connection();
  const demo = demoInstance();
  if (demo) {
    return (
      <>
        <DemoBanner quoteUrl={quoteUrl(demo)} />
        <DemoSignIn
          product="Clinic Management"
          tag={demo.pitch.tag}
          lead={demo.pitch.lead}
          tries={demo.pitch.tries}
        >
          {children}
        </DemoSignIn>
      </>
    );
  }
  return (
    <main
      id="main"
      tabIndex={-1}
      className="flex min-h-dvh items-start justify-center bg-surface px-4 py-12 outline-none md:items-center"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-pop md:p-8">
        {children}
      </div>
    </main>
  );
}
