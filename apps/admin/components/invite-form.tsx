"use client";

import { Input } from "@corex/ui/components/input";
import { useState } from "react";
import type { FormState } from "@/lib/form-state";
import { ActionForm, FormField, SubmitButton } from "./action-form";
import { CopyLink } from "./copy-link";

/** Settings → Team: invite form; the set-up link appears below once created. */
export function InviteForm({
  action,
}: {
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [link, setLink] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <ActionForm
        action={action}
        aria-label="Invite an admin"
        onSuccess={(state) => setLink(state.data?.link ?? null)}
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.3fr_auto] xl:items-start">
          <FormField name="name" label="Name" id="invite-name" required>
            <Input autoComplete="off" />
          </FormField>
          <FormField
            name="username"
            label="Username"
            id="invite-username"
            required
            hint="For signing in"
          >
            <Input autoComplete="off" autoCapitalize="none" spellCheck={false} />
          </FormField>
          <FormField
            name="email"
            label="Email (optional)"
            id="invite-email"
            hint="For password reset by email"
          >
            <Input type="email" autoComplete="off" />
          </FormField>
          <SubmitButton variant="accent" pendingLabel="Inviting..." className="self-start xl:mt-7">
            Create invite
          </SubmitButton>
        </div>
      </ActionForm>
      {link ? <CopyLink link={link} label="Invite link (works once, for 72 hours)" /> : null}
    </div>
  );
}
