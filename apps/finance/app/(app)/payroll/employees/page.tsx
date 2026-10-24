import { Badge } from "@corex/ui/components/badge";
import { PageHeader } from "@corex/ui/components/page-header";
import { Table, TableScroll, Td, Th } from "@corex/ui/components/table";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Section } from "@/components/section";
import { money } from "@/lib/format";
import { getSettings } from "@/lib/org";
import { rows } from "@/lib/queries";
import { MANAGER } from "@/lib/roles";
import { requireRoles } from "@/lib/session";
import { createEmployee } from "../actions";
import { EmployeeFields } from "../employee-fields";

export const metadata: Metadata = { title: "Employees" };

export default async function EmployeesPage() {
  const { supabase } = await requireRoles(MANAGER);
  const settings = await getSettings();
  const employees = rows(
    await supabase
      .from("employees")
      .select(
        "id, first_name, last_name, employee_number, position, base_salary_minor, currency, status",
      )
      .order("employee_number"),
  );
  return (
    <>
      <PageHeader title="Employees" />
      <div className="flex flex-col gap-10">
        {employees.length === 0 ? (
          <p className="text-muted">No employees yet.</p>
        ) : (
          <TableScroll label="Employees">
            <Table>
              <thead>
                <tr>
                  <Th>Employee</Th>
                  <Th>Position</Th>
                  <Th className="text-right">Base salary</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id}>
                    <Td>
                      <Link
                        className="inline-flex min-h-11 min-w-11 items-center font-semibold text-primary underline"
                        href={`/payroll/employees/${e.id}`}
                      >
                        {e.first_name} {e.last_name}
                      </Link>
                      <p className="text-sm text-muted">{e.employee_number}</p>
                    </Td>
                    <Td>{e.position ?? "-"}</Td>
                    <Td className="text-right whitespace-nowrap">
                      {money(e.base_salary_minor, e.currency)}
                    </Td>
                    <Td>
                      <Badge variant={e.status === "active" ? "brand" : "neutral"}>
                        {e.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        )}
        <Section title="Add an employee" id="add">
          <ActionForm
            action={createEmployee}
            resetOnSuccess={false}
            aria-label="Add an employee"
            className="max-w-3xl rounded-xl border border-border bg-background p-5"
          >
            <EmployeeFields currencies={settings.enabledCurrencies} />
            <div>
              <SubmitButton>Add employee</SubmitButton>
            </div>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
