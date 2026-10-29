"use client";

import { Input } from "@corex/ui/components/input";
import { useState } from "react";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import type { FormState } from "@/lib/form-state";
import { finishSetup, startSetup } from "../../actions";

type Props = {
  token: string;
  kind: "invite" | "authenticator_setup";
  name: string;
  username: string;
  email: string | null;
};

type Enrolment = { factorId: string; qr: string; secret: string };

/**
 * Invite: choose a password, then add Corex Admin to an authenticator app.
 * Authenticator reset: confirm the password, then add the new authenticator.
 */
export function SetupFlow({ token, kind, name, username, email }: Props) {
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const invite = kind === "invite";

  if (!enrolment) {
    return (
      <>
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[26px] font-bold">
            {invite ? `Welcome, ${name}` : "Set up a new authenticator"}
          </h1>
          <p className="text-[15px] leading-relaxed text-muted">
            {invite
              ? "Choose a password, then add Corex Admin to an authenticator app on your phone."
              : "Confirm your password, then add Corex Admin to your authenticator app again."}
          </p>
          <p className="text-[15px] text-ink-soft">
            You sign in with <span className="font-semibold">{email ?? username}</span>
            {email ? (
              <>
                {" "}
                or the username <span className="font-semibold">{username}</span>
              </>
            ) : null}
            .
          </p>
        </div>
        <ActionForm
          action={startSetup}
          resetOnSuccess={false}
          aria-label={invite ? "Choose a password" : "Confirm your password"}
          className="gap-5"
          onSuccess={(state: FormState) => {
            const d = state.data;
            if (d?.factorId && d.qr && d.secret) {
              setEnrolment({ factorId: d.factorId, qr: d.qr, secret: d.secret });
            }
          }}
        >
          <input type="hidden" name="token" value={token} />
          <FormField
            name="password"
            label={invite ? "Password" : "Your password"}
            id="password"
            required
            hint={invite ? "At least 12 characters." : undefined}
          >
            <Input type="password" autoComplete={invite ? "new-password" : "current-password"} />
          </FormField>
          {invite ? (
            <FormField name="confirm" label="Repeat the password" id="confirm" required>
              <Input type="password" autoComplete="new-password" />
            </FormField>
          ) : null}
          <SubmitButton variant="accent" size="lg" pendingLabel="Saving...">
            Continue
          </SubmitButton>
        </ActionForm>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-[26px] font-bold">Add Corex Admin to your app</h1>
        <ol className="list-decimal space-y-1 pl-5 text-[15px] leading-relaxed text-ink-soft">
          <li>Install Google Authenticator or Microsoft Authenticator on your phone.</li>
          <li>In the app, add an account and scan this QR code.</li>
          <li>Enter the 6-digit code the app shows.</li>
        </ol>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- a data: URI from Supabase */}
      <img
        src={enrolment.qr}
        alt="QR code to add Corex Admin to an authenticator app"
        width={200}
        height={200}
        className="size-[200px] self-center rounded-lg border border-border bg-white p-2"
      />
      <div className="flex flex-col gap-1 text-[14px] text-muted">
        <p>Cannot scan? Enter this key in the app instead:</p>
        <p
          data-testid="totp-secret"
          className="rounded-md bg-surface-muted px-3 py-2 font-mono text-[15px] break-all text-ink"
        >
          {enrolment.secret}
        </p>
      </div>
      <ActionForm
        action={finishSetup}
        resetOnSuccess={false}
        aria-label="Authenticator code"
        className="gap-5"
      >
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="factorId" value={enrolment.factorId} />
        <FormField name="code" label="6-digit code" id="code" required>
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="[0-9]*"
            className="font-mono text-2xl tracking-[0.4em]"
          />
        </FormField>
        <SubmitButton variant="accent" size="lg" pendingLabel="Checking...">
          Finish set-up
        </SubmitButton>
      </ActionForm>
    </>
  );
}
