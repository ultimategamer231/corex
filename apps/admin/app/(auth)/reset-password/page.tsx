import { Input } from "@corex/ui/components/input";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { requestContext } from "@/lib/request-context";
import { getServiceSupabase } from "@/lib/supabase";
import { findLink } from "@/lib/auth/links";
import { resetPassword } from "../actions";

export const metadata: Metadata = { title: "Choose a new password" };

type Props = { searchParams: Promise<{ token?: string }> };

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token = "" } = await searchParams;
  const link = await findLink(getServiceSupabase(await requestContext()), token, [
    "password_reset",
  ]);
  if (!link) {
    return (
      <>
        <h1 className="font-display text-[26px] font-bold">This link is no longer valid</h1>
        <p className="text-[15px] text-muted">
          Reset links work once and expire. Ask for a new one from the sign-in page or from another
          admin.
        </p>
        <Link
          href="/forgot-password"
          className="inline-flex min-h-11 items-center self-start text-[14px] font-semibold text-primary hover:underline"
        >
          Ask for a new link
        </Link>
      </>
    );
  }
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-[26px] font-bold">Choose a new password</h1>
        <p className="text-[15px] text-muted">
          For {link.admin.name}. Use at least 12 characters. You will be signed out on every device.
        </p>
      </div>
      <ActionForm
        action={resetPassword}
        resetOnSuccess={false}
        aria-label="Choose a new password"
        className="gap-5"
      >
        <input type="hidden" name="token" value={token} />
        <FormField name="password" label="New password" id="password" required>
          <Input type="password" autoComplete="new-password" />
        </FormField>
        <FormField name="confirm" label="Repeat the new password" id="confirm" required>
          <Input type="password" autoComplete="new-password" />
        </FormField>
        <SubmitButton variant="accent" size="lg" pendingLabel="Saving...">
          Save new password
        </SubmitButton>
      </ActionForm>
    </>
  );
}
