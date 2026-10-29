"use client";

import { Input } from "@corex/ui/components/input";
import { Select } from "@corex/ui/components/select";
import { Textarea } from "@corex/ui/components/textarea";
import { useRouter } from "next/navigation";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import type { FormState } from "@/lib/form-state";
import { PLANS, PRODUCTS } from "@/lib/leads";

export type LeadFormValues = {
  leadId?: string;
  name?: string;
  organization?: string;
  phone?: string | null;
  email?: string | null;
  country?: string | null;
  product?: string | null;
  plan?: string;
  message?: string | null;
};

/** Add or correct a lead entered by hand (LEAD-02). */
export function LeadForm({
  action,
  values = {},
  submitLabel,
  onSaved,
}: {
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  values?: LeadFormValues;
  submitLabel: string;
  onSaved?: () => void;
}) {
  const router = useRouter();
  return (
    <ActionForm
      action={action}
      resetOnSuccess={false}
      aria-label={values.leadId ? "Lead details" : "New lead"}
      onSuccess={(state) => {
        if (state.data?.leadId) router.push(`/leads/${state.data.leadId}`);
        onSaved?.();
      }}
    >
      {values.leadId ? <input type="hidden" name="leadId" value={values.leadId} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="name" label="Contact name" required>
          <Input autoComplete="off" defaultValue={values.name ?? ""} />
        </FormField>
        <FormField name="organization" label="Organization" required>
          <Input autoComplete="off" defaultValue={values.organization ?? ""} />
        </FormField>
        <FormField
          name="phone"
          label="Phone or WhatsApp"
          hint="A phone number or an email is needed"
        >
          <Input type="tel" autoComplete="off" defaultValue={values.phone ?? ""} />
        </FormField>
        <FormField name="email" label="Email">
          <Input type="email" autoComplete="off" defaultValue={values.email ?? ""} />
        </FormField>
        <FormField name="country" label="Country">
          <Input autoComplete="off" defaultValue={values.country ?? ""} />
        </FormField>
        <FormField name="product" label="Interested in">
          <Select defaultValue={values.product ?? ""}>
            <option value="">Not known yet</option>
            {PRODUCTS.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField name="plan" label="Plan">
          <Select defaultValue={values.plan ?? "unsure"}>
            {PLANS.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <FormField
        name="message"
        label="What they need"
        hint="How you met them and what they asked for"
      >
        <Textarea rows={4} defaultValue={values.message ?? ""} />
      </FormField>
      <div>
        <SubmitButton variant="primary">{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
