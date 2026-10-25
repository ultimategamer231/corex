// A small, fully fictional clinic for local development and end-to-end tests: one
// sign-in per role, a service price list and a few patients. Local stack only.
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Sql } from "postgres";
import { migrateSchema } from "../migrations.ts";
import { exposeSchemaLocally } from "../provision.ts";
import { assertSchemaName } from "../schema-name.ts";
import { FIXTURE_PASSWORD } from "./school.ts";

export const CLINIC_ROLES = ["admin", "clinician", "nurse", "receptionist", "cashier"] as const;
export type ClinicRole = (typeof CLINIC_ROLES)[number];

/** Sign-in email for a role, for example nurse@e2e-clinic.corex.test. */
export function clinicEmail(schema: string, role: ClinicRole): string {
  return `${role}@${schema.replace(/_/g, "-")}.corex.test`;
}

const NAMES: Record<ClinicRole, string> = {
  admin: "Josephine Mulbah",
  clinician: "Dr. Samuel Dolo",
  nurse: "Watta Sumo",
  receptionist: "Garmai Tarr",
  cashier: "Darius Nyumah",
};

export type ClinicFixture = {
  schema: string;
  users: Record<ClinicRole, { id: string; email: string; name: string }>;
};

/** Drops and rebuilds `schema` with the fixture data. */
export async function seedClinicFixture(
  sql: Sql,
  admin: SupabaseClient,
  schemaName: string,
): Promise<ClinicFixture> {
  const s = assertSchemaName(schemaName);
  const emails = CLINIC_ROLES.map((r) => clinicEmail(s, r));
  const old = await sql<{ id: string }[]>`select id from auth.users where email = any(${emails})`;
  await sql.unsafe(`drop schema if exists ${s} cascade`);
  for (const { id } of old) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw new Error(`Could not delete fixture user ${id}: ${error.message}`);
  }

  await migrateSchema(sql, s, "clinic");
  await sql.unsafe(
    `insert into ${s}.settings (org_name, address, phone, letterhead_text, base_currency)
     values ('Sample Health Clinic', 'Broad Street, Monrovia', '+231 770 000 400', 'Caring for every family', 'USD')`,
  );
  const users = {} as ClinicFixture["users"];
  for (const role of CLINIC_ROLES) {
    const email = clinicEmail(s, role);
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
    `insert into ${s}.services (name, code, price_minor, currency) values
     ('Consultation', 'CONS', 1500, 'USD'), ('Malaria rapid test', 'MRDT', 500, 'USD'),
     ('Full blood count', 'FBC', 800, 'USD'), ('Wound dressing', 'DRESS', 150000, 'LRD'),
     ('Antenatal visit', 'ANC', 1000, 'USD')`,
  );
  const patients: [string, string, string, string, boolean, string | null][] = [
    ["Kebeh", "Kamara", "female", "1992-06-11", true, "Penicillin"],
    ["Boima", "Flomo", "male", "1978-02-20", false, null],
    ["Satta", "Jallah", "female", "2015-09-03", false, null],
  ];
  for (const [first, last, sex, dob, allergic, notes] of patients) {
    await sql.unsafe(
      `insert into ${s}.patients (id, patient_number, first_name, last_name, sex, date_of_birth, phone, address, has_allergies, allergy_notes)
       values ($1, '', $2, $3, $4, $5, $6, 'Sinkor, Monrovia', $7, $8)`,
      [
        randomUUID(),
        first,
        last,
        sex,
        dob,
        `+231 77${patients.findIndex((p) => p[0] === first)} 200 300`,
        allergic,
        notes,
      ],
    );
  }

  // Attachments go to a private bucket named after the schema (CLN-06).
  const bucket = await admin.storage.createBucket(s, { public: false });
  if (bucket.error && !/already exists/i.test(bucket.error.message)) {
    throw new Error(`Could not create bucket ${s}: ${bucket.error.message}`);
  }
  await exposeSchemaLocally(sql, s);
  return { schema: s, users };
}
