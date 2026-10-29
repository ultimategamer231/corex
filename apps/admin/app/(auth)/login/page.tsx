import { Input } from "@corex/ui/components/input";
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
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-[26px] font-bold">Sign in</h1>
        <p className="text-[15px] text-muted">Use the email or username you were invited with.</p>
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
        <FormField name="password" label="Password" id="password" required>
          <Input type="password" autoComplete="current-password" />
        </FormField>
        <SubmitButton variant="accent" size="lg" pendingLabel="Checking...">
          Continue
        </SubmitButton>
      </ActionForm>
      <div className="flex flex-col gap-2 text-[14px] text-muted">
        <Link
          href="/forgot-password"
          className="inline-flex min-h-11 items-center self-start font-semibold text-primary hover:underline"
        >
          Forgot password?
        </Link>
        <p>After 5 failed attempts, sign-in is paused for 15 minutes.</p>
      </div>
    </>
  );
}
