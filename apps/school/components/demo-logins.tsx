"use client";

import type { DemoAccount } from "@corex/core/demo";
import { Button } from "@corex/ui/components/button";

type Props = {
  accounts: DemoAccount[];
  password: string;
  /** Ids of the sign-in form's email and password inputs. */
  emailId: string;
  passwordId: string;
  selected?: string;
};

/** Demo login page: one button per role that fills the credentials and signs in (SPEC.md 11.2). */
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
    <section aria-labelledby="demo-logins-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="demo-logins-title" className="text-lg font-bold">
          Try the demo as
        </h2>
        <p className="text-[15px] text-ink-soft">
          Every account uses the password <span className="font-semibold">{password}</span>.
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {accounts.map((a) => (
          <li key={a.slug}>
            <Button
              type="button"
              variant={a.slug === selected ? "primary" : "secondary"}
              className="w-full"
              onClick={() => logIn(a)}
            >
              Log in as {a.label}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
