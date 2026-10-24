import { Input } from "@corex/ui/components/input";
import { PageHeader } from "@corex/ui/components/page-header";
import { Select } from "@corex/ui/components/select";
import { Textarea } from "@corex/ui/components/textarea";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { loadAccounts, loadCategories, loadCounterparties } from "@/lib/finance";
import { todayIso } from "@/lib/format";
import { maxReceiptBytes } from "@/lib/files";
import { getSettings } from "@/lib/org";
import { MANAGER, RECORDERS } from "@/lib/roles";
import { memberHas, requireRoles } from "@/lib/session";
import { recordEntry } from "../actions";

export const metadata: Metadata = { title: "Record an entry" };

const TITLES = {
  income: "Record income",
  expense: "Record an expense",
  transfer: "Transfer between accounts",
} as const;

type Props = { searchParams: Promise<{ type?: string }> };

export default async function NewEntryPage({ searchParams }: Props) {
  const { supabase, member } = await requireRoles(RECORDERS);
  const wanted = (await searchParams).type;
  const kind = (Object.keys(TITLES) as (keyof typeof TITLES)[]).find((t) => t === wanted);
  if (!kind || (kind === "transfer" && !memberHas(member, MANAGER))) notFound();
  const settings = await getSettings();
  const [accounts, categories, counterparties] = await Promise.all([
    loadAccounts(supabase),
    loadCategories(supabase),
    loadCounterparties(supabase),
  ]);
  const open = accounts.filter((a) => a.active);
  const foreign = open.some((a) => a.currency !== settings.baseCurrency);
  const people = counterparties.filter((c) =>
    kind === "income" ? c.type !== "vendor" : c.type !== "customer",
  );

  return (
    <>
      <PageHeader title={TITLES[kind]} />
      <ActionForm
        action={recordEntry}
        resetOnSuccess={false}
        aria-label={TITLES[kind]}
        className="max-w-2xl rounded-xl border border-border bg-background p-5"
      >
        <input type="hidden" name="id" value={crypto.randomUUID()} />
        <input type="hidden" name="type" value={kind} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField name="date" label="Date" required>
            <Input
              type="date"
              defaultValue={todayIso(settings.timezone)}
              max={todayIso(settings.timezone)}
            />
          </FormField>
          <FormField
            name="amount"
            label="Amount"
            required
            hint="In the account's currency, for example 1250.50"
          >
            <Input inputMode="decimal" autoComplete="off" />
          </FormField>
          <FormField
            name="account_id"
            label={kind === "transfer" ? "From account" : "Account"}
            required
          >
            <Select defaultValue="">
              <option value="">Choose an account</option>
              {open.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </Select>
          </FormField>
          {kind === "transfer" ? (
            <FormField
              name="to_account_id"
              label="To account"
              required
              hint="Transfers are between accounts in the same currency."
            >
              <Select defaultValue="">
                <option value="">Choose an account</option>
                {open.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currency})
                  </option>
                ))}
              </Select>
            </FormField>
          ) : (
            <>
              <FormField name="category_id" label="Category" required>
                <Select defaultValue="">
                  <option value="">Choose a category</option>
                  {categories
                    .filter((c) => c.type === kind && c.active)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </Select>
              </FormField>
              <FormField name="counterparty_id" label={kind === "income" ? "Customer" : "Vendor"}>
                <Select defaultValue="">
                  <option value="">None</option>
                  {people.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            </>
          )}
          {foreign ? (
            <FormField
              name="fx_rate"
              label={`Rate to ${settings.baseCurrency}`}
              hint={`Only for accounts not in ${settings.baseCurrency}: the ${settings.baseCurrency} value of 1 unit. Leave empty to use the latest rate in Settings.`}
            >
              <Input inputMode="decimal" autoComplete="off" />
            </FormField>
          ) : null}
        </div>
        <FormField name="memo" label="Note">
          <Textarea rows={2} />
        </FormField>
        {kind === "transfer" ? null : (
          <FormField
            name="receipt"
            label="Receipt photo"
            hint={`A photo or PDF, up to ${maxReceiptBytes() / 1_000_000} MB.`}
          >
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              capture="environment"
            />
          </FormField>
        )}
        <div>
          <SubmitButton variant="accent" pendingLabel="Saving...">
            Save
          </SubmitButton>
        </div>
      </ActionForm>
    </>
  );
}
