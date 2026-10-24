import { Badge } from "@corex/ui/components/badge";
import { Input } from "@corex/ui/components/input";
import { PageHeader } from "@corex/ui/components/page-header";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import type { Metadata } from "next";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { Section } from "@/components/section";
import { componentValue } from "@/lib/payroll";
import { rows } from "@/lib/queries";
import { MANAGER } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import { createComponent, updateComponent } from "../actions";

export const metadata: Metadata = { title: "Pay components" };

export default async function ComponentsPage() {
  const { supabase } = await requireRoles(MANAGER);
  const components = rows(
    await supabase
      .from("pay_components")
      .select("id, name, kind, calc, default_value, active")
      .order("kind")
      .order("name"),
  );
  return (
    <>
      <PageHeader
        title="Pay components"
        description="Allowances and deductions, including any tax or social security your organization applies. None are built in."
      />
      <div className="flex flex-col gap-10">
        {components.length === 0 ? (
          <p className="text-muted">No components yet.</p>
        ) : (
          <TableScroll label="Pay components">
            <Table>
              <thead>
                <tr>
                  <Th>Component</Th>
                  <Th>Kind</Th>
                  <Th>Default</Th>
                  <Th>
                    <span className="sr-only">Edit</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {components.map((c) => (
                  <tr key={c.id}>
                    <Td className="font-semibold">
                      {c.name}
                      {c.active ? null : (
                        <Badge variant="neutral" className="ml-2">
                          Not in use
                        </Badge>
                      )}
                    </Td>
                    <Td>{c.kind === "allowance" ? "Allowance" : "Deduction"}</Td>
                    <Td className="whitespace-nowrap">
                      {componentValue(c.calc, c.default_value)}
                      {c.calc === "fixed" ? (
                        <span className="text-sm text-muted"> in the salary currency</span>
                      ) : null}
                    </Td>
                    <Td>
                      <details>
                        <summary className="min-h-11 cursor-pointer content-center font-semibold text-primary">
                          Edit<span className="sr-only"> {c.name}</span>
                        </summary>
                        <ActionForm
                          action={updateComponent}
                          resetOnSuccess={false}
                          aria-label={`Edit ${c.name}`}
                          className="mt-2 w-72"
                        >
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="calc" value={c.calc} />
                          <FormField
                            name="default_value"
                            label={c.calc === "fixed" ? "Default amount" : "Default percent"}
                            id={`value-${c.id}`}
                            required
                          >
                            <Input
                              inputMode="decimal"
                              defaultValue={
                                c.calc === "fixed"
                                  ? (Number(c.default_value) / 100).toFixed(2)
                                  : String(Number(c.default_value))
                              }
                            />
                          </FormField>
                          <FormField
                            name="active"
                            label="Use in payroll"
                            id={`active-${c.id}`}
                            required
                          >
                            <Select defaultValue={c.active ? "true" : "false"}>
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                            </Select>
                          </FormField>
                          <SubmitButton size="sm">Save</SubmitButton>
                        </ActionForm>
                      </details>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        )}
        <Section title="Add a component" id="add">
          <ActionForm
            action={createComponent}
            aria-label="Add a pay component"
            className="max-w-3xl rounded-xl border border-border bg-background p-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                name="name"
                label="Name"
                required
                hint="For example Transport allowance or Income tax"
              >
                <Input />
              </FormField>
              <FormField name="kind" label="Kind" required>
                <Select defaultValue="">
                  <option value="">Choose the kind</option>
                  <option value="allowance">Allowance (added to pay)</option>
                  <option value="deduction">Deduction (taken from pay)</option>
                </Select>
              </FormField>
              <FormField name="calc" label="Worked out as" required>
                <Select defaultValue="">
                  <option value="">Choose how</option>
                  <option value="fixed">A fixed amount</option>
                  <option value="percent_of_base">A percent of base salary</option>
                </Select>
              </FormField>
              <FormField name="default_value" label="Default amount or percent" required>
                <Input inputMode="decimal" />
              </FormField>
            </div>
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" name="assign_all" value="yes" className="size-5" />
              Add it to every active employee
            </label>
            <div>
              <SubmitButton>Add component</SubmitButton>
            </div>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
