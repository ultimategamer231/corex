// A small, fully fictional business for local development and end-to-end tests:
// accounts in USD and LRD, categories, customers and vendors, a reference exchange
// rate, a few entries and two employees with pay components. One sign-in per role.
// Local stack only; never run against a real project.
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Sql } from "postgres";
import { migrateSchema } from "../migrations.ts";
import { exposeSchemaLocally } from "../provision.ts";
import { assertSchemaName } from "../schema-name.ts";
import { FIXTURE_PASSWORD } from "./school.ts";

export const FINANCE_ROLES = ["owner", "accountant", "staff"] as const;
export type FinanceRole = (typeof FINANCE_ROLES)[number];

/** Sign-in email for a role, for example accountant@e2e-finance.corex.test. */
export function financeEmail(schema: string, role: FinanceRole): string {
  return `${role}@${schema.replace(/_/g, "-")}.corex.test`;
}

const NAMES: Record<FinanceRole, string> = {
  owner: "Musu Johnson",
  accountant: "Prince Kollie",
  staff: "Fatu Kamara",
};

export type FinanceFixture = {
  schema: string;
  users: Record<FinanceRole, { id: string; email: string; name: string }>;
};

/** Drops and rebuilds `schema` with the fixture data. */
export async function seedFinanceFixture(
  sql: Sql,
  admin: SupabaseClient,
  schemaName: string,
): Promise<FinanceFixture> {
  const s = assertSchemaName(schemaName);
  const emails = FINANCE_ROLES.map((r) => financeEmail(s, r));
  const old = await sql<{ id: string }[]>`select id from auth.users where email = any(${emails})`;
  await sql.unsafe(`drop schema if exists ${s} cascade`);
  for (const { id } of old) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw new Error(`Could not delete fixture user ${id}: ${error.message}`);
  }

  await migrateSchema(sql, s, "finance");
  await sql.unsafe(
    `insert into ${s}.settings (org_name, address, phone, letterhead_text, base_currency)
     values ('Sample Trading Ltd', 'Randall Street, Monrovia', '+231 770 000 300', 'General merchandise', 'USD')`,
  );
  const users = {} as FinanceFixture["users"];
  for (const role of FINANCE_ROLES) {
    const email = financeEmail(s, role);
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: FIXTURE_PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`Could not create ${email}: ${error.message}`);
    users[role] = { id: data.user.id, email, name: NAMES[role] };
    await sql.unsafe(
      `insert into ${s}.memberships (user_id, role, display_name) values ($1, $2, $3)`,
      [data.user.id, role, NAMES[role]],
    );
  }

  await sql.unsafe(
    `insert into ${s}.accounts (name, type, currency, opening_balance_minor, opened_on) values
     ('Cash box', 'cash', 'USD', 50000, current_date - 90),
     ('Bank account (USD)', 'bank', 'USD', 1250000, current_date - 90),
     ('Mobile money (LRD)', 'mobile_money', 'LRD', 7500000, current_date - 90)`,
  );
  await sql.unsafe(
    `insert into ${s}.categories (name, type) values
     ('Sales', 'income'), ('Services', 'income'), ('Other income', 'income'),
     ('Rent', 'expense'), ('Salaries', 'expense'), ('Utilities', 'expense'),
     ('Transport', 'expense'), ('Supplies', 'expense')`,
  );
  await sql.unsafe(
    `insert into ${s}.counterparties (name, type, phone, email) values
     ('Kollie Supermarket', 'customer', '+231 770 222 333', null),
     ('Gbarnga Farmers Cooperative', 'both', '+231 880 444 555', null),
     ('Paynesville Hardware', 'vendor', '+231 770 666 777', null)`,
  );
  // 1 USD = 190 LRD.
  await sql.unsafe(
    `insert into ${s}.exchange_rates (date, from_currency, to_currency, rate) values (current_date - 60, 'USD', 'LRD', 190)`,
  );

  const id = async (table: string, name: string) => {
    const [row] = await sql.unsafe<{ id: string }[]>(
      `select id from ${s}.${table} where name = $1`,
      [name],
    );
    if (!row) throw new Error(`no ${table} ${name}`);
    return row.id;
  };
  const cash = await id("accounts", "Cash box");
  const bank = await id("accounts", "Bank account (USD)");
  const mobile = await id("accounts", "Mobile money (LRD)");
  const entries: [string, number, string, number, string, string][] = [
    ["income", -40, bank, 320000, "Sales", "Wholesale rice order"],
    ["income", -20, cash, 85000, "Sales", "Shop sales"],
    ["income", -15, mobile, 9500000, "Services", "Delivery service"],
    ["expense", -30, bank, 150000, "Rent", "Warehouse rent"],
    ["expense", -10, mobile, 1200000, "Utilities", "Electricity"],
    ["expense", -5, cash, 25000, "Transport", "Fuel"],
  ];
  for (const [type, days, account, amount, category, memo] of entries) {
    await sql.unsafe(
      `select ${s}.record_transaction($1, $2, current_date + $3::int, $4, $5, $6, null, null, null, $7)`,
      [randomUUID(), type, days, account, amount, await id("categories", category), memo],
    );
  }

  const employee = async (
    number: string,
    first: string,
    last: string,
    salary: number,
    currency: string,
  ) => {
    const [row] = await sql.unsafe<{ id: string }[]>(
      `insert into ${s}.employees (first_name, last_name, employee_number, position, department, start_date, base_salary_minor, currency, payment_method)
       values ($1, $2, $3, 'Sales assistant', 'Sales', current_date - 400, $4, $5, 'mobile_money') returning id`,
      [first, last, number, salary, currency],
    );
    return row?.id ?? "";
  };
  const korpo = await employee("EMP-001", "Korpo", "Wleh", 45000, "USD");
  const boima = await employee("EMP-002", "Boima", "Toe", 6500000, "LRD");
  await sql.unsafe(
    `insert into ${s}.pay_components (name, kind, calc, default_value) values
     ('Transport allowance', 'allowance', 'fixed', 5000), ('Pension', 'deduction', 'percent_of_base', 3)`,
  );
  await sql.unsafe(
    `insert into ${s}.employee_components (employee_id, pay_component_id)
     select e, c.id from unnest($1::uuid[]) e, ${s}.pay_components c`,
    [[korpo, boima]],
  );

  // Receipt photos go to a private bucket named after the schema (provisioning does the same).
  const bucket = await admin.storage.createBucket(s, { public: false });
  if (bucket.error && !/already exists/i.test(bucket.error.message)) {
    throw new Error(`Could not create bucket ${s}: ${bucket.error.message}`);
  }
  await exposeSchemaLocally(sql, s);
  return { schema: s, users };
}
