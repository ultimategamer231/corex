import { Input } from "@corex/ui/components/input";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { requestPasswordReset } from "../actions";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-[26px] font-bold">Reset your password</h1>
        <p className="text-[15px] leading-relaxed text-muted">
          Enter your email or username. If your account has an email address, we send it a link to
          choose a new password. Admins without an email address can ask another admin for a reset
          link.
        </p>
      </div>
      <ActionForm action={requestPasswordReset} aria-label="Reset password" className="gap-5">
        <FormField name="identifier" label="Email or username" id="identifier" required>
          <Input autoComplete="username" autoCapitalize="none" spellCheck={false} />
        </FormField>
        <SubmitButton variant="accent" size="lg" pendingLabel="Sending...">
          Send reset link
        </SubmitButton>
      </ActionForm>
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center self-start text-[14px] font-semibold text-primary hover:underline"
      >
        Back to sign in
      </Link>
    </>
  );
}
