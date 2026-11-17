// Corex Admin money report and support log (audit round A4, A5): expenses and support
// items are for admins only; support items are closed, never deleted; the report keeps
// each currency apart and splits income by product and expenses by category.
import type { TransactionSql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateSchema } from "../src/migrations.ts";
import { asAdmin as runAs, type TestAdmin, verifiedAdmin } from "./admin-helpers.ts";
import {
  asUser,
  createTestUser,
  deleteTestUsers,
  dropSchemas,
  localKeys,
  testDb,
  testEmail,
  uniqueSchema,
} from "./helpers.ts";

const sql = testDb();
const keys = localKeys();
const schema = uniqueSchema("money");
const users: string[] = [];
let admin: TestAdmin;
let outsider: string;
let clientId = "";

const asAdmin = <T>(fn: (tx: TransactionSql) => Promise<T>) => runAs(sql, admin, fn);

type Report = {
  year: number;
  currencies: Record<
    string,
    {
      income: string[];
      expenses: string[];
      by_product: Record<string, string>;
      by_category: Record<string, string>;
    }
  >;
};

beforeAll(async () => {
  await migrateSchema(sql, schema, "admin");
  admin = await verifiedAdmin(sql, keys, schema, "money", users);
  outsider = await createTestUser(keys, testEmail("money-outsider"), "Outsider-Test-2026!");
  users.push(outsider);
  const [row] = await asAdmin((tx) =>
    tx.unsafe<{ id: string }[]>(`select ${schema}.create_client(null, $1::jsonb) as id`, [
      {
        name: "Riverside Traders",
        contact_name: "Esther Dolo",
        contact_phone: "+231 88 555 0601",
        product: "finance",
        plan: "managed",
        total_minor: 150000,
        currency: "USD",
        signed_on: "2026-01-20",
        milestone_scheme: [70, 30],
        renewal_minor: 30000,
      } as never,
    ]),
  );
  clientId = row?.id ?? "";
});

afterAll(async () => {
  await dropSchemas(sql, schema);
  await deleteTestUsers(keys, ...users);
  await sql.end();
});

describe("money report", () => {
  it("shows income by product and expenses by category, each currency apart", async () => {
    const [inv] = await asAdmin((tx) =>
      tx.unsafe<{ id: string }[]>(`select ${schema}.save_invoice_draft(null, $1::jsonb) as id`, [
        {
          client_id: clientId,
          kind: "custom",
          currency: "USD",
          lines: [{ description: "Training day", quantity: 1, unit_amount_minor: 40000 }],
        } as never,
      ]),
    );
    await asAdmin((tx) => tx.unsafe(`select ${schema}.issue_invoice($1)`, [inv?.id ?? ""]));
    await asAdmin((tx) =>
      tx.unsafe(
        `select * from ${schema}.record_payment(gen_random_uuid(), $1, 40000, 'USD', 'cash', null)`,
        [inv?.id ?? ""],
      ),
    );
    await asAdmin((tx) =>
      tx.unsafe(
        `insert into ${schema}.expenses (spent_on, category, description, amount_minor, currency) values
         (current_date, 'hosting', 'Vercel Pro', 2000, 'USD'),
         (current_date, 'domains', 'corexlr.com', 1500, 'USD'),
         (current_date, 'staff', 'Field visit transport', 500000, 'LRD')`,
      ),
    );
    const [row] = await asAdmin((tx) =>
      tx.unsafe<{ r: Report }[]>(
        `select ${schema}.money_report(extract(year from current_date)::int) as r`,
      ),
    );
    const month = new Date().getUTCMonth();
    const usd = row?.r.currencies.USD;
    expect(usd?.income[month]).toBe("40000");
    expect(usd?.expenses[month]).toBe("3500");
    expect(usd?.income.reduce((a, b) => a + Number(b), 0)).toBe(40000);
    expect(usd?.by_product).toEqual({ other: "40000" });
    expect(usd?.by_category).toEqual({ hosting: "2000", domains: "1500" });
    const lrd = row?.r.currencies.LRD;
    expect(lrd?.income.every((v) => v === "0")).toBe(true);
    expect(lrd?.by_category).toEqual({ staff: "500000" });
    // Another year has nothing.
    const [empty] = await asAdmin((tx) =>
      tx.unsafe<{ r: Report }[]>(`select ${schema}.money_report(2001) as r`),
    );
    expect(empty?.r.currencies).toEqual({});
  });

  it("keeps expenses to admins", async () => {
    expect(
      await asUser(sql, outsider, (tx) => tx.unsafe(`select * from ${schema}.expenses`)),
    ).toHaveLength(0);
    await expect(
      asUser(sql, outsider, (tx) =>
        tx.unsafe(
          `insert into ${schema}.expenses (spent_on, category, description, amount_minor, currency)
           values (current_date, 'other', 'Not mine', 100, 'USD')`,
        ),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asAdmin((tx) =>
        tx.unsafe(
          `insert into ${schema}.expenses (spent_on, category, description, amount_minor, currency)
           values (current_date, 'other', 'Free lunch', 0, 'USD')`,
        ),
      ),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("support log", () => {
  it("dates resolving and reopening, and keeps every item", async () => {
    const [item] = await asAdmin((tx) =>
      tx.unsafe<{ id: string; status: string; resolved_on: string | null }[]>(
        `insert into ${schema}.support_tickets (client_id, kind, priority, title, details)
         values ($1, 'issue', 'high', 'Receipts print blank', 'Since Monday')
         returning id, status, resolved_on`,
        [clientId],
      ),
    );
    expect(item).toMatchObject({ status: "open", resolved_on: null });
    const [resolved] = await asAdmin((tx) =>
      tx.unsafe<{ resolved_on: Date | null }[]>(
        `update ${schema}.support_tickets set status = 'resolved', resolution = 'Printer driver'
         where id = $1 returning resolved_on`,
        [item?.id ?? ""],
      ),
    );
    expect(resolved?.resolved_on).toBeInstanceOf(Date);
    const [reopened] = await asAdmin((tx) =>
      tx.unsafe<{ resolved_on: Date | null }[]>(
        `update ${schema}.support_tickets set status = 'in_progress' where id = $1 returning resolved_on`,
        [item?.id ?? ""],
      ),
    );
    expect(reopened?.resolved_on).toBeNull();
    await expect(
      asAdmin((tx) =>
        tx.unsafe(`delete from ${schema}.support_tickets where id = $1`, [item?.id ?? ""]),
      ),
    ).rejects.toThrow(/permission denied/);
    expect(
      await asUser(sql, outsider, (tx) => tx.unsafe(`select * from ${schema}.support_tickets`)),
    ).toHaveLength(0);
    const [logged] = await sql.unsafe<{ n: string }[]>(
      `select count(*) as n from ${schema}.audit_events where table_name = 'support_tickets'`,
    );
    expect(Number(logged?.n)).toBe(3);
  });
});
