"use client";

import type { DemoAccount } from "@corex/core/demo";
import { cn } from "@corex/ui/lib/utils";
import {
  CalendarCheck,
  ClipboardCheck,
  GraduationCap,
  HeartPulse,
  Loader2,
  ShieldCheck,
  Stethoscope,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
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
  // The role being signed in, shown on its card while the sign-in form works.
  const [busy, setBusy] = useState<string | null>(null);

  function logIn(account: DemoAccount) {
    if (busy) return;
    const email = document.getElementById(emailId);
    const secret = document.getElementById(passwordId);
    if (!(email instanceof HTMLInputElement) || !(secret instanceof HTMLInputElement)) return;
    email.value = account.email;
    secret.value = password;
    setBusy(account.slug);
    email.form?.requestSubmit();
  }

  // The card stops saying "Signing in..." when the form's button is ready again (for
  // example after a wrong password or too many tries); on success the page changes.
  useEffect(() => {
    if (!busy) return;
    const form = document.getElementById(emailId)?.closest("form");
    const submit = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!submit) return;
    let started = submit.disabled;
    const observer = new MutationObserver(() => {
      if (submit.disabled) started = true;
      else if (started) setBusy(null);
    });
    observer.observe(submit, { attributes: true, attributeFilter: ["disabled"] });
    const giveUp = window.setTimeout(() => setBusy(null), 20_000);
    return () => {
      observer.disconnect();
      window.clearTimeout(giveUp);
    };
  }, [busy, emailId]);

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
                a.slug === selected || a.slug === busy
                  ? "border-primary bg-surface"
                  : "border-border",
                busy !== null && busy !== a.slug && "opacity-60",
              )}
            >
              <button
                type="button"
                onClick={() => logIn(a)}
                disabled={busy !== null && busy !== a.slug}
                aria-busy={busy === a.slug}
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
                {busy === a.slug ? (
                  <span
                    role="status"
                    className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary"
                  >
                    <Loader2
                      aria-hidden="true"
                      className="size-4 animate-spin motion-reduce:animate-none"
                    />
                    Signing in...
                  </span>
                ) : a.summary ? (
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
