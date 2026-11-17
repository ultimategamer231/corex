import { Check } from "lucide-react";
import type * as React from "react";
import { CorexLogo } from "../brand";

export type DemoSignInProps = {
  /** Product name, for example "School Management". */
  product: string;
  /** Short label for this demo, for example "College demo". */
  tag: string;
  lead: string;
  /** A few things worth trying. */
  tries: string[];
  children: React.ReactNode;
};

/**
 * Sign-in page of a public demo: what the demo is on the left, the role cards and the
 * form on the right. On phones the panel becomes a short band above the form.
 */
export function DemoSignIn({ product, tag, lead, tries, children }: DemoSignInProps) {
  return (
    <div className="grid min-h-[calc(100dvh-3.5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <section
        aria-label="About this demo"
        className="dark-surface relative isolate flex flex-col gap-5 overflow-hidden bg-primary-dark px-6 py-8 text-white lg:gap-6 lg:px-14 lg:py-14"
      >
        <div
          aria-hidden="true"
          className="absolute -right-32 -bottom-40 -z-10 hidden size-[420px] rotate-[24deg] rounded-[60px] bg-white/5 lg:block"
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <CorexLogo tone="dark" />
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">
            {tag}
          </span>
        </div>
        <p className="font-display text-[clamp(28px,3.4vw,42px)] leading-[1.08] font-extrabold tracking-[-0.03em]">
          Try {product}, one role at a time.
        </p>
        <p className="max-w-[420px] leading-relaxed text-on-dark">{lead}</p>
        <ul className="hidden flex-col gap-2.5 lg:flex">
          {tries.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-on-dark">
              <Check
                className="mt-0.5 size-5 shrink-0 text-accent-on-dark"
                strokeWidth={2.6}
                aria-hidden="true"
              />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-auto hidden text-sm text-on-dark-muted lg:block">
          Developed by Corex Digital Solutions | www.corexlr.com
        </p>
      </section>
      <main
        id="main"
        tabIndex={-1}
        className="flex flex-col justify-center bg-background px-5 py-8 outline-none sm:px-8 lg:px-14 lg:py-12"
      >
        <div className="mx-auto w-full max-w-[640px]">{children}</div>
      </main>
    </div>
  );
}
