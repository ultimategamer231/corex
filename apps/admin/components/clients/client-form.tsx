"use client";

import { Input } from "@corex/ui/components/input";
import { Select } from "@corex/ui/components/select";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { createClient } from "@/app/(app)/clients/actions";
import { CLIENT_PLANS, CONTRACT_PRODUCTS, SCHEME_CHOICES } from "@/lib/clients";

export type ClientFormValues = {
  leadId?: string;
  name?: string;
  country?: string | null;
  city?: string | null;
  contactName?: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  product?: string;
  plan?: string;
  currency?: string;
  total?: string;
  signedOn: string;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 border-t border-border-subtle pt-5 first:border-t-0 first:pt-0">
      <legend className="mb-1 font-display text-lg font-bold text-ink">{title}</legend>
      {children}
    </fieldset>
  );
}

/** LEAD-06 and "Add client": client, first contact, contract and deployment in one go. */
export function ClientForm({ values }: { values: ClientFormValues }) {
  const router = useRouter();
  const [plan, setPlan] = useState(values.plan ?? "managed");
  const [currency, setCurrency] = useState(values.currency ?? "USD");
  return (
    <ActionForm
      action={createClient}
      resetOnSuccess={false}
      aria-label={values.leadId ? "Convert to client" : "New client"}
      onSuccess={(state) => {
        if (state.data?.clientId) router.push(`/clients/${state.data.clientId}`);
      }}
      className="gap-6"
    >
      {values.leadId ? <input type="hidden" name="leadId" value={values.leadId} /> : null}
      <Section title="Organization">
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField name="name" label="Name" required className="sm:col-span-3">
            <Input autoComplete="off" defaultValue={values.name ?? ""} />
          </FormField>
          <FormField name="city" label="City">
            <Input autoComplete="off" defaultValue={values.city ?? ""} />
          </FormField>
          <FormField name="country" label="Country">
            <Input autoComplete="off" defaultValue={values.country ?? ""} />
          </FormField>
        </div>
      </Section>

      <Section title="Primary contact">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField name="contactName" label="Name" required>
            <Input autoComplete="off" defaultValue={values.contactName ?? ""} />
          </FormField>
          <FormField name="contactTitle" label="Role">
            <Input autoComplete="off" placeholder="For example: Registrar" />
          </FormField>
          <FormField
            name="contactPhone"
            label="Phone or WhatsApp"
            hint="A phone number or an email is needed"
          >
            <Input type="tel" autoComplete="off" defaultValue={values.contactPhone ?? ""} />
          </FormField>
          <FormField name="contactEmail" label="Email">
            <Input type="email" autoComplete="off" defaultValue={values.contactEmail ?? ""} />
          </FormField>
        </div>
      </Section>

      <Section title="Contract">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField name="product" label="Product" required>
            <Select defaultValue={values.product ?? "custom"}>
              {CONTRACT_PRODUCTS.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField name="plan" label="Plan" required>
            <Select value={plan} onChange={(e) => setPlan(e.target.value)}>
              {CLIENT_PLANS.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <div className="grid grid-cols-[6.5rem_1fr] gap-3">
            <FormField name="currency" label="Currency" required>
              <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="USD">USD</option>
                <option value="LRD">LRD</option>
              </Select>
            </FormField>
            <FormField name="total" label="Contract amount" required>
              <Input inputMode="decimal" defaultValue={values.total ?? ""} placeholder="2,500.00" />
            </FormField>
          </div>
          <FormField name="signedOn" label="Signing date" required>
            <Input type="date" defaultValue={values.signedOn} />
          </FormField>
          <FormField
            name="scheme"
            label="Payment split (%)"
            required
            hint="Percentages that add up to 100, for example 50/30/20"
          >
            <Input defaultValue="50/30/20" list="scheme-choices" autoComplete="off" />
          </FormField>
          {plan === "managed" ? (
            <FormField
              name="renewal"
              label={`Yearly renewal (${currency})`}
              required
              hint="Charged each year from one year after go-live"
            >
              <Input inputMode="decimal" placeholder="600.00" />
            </FormField>
          ) : null}
        </div>
        <datalist id="scheme-choices">
          {SCHEME_CHOICES.map((choice) => (
            <option key={choice} value={choice} />
          ))}
        </datalist>
      </Section>

      <Section title="Deployment">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField name="targetGoLive" label="Target go-live">
            <Input type="date" />
          </FormField>
          <div className="grid grid-cols-[6.5rem_1fr] gap-3">
            <FormField name="hostingCurrency" label="Currency">
              <Select defaultValue="USD">
                <option value="USD">USD</option>
                <option value="LRD">LRD</option>
              </Select>
            </FormField>
            <FormField name="hostingCost" label="Hosting cost per month">
              <Input inputMode="decimal" placeholder="10.00" />
            </FormField>
          </div>
        </div>
        <p className="text-sm text-muted">
          The client starts in &quot;Setting up&quot;. Payment invoices for the milestones are
          created from the client&apos;s page once invoicing is available.
        </p>
      </Section>

      <div>
        <SubmitButton variant="accent" pendingLabel="Creating...">
          {values.leadId ? "Convert to client" : "Add client"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
