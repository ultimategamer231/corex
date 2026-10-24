import { Input } from "@corex/ui/components/input";
import { PageHeader } from "@corex/ui/components/page-header";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import type { Metadata } from "next";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { ConfirmAction } from "@/components/confirm-action";
import { Section } from "@/components/section";
import { money } from "@/lib/format";
import { getSettings } from "@/lib/org";
import { listTerms, rows, termLabel } from "@/lib/queries";
import { BURSAR } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import { addFeeStructure, removeFeeStructure } from "../actions";

export const metadata: Metadata = { title: "Fee structures" };

export default async function FeeStructuresPage() {
  const { supabase } = await requireRoles(BURSAR);
  const settings = await getSettings();
  const [structures, years, terms, programs] = await Promise.all([
    supabase
      .from("fee_structures")
      .select("id, applies_to, item, amount_minor, currency, academic_years(name), terms(name)")
      .order("created_at", { ascending: false })
      .then(rows),
    supabase
      .from("academic_years")
      .select("id, name, is_current")
      .order("starts_on", { ascending: false })
      .then(rows),
    listTerms(supabase),
    supabase.from("programs").select("code, name").order("code").then(rows),
  ]);
  return (
    <>
      <PageHeader
        title="Fee structures"
        description="Items charged per term, for all students or one program."
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <Section title="Fee items" id="list">
          {structures.length === 0 ? (
            <p className="text-muted">No fee items yet.</p>
          ) : (
            <TableScroll label="Fee items">
              <Table>
                <thead>
                  <tr>
                    <Th>Item</Th>
                    <Th>Year and term</Th>
                    <Th>Applies to</Th>
                    <Th className="text-right">Amount</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {structures.map((f) => (
                    <tr key={f.id}>
                      <Td className="font-semibold">{f.item}</Td>
                      <Td>
                        {f.academic_years?.name} · {f.terms?.name ?? "Every term"}
                      </Td>
                      <Td>{f.applies_to === "all" ? "All students" : f.applies_to}</Td>
                      <Td className="text-right whitespace-nowrap">
                        {money(f.amount_minor, f.currency)}
                      </Td>
                      <Td className="text-right">
                        <ConfirmAction
                          action={removeFeeStructure}
                          fields={{ id: f.id }}
                          triggerLabel={`Remove ${f.item}`}
                          title={`Remove ${f.item}?`}
                          description="Invoices already issued keep their lines."
                          confirmLabel="Remove"
                        />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
          )}
        </Section>
        <Section title="Add a fee item" id="add">
          <ActionForm
            action={addFeeStructure}
            aria-label="Add a fee item"
            className="rounded-xl border border-border bg-background p-5"
          >
            <FormField name="item" label="Item" hint="For example Tuition or Lab fee." required>
              <Input />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
              <FormField name="amount" label="Amount" required>
                <Input inputMode="decimal" placeholder="1,500.00" />
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
            </div>
            <FormField name="academic_year_id" label="Academic year" required>
              <Select defaultValue={years.find((y) => y.is_current)?.id ?? ""}>
                <option value="">Choose a year</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              name="term_id"
              label="Term"
              hint="Leave as every term to charge it each term of the year."
            >
              <Select defaultValue="">
                <option value="">Every term</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {termLabel(t)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField name="applies_to" label="Applies to">
              <Select defaultValue="all">
                <option value="all">All students</option>
                {programs.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.code} {p.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <div>
              <SubmitButton>Add fee item</SubmitButton>
            </div>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
