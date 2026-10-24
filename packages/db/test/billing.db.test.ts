// Shared billing module (SPEC.md 5.1-5.2: CORE-05, CORE-06, CORE-07, CORE-08).
import type { Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect } from "../src/db.ts";
import { LOCAL_DATABASE_URL } from "../src/env.ts";
import { migrateSchema } from "../src/migrations.ts";
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
const schema = uniqueSchema("billing");
let cashier = "";
let clerk = "";

type PaymentResult = {
  payment_id: string;
  receipt_id: string;
  receipt_number: string;
  invoice_status: string;
};

async function draftInvoice(currency = "LRD", lines: [number, number][] = [[1, 1500000]]) {
  const id = crypto.randomUUID();
  await asUser(sql, cashier, async (tx) => {
    await tx.unsafe(
      `insert into ${schema}.invoices (id, party_type, party_id, currency) values ($1, 'student', gen_random_uuid(), $2)`,
      [id, currency],
    );
    for (const [quantity, unit] of lines) {
      await tx.unsafe(
        `insert into ${schema}.invoice_lines (invoice_id, description, quantity, unit_amount_minor, amount_minor) values ($1, 'Tuition', $2, $3, 0)`,
        [id, quantity, unit],
      );
    }
  });
  return id;
}

async function issue(invoiceId: string): Promise<number> {
  const [row] = await asUser(sql, cashier, (tx) =>
    tx.unsafe<{ n: string }[]>(`select ${schema}.issue_invoice($1) as n`, [invoiceId]),
  );
  return Number(row?.n);
}

async function pay(invoiceId: string, amount: number, id = crypto.randomUUID(), currency = "LRD") {
  const [row] = await asUser(sql, cashier, (tx) =>
    tx.unsafe<PaymentResult[]>(`select * from ${schema}.record_payment($1, $2, $3, $4, 'cash')`, [
      id,
      invoiceId,
      amount,
      currency,
    ]),
  );
  if (!row) throw new Error("no payment result");
  return row;
}

async function balance(invoiceId: string) {
  const [row] = await sql.unsafe<{ total_minor: string; paid_minor: string; status: string }[]>(
    `select b.total_minor, b.paid_minor, i.status from ${schema}.invoice_balances b
     join ${schema}.invoices i on i.id = b.invoice_id where b.invoice_id = $1`,
    [invoiceId],
  );
  return { total: Number(row?.total_minor), paid: Number(row?.paid_minor), status: row?.status };
}

beforeAll(async () => {
  await migrateSchema(sql, schema, "school");
  await sql.unsafe(`insert into ${schema}.settings (org_name) values ('Billing School')`);
  // A product role that bills, the way the School product will (bursar).
  await sql.unsafe(`create or replace function ${schema}.billing_roles() returns text[] language sql immutable
    set search_path = '' as $$ select array['super_admin', 'admin', 'owner', 'bursar'] $$`);
  cashier = await createTestUser(keys, testEmail("bursar"), "Test@2026pass");
  clerk = await createTestUser(keys, testEmail("registrar"), "Test@2026pass");
  await sql.unsafe(
    `insert into ${schema}.memberships (user_id, role, display_name) values ($1, 'bursar', 'Bursar'), ($2, 'registrar', 'Registrar')`,
    [cashier, clerk],
  );
});

afterAll(async () => {
  await dropSchemas(sql, schema);
  await deleteTestUsers(keys, cashier, clerk);
  await sql.end();
});

describe("invoice lines", () => {
  it("computes amounts from quantity and unit price, rounding half away from zero", async () => {
    const id = await draftInvoice("USD", [
      [2, 2500],
      [0.5, 333],
    ]);
    const lines = await sql.unsafe<{ amount_minor: string }[]>(
      `select amount_minor from ${schema}.invoice_lines where invoice_id = $1 order by amount_minor`,
      [id],
    );
    expect(lines.map((l) => Number(l.amount_minor))).toEqual([167, 5000]);
    expect((await balance(id)).total).toBe(5167);
  });

  it("are locked once the invoice is issued (CORE-07)", async () => {
    const id = await draftInvoice();
    await issue(id);
    await expect(
      asUser(sql, cashier, (tx) =>
        tx.unsafe(
          `update ${schema}.invoice_lines set unit_amount_minor = 1 where invoice_id = $1`,
          [id],
        ),
      ),
    ).rejects.toThrow(/only change while the invoice is a draft/);
    await expect(
      sql.unsafe(`delete from ${schema}.invoice_lines where invoice_id = $1`, [id]),
    ).rejects.toThrow(/draft/);
  });
});

describe("numbering (CORE-08)", () => {
  it("issues sequential invoice numbers with no gaps, even concurrently", async () => {
    const ids = await Promise.all(Array.from({ length: 8 }, () => draftInvoice()));
    const connections: Sql[] = ids.map(() =>
      connect(process.env.DATABASE_URL ?? LOCAL_DATABASE_URL),
    );
    try {
      const numbers = await Promise.all(
        ids.map((id, i) =>
          asUser(connections[i] as Sql, cashier, (tx) =>
            tx.unsafe<{ n: string }[]>(`select ${schema}.issue_invoice($1) as n`, [id]),
          ).then(([row]) => Number(row?.n)),
        ),
      );
      const sorted = [...numbers].sort((a, b) => a - b);
      const first = sorted[0] ?? 0;
      expect(sorted).toEqual(Array.from({ length: 8 }, (_, i) => first + i));
    } finally {
      await Promise.all(connections.map((c) => c.end()));
    }
  });

  it("never reuses a number: a voided invoice keeps it and the next one moves on", async () => {
    const a = await draftInvoice();
    const n = await issue(a);
    await asUser(sql, cashier, (tx) =>
      tx.unsafe(`select ${schema}.void_invoice($1, 'Issued twice')`, [a]),
    );
    const b = await draftInvoice();
    expect(await issue(b)).toBe(n + 1);
    const [voided] = await sql.unsafe<{ number: string; status: string }[]>(
      `select number, status from ${schema}.invoices where id = $1`,
      [a],
    );
    expect(voided).toEqual({ number: String(n), status: "void" });
  });

  it("refuses to issue an empty invoice or one that is already issued", async () => {
    const empty = await draftInvoice("USD", []);
    await expect(issue(empty)).rejects.toThrow(/at least one line/);
    const id = await draftInvoice();
    await issue(id);
    await expect(issue(id)).rejects.toThrow(/Only a draft/);
  });
});

describe("payments and receipts", () => {
  it("records a partial payment in LRD, then the rest, with a receipt each (SCH-06 groundwork)", async () => {
    const id = await draftInvoice("LRD", [[1, 1500000]]);
    await issue(id);
    const first = await pay(id, 500000);
    expect(first.invoice_status).toBe("partially_paid");
    expect(await balance(id)).toEqual({ total: 1500000, paid: 500000, status: "partially_paid" });
    const second = await pay(id, 1000000);
    expect(second.invoice_status).toBe("paid");
    expect(Number(second.receipt_number)).toBe(Number(first.receipt_number) + 1);
  });

  it("creates one payment when the same request is retried (CORE-06)", async () => {
    const id = await draftInvoice();
    await issue(id);
    const paymentId = crypto.randomUUID();
    const first = await pay(id, 200000, paymentId);
    const retry = await pay(id, 200000, paymentId);
    expect(retry).toEqual(first);
    const rows = await sql.unsafe(`select 1 from ${schema}.payments where invoice_id = $1`, [id]);
    expect(rows).toHaveLength(1);
    await expect(pay(id, 999, paymentId)).rejects.toThrow(/different payment/);
  });

  it("never mixes currencies (CORE-05)", async () => {
    const id = await draftInvoice("LRD");
    await issue(id);
    await expect(pay(id, 100, crypto.randomUUID(), "USD")).rejects.toThrow(
      /does not match invoice currency/,
    );
  });

  it("refuses overpayment, zero amounts and payments on drafts", async () => {
    const draft = await draftInvoice();
    await expect(pay(draft, 100)).rejects.toThrow(/issued, unpaid/);
    const id = await draftInvoice("LRD", [[1, 1000]]);
    await issue(id);
    await expect(pay(id, 1001)).rejects.toThrow(/more than the balance/);
    await expect(pay(id, 0)).rejects.toThrow(/greater than zero/);
  });

  it("voids a payment with a reason, keeps it and its receipt, and reopens the balance (CORE-07)", async () => {
    const id = await draftInvoice("LRD", [[1, 1000]]);
    await issue(id);
    const payment = await pay(id, 1000);
    await expect(
      asUser(sql, cashier, (tx) =>
        tx.unsafe(`select ${schema}.void_payment($1, '  ')`, [payment.payment_id]),
      ),
    ).rejects.toThrow(/reason is required/);
    const [row] = await asUser(sql, cashier, (tx) =>
      tx.unsafe<{ status: string }[]>(
        `select ${schema}.void_payment($1, 'Wrong student') as status`,
        [payment.payment_id],
      ),
    );
    expect(row?.status).toBe("issued");
    const [voided] = await sql.unsafe<{ status: string; void_reason: string }[]>(
      `select status, void_reason from ${schema}.payments where id = $1`,
      [payment.payment_id],
    );
    expect(voided).toEqual({ status: "void", void_reason: "Wrong student" });
    const receipts = await sql.unsafe(`select 1 from ${schema}.receipts where payment_id = $1`, [
      payment.payment_id,
    ]);
    expect(receipts).toHaveLength(1);
    expect(await balance(id)).toMatchObject({ paid: 0, status: "issued" });
    const audit = await sql.unsafe<{ action: string; actor_id: string }[]>(
      `select action, actor_id from ${schema}.audit_events where table_name = 'payments' and record_id = $1 order by created_at`,
      [payment.payment_id],
    );
    expect(audit.map((a) => a.action)).toEqual(["create", "void"]);
    expect(audit[1]?.actor_id).toBe(cashier);
  });

  it("does not void an invoice that still has posted payments", async () => {
    const id = await draftInvoice("LRD", [[1, 1000]]);
    await issue(id);
    await pay(id, 500);
    await expect(
      asUser(sql, cashier, (tx) =>
        tx.unsafe(`select ${schema}.void_invoice($1, 'Cancelled')`, [id]),
      ),
    ).rejects.toThrow(/payments first/);
  });

  it("never deletes payments, receipts or invoices, even for the database owner", async () => {
    await expect(sql.unsafe(`delete from ${schema}.payments`)).rejects.toThrow(/never deleted/);
    await expect(sql.unsafe(`delete from ${schema}.receipts`)).rejects.toThrow(/never deleted/);
    await expect(sql.unsafe(`delete from ${schema}.invoices`)).rejects.toThrow(/never deleted/);
  });
});

describe("billing permissions (CORE-02)", () => {
  it("rejects billing calls from members without a billing role", async () => {
    const id = await draftInvoice();
    await expect(
      asUser(sql, clerk, (tx) => tx.unsafe(`select ${schema}.issue_invoice($1)`, [id])),
    ).rejects.toThrow(/cannot record billing/);
    const rows = await asUser(sql, clerk, (tx) => tx.unsafe(`select id from ${schema}.invoices`));
    expect(rows).toHaveLength(0);
  });

  it("does not let anyone write payments directly, bypassing the checks", async () => {
    const id = await draftInvoice();
    await issue(id);
    await expect(
      asUser(sql, cashier, (tx) =>
        tx.unsafe(
          `insert into ${schema}.payments (invoice_id, amount_minor, currency, method) values ($1, 1, 'LRD', 'cash')`,
          [id],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("logs sign-ins for members only", async () => {
    await asUser(sql, clerk, (tx) => tx.unsafe(`select ${schema}.log_login()`));
    const rows = await sql.unsafe(
      `select 1 from ${schema}.audit_events where action = 'login' and actor_id = $1`,
      [clerk],
    );
    expect(rows).toHaveLength(1);
  });
});
