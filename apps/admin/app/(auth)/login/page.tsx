import { Input } from "@corex/ui/components/input";
import { Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { SignInSteps } from "@/components/sign-in-steps";
import { signIn } from "../actions";

export const metadata: Metadata = { title: "Sign in" };

const NOTICES: Record<string, string> = {
  "signed-out": "Please sign in to continue.",
  "signed-out-now": "You are signed out.",
  timeout: "You were signed out after a period without activity. Sign in again.",
  "no-access": "This account does not have access to the admin.",
  "password-changed": "Your password was changed. Sign in with the new one.",
};

type Props = { searchParams: Promise<{ next?: string; reason?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next, reason } = await searchParams;
  const notice = reason ? NOTICES[reason] : undefined;
  return (
    <>
      <SignInSteps step={1} />
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[clamp(30px,3vw,38px)] leading-tight font-extrabold tracking-[-0.02em]">
          Welcome back.
        </h1>
        <p className="text-[16px] leading-relaxed text-ink-soft">
          Sign in with the email or username your administrator gave you.
        </p>
        {notice ? (
          <p
            role="status"
            className="mt-2 rounded-lg bg-tint px-3 py-2 text-[15px] text-primary-dark"
          >
            {notice}
          </p>
        ) : null}
      </div>
      <ActionForm action={signIn} resetOnSuccess={false} aria-label="Sign in" className="gap-5">
        <input type="hidden" name="next" value={next ?? ""} />
        <FormField name="identifier" label="Email or username" id="identifier" required>
          <Input autoComplete="username" autoCapitalize="none" spellCheck={false} />
        </FormField>
        <div className="relative">
          <FormField name="password" label="Password" id="password" required>
            <Input type="password" autoComplete="current-password" />
          </FormField>
          <Link
            href="/forgot-password"
            className="absolute -top-3 right-0 inline-flex min-h-11 items-center text-[14px] font-bold text-primary underline-offset-2 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <SubmitButton size="lg" pendingLabel="Checking...">
          Continue
        </SubmitButton>
      </ActionForm>
      <p className="flex gap-2.5 text-[14px] leading-relaxed text-muted">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Every sign-in also needs a code from your authenticator app. After 5 wrong passwords,
        sign-in pauses for 15 minutes.
      </p>
    </>
  );
}
