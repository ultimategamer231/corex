"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isoDate, must, optionalText, requiredText, runAction, uuid } from "@/lib/action";
import { amountText, rateText, toMinor } from "@/lib/finance";
import type { FormState } from "@/lib/form-state";
import { MANAGER, OWNER } from "@/lib/roles";

const manage = <T>(schema: z.ZodType<T>) => ({ roles: MANAGER, schema, revalidate: ["/payroll"] });

const employeeSchema = z.object({
  first_name: requiredText("the first name", 80),
  last_name: requiredText("the last name", 80),
  employee_number: requiredText("the employee number", 30),
  position: optionalText,
  department: optionalText,
  start_date: isoDate("the start date"),
  currency: z.enum(["USD", "LRD"], { error: "Choose the currency" }),
  base_salary: amountText,
  payment_method: z.enum(["cash", "bank", "mobile_money"], { error: "Choose how they are paid" }),
  bank_or_wallet_ref: optionalText,
});

function employeeRow(d: z.infer<typeof employeeSchema>) {
  const { base_salary, ...rest } = d;
  return { ...rest, base_salary_minor: toMinor(base_salary, d.currency) };
}

export async function createEmployee(_p: FormState, formData: FormData): Promise<FormState> {
  let id: string | null = null;
  const result = await runAction(formData, manage(employeeSchema), async (d, { supabase }) => {
    id = must(await supabase.from("employees").insert(employeeRow(d)).select("id").single()).id;
  });
  if (id && result.status === "success") redirect(`/payroll/employees/${id}`);
  return result;
}

export async function updateEmployee(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    manage(employeeSchema.extend({ id: uuid(), status: z.enum(["active", "inactive"]) })),
    async ({ id, status, ...d }, { supabase }) => {
      must(
        await supabase
          .from("employees")
          .update({ ...employeeRow(d), status })
          .eq("id", id),
      );
      return "Employee saved. Approved payslips keep the amounts they were approved with.";
    },
  );
}

/** A component value as stored: minor units for fixed amounts, a percentage otherwise. */
const valueText = z
  .string()
  .trim()
  .regex(/^\d{1,9}(\.\d{1,2})?$/, "Enter a number like 25 or 12.50");

const componentSchema = z
  .object({
    name: requiredText("the name", 80),
    kind: z.enum(["allowance", "deduction"], { error: "Choose allowance or deduction" }),
    calc: z.enum(["fixed", "percent_of_base"], { error: "Choose how it is worked out" }),
    default_value: valueText,
  })
  .refine((v) => v.calc !== "percent_of_base" || Number(v.default_value) <= 100, {
    path: ["default_value"],
    message: "A percentage is at most 100",
  });

const stored = (calc: string, value: string) =>
  calc === "fixed" ? Math.round(Number(value) * 100) : Number(value);

/**
 * Adds a pay component (FIN-06: none are built in; each organization sets its own,
 * including any tax or social security). Optionally assigns it to everyone.
 */
export async function createComponent(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    manage(componentSchema.and(z.object({ assign_all: z.string().optional() }))),
    async (d, { supabase }) => {
      const row = must(
        await supabase
          .from("pay_components")
          .insert({
            name: d.name,
            kind: d.kind,
            calc: d.calc,
            default_value: stored(d.calc, d.default_value),
          })
          .select("id")
          .single(),
      );
      if (d.assign_all) {
        const employees = must(
          await supabase.from("employees").select("id").eq("status", "active"),
        );
        if (employees.length > 0) {
          must(
            await supabase
              .from("employee_components")
              .insert(employees.map((e) => ({ employee_id: e.id, pay_component_id: row.id }))),
          );
        }
      }
      return `${d.name} added.`;
    },
  );
}

export async function updateComponent(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    manage(
      z.object({
        id: uuid(),
        calc: z.enum(["fixed", "percent_of_base"]),
        default_value: valueText,
        active: z.enum(["true", "false"]),
      }),
    ),
    async (d, { supabase }) => {
      must(
        await supabase
          .from("pay_components")
          .update({ default_value: stored(d.calc, d.default_value), active: d.active === "true" })
          .eq("id", d.id),
      );
      return "Saved. Approved payslips keep the amounts they were approved with.";
    },
  );
}

const assignSchema = z.object({
  employee_id: uuid(),
  pay_component_id: uuid("a component"),
  calc: z.enum(["fixed", "percent_of_base"]).optional(),
  value: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null)
    .refine(
      (v) => v === null || /^\d{1,9}(\.\d{1,2})?$/.test(v),
      "Enter a number like 25 or 12.50",
    ),
});

export async function assignComponent(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, manage(assignSchema), async (d, { supabase }) => {
    const component = must(
      await supabase.from("pay_components").select("calc").eq("id", d.pay_component_id).single(),
    );
    must(
      await supabase.from("employee_components").upsert({
        employee_id: d.employee_id,
        pay_component_id: d.pay_component_id,
        value: d.value === null ? null : stored(component.calc, d.value),
      }),
    );
    return "Component saved for this employee.";
  });
}

export async function unassignComponent(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    manage(z.object({ employee_id: uuid(), pay_component_id: uuid() })),
    async (d, { supabase }) => {
      must(
        await supabase
          .from("employee_components")
          .delete()
          .eq("employee_id", d.employee_id)
          .eq("pay_component_id", d.pay_component_id),
      );
      return "Component removed from this employee.";
    },
  );
}

/** Creates or recalculates the draft run for a month. */
export async function prepareRun(_p: FormState, formData: FormData): Promise<FormState> {
  let id: string | null = null;
  const result = await runAction(
    formData,
    manage(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/, "Choose the month") })),
    async (d, { supabase }) => {
      id = must(await supabase.rpc("prepare_payroll_run", { p_month: `${d.month}-01` }));
    },
  );
  if (id && result.status === "success") redirect(`/payroll/runs/${id}`);
  return result;
}

const runSchema = z.object({ id: uuid(), month: z.string() });

export async function recalculateRun(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(formData, manage(runSchema), async (d, { supabase }) => {
    must(await supabase.rpc("prepare_payroll_run", { p_month: d.month }));
    return "Payslips recalculated from current salaries and components.";
  });
}

/** Approves a run (Owner / Admin only, FIN-06); its payslips are then fixed. */
export async function approveRun(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: OWNER, schema: runSchema, revalidate: ["/payroll"] },
    async (d, { supabase }) => {
      const count = must(await supabase.rpc("approve_payroll_run", { p_run_id: d.id }));
      return `Payroll approved with ${count} payslips. It can no longer change.`;
    },
  );
}

const paySchema = z.object({
  id: uuid(),
  date: isoDate("the payment date"),
  category_id: uuid("an expense category"),
  account_USD: z.string().optional(),
  account_LRD: z.string().optional(),
  fx_rate: rateText,
});

/** Marks an approved run paid; this records the salary expenses (FIN-06). */
export async function payRun(_p: FormState, formData: FormData): Promise<FormState> {
  return runAction(
    formData,
    { roles: OWNER, schema: paySchema, revalidate: ["/payroll", "/"] },
    async (d, { supabase }) => {
      const accounts = Object.fromEntries(
        (["USD", "LRD"] as const).map((c) => [c, d[`account_${c}`]] as const).filter(([, v]) => v),
      );
      const count = must(
        await supabase.rpc("pay_payroll_run", {
          p_run_id: d.id,
          p_date: d.date,
          p_category_id: d.category_id,
          p_accounts: accounts,
          p_fx_rate: d.fx_rate ? Number(d.fx_rate) : undefined,
        }),
      );
      return `Payroll marked paid. ${count} expense ${count === 1 ? "entry" : "entries"} recorded.`;
    },
  );
}
