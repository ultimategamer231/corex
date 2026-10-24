// Financial Management (SPEC.md 9.3): FIN-01 to FIN-07 with mixed USD and LRD data,
// sales invoice payments and payroll.
import { randomUUID } from "node:crypto";
import type { TransactionSql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateSchema } from "../src/migrations.ts";
import {
  asUser,
  createTestUser,
  deleteTestUsers,
  dropSchemas,
  localKeys,
  testDb,
  testEmail,
} from "./helpers.ts";
import { uniqueSchema } from "./helpers.ts";

const sql = testDb();
const keys = localKeys();
const s = uniqueSchema("fin");

const users = {} as Record<"owner" | "accountant" | "staff" | "outsider", string>;
const ids = {} as Record<
  "cashUsd" | "mobileUsd" | "bankLrd" | "sales" | "rent" | "salaries" | "customer",
  string
>;

async function one<T>(tx: TransactionSql | typeof sql, query: string, params: unknown[] = []) {
  const [row] = await tx.unsafe<T[]>(query, params as never[]);
  if (!row) throw new Error(`no row: ${query}`);
  return row;
}

type Entry = {
  id?: string;
  type: "income" | "expense" | "transfer";
  account: string;
  amount: number;
  category?: string | null;
  to?: string | null;
  date?: string;
  rate?: number | null;
};

function record(tx: TransactionSql, e: Entry) {
  return one<{ id: string; fx_rate_to_base: string; base_amount_minor: string }>(
    tx,
    `select * from ${s}.record_transaction($1, $2, $3, $4, $5, $6, $7, null, $8)`,
    [
      e.id ?? randomUUID(),
      e.type,
      e.date ?? "2026-10-01",
      e.account,
      e.amount,
      e.category ?? null,
      e.to ?? null,
      e.rate ?? null,
    ],
  );
}

/** Balances in base currency (USD) across all accounts, as the owner sees them. */
async function totalBase(): Promise<number> {
  const rows = await sql.unsafe<{ base: string }[]>(
    `select coalesce(sum(base_amount_minor), 0)::text as base from ${s}.ledger`,
  );
  return Number(rows[0]?.base ?? 0);
}

beforeAll(async () => {
  await migrateSchema(sql, s, "finance");
  await sql.unsafe(
    `insert into ${s}.settings (org_name, base_currency) values ('Test Traders', 'USD')`,
  );
  for (const role of ["owner", "accountant", "staff", "outsider"] as const) {
    users[role] = await createTestUser(keys, testEmail(`fin-${role}`), "Test@2026pass");
    if (role !== "outsider") {
      await sql.unsafe(
        `insert into ${s}.memberships (user_id, role, display_name) values ($1, $2, $3)`,
        [users[role], role, role],
      );
    }
  }
  const account = async (name: string, type: string, currency: string, opening: number) =>
    (
      await one<{ id: string }>(
        sql,
        `insert into ${s}.accounts (name, type, currency, opening_balance_minor, opened_on)
         values ($1, $2, $3, $4, '2026-01-01') returning id`,
        [name, type, currency, opening],
      )
    ).id;
  ids.cashUsd = await account("Cash box", "cash", "USD", 10_000);
  ids.mobileUsd = await account("Mobile money", "mobile_money", "USD", 0);
  ids.bankLrd = await account("Bank LRD", "bank", "LRD", 5_000_000);
  const category = async (name: string, type: string) =>
    (
      await one<{ id: string }>(
        sql,
        `insert into ${s}.categories (name, type) values ($1, $2) returning id`,
        [name, type],
      )
    ).id;
  ids.sales = await category("Sales", "income");
  ids.rent = await category("Rent", "expense");
  ids.salaries = await category("Salaries", "expense");
  ids.customer = (
    await one<{ id: string }>(
      sql,
      `insert into ${s}.counterparties (name, type) values ('Kollie Supermarket', 'customer') returning id`,
    )
  ).id;
  // 1 USD = 200 LRD on 1 October.
  await sql.unsafe(
    `insert into ${s}.exchange_rates (date, from_currency, to_currency, rate) values ('2026-10-01', 'USD', 'LRD', 200)`,
  );
});

afterAll(async () => {
  await dropSchemas(sql, s);
  await deleteTestUsers(keys, ...Object.values(users));
  await sql.end();
});

describe("FIN-01 transactions need valid details", () => {
  it.each([
    ["no category", { type: "income", amount: 500, category: null }, /Choose a category/],
    ["a zero amount", { type: "income", amount: 0 }, /greater than zero/],
    [
      "a category of the other type",
      { type: "expense", amount: 500 },
      /Choose an expense category/,
    ],
  ] as const)("rejects %s", async (_label, entry, error) => {
    await expect(
      asUser(sql, users.accountant, (tx) =>
        record(tx, { account: ids.cashUsd, category: ids.sales, ...entry }),
      ),
    ).rejects.toThrow(error);
  });

  it("takes the currency from the account", async () => {
    const row = await asUser(sql, users.staff, (tx) =>
      record(tx, { type: "expense", account: ids.bankLrd, amount: 100_000, category: ids.rent }),
    );
    expect(
      await one<{ currency: string }>(sql, `select currency from ${s}.transactions where id = $1`, [
        row.id,
      ]),
    ).toEqual({
      currency: "LRD",
    });
  });
});

describe("FIN-02 retries", () => {
  it("records one transaction for a retried id and refuses changed details", async () => {
    const id = randomUUID();
    const entry = {
      id,
      type: "income",
      account: ids.cashUsd,
      amount: 2_500,
      category: ids.sales,
    } as const;
    await asUser(sql, users.staff, (tx) => record(tx, entry));
    await asUser(sql, users.staff, (tx) => record(tx, entry));
    expect(
      await one<{ n: string }>(
        sql,
        `select count(*)::text as n from ${s}.transactions where id = $1`,
        [id],
      ),
    ).toEqual({
      n: "1",
    });
    await expect(
      asUser(sql, users.staff, (tx) => record(tx, { ...entry, amount: 2_600 })),
    ).rejects.toThrow(/already used/);
  });
});

describe("FIN-03 saved exchange rates", () => {
  it("keeps the rate and base amount when reference rates change later", async () => {
    const row = await asUser(sql, users.accountant, (tx) =>
      record(tx, { type: "income", account: ids.bankLrd, amount: 2_000_000, category: ids.sales }),
    );
    expect(Number(row.fx_rate_to_base)).toBe(0.005);
    expect(Number(row.base_amount_minor)).toBe(10_000);
    await sql.unsafe(`update ${s}.exchange_rates set rate = 100`);
    const again = await one<{ fx_rate_to_base: string; base_amount_minor: string }>(
      sql,
      `select fx_rate_to_base, base_amount_minor from ${s}.transactions where id = $1`,
      [row.id],
    );
    expect(Number(again.base_amount_minor)).toBe(10_000);
    await sql.unsafe(`update ${s}.exchange_rates set rate = 200`);
  });

  it("asks for a rate when no reference rate exists", async () => {
    await expect(
      asUser(sql, users.accountant, (tx) =>
        record(tx, {
          type: "income",
          account: ids.bankLrd,
          amount: 1_000,
          category: ids.sales,
          date: "2026-01-05",
        }),
      ),
    ).rejects.toThrow(/Enter the exchange rate/);
  });
});

describe("FIN-04 transfers", () => {
  it("moves money between accounts and leaves the base total unchanged", async () => {
    const before = await totalBase();
    await asUser(sql, users.accountant, (tx) =>
      record(tx, { type: "transfer", account: ids.cashUsd, to: ids.mobileUsd, amount: 3_000 }),
    );
    expect(await totalBase()).toBe(before);
    const mobile = await one<{ balance_minor: string }>(
      sql,
      `select balance_minor from ${s}.account_balances where account_id = $1`,
      [ids.mobileUsd],
    );
    expect(Number(mobile.balance_minor)).toBe(3_000);
  });

  it("refuses transfers between currencies and from Staff", async () => {
    await expect(
      asUser(sql, users.accountant, (tx) =>
        record(tx, { type: "transfer", account: ids.cashUsd, to: ids.bankLrd, amount: 100 }),
      ),
    ).rejects.toThrow(/same currency/);
    await expect(
      asUser(sql, users.staff, (tx) =>
        record(tx, { type: "transfer", account: ids.cashUsd, to: ids.mobileUsd, amount: 100 }),
      ),
    ).rejects.toThrow(/Only the Owner or Accountant/);
  });
});

describe("FIN-05 voiding", () => {
  it("adds a reversal, keeps the original visible and restores the balance", async () => {
    const balance = async () =>
      Number(
        (
          await one<{ balance_minor: string }>(
            sql,
            `select balance_minor from ${s}.account_balances where account_id = $1`,
            [ids.cashUsd],
          )
        ).balance_minor,
      );
    const before = await balance();
    const row = await asUser(sql, users.staff, (tx) =>
      record(tx, { type: "expense", account: ids.cashUsd, amount: 1_200, category: ids.rent }),
    );
    expect(await balance()).toBe(before - 1_200);
    await expect(
      asUser(sql, users.staff, (tx) =>
        tx.unsafe(`select ${s}.void_transaction($1, 'Mistake')`, [row.id]),
      ),
    ).rejects.toThrow(/Only the Owner or Accountant/);
    await asUser(sql, users.accountant, (tx) =>
      tx.unsafe(`select ${s}.void_transaction($1, 'Entered twice')`, [row.id]),
    );
    expect(await balance()).toBe(before);
    const rows = await sql.unsafe<{ status: string; reversal_of_id: string | null }[]>(
      `select status, reversal_of_id from ${s}.transactions where id = $1 or reversal_of_id = $1 order by reversal_of_id nulls first`,
      [row.id],
    );
    expect(rows).toEqual([
      { status: "void", reversal_of_id: null },
      { status: "void", reversal_of_id: row.id },
    ]);
  });

  it("never edits or deletes a posted transaction", async () => {
    const row = await one<{ id: string }>(sql, `select id from ${s}.transactions limit 1`);
    await expect(
      sql.unsafe(`update ${s}.transactions set amount_minor = 1 where id = $1`, [row.id]),
    ).rejects.toThrow(/cannot be edited/);
    await expect(
      sql.unsafe(`delete from ${s}.transactions where id = $1`, [row.id]),
    ).rejects.toThrow(/never deleted/);
  });
});

describe("sales invoices", () => {
  it("records a partial payment with its income entry, once, and voids both", async () => {
    const invoice = await asUser(sql, users.accountant, async (tx) => {
      const inv = await one<{ id: string }>(
        tx,
        `insert into ${s}.invoices (party_type, party_id, currency) values ('counterparty', $1, 'USD') returning id`,
        [ids.customer],
      );
      await tx.unsafe(
        `insert into ${s}.invoice_lines (invoice_id, description, quantity, unit_amount_minor, amount_minor)
         values ($1, 'Rice, 10 bags', 10, 4_000, 40_000)`,
        [inv.id],
      );
      await tx.unsafe(`select ${s}.issue_invoice($1)`, [inv.id]);
      return inv.id;
    });
    const payment = randomUUID();
    const pay = () =>
      asUser(sql, users.accountant, (tx) =>
        one<{ invoice_status: string }>(
          tx,
          `select * from ${s}.record_invoice_payment($1, $2, 15_000, 'cash', $3, $4, '2026-10-05')`,
          [payment, invoice, ids.cashUsd, ids.sales],
        ),
      );
    expect((await pay()).invoice_status).toBe("partially_paid");
    expect((await pay()).invoice_status).toBe("partially_paid");
    const income = await sql.unsafe<{ amount_minor: string; counterparty_id: string }[]>(
      `select amount_minor, counterparty_id from ${s}.transactions where invoice_payment_id = $1`,
      [payment],
    );
    expect(income).toEqual([{ amount_minor: "15000", counterparty_id: ids.customer }]);

    await expect(
      asUser(sql, users.accountant, (tx) =>
        tx.unsafe(`select ${s}.void_transaction($1, 'x')`, [payment]),
      ),
    ).rejects.toThrow(/void the payment on its invoice/);
    await asUser(sql, users.accountant, (tx) =>
      tx.unsafe(`select ${s}.void_invoice_payment($1, 'Cheque bounced')`, [payment]),
    );
    const net = await one<{ net: string }>(
      sql,
      `select coalesce(sum(amount_minor), 0)::text as net from ${s}.ledger where transaction_id in
         (select id from ${s}.transactions where invoice_payment_id = $1)`,
      [payment],
    );
    expect(net.net).toBe("0");
    expect(
      (
        await one<{ status: string }>(sql, `select status from ${s}.invoices where id = $1`, [
          invoice,
        ])
      ).status,
    ).toBe("issued");
  });
});

describe("FIN-06 payroll", () => {
  let runId = "";

  beforeAll(async () => {
    const employee = async (number: string, first: string, salary: number, currency: string) =>
      (
        await one<{ id: string }>(
          sql,
          `insert into ${s}.employees (first_name, last_name, employee_number, start_date, base_salary_minor, currency)
           values ($1, 'Test', $2, '2025-01-01', $3, $4) returning id`,
          [first, number, salary, currency],
        )
      ).id;
    const musu = await employee("E001", "Musu", 60_000, "USD");
    const varney = await employee("E002", "Varney", 9_000_000, "LRD");
    const transport = await one<{ id: string }>(
      sql,
      `insert into ${s}.pay_components (name, kind, calc, default_value) values ('Transport', 'allowance', 'fixed', 5000) returning id`,
    );
    const pension = await one<{ id: string }>(
      sql,
      `insert into ${s}.pay_components (name, kind, calc, default_value) values ('Pension', 'deduction', 'percent_of_base', 3) returning id`,
    );
    await sql.unsafe(
      `insert into ${s}.employee_components (employee_id, pay_component_id, value) values
       ($1, $3, null), ($1, $4, null), ($2, $4, 4)`,
      [musu, varney, transport.id, pension.id],
    );
  });

  it("lets the Accountant prepare but only the Owner approve", async () => {
    runId = await asUser(
      sql,
      users.accountant,
      async (tx) =>
        (await one<{ id: string }>(tx, `select ${s}.prepare_payroll_run('2026-10-15') as id`)).id,
    );
    await expect(
      asUser(sql, users.accountant, (tx) =>
        tx.unsafe(`select ${s}.approve_payroll_run($1)`, [runId]),
      ),
    ).rejects.toThrow(/Only the Owner can approve/);
    await asUser(sql, users.owner, (tx) =>
      tx.unsafe(`select ${s}.approve_payroll_run($1)`, [runId]),
    );
    const slips = await sql.unsafe<
      {
        employee_number: string;
        gross_minor: string;
        total_deductions_minor: string;
        net_minor: string;
      }[]
    >(
      `select e.employee_number, p.gross_minor, p.total_deductions_minor, p.net_minor
       from ${s}.payslips p join ${s}.employees e on e.id = p.employee_id order by 1`,
    );
    expect(slips).toEqual([
      {
        employee_number: "E001",
        gross_minor: "65000",
        total_deductions_minor: "1800",
        net_minor: "63200",
      },
      {
        employee_number: "E002",
        gross_minor: "9000000",
        total_deductions_minor: "360000",
        net_minor: "8640000",
      },
    ]);
  });

  it("keeps approved payslips as they were when components change", async () => {
    await sql.unsafe(`update ${s}.pay_components set default_value = 10 where name = 'Pension'`);
    const slip = await one<{ net_minor: string }>(
      sql,
      `select p.net_minor from ${s}.payslips p join ${s}.employees e on e.id = p.employee_id where e.employee_number = 'E001'`,
    );
    expect(slip.net_minor).toBe("63200");
    await expect(sql.unsafe(`update ${s}.payslips set net_minor = 1`)).rejects.toThrow(/read-only/);
    await expect(
      asUser(sql, users.accountant, (tx) =>
        tx.unsafe(`select ${s}.prepare_payroll_run('2026-10-01')`),
      ),
    ).rejects.toThrow(/already approved/);
  });

  it("creates the expense entries when the Owner marks the run paid", async () => {
    const before = await totalBase();
    await asUser(sql, users.owner, (tx) =>
      tx.unsafe(`select ${s}.pay_payroll_run($1, '2026-10-30', $2, $3::text::jsonb)`, [
        runId,
        ids.salaries,
        JSON.stringify({ USD: ids.cashUsd, LRD: ids.bankLrd }),
      ]),
    );
    const entries = await sql.unsafe<{ currency: string; amount_minor: string }[]>(
      `select currency, amount_minor from ${s}.transactions where category_id = $1 order by currency`,
      [ids.salaries],
    );
    expect(entries).toEqual([
      { currency: "LRD", amount_minor: "8640000" },
      { currency: "USD", amount_minor: "63200" },
    ]);
    // 63,200 USD cents + 8,640,000 LRD cents at 200 LRD per USD.
    expect(await totalBase()).toBe(before - 63_200 - 43_200);
    expect(
      (
        await one<{ status: string }>(sql, `select status from ${s}.payroll_runs where id = $1`, [
          runId,
        ])
      ).status,
    ).toBe("paid");
  });
});

describe("FIN-07 Staff", () => {
  it("cannot read payroll and sees only their own entries", async () => {
    await asUser(sql, users.staff, async (tx) => {
      for (const table of [
        "employees",
        "pay_components",
        "payroll_runs",
        "payslips",
        "payslip_lines",
      ]) {
        const rows = await tx.unsafe(`select 1 from ${s}.${table}`);
        expect(rows, table).toHaveLength(0);
      }
      const others = await tx.unsafe(
        `select 1 from ${s}.transactions where created_by is distinct from $1`,
        [users.staff],
      );
      expect(others).toHaveLength(0);
      const mine = await tx.unsafe(`select 1 from ${s}.transactions`);
      expect(mine.length).toBeGreaterThan(0);
    });
  });

  it("gives non-members nothing", async () => {
    await asUser(sql, users.outsider, async (tx) => {
      expect(await tx.unsafe(`select 1 from ${s}.accounts`)).toHaveLength(0);
    });
    await expect(
      asUser(sql, users.outsider, (tx) =>
        record(tx, { type: "income", account: ids.cashUsd, amount: 100, category: ids.sales }),
      ),
    ).rejects.toThrow(/cannot record/);
  });
});
