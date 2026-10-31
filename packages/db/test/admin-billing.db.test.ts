// Corex Admin invoices, payments and receipts (SPEC-ADMIN.md 9.2, 9.3): INV-01 to INV-06
// and PAY-01 to PAY-06 at the database.
import { randomUUID } from "node:crypto";
import type { TransactionSql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { verifyActivityLog } from "../src/admin/verify-log.ts";
import { migrateSchema } from "../src/migrations.ts";
import { asAdmin as runAs, type TestAdmin, verifiedAdmin } from "./admin-helpers.ts";
import { deleteTestUsers, dropSchemas, localKeys, testDb, uniqueSchema } from "./helpers.ts";

const sql = testDb();
const keys = localKeys();
const schema = uniqueSchema("billing");
const users: string[] = [];
let admin: TestAdmin;
let clientId: string;
let contractId: string;

const asAdmin = <T>(fn: (tx: TransactionSql) => Promise<T>) => runAs(sql, admin, fn);

type Line = { description: string; quantity?: number; unit_amount_minor: number; details?: string };

async function draft(
  details: Record<string, unknown>,
  lines: Line[],
  invoiceId: string | null = null,
) {
  const [row] = await asAdmin((tx) =>
    tx.unsafe<{ id: string }[]>(`select ${schema}.save_invoice_draft($1, $2::jsonb) as id`, [
      invoiceId,
      { client_id: clientId, currency: "USD", kind: "custom", ...details, lines } as never,
    ]),
  );
  if (!row) throw new Error("no invoice");
  return row.id;
}

async function invoice(id: string) {
  const [row] = await sql.unsafe<
    {
      status: string;
      display_number: string | null;
      subtotal_minor: string;
      discount_minor: string;
      tax_minor: string;
      total_minor: string;
      issue_date: string | null;
      due_date: string | null;
    }[]
  >(
    `select status, display_number, subtotal_minor, discount_minor, tax_minor, total_minor,
            issue_date::text, due_date::text
     from ${schema}.invoices where id = $1`,
    [id],
  );
  if (!row) throw new Error("invoice not found");
  return {
    ...row,
    subtotal: Number(row.subtotal_minor),
    discount: Number(row.discount_minor),
    tax: Number(row.tax_minor),
    total: Number(row.total_minor),
  };
}

const send = (id: string) => asAdmin((tx) => tx.unsafe(`select ${schema}.issue_invoice($1)`, [id]));

async function pay(id: string, amount: number, currency = "USD", method = "orange_money") {
  const [row] = await asAdmin((tx) =>
    tx.unsafe<{ payment_id: string; receipt_id: string; invoice_status: string }[]>(
      `select * from ${schema}.record_payment($1, $2, $3, $4, $5, 'OM-123')`,
      [randomUUID(), id, amount, currency, method],
    ),
  );
  if (!row) throw new Error("no payment");
  return row;
}

async function setConfig(values: Record<string, unknown>) {
  await sql.unsafe(`update ${schema}.settings set config = config || $1::jsonb`, [values as never]);
}

const today = async () =>
  (await sql.unsafe<{ d: string }[]>(`select ${schema}.today_monrovia()::text as d`))[0]?.d ?? "";

beforeAll(async () => {
  await migrateSchema(sql, schema, "admin");
  admin = await verifiedAdmin(sql, keys, schema, "fatu", users);
  const [client] = await asAdmin((tx) =>
    tx.unsafe<{ id: string }[]>(`select ${schema}.create_client(null, $1::jsonb) as id`, [
      {
        name: "Hope Medical Center",
        contact_name: "Esther Dolo",
        contact_phone: "+231 88 555 0601",
        product: "clinic",
        plan: "managed",
        total_minor: 250000,
        currency: "USD",
        signed_on: "2026-09-16",
        milestone_scheme: [50, 30, 20],
        renewal_minor: 60000,
      } as never,
    ]),
  );
  clientId = client?.id ?? "";
  const [contract] = await sql.unsafe<{ id: string }[]>(
    `select id from ${schema}.contracts where client_id = $1`,
    [clientId],
  );
  contractId = contract?.id ?? "";
  await sql.unsafe(
    `update ${schema}.deployments set environment = 'live', went_live_on = '2026-10-20' where client_id = $1`,
    [clientId],
  );
});

afterAll(async () => {
  await dropSchemas(sql, schema);
  await sql.unsafe(`delete from storage.buckets where id = $1`, [schema]).catch(() => undefined);
  await deleteTestUsers(keys, ...users);
  await sql.end();
});

describe("INV-01 to INV-04: totals", () => {
  it("subtotal is the sum of lines; a percent discount rounds half up; no tax while it is off", async () => {
    const id = await draft(
      { discount_type: "percent", discount_value: 10, discount_reason: "Early client" },
      [{ description: "Setup", quantity: 1, unit_amount_minor: 1005 }],
    );
    expect(await invoice(id)).toMatchObject({ subtotal: 1005, discount: 101, tax: 0, total: 904 });
  });

  it("tax, when turned on, applies after the discount and rounds half up", async () => {
    await setConfig({ tax_enabled: true, tax_rate_bp: 1000 });
    const id = await draft({ discount_type: "fixed", discount_value: 5000 }, [
      { description: "Training", quantity: 2, unit_amount_minor: 10025 },
      { description: "Data migration", quantity: 1, unit_amount_minor: 50050 },
    ]);
    // 20050 + 50050 = 70100; minus 5000 = 65100; 10% tax = 6510.
    expect(await invoice(id)).toMatchObject({
      subtotal: 70100,
      discount: 5000,
      tax: 6510,
      total: 71610,
    });
    await setConfig({ tax_enabled: false, tax_rate_bp: 0 });
  });

  it("the discount can never be more than the subtotal; a draft needs a line", async () => {
    await expect(
      draft({ discount_type: "fixed", discount_value: 2000 }, [
        { description: "Small", unit_amount_minor: 1000 },
      ]),
    ).rejects.toThrow(/more than the subtotal/);
    await expect(draft({}, [])).rejects.toThrow(/at least one line/);
    const totals = await sql.unsafe<
      { discount_minor: string; tax_minor: string; total_minor: string }[]
    >(`select * from ${schema}.invoice_totals(333, 'percent', 50, 750)`);
    // 50% of 333 = 166.5 → 167; tax 7.5% of 166 = 12.45 → 12.
    expect(totals[0]).toEqual({ discount_minor: "167", tax_minor: "12", total_minor: "178" });
  });
});

describe("INV-05: numbers", () => {
  it("drafts have no number; sending assigns CX-YY-MM-NNN in order and the due date", async () => {
    const first = await draft({}, [{ description: "Website", unit_amount_minor: 30000 }]);
    const second = await draft({ payment_terms_days: 30 }, [
      { description: "Hosting", unit_amount_minor: 12000 },
    ]);
    expect((await invoice(first)).display_number).toBeNull();
    await send(first);
    await send(second);
    const day = await today();
    const prefix = `CX-${day.slice(2, 4)}-${day.slice(5, 7)}-`;
    const a = await invoice(first);
    const b = await invoice(second);
    expect(a.display_number).toBe(`${prefix}001`);
    expect(b.display_number).toBe(`${prefix}002`);
    expect(a.status).toBe("issued");
    expect(a.issue_date).toBe(day);
    const daysBetween = (from: string, to: string) =>
      Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
    expect(daysBetween(a.issue_date ?? "", a.due_date ?? "")).toBe(7);
    expect(daysBetween(b.issue_date ?? "", b.due_date ?? "")).toBe(30);
  });

  it("restart each year and are never reused", async () => {
    const [n] = await sql.unsafe<{ n: string }[]>(
      `select ${schema}.next_display_number('invoice', '2031-01-05') as n`,
    );
    expect(n?.n).toBe("CX-31-01-001");
    const voided = await draft({}, [{ description: "Mistake", unit_amount_minor: 100 }]);
    await send(voided);
    const number = (await invoice(voided)).display_number;
    await asAdmin((tx) => tx.unsafe(`select ${schema}.void_invoice($1, 'Wrong client')`, [voided]));
    expect(await invoice(voided)).toMatchObject({ status: "void", display_number: number });
    const next = await draft({}, [{ description: "Right one", unit_amount_minor: 100 }]);
    await send(next);
    expect((await invoice(next)).display_number).not.toBe(number);
  });
});

describe("INV-06: sent invoices", () => {
  it("cannot be edited or deleted, only voided with a reason, and payments first", async () => {
    const id = await draft({}, [{ description: "Support", unit_amount_minor: 5000 }]);
    await send(id);
    await expect(draft({}, [{ description: "Changed", unit_amount_minor: 1 }], id)).rejects.toThrow(
      /cannot be changed/,
    );
    await expect(
      asAdmin((tx) => tx.unsafe(`update ${schema}.invoices set notes = 'x' where id = $1`, [id])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asAdmin((tx) => tx.unsafe(`select ${schema}.delete_invoice_draft($1)`, [id])),
    ).rejects.toThrow(/Only a draft/);
    await expect(
      asAdmin((tx) => tx.unsafe(`select ${schema}.void_invoice($1, ' ')`, [id])),
    ).rejects.toThrow(/Say why/);
    await pay(id, 1000);
    await expect(
      asAdmin((tx) => tx.unsafe(`select ${schema}.void_invoice($1, 'Duplicate')`, [id])),
    ).rejects.toThrow(/payments first/);
  });

  it("a draft can be deleted", async () => {
    const id = await draft({}, [{ description: "Not needed", unit_amount_minor: 100 }]);
    await asAdmin((tx) => tx.unsafe(`select ${schema}.delete_invoice_draft($1)`, [id]));
    const rows = await sql.unsafe(`select id from ${schema}.invoices where id = $1`, [id]);
    expect(rows).toHaveLength(0);
  });
});

describe("milestones", () => {
  it("one live invoice per milestone, in the contract's currency", async () => {
    const details = { kind: "milestone", contract_id: contractId, milestone_no: 1 };
    const id = await draft(details, [
      { description: "Milestone 1 of 3 (50%)", unit_amount_minor: 125000 },
    ]);
    await expect(
      draft(details, [{ description: "Again", unit_amount_minor: 125000 }]),
    ).rejects.toThrow(/invoices_one_milestone/);
    await expect(
      draft({ ...details, milestone_no: 2, currency: "LRD" }, [
        { description: "LRD", unit_amount_minor: 1 },
      ]),
    ).rejects.toThrow(/contract's currency/);
    await send(id);
    await asAdmin((tx) =>
      tx.unsafe(`select ${schema}.void_invoice($1, 'Amount agreed again')`, [id]),
    );
    expect(
      await draft(details, [{ description: "Milestone 1, again", unit_amount_minor: 120000 }]),
    ).toBeTruthy();
  });
});

describe("PAY-01 to PAY-05: payments and receipts", () => {
  it("part payments move the status; overpayment and another currency are refused", async () => {
    const id = await draft({}, [{ description: "Annual support", unit_amount_minor: 100000 }]);
    await send(id);
    await expect(pay(id, 1000, "LRD")).rejects.toThrow(/invoice's currency/);
    await expect(pay(id, 1000, "USD", "mobile_money")).rejects.toThrow(/payments_method_check/);
    await expect(pay(id, 100001)).rejects.toThrow(/more than the balance/);
    expect((await pay(id, 40000)).invoice_status).toBe("partially_paid");
    const last = await pay(id, 60000, "USD", "bank_transfer");
    expect(last.invoice_status).toBe("paid");
    await expect(pay(id, 1)).rejects.toThrow(/sent, unpaid/);

    const receipts = await sql.unsafe<{ display_number: string }[]>(
      `select r.display_number from ${schema}.receipts r join ${schema}.payments p on p.id = r.payment_id
       where p.invoice_id = $1 order by r.number`,
      [id],
    );
    expect(receipts).toHaveLength(2);
    for (const r of receipts) expect(r.display_number).toMatch(/^RC-\d{2}-\d{2}-\d{3}$/);

    const [voided] = await asAdmin((tx) =>
      tx.unsafe<{ status: string }[]>(
        `select ${schema}.void_payment($1, 'Bank reversed it') as status`,
        [last.payment_id],
      ),
    );
    expect(voided?.status).toBe("partially_paid");
    const [receipt] = await sql.unsafe<{ voided: boolean }[]>(
      `select voided_at is not null as voided from ${schema}.receipts where payment_id = $1`,
      [last.payment_id],
    );
    expect(receipt?.voided).toBe(true);
    await expect(
      asAdmin((tx) => tx.unsafe(`delete from ${schema}.payments where id = $1`, [last.payment_id])),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("PAY-06: renewals", () => {
  it("paying a renewal moves the next renewal a year; voiding its payment moves it back", async () => {
    const next = async () =>
      (
        await sql.unsafe<{ d: string }[]>(
          `select next_renewal_on::text as d from ${schema}.subscriptions where contract_id = $1`,
          [contractId],
        )
      )[0]?.d;
    expect(await next()).toBe("2027-10-20");
    const id = await draft(
      { kind: "renewal", contract_id: contractId, renewal_for: "2027-10-20" },
      [{ description: "Yearly renewal", unit_amount_minor: 60000 }],
    );
    await send(id);
    await pay(id, 30000);
    expect(await next()).toBe("2027-10-20");
    const final = await pay(id, 30000);
    expect(await next()).toBe("2028-10-20");
    await asAdmin((tx) =>
      tx.unsafe(`select ${schema}.void_payment($1, 'Cheque bounced')`, [final.payment_id]),
    );
    expect(await next()).toBe("2027-10-20");
  });
});

describe("LINK-01 to LINK-04: client view links", () => {
  const hash = (n: number) => n.toString(16).padStart(64, "0");
  const open = (h: string) =>
    sql.begin(async (tx) => {
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ role: "service_role" })}, true)`;
      await tx.unsafe("set local role service_role");
      const [row] = await tx.unsafe<{ id: string | null }[]>(
        `select ${schema}.open_invoice_link($1, '203.0.113.7') as id`,
        [h],
      );
      return row?.id ?? null;
    });

  it("only sent invoices get a link; a new link replaces the old; first open per day is logged", async () => {
    const id = await draft({}, [{ description: "Link test", unit_amount_minor: 5000 }]);
    await expect(
      asAdmin((tx) => tx.unsafe(`select ${schema}.create_invoice_link($1, $2)`, [id, hash(1)])),
    ).rejects.toThrow(/Only a sent invoice/);
    await send(id);
    const [created] = await asAdmin((tx) =>
      tx.unsafe<{ days: number }[]>(
        `select extract(day from ${schema}.create_invoice_link($1, $2) - now())::int as days`,
        [id, hash(1)],
      ),
    );
    expect(created?.days).toBe(30);
    expect(await open(hash(1))).toBe(id);
    expect(await open(hash(1))).toBe(id);
    const [opens] = await sql.unsafe<{ n: string }[]>(
      `select count(*) as n from ${schema}.audit_events
       where action = 'client_link_opened' and record_id = $1 and actor_type = 'client_link'`,
      [id],
    );
    expect(Number(opens?.n)).toBe(1);

    await asAdmin((tx) => tx.unsafe(`select ${schema}.create_invoice_link($1, $2)`, [id, hash(2)]));
    expect(await open(hash(1))).toBeNull();
    expect(await open(hash(2))).toBe(id);
    expect(await open(hash(999))).toBeNull();
  });

  it("expired links and void invoices show nothing; only the server can open links", async () => {
    const id = await draft({}, [{ description: "Expiry test", unit_amount_minor: 5000 }]);
    await send(id);
    await asAdmin((tx) => tx.unsafe(`select ${schema}.create_invoice_link($1, $2)`, [id, hash(3)]));
    await sql.unsafe(
      `update ${schema}.invoice_links set expires_at = now() - interval '1 minute' where invoice_id = $1`,
      [id],
    );
    expect(await open(hash(3))).toBeNull();
    await asAdmin((tx) => tx.unsafe(`select ${schema}.create_invoice_link($1, $2)`, [id, hash(4)]));
    expect(await open(hash(4))).toBe(id);
    await asAdmin((tx) => tx.unsafe(`select ${schema}.void_invoice($1, 'Sent twice')`, [id]));
    expect(await open(hash(4))).toBeNull();
    await expect(
      asAdmin((tx) => tx.unsafe(`select ${schema}.open_invoice_link($1)`, [hash(4)])),
    ).rejects.toThrow(/permission denied/);
    const leaked = await sql.unsafe(
      `select seq from ${schema}.audit_events where table_name = 'invoice_links'
       and (after ? 'token_hash' or before ? 'token_hash')`,
    );
    expect(leaked).toHaveLength(0);
  });
});

describe("access", () => {
  it("only verified admins see invoices; the activity log stays verifiable", async () => {
    const unverified = { userId: admin.userId, sessionId: randomUUID() };
    expect(
      await runAs(sql, unverified, (tx) => tx.unsafe(`select id from ${schema}.invoices`)),
    ).toHaveLength(0);
    await expect(
      runAs(sql, unverified, (tx) =>
        tx.unsafe(`select ${schema}.save_invoice_draft(null, $1::jsonb)`, [
          {
            client_id: clientId,
            currency: "USD",
            lines: [{ description: "x", unit_amount_minor: 1 }],
          } as never,
        ]),
      ),
    ).rejects.toThrow(/cannot record billing/);
    expect((await verifyActivityLog(sql, schema)).ok).toBe(true);
  });
});
