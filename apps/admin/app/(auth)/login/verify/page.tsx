import { Input } from "@corex/ui/components/input";
import type { Metadata } from "next";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { SignInSteps } from "@/components/sign-in-steps";
import { requestContext } from "@/lib/request-context";
import { securitySettings } from "@/lib/settings";
import { getServiceSupabase } from "@/lib/supabase";
import { cancelSignIn, verifyCode } from "../../actions";

export const metadata: Metadata = { title: "Authenticator code" };

type Props = { searchParams: Promise<{ next?: string }> };

export default async function VerifyPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const { trustedDeviceDays } = await securitySettings(getServiceSupabase(await requestContext()));
  return (
    <>
      <SignInSteps step={2} />
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-[26px] font-bold">Enter your code</h1>
        <p className="text-[15px] leading-relaxed text-muted">
          Open your authenticator app (for example Google Authenticator) and enter the 6-digit code
          shown for Corex Admin.
        </p>
      </div>
      <ActionForm
        action={verifyCode}
        resetOnSuccess={false}
        aria-label="Authenticator code"
        className="gap-5"
      >
        <input type="hidden" name="next" value={next ?? ""} />
        <FormField name="code" label="6-digit code" id="code" required>
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="[0-9]*"
            className="font-mono text-2xl tracking-[0.4em]"
          />
        </FormField>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
          <input type="checkbox" name="trust" className="size-5 accent-primary" />
          Trust this device for {trustedDeviceDays} days
        </label>
        <SubmitButton variant="accent" size="lg" pendingLabel="Checking...">
          Verify and sign in
        </SubmitButton>
      </ActionForm>
      <form action={cancelSignIn}>
        <button
          type="submit"
          className="inline-flex min-h-11 min-w-11 items-center text-[14px] font-semibold text-primary hover:underline"
        >
          Back
        </button>
      </form>
    </>
  );
}
