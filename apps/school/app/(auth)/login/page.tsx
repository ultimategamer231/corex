import { Input } from "@corex/ui/components/input";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { OrgHeading } from "@/components/org-heading";
import { signIn } from "../actions";

export const metadata: Metadata = { title: "Sign in" };

const REASONS: Record<string, string> = {
  "signed-out": "Please sign in to continue. Sessions end after 8 hours.",
  "no-access": "This account does not have access to this school. Ask the school administrator.",
};

type Props = { searchParams: Promise<{ next?: string; reason?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next, reason } = await searchParams;
  const notice = reason ? REASONS[reason] : undefined;
  return (
    <div className="flex flex-col gap-6">
      <OrgHeading />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Sign in</h1>
        {notice ? <p className="text-[15px] text-ink-soft">{notice}</p> : null}
      </div>
      <ActionForm action={signIn} resetOnSuccess={false} aria-label="Sign in">
        <input type="hidden" name="next" value={next ?? ""} />
        <FormField name="email" label="Email" required>
          <Input type="email" autoComplete="email" />
        </FormField>
        <FormField name="password" label="Password" required>
          <Input type="password" autoComplete="current-password" />
        </FormField>
        <SubmitButton variant="accent" size="lg" pendingLabel="Signing in...">
          Sign in
        </SubmitButton>
      </ActionForm>
      <Link
        href="/forgot-password"
        className="inline-flex min-h-11 items-center self-start font-semibold text-primary hover:underline"
      >
        Forgot your password?
      </Link>
    </div>
  );
}
