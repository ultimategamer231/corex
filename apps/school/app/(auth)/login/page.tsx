import { DEMO_PASSWORD } from "@corex/core/demo";
import { Input } from "@corex/ui/components/input";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { DemoLogins } from "@/components/demo-logins";
import { OrgHeading } from "@/components/org-heading";
import { demoInstance } from "@/lib/demo";
import { signIn } from "../actions";

export const metadata: Metadata = { title: "Sign in" };

const REASONS: Record<string, string> = {
  "signed-out": "Please sign in to continue. Sessions end after 8 hours.",
  "no-access": "This account does not have access to this school. Ask the school administrator.",
};

type Props = { searchParams: Promise<{ next?: string; reason?: string; role?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next, reason, role } = await searchParams;
  const notice = reason ? REASONS[reason] : undefined;
  // On a public demo the website can preselect a role with ?role=registrar.
  const demo = demoInstance();
  const preselected = demo?.accounts.find((a) => a.slug === role);
  return (
    <div className="flex flex-col gap-6">
      <OrgHeading />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Sign in</h1>
        {notice ? <p className="text-[15px] text-ink-soft">{notice}</p> : null}
      </div>
      <ActionForm action={signIn} resetOnSuccess={false} aria-label="Sign in">
        <input type="hidden" name="next" value={next ?? ""} />
        <FormField name="email" label="Email" id="email" required>
          <Input type="email" autoComplete="email" defaultValue={preselected?.email} />
        </FormField>
        <FormField name="password" label="Password" id="password" required>
          <Input
            type="password"
            autoComplete="current-password"
            defaultValue={preselected ? DEMO_PASSWORD : undefined}
          />
        </FormField>
        <SubmitButton variant="accent" size="lg" pendingLabel="Signing in...">
          Sign in
        </SubmitButton>
      </ActionForm>
      {demo ? (
        <DemoLogins
          accounts={demo.accounts}
          password={DEMO_PASSWORD}
          emailId="email"
          passwordId="password"
          selected={preselected?.slug}
        />
      ) : (
        <Link
          href="/forgot-password"
          className="inline-flex min-h-11 items-center self-start font-semibold text-primary hover:underline"
        >
          Forgot your password?
        </Link>
      )}
    </div>
  );
}
