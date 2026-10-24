import { Input } from "@corex/ui/components/input";
import { PageHeader } from "@corex/ui/components/page-header";
import { Select } from "@corex/ui/components/select";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionForm, FormField, SubmitButton } from "@/components/action-form";
import { ConfirmAction } from "@/components/confirm-action";
import { Section } from "@/components/section";
import { isUuid } from "@/lib/ids";
import { getSettings } from "@/lib/org";
import { componentValue } from "@/lib/payroll";
import { rows } from "@/lib/queries";
import { MANAGER } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import { assignComponent, unassignComponent, updateEmployee } from "../../actions";
import { EmployeeFields } from "../../employee-fields";

export const metadata: Metadata = { title: "Employee" };

type Props = { params: Promise<{ id: string }> };

export default async function EmployeePage({ params }: Props) {
  const { supabase } = await requireRoles(MANAGER);
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const settings = await getSettings();
  const employee = await supabase
    .from("employees")
    .select("*")
    .eq("id", id)
    .maybeSingle()
    .then(rows);
  if (!employee) notFound();
  const [assigned, components] = await Promise.all([
    supabase
      .from("employee_components")
      .select("pay_component_id, value, pay_components(name, kind, calc, default_value, active)")
      .eq("employee_id", id)
      .then(rows),
    supabase.from("pay_components").select("id, name, kind, calc, active").order("name").then(rows),
  ]);
  const assignedIds = new Set(assigned.map((a) => a.pay_component_id));
  const available = components.filter((c) => c.active && !assignedIds.has(c.id));
  const salary = (Number(employee.base_salary_minor) / 100).toFixed(2);
  return (
    <>
      <PageHeader
        title={`${employee.first_name} ${employee.last_name}`}
        description={`${employee.employee_number}${employee.position ? ` · ${employee.position}` : ""}`}
      />
      <div className="flex flex-col gap-10">
        <Section title="Details" id="details">
          <ActionForm
            action={updateEmployee}
            resetOnSuccess={false}
            aria-label="Employee details"
            className="max-w-3xl rounded-xl border border-border bg-background p-5"
          >
            <input type="hidden" name="id" value={id} />
            <EmployeeFields
              e={{ ...employee, base_salary: salary }}
              currencies={settings.enabledCurrencies}
            />
            <FormField name="status" label="Status" required className="max-w-60">
              <Select defaultValue={employee.status}>
                <option value="active">Active (paid in payroll runs)</option>
                <option value="inactive">Inactive</option>
              </Select>
            </FormField>
            <div>
              <SubmitButton>Save details</SubmitButton>
            </div>
          </ActionForm>
        </Section>

        <Section
          title="Pay components"
          id="components"
          description="Allowances and deductions included in this employee's payslips."
        >
          {assigned.length === 0 ? (
            <p className="text-muted">None. The payslip is the base salary only.</p>
          ) : (
            <TableScroll label="Pay components">
              <Table>
                <thead>
                  <tr>
                    <Th>Component</Th>
                    <Th>Kind</Th>
                    <Th className="text-right">Amount</Th>
                    <Th>
                      <span className="sr-only">Remove</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {assigned.map((a) => {
                    const c = a.pay_components;
                    if (!c) return null;
                    return (
                      <tr key={a.pay_component_id}>
                        <Td className="font-semibold">
                          {c.name}
                          {c.active ? null : (
                            <span className="ml-2 text-sm text-muted">(not in use)</span>
                          )}
                        </Td>
                        <Td>{c.kind === "allowance" ? "Allowance" : "Deduction"}</Td>
                        <Td className="text-right whitespace-nowrap">
                          {componentValue(c.calc, a.value ?? c.default_value, employee.currency)}
                          {a.value === null ? (
                            <span className="text-sm text-muted"> (default)</span>
                          ) : null}
                        </Td>
                        <Td className="text-right">
                          <ConfirmAction
                            action={unassignComponent}
                            fields={{ employee_id: id, pay_component_id: a.pay_component_id }}
                            triggerLabel={`Remove ${c.name}`}
                            title={`Remove ${c.name}?`}
                            description="Future payslips leave it out. Approved payslips do not change."
                            confirmLabel="Remove"
                          />
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableScroll>
          )}
          {available.length > 0 ? (
            <ActionForm
              action={assignComponent}
              aria-label="Add a pay component"
              className="flex max-w-3xl flex-wrap items-end gap-4 rounded-xl border border-border bg-background p-5"
            >
              <input type="hidden" name="employee_id" value={id} />
              <FormField
                name="pay_component_id"
                label="Component"
                required
                className="w-64 max-w-full"
              >
                <Select defaultValue="">
                  <option value="">Choose a component</option>
                  {available.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.calc === "fixed" ? "fixed" : "% of base"})
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField
                name="value"
                label="Amount or percent"
                hint="Leave empty to use the default"
                className="w-56"
              >
                <Input inputMode="decimal" />
              </FormField>
              <SubmitButton variant="secondary">Add component</SubmitButton>
            </ActionForm>
          ) : null}
        </Section>
      </div>
    </>
  );
}
