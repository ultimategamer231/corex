import { Input } from "@corex/ui/components/input";
import { PageHeader } from "@corex/ui/components/page-header";
import { Select } from "@corex/ui/components/select";
import { Textarea } from "@corex/ui/components/textarea";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { loadCounterparties } from "@/lib/finance";
import { todayIso } from "@/lib/format";
import { getSettings } from "@/lib/org";
import { MANAGER } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import { createInvoice } from "../actions";

export const metadata: Metadata = { title: "New invoice" };

export default async function NewInvoicePage() {
  const { supabase } = await requireRoles(MANAGER);
  const settings = await getSettings();
  const customers = (await loadCounterparties(supabase)).filter((c) => c.type !== "vendor");
  const due = new Date(Date.parse(`${todayIso(settings.timezone)}T00:00:00Z`) + 30 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return (
    <>
      <PageHeader title="New invoice" description="Start a draft, add its lines, then issue it." />
      {customers.length === 0 ? (
        <p className="text-muted">
          Add a customer first on{" "}
          <Link className="font-semibold text-primary underline" href="/counterparties">
            Customers and vendors
          </Link>
          .
        </p>
      ) : (
        <ActionForm
          action={createInvoice}
          resetOnSuccess={false}
          aria-label="New invoice"
          className="max-w-2xl rounded-xl border border-border bg-background p-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField name="party_id" label="Customer" required>
              <Select defaultValue="">
                <option value="">Choose a customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField name="currency" label="Currency" required>
              <Select defaultValue={settings.baseCurrency}>
                {settings.enabledCurrencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField name="due_date" label="Due date" required>
              <Input type="date" defaultValue={due} />
            </FormField>
          </div>
          <FormField
            name="notes"
            label="Notes"
            hint="Printed on the invoice, for example payment instructions"
          >
            <Textarea rows={2} />
          </FormField>
          <div>
            <SubmitButton variant="accent">Create draft</SubmitButton>
          </div>
        </ActionForm>
      )}
    </>
  );
}
