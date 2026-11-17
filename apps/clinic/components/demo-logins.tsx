"use client";

import type { DemoAccount } from "@corex/core/demo";
import { cn } from "@corex/ui/lib/utils";
import {
  CalendarCheck,
  ClipboardCheck,
  GraduationCap,
  HeartPulse,
  ShieldCheck,
  Stethoscope,
  User,
  Users,
  Wallet,
} from "lucide-react";
import type * as React from "react";

type Props = {
  accounts: DemoAccount[];
  password: string;
  /** Ids of the sign-in form's email and password inputs. */
  emailId: string;
  passwordId: string;
  selected?: string;
};

const ICONS: Record<string, React.ReactElement> = {
  admin: <ShieldCheck />,
  owner: <ShieldCheck />,
  registrar: <ClipboardCheck />,
  instructor: <GraduationCap />,
  teacher: <GraduationCap />,
  bursar: <Wallet />,
  cashier: <Wallet />,
  accountant: <Wallet />,
  student: <User />,
  staff: <User />,
  parent: <Users />,
  doctor: <Stethoscope />,
  nurse: <HeartPulse />,
  reception: <CalendarCheck />,
};

/** Demo sign-in: one card per role that fills the credentials and signs in (SPEC.md 11.2). */
export function DemoLogins({ accounts, password, emailId, passwordId, selected }: Props) {
  function logIn(account: DemoAccount) {
    const email = document.getElementById(emailId);
    const secret = document.getElementById(passwordId);
    if (!(email instanceof HTMLInputElement) || !(secret instanceof HTMLInputElement)) return;
    email.value = account.email;
    secret.value = password;
    email.form?.requestSubmit();
  }

  return (
    <section aria-labelledby="demo-logins-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1
          id="demo-logins-title"
          className="font-display text-[clamp(24px,2.6vw,30px)] font-bold tracking-[-0.02em]"
        >
          Choose who to sign in as
        </h1>
        <p className="text-[15px] text-ink-soft">
          One click, no typing. Every account uses the password{" "}
          <span className="font-semibold">{password}</span>.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {accounts.map((a) => (
          <li key={a.slug}>
            {/* The button covers the whole card; its name is just "Log in as <role>". */}
            <div
              className={cn(
                "relative flex h-full min-h-[76px] items-start gap-3 rounded-xl border-[1.5px] bg-background p-4 transition-colors focus-within:border-primary hover:border-primary hover:bg-surface",
                a.slug === selected ? "border-primary bg-surface" : "border-border",
              )}
            >
              <button
                type="button"
                onClick={() => logIn(a)}
                aria-describedby={a.summary ? `demo-role-${a.slug}` : undefined}
                className="absolute inset-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="sr-only">Log in as {a.label}</span>
              </button>
              <span
                aria-hidden="true"
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-tint text-primary [&_svg]:size-5"
              >
                {ICONS[a.slug] ?? <User />}
              </span>
              <span className="pointer-events-none flex min-w-0 flex-col gap-0.5">
                <span aria-hidden="true" className="font-bold text-ink">
                  {a.label}
                </span>
                {a.summary ? (
                  <span id={`demo-role-${a.slug}`} className="text-[13px] leading-snug text-muted">
                    {a.summary}
                  </span>
                ) : null}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
