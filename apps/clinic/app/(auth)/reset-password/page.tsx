import { Input } from "@corex/ui/components/input";
import type { Metadata } from "next";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { updatePassword } from "../actions";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      <ActionForm action={updatePassword} resetOnSuccess={false} aria-label="New password">
        <FormField
          name="password"
          label="New password"
          hint="At least 8 characters with upper and lower case letters and a number."
          required
        >
          <Input type="password" autoComplete="new-password" />
        </FormField>
        <FormField name="confirm" label="Repeat the new password" required>
          <Input type="password" autoComplete="new-password" />
        </FormField>
        <SubmitButton>Save password</SubmitButton>
      </ActionForm>
    </div>
  );
}
