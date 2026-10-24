// Clinic Management (SPEC.md 8.3): CLN-01 to CLN-08, the visit workflow and bills.
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { TransactionSql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateSchema } from "../src/migrations.ts";
import { exposeSchemaLocally } from "../src/provision.ts";
import {
  asUser,
  createTestUser,
  deleteTestUsers,
  dropSchemas,
  localKeys,
  testDb,
  testEmail,
  uniqueSchema,
  unexposeSchemasLocally,
} from "./helpers.ts";

const sql = testDb();
const keys = localKeys();
const s = uniqueSchema("clinic");
const PASSWORD = "Test@2026pass";

type Role = "admin" | "clinician" | "clinician2" | "nurse" | "receptionist" | "cashier";
const users = {} as Record<Role, string>;
const emails = {} as Record<Role, string>;
const ids = {} as Record<"patient" | "appointment" | "queue" | "encounter" | "note", string>;

async function one<T>(tx: TransactionSql | typeof sql, query: string, params: unknown[] = []) {
  const [row] = await tx.unsafe<T[]>(query, params as never[]);
  if (!row) throw new Error(`no row: ${query}`);
  return row;
}

function register(
  tx: TransactionSql,
  p: { first: string; last: string; dob?: string; phone?: string },
) {
  return one<{ id: string; patient_number: string; possible_duplicate_of: string | null }>(
    tx,
    `insert into ${s}.patients (id, patient_number, first_name, last_name, date_of_birth, phone)
     values ($1, '', $2, $3, $4, $5) returning id, patient_number, possible_duplicate_of`,
    [randomUUID(), p.first, p.last, p.dob ?? null, p.phone ?? null],
  );
}

function book(tx: TransactionSql, clinician: string, startsAt: string, minutes = 30) {
  return one<{ id: string }>(
    tx,
    `insert into ${s}.appointments (patient_id, clinician_id, starts_at, duration_minutes, reason)
     values ($1, $2, $3, $4, 'Follow-up') returning id`,
    [ids.patient, clinician, startsAt, minutes],
  );
}

beforeAll(async () => {
  await migrateSchema(sql, s, "clinic");
  await sql.unsafe(`insert into ${s}.settings (org_name) values ('Test Clinic')`);
  for (const role of [
    "admin",
    "clinician",
    "clinician2",
    "nurse",
    "receptionist",
    "cashier",
  ] as const) {
    emails[role] = testEmail(`clinic-${role}`);
    users[role] = await createTestUser(keys, emails[role], PASSWORD);
    await sql.unsafe(
      `insert into ${s}.memberships (user_id, role, display_name) values ($1, $2, $3)`,
      [users[role], role === "clinician2" ? "clinician" : role, role],
    );
  }
  await sql.unsafe(
    `insert into ${s}.services (name, code, price_minor, currency) values
     ('Consultation', 'CONS', 1500, 'USD'), ('Malaria test', 'MRDT', 500, 'USD')`,
  );
});

afterAll(async () => {
  await unexposeSchemasLocally(sql, s);
  await dropSchemas(sql, s);
  await deleteTestUsers(keys, ...Object.values(users));
  await sql.end();
});

describe("CLN-08 registration", () => {
  it("numbers patients and flags possible duplicates by name and birth date or phone", async () => {
    const first = await asUser(sql, users.receptionist, (tx) =>
      register(tx, { first: "Musu", last: "Kollie", dob: "1990-04-02", phone: "+231 770 123 456" }),
    );
    ids.patient = first.id;
    expect(first.patient_number).toMatch(/^PT-\d{4}-00001$/);
    expect(first.possible_duplicate_of).toBeNull();
    const sameName = await asUser(sql, users.receptionist, (tx) =>
      register(tx, { first: "musu ", last: "KOLLIE", dob: "1990-04-02" }),
    );
    expect(sameName.possible_duplicate_of).toBe(first.id);
    const samePhone = await asUser(sql, users.receptionist, (tx) =>
      register(tx, { first: "Hawa", last: "Doe", phone: "0770123456" }),
    );
    expect(samePhone.possible_duplicate_of).toBe(first.id);
    const other = await asUser(sql, users.receptionist, (tx) =>
      register(tx, { first: "Hawa", last: "Doe", dob: "1985-01-01", phone: "0886 000 111" }),
    );
    expect(other.possible_duplicate_of).toBeNull();
  });
});

describe("CLN-04 and CLN-05 appointments", () => {
  it("blocks double-booking a clinician with a clear message", async () => {
    ids.appointment = (
      await asUser(sql, users.receptionist, (tx) =>
        book(tx, users.clinician, "2026-11-02T09:00:00Z"),
      )
    ).id;
    await expect(
      asUser(sql, users.receptionist, (tx) => book(tx, users.clinician, "2026-11-02T09:15:00Z")),
    ).rejects.toThrow(/already has an appointment from 09:00 to 09:30/);
    // Another clinician, and the next slot, are free.
    await asUser(sql, users.receptionist, (tx) =>
      book(tx, users.clinician2, "2026-11-02T09:15:00Z"),
    );
    await asUser(sql, users.receptionist, (tx) =>
      book(tx, users.clinician, "2026-11-02T09:30:00Z"),
    );
  });

  it("allows only one of two simultaneous bookings for the same slot", async () => {
    const results = await Promise.allSettled([
      asUser(sql, users.receptionist, (tx) => book(tx, users.clinician, "2026-11-03T10:00:00Z")),
      asUser(sql, users.receptionist, (tx) => book(tx, users.clinician, "2026-11-03T10:10:00Z")),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("keeps cancelled appointments, with their reason, and frees the slot", async () => {
    const appt = await asUser(sql, users.receptionist, (tx) =>
      book(tx, users.clinician2, "2026-11-04T08:00:00Z"),
    );
    await expect(
      asUser(sql, users.receptionist, (tx) =>
        tx.unsafe(`update ${s}.appointments set status = 'cancelled' where id = $1`, [appt.id]),
      ),
    ).rejects.toThrow(/check constraint/);
    await asUser(sql, users.receptionist, (tx) =>
      tx.unsafe(
        `update ${s}.appointments set status = 'cancelled', cancel_reason = 'Patient travelled' where id = $1`,
        [appt.id],
      ),
    );
    await expect(
      sql.unsafe(`delete from ${s}.appointments where id = $1`, [appt.id]),
    ).rejects.toThrow(/never deleted/);
    await asUser(sql, users.receptionist, (tx) =>
      book(tx, users.clinician2, "2026-11-04T08:00:00Z"),
    );
  });
});

describe("visit workflow and CLN-03 notes", () => {
  it("checks in, records intake vitals and opens the visit", async () => {
    ids.queue = await asUser(
      sql,
      users.receptionist,
      async (tx) =>
        (await one<{ id: string }>(tx, `select ${s}.check_in($1) as id`, [ids.appointment])).id,
    );
    await asUser(sql, users.nurse, (tx) =>
      tx.unsafe(
        `insert into ${s}.vitals (id, patient_id, temperature_c, pulse_bpm, bp_systolic, bp_diastolic, recorded_by)
         values ($1, $2, 38.4, 96, 128, 82, $3)`,
        [randomUUID(), ids.patient, users.nurse],
      ),
    );
    ids.encounter = await asUser(
      sql,
      users.clinician,
      async (tx) =>
        (await one<{ id: string }>(tx, `select ${s}.start_encounter($1) as id`, [ids.queue])).id,
    );
    expect(
      (
        await one<{ n: string }>(
          sql,
          `select count(*)::text as n from ${s}.vitals where encounter_id = $1`,
          [ids.encounter],
        )
      ).n,
    ).toBe("1");
  });

  it("never edits a signed note; a correction is a new version", async () => {
    ids.note = await asUser(
      sql,
      users.clinician,
      async (tx) =>
        (
          await one<{ id: string }>(
            tx,
            `insert into ${s}.clinical_notes (encounter_id, complaints, assessment, plan)
           values ($1, 'Fever for two days', 'Malaria, uncomplicated', 'ACT for three days') returning id`,
            [ids.encounter],
          )
        ).id,
    );
    await asUser(sql, users.clinician, (tx) => tx.unsafe(`select ${s}.sign_note($1)`, [ids.note]));
    // Through the API a signed note is simply not editable: no row changes.
    const updated = await asUser(sql, users.clinician, (tx) =>
      tx.unsafe(
        `update ${s}.clinical_notes set assessment = 'Typhoid' where id = $1 returning id`,
        [ids.note],
      ),
    );
    expect(updated).toHaveLength(0);
    await expect(
      sql.unsafe(`update ${s}.clinical_notes set assessment = 'x' where id = $1`, [ids.note]),
    ).rejects.toThrow(/Signed notes cannot be edited/);
    const correction = await asUser(sql, users.clinician, async (tx) => {
      const id = (await one<{ id: string }>(tx, `select ${s}.amend_note($1) as id`, [ids.note])).id;
      await tx.unsafe(
        `update ${s}.clinical_notes set assessment = 'Malaria, confirmed by test' where id = $1`,
        [id],
      );
      await tx.unsafe(`select ${s}.sign_note($1)`, [id]);
      return id;
    });
    const history = await sql.unsafe<
      { version: number; supersedes_id: string | null; assessment: string }[]
    >(
      `select version, supersedes_id, assessment from ${s}.clinical_notes where encounter_id = $1 order by version`,
      [ids.encounter],
    );
    expect(history).toEqual([
      { version: 1, supersedes_id: null, assessment: "Malaria, uncomplicated" },
      { version: 2, supersedes_id: ids.note, assessment: "Malaria, confirmed by test" },
    ]);
    expect(correction).not.toBe(ids.note);
  });

  it("lets only the clinician write notes and closes the visit", async () => {
    await expect(
      asUser(sql, users.nurse, (tx) =>
        tx.unsafe(
          `insert into ${s}.clinical_notes (encounter_id, assessment, author_id) values ($1, 'x', $2)`,
          [ids.encounter, users.nurse],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
    await asUser(sql, users.clinician, (tx) =>
      tx.unsafe(`select ${s}.close_encounter($1)`, [ids.encounter]),
    );
    const appt = await one<{ status: string }>(
      sql,
      `select status from ${s}.appointments where id = $1`,
      [ids.appointment],
    );
    expect(appt.status).toBe("completed");
  });
});

describe("CLN-01 clinical privacy", () => {
  it.each(["receptionist", "cashier", "admin"] as const)(
    "gives the %s no notes or vitals",
    async (role) => {
      await asUser(sql, users[role], async (tx) => {
        expect(await tx.unsafe(`select 1 from ${s}.clinical_notes`)).toHaveLength(0);
        expect(await tx.unsafe(`select 1 from ${s}.vitals`)).toHaveLength(0);
      });
    },
  );

  it("gives the nurse vitals but no notes", async () => {
    await asUser(sql, users.nurse, async (tx) => {
      expect(await tx.unsafe(`select 1 from ${s}.clinical_notes`)).toHaveLength(0);
      expect((await tx.unsafe(`select 1 from ${s}.vitals`)).length).toBeGreaterThan(0);
    });
  });

  it("returns nothing to a direct API call from the receptionist", async () => {
    await exposeSchemaLocally(sql, s);
    const client = createClient(keys.apiUrl, keys.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await client.auth.signInWithPassword({ email: emails.receptionist, password: PASSWORD });
    let result = await client.schema(s).from("clinical_notes").select("*");
    for (let i = 0; i < 40 && result.error; i++) {
      await new Promise((r) => setTimeout(r, 250));
      result = await client.schema(s).from("clinical_notes").select("*");
    }
    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
    expect((await client.schema(s).from("vitals").select("*")).data).toEqual([]);
  });

  it("hides audit rows about notes and vitals from the admin", async () => {
    const tables = await asUser(sql, users.admin, (tx) =>
      tx.unsafe<{ table_name: string }[]>(`select distinct table_name from ${s}.audit_events`),
    );
    const names = tables.map((t) => t.table_name);
    expect(names).toContain("patients");
    expect(names).not.toContain("clinical_notes");
    expect(names).not.toContain("vitals");
  });

  it("keeps patient attachments' records from the admin (CLN-06)", async () => {
    await sql.unsafe(
      `insert into ${s}.files (bucket_path, owner_table, owner_id, mime_type, size_bytes)
       values ($1, 'patients', $2, 'application/pdf', 1000)`,
      [`patients/${ids.patient}/lab.pdf`, ids.patient],
    );
    await asUser(sql, users.admin, async (tx) => {
      expect(
        await tx.unsafe(`select 1 from ${s}.files where owner_table = 'patients'`),
      ).toHaveLength(0);
    });
    await asUser(sql, users.nurse, async (tx) => {
      expect(
        await tx.unsafe(`select 1 from ${s}.files where owner_table = 'patients'`),
      ).toHaveLength(1);
    });
  });
});

describe("CLN-02 record views", () => {
  it("writes a view audit row for the clinician who opened the record", async () => {
    await asUser(sql, users.clinician, (tx) =>
      tx.unsafe(`select ${s}.log_view('patients', $1)`, [ids.patient]),
    );
    const row = await one<{ actor_id: string }>(
      sql,
      `select actor_id from ${s}.audit_events where action = 'view' and record_id = $1`,
      [ids.patient],
    );
    expect(row.actor_id).toBe(users.clinician);
  });
});

describe("CLN-07 bills", () => {
  it("totals the service lines and reconciles receipts to payments", async () => {
    const invoice = await asUser(sql, users.cashier, async (tx) => {
      const inv = await one<{ id: string }>(
        tx,
        `insert into ${s}.invoices (party_type, party_id, currency, encounter_id, payer_type)
         values ('patient', $1, 'USD', $2, 'self') returning id`,
        [ids.patient, ids.encounter],
      );
      await tx.unsafe(
        `insert into ${s}.invoice_lines (invoice_id, description, quantity, unit_amount_minor, amount_minor)
         select $1, name, 1, price_minor, price_minor from ${s}.services`,
        [inv.id],
      );
      await tx.unsafe(`select ${s}.issue_invoice($1)`, [inv.id]);
      await tx.unsafe(`select * from ${s}.record_payment($1, $2, 1200, 'USD', 'cash')`, [
        randomUUID(),
        inv.id,
      ]);
      return inv.id;
    });
    const totals = await one<{ total_minor: string; paid_minor: string; receipts: string }>(
      sql,
      `select b.total_minor, b.paid_minor,
              (select sum(p.amount_minor) from ${s}.receipts r join ${s}.payments p on p.id = r.payment_id
               where p.invoice_id = b.invoice_id)::text as receipts
       from ${s}.invoice_balances b where b.invoice_id = $1`,
      [invoice],
    );
    expect(totals).toEqual({ total_minor: "2000", paid_minor: "1200", receipts: "1200" });
  });

  it("names the payer for insurance and company bills, and keeps billing from clinicians", async () => {
    await expect(
      asUser(sql, users.cashier, (tx) =>
        tx.unsafe(
          `insert into ${s}.invoices (party_type, party_id, currency, payer_type) values ('patient', $1, 'USD', 'insurance')`,
          [ids.patient],
        ),
      ),
    ).rejects.toThrow(/invoices_payer_named/);
    await expect(
      asUser(sql, users.clinician, (tx) =>
        tx.unsafe(
          `insert into ${s}.invoices (party_type, party_id, currency) values ('patient', $1, 'USD')`,
          [ids.patient],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});
