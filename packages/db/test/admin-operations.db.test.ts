// Corex Admin operations (SPEC-ADMIN.md 7, 10, 11, 13): the daily job (idempotent, rules
// switched off in Settings, every run logged), subscription states, "Needs attention",
// dashboard figures, search, notifications, the price list and sample data.
import { randomUUID } from "node:crypto";
import type { TransactionSql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { verifyActivityLog } from "../src/admin/verify-log.ts";
import { migrateSchema } from "../src/migrations.ts";
import { asAdmin as runAs, asServiceRole, type TestAdmin, verifiedAdmin } from "./admin-helpers.ts";
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
const schema = uniqueSchema("ops");
const users: string[] = [];
let admin: TestAdmin;
let outsider: string;

const asAdmin = <T>(fn: (tx: TransactionSql) => Promise<T>) => runAs(sql, admin, fn);

type Figures = {
  new_leads: { count: number; not_contacted: number };
  pipeline: { open: number; stages: Record<string, number> };
  outstanding: { by_currency: Record<string, string>; overdue: number };
  collected: { by_currency: Record<string, string>; by_month: Record<string, string[]> };
};

type JobResult = {
  run_id: string;
  renewals: { invoice_id: string; sent: boolean }[];
  reminders: { reminder_id: string; invoice_id: string; stage: string }[];
  summary: Record<string, unknown>;
};

async function runJob(email = false): Promise<JobResult> {
  const [row] = await asServiceRole(sql, (tx) =>
    tx.unsafe<{ r: JobResult }[]>(`select ${schema}.daily_job($1, 'manual') as r`, [email]),
  );
  if (!row) throw new Error("job did not run");
  return row.r;
}

async function setConfig(values: Record<string, unknown>) {
  await sql.unsafe(`update ${schema}.settings set config = config || $1::jsonb`, [values as never]);
}

/** A Managed client whose renewal date is `days` from today (negative: past). */
async function managedClient(name: string, days: number | null, currency = "USD") {
  const [row] = await asAdmin((tx) =>
    tx.unsafe<{ id: string }[]>(`select ${schema}.create_client(null, $1::jsonb) as id`, [
      {
        name,
        contact_name: "Esther Dolo",
        contact_phone: "+231 88 555 0601",
        contact_email: `${name.toLowerCase().replace(/\W+/g, ".")}@example.org`,
        product: "finance",
        plan: "managed",
        total_minor: 150000,
        currency,
        signed_on: "2025-09-20",
        milestone_scheme: [50, 30, 20],
        renewal_minor: 30000,
      } as never,
    ]),
  );
  const clientId = row?.id ?? "";
  if (days !== null) {
    await sql.unsafe(
      `update ${schema}.subscriptions
       set starts_on = current_date + $2::int - 365, next_renewal_on = current_date + $2::int
       where client_id = $1`,
      [clientId, days],
    );
  }
  const [contract] = await sql.unsafe<{ id: string }[]>(
    `select id from ${schema}.contracts where client_id = $1`,
    [clientId],
  );
  return { clientId, contractId: contract?.id ?? "" };
}

async function counts() {
  const [row] = await sql.unsafe<
    { invoices: string; lines: string; reminders: string; subs: string; issued: string }[]
  >(
    `select (select count(*) from ${schema}.invoices) as invoices,
            (select count(*) from ${schema}.invoice_lines) as lines,
            (select count(*) from ${schema}.renewal_reminders) as reminders,
            (select string_agg(next_renewal_on::text, ',' order by id) from ${schema}.subscriptions) as subs,
            (select count(*) from ${schema}.invoices where status <> 'draft') as issued`,
  );
  return row;
}

beforeAll(async () => {
  await migrateSchema(sql, schema, "admin");
  admin = await verifiedAdmin(sql, keys, schema, "fatu", users);
  outsider = await createTestUser(keys, testEmail("outsider"), "Outsider-Test-2026!");
  users.push(outsider);
});

afterAll(async () => {
  await dropSchemas(sql, schema);
  await sql.unsafe(`delete from storage.buckets where id = $1`, [schema]).catch(() => undefined);
  await deleteTestUsers(keys, ...users);
  await sql.end();
});

describe("daily job (SPEC-ADMIN.md 10)", () => {
  let due: { clientId: string; contractId: string };

  it("drafts the renewal invoice 30 days before, due on the renewal date", async () => {
    due = await managedClient("Riverside Traders", 30);
    await managedClient("Kakata Community School", 31);
    await managedClient("Hope Medical Center", null);
    const result = await runJob();
    expect(result.renewals).toHaveLength(1);
    expect(result.renewals[0]?.sent).toBe(false);
    const [inv] = await sql.unsafe<
      {
        status: string;
        kind: string;
        renewal_for: string;
        expected: string;
        payment_terms_days: number;
        total_minor: string;
        details: string;
      }[]
    >(
      `select i.status, i.kind, i.renewal_for::text, (current_date + 30)::text as expected,
              i.payment_terms_days, i.total_minor, l.details
       from ${schema}.invoices i join ${schema}.invoice_lines l on l.invoice_id = i.id
       where i.contract_id = $1`,
      [due.contractId],
    );
    expect(inv).toMatchObject({ status: "draft", kind: "renewal", payment_terms_days: 30 });
    expect(inv?.renewal_for).toBe(inv?.expected);
    expect(Number(inv?.total_minor)).toBe(30000);
    expect(inv?.details).toMatch(/^Financial Management, \d+ \w{3} \d{4} to \d+ \w{3} \d{4}$/);
  });

  it("is idempotent: a second run the same day changes nothing, and both runs are logged", async () => {
    const before = await counts();
    const second = await runJob();
    expect(second.renewals).toHaveLength(0);
    expect(second.reminders).toHaveLength(0);
    expect(await counts()).toEqual(before);
    const runs = await sql.unsafe(`select summary from ${schema}.job_runs order by started_at`);
    expect(runs).toHaveLength(2);
    const logged = await sql.unsafe<{ summary: string; actor_type: string }[]>(
      `select summary, actor_type from ${schema}.audit_events where action = 'daily_job' order by seq`,
    );
    expect(logged).toHaveLength(2);
    expect(logged[0]?.summary).toBe("Daily job ran: 1 renewal invoice drafted");
    expect(logged[0]?.actor_type).toBe("system");
  });

  it("sends reminders 14 and 3 days before the due date, once each, while unpaid", async () => {
    const [inv] = await sql.unsafe<{ id: string }[]>(
      `select id from ${schema}.invoices where contract_id = $1`,
      [due.contractId],
    );
    const id = inv?.id ?? "";
    await asAdmin((tx) => tx.unsafe(`select ${schema}.issue_invoice($1)`, [id]));
    await sql.unsafe(`update ${schema}.invoices set due_date = current_date + 12 where id = $1`, [
      id,
    ]);
    const first = await runJob();
    expect(first.reminders.map((r) => r.stage)).toEqual(["14d"]);
    expect((await runJob()).reminders).toHaveLength(0);
    await sql.unsafe(`update ${schema}.invoices set due_date = current_date + 3 where id = $1`, [
      id,
    ]);
    expect((await runJob()).reminders.map((r) => r.stage)).toEqual(["3d"]);
    const rows = await sql.unsafe<{ stage: string; status: string }[]>(
      `select stage, status from ${schema}.renewal_reminders where invoice_id = $1 order by stage`,
      [id],
    );
    // Client email is off: recorded, not sent.
    expect(rows).toEqual([
      { stage: "14d", status: "skipped_disabled" },
      { stage: "3d", status: "skipped_disabled" },
    ]);
  });

  it("with client email on, sends the new renewal invoice and queues reminders", async () => {
    const soon = await managedClient("Mano River Logistics", 25);
    const result = await runJob(true);
    expect(result.renewals).toHaveLength(1);
    const [inv] = await sql.unsafe<{ id: string; status: string; display_number: string }[]>(
      `select id, status, display_number from ${schema}.invoices where contract_id = $1`,
      [soon.contractId],
    );
    expect(inv?.status).toBe("issued");
    expect(inv?.display_number).toMatch(/^CX-\d{2}-\d{2}-\d{3}$/);
    await sql.unsafe(`update ${schema}.invoices set due_date = current_date + 10 where id = $1`, [
      inv?.id ?? "",
    ]);
    const next = await runJob(true);
    expect(next.reminders).toEqual([
      expect.objectContaining({ invoice_id: inv?.id, stage: "14d" }),
    ]);
    const [rem] = await sql.unsafe<{ status: string }[]>(
      `select status from ${schema}.renewal_reminders where invoice_id = $1`,
      [inv?.id ?? ""],
    );
    expect(rem?.status).toBe("queued");
  });

  it("each rule can be switched off in Settings", async () => {
    await managedClient("Greenfield Academy", 20);
    await setConfig({ job_renewal_invoice: "false", job_reminders: "false" });
    const result = await runJob();
    expect(result.renewals).toHaveLength(0);
    expect(result.reminders).toHaveLength(0);
    await setConfig({ job_renewal_invoice: "true", job_reminders: "true" });
    expect((await runJob()).renewals).toHaveLength(1);
  });

  it("only the service role runs the job", async () => {
    await expect(
      asAdmin((tx) => tx.unsafe(`select ${schema}.daily_job(false, 'manual')`)),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("subscription states and Needs attention (SPEC-ADMIN.md 7, 10)", () => {
  let grace: { clientId: string; contractId: string };
  let pause: { clientId: string; contractId: string };

  beforeAll(async () => {
    grace = await managedClient("Bright Future NGO", -12);
    pause = await managedClient("Saint Luke's Clinic", -31);
  });

  it("works out due soon, grace and pause flag from the renewal date", async () => {
    const rows = await asAdmin((tx) =>
      tx.unsafe<{ client_name: string; state: string; days_to_renewal: number }[]>(
        `select client_name, state, days_to_renewal from ${schema}.subscription_overview()`,
      ),
    );
    const state = (name: string) => rows.find((r) => r.client_name === name)?.state;
    expect(state("Riverside Traders")).toBe("due_soon");
    expect(state("Kakata Community School")).toBe("active");
    expect(state("Hope Medical Center")).toBe("starts_at_go_live");
    expect(state("Bright Future NGO")).toBe("grace");
    expect(state("Saint Luke's Clinic")).toBe("pause_flag");
    await setConfig({ job_pause_flag: "false" });
    const off = await asAdmin((tx) =>
      tx.unsafe<{ state: string }[]>(
        `select state from ${schema}.subscription_overview() where client_id = $1`,
        [pause.clientId],
      ),
    );
    expect(off[0]?.state).toBe("grace");
    await setConfig({ job_pause_flag: "true" });
  });

  it("lists overdue invoices, pause flags, follow-ups, new leads, renewals and warranties", async () => {
    // Bright Future's renewal invoice, sent and 12 days overdue.
    const [past] = await sql.unsafe<{ d: string }[]>(`select (current_date - 12)::text as d`);
    const [inv] = await asAdmin((tx) =>
      tx.unsafe<{ id: string }[]>(`select ${schema}.save_invoice_draft(null, $1::jsonb) as id`, [
        {
          client_id: grace.clientId,
          kind: "renewal",
          contract_id: grace.contractId,
          renewal_for: past?.d,
          currency: "USD",
          lines: [{ description: "Yearly renewal", quantity: 1, unit_amount_minor: 30000 }],
        } as never,
      ]),
    );
    await asAdmin((tx) => tx.unsafe(`select ${schema}.issue_invoice($1)`, [inv?.id ?? ""]));
    await sql.unsafe(
      `update ${schema}.invoices set issue_date = current_date - 42, due_date = current_date - 12
       where id = $1`,
      [inv?.id ?? ""],
    );
    await asServiceRole(sql, (tx) =>
      tx.unsafe(
        `insert into ${schema}.leads (name, organization, country, product, phone, message, consent)
         values ('Musu Kollie', 'Greenfield Academy', 'Liberia', 'school-highschool', '+231 77 555 0101', 'Report cards.', true),
                ('Comfort Pewee', 'Saint Luke''s Clinic', 'Liberia', 'clinic', '+231 77 555 0303', 'Two doctors.', true)`,
      ),
    );
    await sql.unsafe(
      `update ${schema}.leads set stage = 'contacted', follow_up_on = current_date + 1, next_step = 'Call'
       where organization = 'Saint Luke''s Clinic'`,
    );
    const handover = await asAdmin((tx) =>
      tx.unsafe<{ id: string }[]>(`select ${schema}.create_client(null, $1::jsonb) as id`, [
        {
          name: "Lakeside Institute",
          contact_name: "Daniel Kpoto",
          contact_phone: "+231 88 555 0604",
          product: "school_college",
          plan: "handover",
          total_minor: 400000,
          currency: "USD",
          signed_on: "2026-08-12",
          milestone_scheme: [50, 30, 20],
        } as never,
      ]),
    );
    await sql.unsafe(
      `update ${schema}.deployments set environment = 'live', went_live_on = current_date - 18
       where client_id = $1`,
      [handover[0]?.id ?? ""],
    );

    const items = await asAdmin((tx) =>
      tx.unsafe<{ kind: string; title: string; detail: string; href: string }[]>(
        `select kind, title, detail, href from ${schema}.attention_items()`,
      ),
    );
    const kinds = items.map((i) => i.kind);
    expect(kinds.indexOf("overdue")).toBeLessThan(kinds.indexOf("warranty"));
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "overdue",
          title: "Bright Future NGO: renewal 12 days overdue",
          href: `/invoices/${inv?.id}`,
        }),
        expect.objectContaining({ kind: "pause_flag", href: `/clients/${pause.clientId}` }),
        expect.objectContaining({
          kind: "follow_up",
          title: "Call: Comfort Pewee, Saint Luke's Clinic",
        }),
        expect.objectContaining({ kind: "new_leads", title: "1 new lead not contacted yet" }),
        expect.objectContaining({ kind: "renewal", title: "Riverside Traders renews in 30 days" }),
        expect.objectContaining({
          kind: "warranty",
          detail: "Handover plan · offer a paid support plan",
        }),
      ]),
    );
    expect(items.find((i) => i.kind === "overdue")?.detail).toMatch(
      /US\$300\.00 · pause flag on \d+ \w{3}/,
    );
    // Bright Future is covered by its overdue invoice, not listed twice.
    expect(items.filter((i) => i.title.startsWith("Bright Future"))).toHaveLength(1);
  });

  it("is visible only to a verified admin", async () => {
    const rows = await asUser(sql, outsider, (tx) =>
      tx.unsafe(`select * from ${schema}.attention_items()`),
    );
    expect(rows).toHaveLength(0);
  });
});

describe("dashboard figures (SPEC-ADMIN.md 7)", () => {
  it("counts leads, pipeline, outstanding per currency and collections per month", async () => {
    // A paid USD invoice and a part-paid LRD one.
    const lrd = await managedClient("Kakata Traders", 200, "LRD");
    const paidUsd = async () => {
      const [row] = await sql.unsafe<{ id: string }[]>(
        `select id from ${schema}.invoices where display_number is not null and currency = 'USD'
         and status = 'issued' order by display_number limit 1`,
      );
      return row?.id ?? "";
    };
    const usdId = await paidUsd();
    await asAdmin((tx) =>
      tx.unsafe(
        `select * from ${schema}.record_payment($1, $2, 30000, 'USD', 'orange_money', 'OM-1')`,
        [randomUUID(), usdId],
      ),
    );
    const [draft] = await asAdmin((tx) =>
      tx.unsafe<{ id: string }[]>(`select ${schema}.save_invoice_draft(null, $1::jsonb) as id`, [
        {
          client_id: lrd.clientId,
          currency: "LRD",
          kind: "custom",
          lines: [{ description: "Training", quantity: 1, unit_amount_minor: 4500000 }],
        } as never,
      ]),
    );
    await asAdmin((tx) => tx.unsafe(`select ${schema}.issue_invoice($1)`, [draft?.id ?? ""]));
    await asAdmin((tx) =>
      tx.unsafe(`select * from ${schema}.record_payment($1, $2, 1000000, 'LRD', 'cash', null)`, [
        randomUUID(),
        draft?.id ?? "",
      ]),
    );

    const expected = await sql.unsafe<{ currency: string; balance: string }[]>(
      `select i.currency, sum(i.total_minor - b.paid_minor)::text as balance
       from ${schema}.invoices i join ${schema}.invoice_balances b on b.invoice_id = i.id
       where i.status in ('issued', 'partially_paid') group by i.currency order by 1`,
    );
    const [row] = await asAdmin((tx) =>
      tx.unsafe<{ f: Figures }[]>(`select ${schema}.dashboard_figures() as f`),
    );
    const f = row?.f;
    if (!f) throw new Error("no figures");
    expect(f.new_leads).toEqual({ count: 2, not_contacted: 1 });
    expect(f.pipeline.open).toBe(2);
    expect(f.pipeline.stages).toMatchObject({ new: 1, contacted: 1, won: 0, lost: 0 });
    expect(f.outstanding.by_currency).toEqual(
      Object.fromEntries(expected.map((e) => [e.currency, e.balance])),
    );
    expect(f.outstanding.by_currency.LRD).toBe("3500000");
    expect(f.outstanding.overdue).toBeGreaterThanOrEqual(1);
    expect(f.collected.by_currency).toEqual({ USD: "30000", LRD: "1000000" });
    const month = new Date().getUTCMonth();
    expect(f.collected.by_month.USD).toHaveLength(12);
    expect(f.collected.by_month.USD?.[month]).toBe("30000");
    expect(f.collected.by_month.LRD?.[month]).toBe("1000000");
  });
});

describe("search and notifications (SPEC-ADMIN.md 11)", () => {
  const search = (q: string) =>
    asAdmin((tx) =>
      tx.unsafe<{ kind: string; title: string; href: string }[]>(
        `select kind, title, href from ${schema}.admin_search($1)`,
        [q],
      ),
    );

  it("finds leads by name, organization, phone or email; clients; invoices and receipts", async () => {
    expect((await search("musu")).map((r) => r.kind)).toEqual(["lead"]);
    expect((await search("077 555 0101"))[0]?.title).toBe("Musu Kollie, Greenfield Academy");
    expect((await search("bright future")).map((r) => r.kind)).toEqual(["client"]);
    const [inv] = await sql.unsafe<{ display_number: string }[]>(
      `select display_number from ${schema}.invoices where display_number is not null limit 1`,
    );
    expect((await search(inv?.display_number ?? "")).some((r) => r.kind === "invoice")).toBe(true);
    expect((await search("RC-")).every((r) => r.kind === "receipt")).toBe(true);
    expect(await search("%")).toEqual([]);
    expect(await search("x")).toEqual([]);
  });

  it("finds nothing for someone who is not a verified admin", async () => {
    const rows = await asUser(sql, outsider, (tx) =>
      tx.unsafe(`select * from ${schema}.admin_search('musu')`),
    );
    expect(rows).toHaveLength(0);
  });

  it("remembers when an admin last opened the notifications", async () => {
    const [row] = await asAdmin((tx) =>
      tx.unsafe<{ t: Date }[]>(`select ${schema}.mark_notifications_seen() as t`),
    );
    const [seen] = await asAdmin((tx) =>
      tx.unsafe<{ seen_at: Date }[]>(`select seen_at from ${schema}.admin_notification_state`),
    );
    expect(seen?.seen_at.getTime()).toBe(row?.t.getTime());
    await expect(
      asUser(sql, outsider, (tx) => tx.unsafe(`select ${schema}.mark_notifications_seen()`)),
    ).rejects.toThrow(/Sign in again/);
  });
});

describe("price list (Settings → Price list)", () => {
  it("admins add and change items; nobody else sees them", async () => {
    await asAdmin((tx) =>
      tx.unsafe(
        `insert into ${schema}.price_list_items (name, kind, managed_year1_minor, renewal_minor, handover_minor)
         values ('Clinic Management', 'product', 250000, 60000, 350000)`,
      ),
    );
    await expect(
      asAdmin((tx) =>
        tx.unsafe(
          `insert into ${schema}.price_list_items (name, kind) values ('No price', 'addon')`,
        ),
      ),
    ).rejects.toThrow(/price_list_items_has_price/);
    const hidden = await asUser(sql, outsider, (tx) =>
      tx.unsafe(`select * from ${schema}.price_list_items`),
    );
    expect(hidden).toHaveLength(0);
  });
});

describe("sample data (SPEC-ADMIN.md 13)", () => {
  async function seedSample() {
    await sql.begin(async (tx) => {
      await tx`select set_config('corex.sample', 'on', true)`;
      const [c] = await tx.unsafe<{ id: string }[]>(
        `select ${schema}.create_client(null, $1::jsonb) as id`,
        [
          {
            name: "Sample Academy",
            contact_name: "Sample Person",
            contact_phone: "+231 77 000 0000",
            product: "school_highschool",
            plan: "managed",
            total_minor: 180000,
            currency: "USD",
            signed_on: "2026-01-10",
            milestone_scheme: [50, 30, 20],
            renewal_minor: 45000,
          } as never,
        ],
      );
      const [contract] = await tx.unsafe<{ id: string }[]>(
        `select id from ${schema}.contracts where client_id = $1`,
        [c?.id ?? ""],
      );
      const [inv] = await tx.unsafe<{ id: string }[]>(
        `select ${schema}.save_invoice_draft(null, $1::jsonb) as id`,
        [
          {
            client_id: c?.id,
            kind: "milestone",
            contract_id: contract?.id,
            milestone_no: 1,
            currency: "USD",
            lines: [{ description: "Milestone 1", quantity: 1, unit_amount_minor: 90000 }],
          } as never,
        ],
      );
      await tx.unsafe(`select ${schema}.issue_invoice($1)`, [inv?.id ?? ""]);
      await tx.unsafe(
        `select * from ${schema}.record_payment(gen_random_uuid(), $1, 40000, 'USD', 'cash', null)`,
        [inv?.id ?? ""],
      );
      await tx.unsafe(
        `insert into ${schema}.leads (name, organization, phone, source) values ('Sample Lead', 'Sample Org', '+231 77 000 0001', 'manual')`,
      );
      await tx.unsafe(
        `insert into ${schema}.price_list_items (name, managed_year1_minor) values ('Sample item', 1000)`,
      );
    });
  }

  it("marks every row written while seeding, and the mark cannot be changed", async () => {
    await seedSample();
    const [row] = await sql.unsafe<Record<string, string>[]>(
      `select (select count(*) from ${schema}.clients where is_sample) as clients,
              (select count(*) from ${schema}.contracts where is_sample) as contracts,
              (select count(*) from ${schema}.invoices where is_sample) as invoices,
              (select count(*) from ${schema}.payments where is_sample) as payments,
              (select count(*) from ${schema}.receipts where is_sample) as receipts,
              (select count(*) from ${schema}.clients where not is_sample) as real_clients`,
    );
    expect(row).toMatchObject({
      clients: "1",
      contracts: "1",
      invoices: "1",
      payments: "1",
      receipts: "1",
    });
    expect(Number(row?.real_clients)).toBeGreaterThan(5);
    await asAdmin((tx) =>
      tx.unsafe(`update ${schema}.clients set is_sample = true where name = 'Riverside Traders'`),
    );
    const [riverside] = await sql.unsafe<{ is_sample: boolean }[]>(
      `select is_sample from ${schema}.clients where name = 'Riverside Traders'`,
    );
    expect(riverside?.is_sample).toBe(false);
    const [has] = await asAdmin((tx) =>
      tx.unsafe<{ has: boolean }[]>(`select ${schema}.has_sample_data() as has`),
    );
    expect(has?.has).toBe(true);
  });

  it("is refused while a real record uses it, then removes only sample rows", async () => {
    const [sample] = await sql.unsafe<{ id: string }[]>(
      `select id from ${schema}.clients where is_sample`,
    );
    const [real] = await asAdmin((tx) =>
      tx.unsafe<{ id: string }[]>(`select ${schema}.save_invoice_draft(null, $1::jsonb) as id`, [
        {
          client_id: sample?.id,
          currency: "USD",
          kind: "custom",
          lines: [{ description: "Real work", quantity: 1, unit_amount_minor: 100 }],
        } as never,
      ]),
    );
    await expect(sql.unsafe(`select ${schema}.remove_sample_data()`)).rejects.toThrow(
      /records of your own use sample data/,
    );
    expect((await sql.unsafe(`select 1 from ${schema}.clients where is_sample`)).length).toBe(1);
    await asAdmin((tx) => tx.unsafe(`select ${schema}.delete_invoice_draft($1)`, [real?.id ?? ""]));

    const before = await counts();
    const [result] = await sql.unsafe<{ r: Record<string, number> }[]>(
      `select ${schema}.remove_sample_data() as r`,
    );
    expect(result?.r).toMatchObject({
      clients: 1,
      invoices: 1,
      payments: 1,
      receipts: 1,
      leads: 1,
    });
    const after = await counts();
    expect(Number(after?.invoices)).toBe(Number(before?.invoices) - 1);
    const [left] = await sql.unsafe<{ n: string }[]>(
      `select (select count(*) from ${schema}.clients where is_sample)
            + (select count(*) from ${schema}.leads where is_sample)
            + (select count(*) from ${schema}.price_list_items where is_sample) as n`,
    );
    expect(left?.n).toBe("0");
  });

  it("keeps the guards for real rows and is not callable from the app", async () => {
    await expect(sql.unsafe(`delete from ${schema}.payments`)).rejects.toThrow(/never deleted/);
    await expect(
      asServiceRole(sql, (tx) => tx.unsafe(`select ${schema}.remove_sample_data()`)),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("activity log", () => {
  it("still verifies after the job, sample data and its removal", async () => {
    expect((await verifyActivityLog(sql, schema)).ok).toBe(true);
  });
});
