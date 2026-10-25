// Public demos (SPEC.md 11.3-11.5): seed volumes, sample records protected from
// visitors, settings and users locked, rate limits, demo passwords kept, and the
// reset wiping visitors' records. Uses the real demo schema names on the local stack.
import { DEMO_PASSWORD, DEMOS } from "@corex/core/demo";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetDemo } from "../src/demo/reset.ts";
import { supabaseAdmin } from "../src/supabase-admin.ts";
import { asUser, localKeys, testDb } from "./helpers.ts";

const sql = testDb();
const keys = localKeys();
const admin = supabaseAdmin({ url: keys.apiUrl, serviceRoleKey: keys.serviceRoleKey });
const c = DEMOS.college.schema;
const h = DEMOS.highschool.schema;
const users: Record<string, string> = {};

async function count(query: string, params: unknown[] = []): Promise<number> {
  const [row] = await sql.unsafe<{ n: string }[]>(
    `select count(*)::text as n from ${query}`,
    params as never[],
  );
  return Number(row?.n ?? 0);
}

async function one<T>(query: string, params: unknown[] = []): Promise<T> {
  const [row] = await sql.unsafe<T[]>(query, params as never[]);
  if (!row) throw new Error(`no row: ${query}`);
  return row;
}

beforeAll(async () => {
  await resetDemo(sql, admin, "college", { exposeLocally: true });
  for (const a of DEMOS.college.accounts) {
    users[a.slug] = (
      await one<{ id: string }>(`select id from auth.users where email = $1`, [a.email])
    ).id;
  }
}, 120_000);

afterAll(async () => {
  await sql.end();
});

describe("college demo seed", () => {
  it("has the sizes SPEC.md 11.4 asks for, all marked as sample records", async () => {
    expect(await count(`${c}.departments`)).toBe(3);
    expect(await count(`${c}.programs`)).toBe(4);
    expect(await count(`${c}.courses`)).toBe(40);
    expect(await count(`${c}.course_prerequisites`)).toBeGreaterThan(15);
    expect(await count(`${c}.academic_years`)).toBe(2);
    expect(await count(`${c}.terms`)).toBe(4);
    expect(await count(`${c}.students`)).toBe(300);
    expect(await count(`${c}.students where not is_seed`)).toBe(0);
    expect(await count(`${c}.final_grades where status = 'locked'`)).toBeGreaterThan(500);
    expect(await count(`${c}.course_registrations where status = 'submitted'`)).toBeGreaterThan(0);
    expect(await count(`${c}.audit_events`)).toBe(0);
    const states = await sql.unsafe<{ status: string; currency: string }[]>(
      `select distinct status, currency from ${c}.invoices`,
    );
    for (const status of ["issued", "partially_paid", "paid"]) {
      for (const currency of ["USD", "LRD"]) {
        expect(states).toContainEqual({ status, currency });
      }
    }
  });

  it("links the demo student and gives every published role a membership", async () => {
    const student = await one<{ first_name: string }>(
      `select first_name from ${c}.students where user_id = $1`,
      [users.student],
    );
    expect(student.first_name).toBe("Ama");
    expect(await count(`${c}.memberships`)).toBe(
      DEMOS.college.accounts.length + DEMOS.college.staff.length,
    );
  });

  it("is the same data on every run", async () => {
    const names = () =>
      sql.unsafe<{ n: string }[]>(
        `select first_name || ' ' || last_name as n from ${c}.students order by student_number`,
      );
    const before = (await names()).map((r) => r.n);
    await resetDemo(sql, admin, "college");
    expect((await names()).map((r) => r.n)).toEqual(before);
  }, 60_000);
});

describe("sample records", () => {
  it("cannot be edited or deleted by a visitor", async () => {
    const seed = await one<{ id: string }>(`select id from ${c}.students limit 1`);
    await expect(
      asUser(sql, users.registrar ?? "", (tx) =>
        tx.unsafe(`update ${c}.students set phone = '+231 770 999 999' where id = $1`, [seed.id]),
      ),
    ).rejects.toThrow(/sample records/);
  });

  it("lets a visitor create and edit their own records, never marked as samples", async () => {
    const id = await asUser(sql, users.registrar ?? "", async (tx) => {
      const [row] = await tx.unsafe<{ id: string; is_seed: boolean }[]>(
        `insert into ${c}.students (student_number, first_name, last_name, is_seed)
         values ('', 'Visitor', 'Record', true) returning id, is_seed`,
      );
      expect(row?.is_seed).toBe(false);
      await tx.unsafe(`update ${c}.students set phone = '+231 770 000 001' where id = $1`, [
        row?.id ?? "",
      ]);
      return row?.id;
    });
    expect(await count(`${c}.students where id = $1 and phone is not null`, [id])).toBe(1);
  });

  it("can be moved along by workflows but not voided", async () => {
    const invoice = await one<{ id: string; currency: string }>(
      `select id, currency from ${c}.invoices where status = 'issued' limit 1`,
    );
    await asUser(sql, users.bursar ?? "", (tx) =>
      tx.unsafe(`select * from ${c}.record_payment(gen_random_uuid(), $1, 100, $2, 'cash')`, [
        invoice.id,
        invoice.currency,
      ]),
    );
    const payment = await one<{ id: string }>(
      `select id from ${c}.payments where status = 'posted' and is_seed limit 1`,
    );
    await expect(
      asUser(sql, users.bursar ?? "", (tx) =>
        tx.unsafe(`select ${c}.void_payment($1, 'Entered twice')`, [payment.id]),
      ),
    ).rejects.toThrow(/sample records/);

    const submitted = await one<{ id: string }>(
      `select id from ${c}.course_registrations where status = 'submitted' limit 1`,
    );
    await asUser(sql, users.registrar ?? "", (tx) =>
      tx.unsafe(`select ${c}.decide_registration($1, true)`, [submitted.id]),
    );
    expect(
      await count(`${c}.course_registrations where id = $1 and status = 'approved'`, [
        submitted.id,
      ]),
    ).toBe(1);
  });

  it("keeps published grades from being reopened", async () => {
    const offering = await one<{ offering_id: string }>(
      `select offering_id from ${c}.final_grades where status = 'locked' limit 1`,
    );
    await expect(
      asUser(sql, users.registrar ?? "", (tx) =>
        tx.unsafe(`select ${c}.reopen_grades($1, 'Marking error')`, [offering.offering_id]),
      ),
    ).rejects.toThrow(/sample records/);
  });
});

describe("demo restrictions", () => {
  it("locks settings and memberships against visitors", async () => {
    await expect(
      asUser(sql, users.admin ?? "", (tx) =>
        tx.unsafe(`update ${c}.settings set org_name = 'Changed'`),
      ),
    ).rejects.toThrow(/cannot change settings/);
    await expect(
      asUser(sql, users.admin ?? "", (tx) =>
        tx.unsafe(`update ${c}.memberships set status = 'suspended' where user_id = $1`, [
          users.student ?? "",
        ]),
      ),
    ).rejects.toThrow(/cannot change users or roles/);
  });

  it("counts logins per key and writes per user", async () => {
    const key = `login:test-${Date.now()}`;
    const results: boolean[] = [];
    for (let i = 0; i < 11; i++) {
      const [row] = await sql.unsafe<{ ok: boolean }[]>(
        `select ${c}.demo_rate_hit($1, 10, 900) as ok`,
        [key],
      );
      results.push(Boolean(row?.ok));
    }
    expect(results.slice(0, 10).every(Boolean)).toBe(true);
    expect(results[10]).toBe(false);

    const writes = await asUser(sql, users.instructor ?? "", async (tx) => {
      const out: boolean[] = [];
      for (let i = 0; i < 61; i++) {
        const [row] = await tx.unsafe<{ ok: boolean }[]>(`select ${c}.demo_write_allowed() as ok`);
        out.push(Boolean(row?.ok));
      }
      return out;
    });
    expect(writes.filter(Boolean)).toHaveLength(60);
    expect(writes.at(-1)).toBe(false);
  });

  it("keeps the published password when a visitor tries to change it", async () => {
    const email = DEMOS.college.accounts.find((a) => a.slug === "student")?.email ?? "";
    const client = createClient(keys.apiUrl, keys.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const signIn = await client.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
    expect(signIn.error).toBeNull();
    await client.auth.updateUser({ password: "Changed@2026" });
    await client.auth.signOut();
    const again = await client.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
    expect(again.error).toBeNull();
  });

  it("wipes visitors' records at the reset", async () => {
    await asUser(sql, users.registrar ?? "", (tx) =>
      tx.unsafe(
        `insert into ${c}.students (student_number, first_name, last_name) values ('', 'Temporary', 'Visitor')`,
      ),
    );
    await resetDemo(sql, admin, "college");
    expect(await count(`${c}.students where not is_seed`)).toBe(0);
    expect(await count(`${c}.students`)).toBe(300);
  }, 60_000);
});

describe("high school demo seed", () => {
  it("has the sizes SPEC.md 11.4 asks for", async () => {
    await resetDemo(sql, admin, "highschool", { exposeLocally: true });
    expect(await count(`${h}.grade_levels`)).toBe(6);
    expect(await count(`${h}.sections`)).toBe(12);
    expect(await count(`${h}.subjects`)).toBe(12);
    expect(await count(`${h}.students`)).toBe(360);
    expect(await count(`${h}.student_guardians`)).toBeGreaterThanOrEqual(360);
    expect(await count(`(select distinct date from ${h}.attendance) d`)).toBe(60);
    expect(await count(`${h}.period_scores where status = 'locked'`)).toBeGreaterThan(10_000);
    const parent = DEMOS.highschool.accounts.find((a) => a.slug === "parent")?.email ?? "";
    expect(
      await count(
        `${h}.student_guardians sg join ${h}.guardians g on g.id = sg.guardian_id
         join auth.users u on u.id = g.user_id where u.email = $1`,
        [parent],
      ),
    ).toBe(2);
  }, 120_000);
});

describe("finance demo seed", () => {
  const f = DEMOS.finance.schema;

  it("has the sizes SPEC.md 11.4 asks for", async () => {
    await resetDemo(sql, admin, "finance", { exposeLocally: true });
    expect(await count(`${f}.accounts`)).toBe(3);
    expect(await count(`(select distinct currency from ${f}.accounts) c`)).toBe(2);
    expect(await count(`${f}.counterparties`)).toBe(25);
    expect(await count(`${f}.invoices`)).toBe(30);
    expect(await count(`${f}.employees`)).toBe(12);
    expect(await count(`${f}.payroll_runs where status = 'paid'`)).toBe(12);
    expect(
      await count(`(select distinct date_trunc('month', date) from ${f}.transactions) m`),
    ).toBe(18);
    expect(await count(`${f}.transactions where not is_seed`)).toBe(0);
    const negative = await count(`${f}.account_balances where balance_minor < 0`);
    expect(negative).toBe(0);
  }, 120_000);

  it("keeps sample entries from being voided by visitors", async () => {
    const accountant = (
      await one<{ id: string }>(`select id from auth.users where email = $1`, [
        DEMOS.finance.accounts.find((a) => a.slug === "accountant")?.email,
      ])
    ).id;
    const entry = await one<{ id: string }>(
      `select id from ${f}.transactions where status = 'posted' and invoice_payment_id is null limit 1`,
    );
    await expect(
      asUser(sql, accountant, (tx) =>
        tx.unsafe(`select ${f}.void_transaction($1, 'Mistake')`, [entry.id]),
      ),
    ).rejects.toThrow(/sample records/);
  });
});

describe("clinic demo seed", () => {
  const k = DEMOS.clinic.schema;
  const as = async (slug: string) =>
    (
      await one<{ id: string }>(`select id from auth.users where email = $1`, [
        DEMOS.clinic.accounts.find((a) => a.slug === slug)?.email,
      ])
    ).id;

  it("has the data SPEC.md 11.4 asks for", async () => {
    await resetDemo(sql, admin, "clinic", { exposeLocally: true });
    // 400 patients plus one registered twice, flagged as a possible duplicate (CLN-08).
    expect(await count(`${k}.patients`)).toBe(401);
    expect(await count(`${k}.patients where possible_duplicate_of is not null`)).toBeGreaterThan(0);
    expect(
      await count(`(select distinct date_trunc('month', opened_at) from ${k}.encounters) m`),
    ).toBeGreaterThanOrEqual(18);
    expect(await count(`${k}.encounters`)).toBeGreaterThan(3000);
    expect(await count(`${k}.vitals`)).toBeGreaterThan(3000);
    expect(await count(`${k}.clinical_notes where signed_at is not null`)).toBeGreaterThan(3000);
    expect(await count(`${k}.clinical_notes where supersedes_id is not null`)).toBeGreaterThan(0);
    expect(
      await count(
        `${k}.appointments where status = 'booked' and starts_at > now() + interval '7 days'`,
      ),
    ).toBeGreaterThan(0);
    expect(await count(`${k}.queue_entries where status <> 'done'`)).toBeGreaterThan(3);
    expect(await count(`${k}.services`)).toBeGreaterThan(8);
    const states = await sql.unsafe<{ status: string }[]>(
      `select distinct status from ${k}.invoices`,
    );
    for (const status of ["issued", "partially_paid", "paid", "void"]) {
      expect(states).toContainEqual({ status });
    }
    // Every payment has its receipt (CLN-07).
    expect(
      await count(
        `${k}.payments p left join ${k}.receipts r on r.payment_id = p.id where r.id is null`,
      ),
    ).toBe(0);
    expect(await count(`${k}.audit_events`)).toBe(0);
    expect(await count(`${k}.memberships`)).toBe(
      DEMOS.clinic.accounts.length + DEMOS.clinic.staff.length,
    );
  }, 120_000);

  it("lets visitors register patients and take payments, but not change sample records", async () => {
    const reception = await as("reception");
    const cashier = await as("cashier");
    // Registering bumps the seeded patient number counter.
    await asUser(sql, reception, (tx) =>
      tx.unsafe(
        `insert into ${k}.patients (id, patient_number, first_name, last_name) values (gen_random_uuid(), '', 'Visitor', 'Patient')`,
      ),
    );
    const sample = await one<{ id: string }>(`select id from ${k}.patients where is_seed limit 1`);
    await expect(
      asUser(sql, reception, (tx) =>
        tx.unsafe(`update ${k}.patients set phone = '0770000000' where id = $1`, [sample.id]),
      ),
    ).rejects.toThrow(/sample records/);
    const unpaid = await one<{ id: string; currency: string }>(
      `select id, currency from ${k}.invoices where status = 'issued' and payer_type = 'self' limit 1`,
    );
    await asUser(sql, cashier, (tx) =>
      tx.unsafe(`select * from ${k}.record_payment(gen_random_uuid(), $1, 100, $2, 'cash')`, [
        unpaid.id,
        unpaid.currency,
      ]),
    );
    const posted = await one<{ id: string }>(
      `select id from ${k}.payments where is_seed and status = 'posted' limit 1`,
    );
    await expect(
      asUser(sql, cashier, (tx) =>
        tx.unsafe(`select ${k}.void_payment($1, 'Mistake')`, [posted.id]),
      ),
    ).rejects.toThrow(/sample records/);
  });
});
