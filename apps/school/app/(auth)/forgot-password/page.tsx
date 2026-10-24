import { Input } from "@corex/ui/components/input";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { requestPasswordReset } from "../actions";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Reset your password</h1>
        <p className="text-[15px] text-ink-soft">
          We will email you a link to choose a new password.
        </p>
      </div>
      <ActionForm action={requestPasswordReset} aria-label="Reset password">
        <FormField name="email" label="Email" required>
          <Input type="email" autoComplete="email" />
        </FormField>
        <SubmitButton pendingLabel="Sending...">Send reset link</SubmitButton>
      </ActionForm>
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center self-start font-semibold text-primary hover:underline"
      >
        Back to sign in
      </Link>
    </div>
  );
}
