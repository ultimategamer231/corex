import { Input } from "@corex/ui/components/input";
import { PageHeader } from "@corex/ui/components/page-header";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import type { Metadata } from "next";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { Section } from "@/components/section";
import { COUNTERPARTY_TYPES, type CounterpartyRow, loadCounterparties } from "@/lib/finance";
import { MANAGER, RECORDERS } from "@/lib/roles";
import { memberHas, requireRoles } from "@/lib/session";
import { createCounterparty, updateCounterparty } from "./actions";

export const metadata: Metadata = { title: "Customers and vendors" };

function Fields({ c }: { c?: CounterpartyRow }) {
  const id = (name: string) => (c ? `${name}-${c.id}` : name);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField name="name" label="Name" id={id("name")} required>
        <Input defaultValue={c?.name} />
      </FormField>
      <FormField name="type" label="Type" id={id("type")} required>
        <Select defaultValue={c?.type ?? ""}>
          <option value="">Choose the type</option>
          {Object.entries(COUNTERPARTY_TYPES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField name="phone" label="Phone" id={id("phone")}>
        <Input type="tel" defaultValue={c?.phone ?? ""} />
      </FormField>
      <FormField name="email" label="Email" id={id("email")}>
        <Input type="email" defaultValue={c?.email ?? ""} />
      </FormField>
    </div>
  );
}

export default async function CounterpartiesPage() {
  const { supabase, member } = await requireRoles(RECORDERS);
  const manager = memberHas(member, MANAGER);
  const list = await loadCounterparties(supabase);
  return (
    <>
      <PageHeader
        title="Customers and vendors"
        description="People and businesses you buy from or sell to."
      />
      <div className="flex flex-col gap-10">
        {list.length === 0 ? (
          <p className="text-muted">None yet. Add your first customer or vendor below.</p>
        ) : (
          <TableScroll label="Customers and vendors">
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Type</Th>
                  <Th>Contact</Th>
                  {manager ? (
                    <Th>
                      <span className="sr-only">Edit</span>
                    </Th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id}>
                    <Td className="font-semibold">{c.name}</Td>
                    <Td>{COUNTERPARTY_TYPES[c.type]}</Td>
                    <Td>{[c.phone, c.email].filter(Boolean).join(", ") || "-"}</Td>
                    {manager ? (
                      <Td>
                        <details>
                          <summary className="min-h-11 cursor-pointer content-center font-semibold text-primary">
                            Edit<span className="sr-only"> {c.name}</span>
                          </summary>
                          <ActionForm
                            action={updateCounterparty}
                            resetOnSuccess={false}
                            aria-label={`Edit ${c.name}`}
                            className="mt-2 w-[min(36rem,80vw)]"
                          >
                            <input type="hidden" name="id" value={c.id} />
                            <Fields c={c} />
                            <div>
                              <SubmitButton size="sm">Save</SubmitButton>
                            </div>
                          </ActionForm>
                        </details>
                      </Td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        )}
        <Section title="Add a customer or vendor" id="add">
          <ActionForm
            action={createCounterparty}
            aria-label="Add a customer or vendor"
            className="max-w-3xl rounded-xl border border-border bg-background p-5"
          >
            <Fields />
            <div>
              <SubmitButton>Add</SubmitButton>
            </div>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
