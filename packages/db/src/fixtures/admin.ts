// Corex Admin fixture for local development and end-to-end tests: five active admins
// with passwords and authenticator apps already set up. Local stack only; never run
// against a real project.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Sql } from "postgres";
import { totpCode } from "../admin/totp.ts";
import { USERNAME_EMAIL_DOMAIN } from "../admin/team.ts";
import { migrateSchema } from "../migrations.ts";
import { exposeSchemaLocally } from "../provision.ts";
import { assertSchemaName } from "../schema-name.ts";

export const ADMIN_FIXTURE_PASSWORD = "Admin-Fixture-2026";

export type AdminFixtureUser = {
  name: string;
  username: string;
  email: string | null;
  /** Base32 authenticator secret, for an authenticator app or `totpCode`. */
  secret: string;
};

/** Separate admins, so end-to-end tests never reuse one authenticator code at once. */
export const ADMIN_FIXTURE_KEYS = ["owner", "staff", "verifier", "plain", "trusted"] as const;
export type AdminFixtureKey = (typeof ADMIN_FIXTURE_KEYS)[number];

export type AdminFixture = { schema: string; users: Record<AdminFixtureKey, AdminFixtureUser> };

/** Drops and rebuilds `schema` (product admin) with five active admins. */
export async function seedAdminFixture(
  sql: Sql,
  service: SupabaseClient,
  local: { apiUrl: string; anonKey: string },
  schemaName: string,
): Promise<AdminFixture> {
  const s = assertSchemaName(schemaName);
  const exists = await sql`select 1 from pg_namespace where nspname = ${s}`;
  const oldUsers = exists.length
    ? await sql.unsafe<{ user_id: string }[]>(`select user_id from ${s}.admins`)
    : [];
  await sql.unsafe(`drop schema if exists ${s} cascade`);
  for (const { user_id } of oldUsers) await service.auth.admin.deleteUser(user_id);
  await migrateSchema(sql, s, "admin");
  await exposeSchemaLocally(sql, s);

  const domain = `${s.replace(/_/g, "-")}.corex.test`;
  const people: { key: AdminFixtureKey; name: string; username: string; email: string | null }[] = [
    { key: "owner", name: "Fatu Admin", username: "owner", email: `owner@${domain}` },
    { key: "staff", name: "Maima Gbessay", username: "maima", email: null },
    { key: "verifier", name: "Ama Sirleaf", username: "ama", email: `ama@${domain}` },
    { key: "plain", name: "Kebeh Toe", username: "kebeh", email: null },
    { key: "trusted", name: "Joseph Flomo", username: "joseph", email: `joseph@${domain}` },
  ];
  const users = {} as AdminFixture["users"];
  for (const person of people) {
    const email =
      person.email ?? `${person.username}.${s.replace(/_/g, "-")}@${USERNAME_EMAIL_DOMAIN}`;
    const stale = await sql<{ id: string }[]>`select id from auth.users where email = ${email}`;
    for (const { id } of stale) await service.auth.admin.deleteUser(id);
    const created = await service.auth.admin.createUser({
      email,
      password: ADMIN_FIXTURE_PASSWORD,
      email_confirm: true,
      user_metadata: { name: person.name },
    });
    if (created.error) throw created.error;
    const userId = created.data.user.id;
    await sql.unsafe(
      `insert into ${s}.admins (user_id, username, name, email, status) values ($1, $2, $3, $4, 'active')`,
      [userId, person.username, person.name, person.email],
    );

    const client = createClient(local.apiUrl, local.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const signedIn = await client.auth.signInWithPassword({
      email,
      password: ADMIN_FIXTURE_PASSWORD,
    });
    if (signedIn.error) throw signedIn.error;
    const enrolled = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "Fixture" });
    if (enrolled.error) throw enrolled.error;
    const verified = await client.auth.mfa.challengeAndVerify({
      factorId: enrolled.data.id,
      code: totpCode(enrolled.data.totp.secret),
    });
    if (verified.error) throw verified.error;
    await client.auth.signOut();
    users[person.key] = {
      name: person.name,
      username: person.username,
      email: person.email,
      secret: enrolled.data.totp.secret,
    };
  }
  await seedLeads(sql, s);
  await seedClients(sql, s);
  return { schema: s, users };
}

function adminId(ids: Record<string, string>, username: string): string {
  const id = ids[username];
  if (!id) throw new Error(`fixture admin ${username} is missing`);
  return id;
}

/**
 * Leads from the mockup (Leads.dc.html): website requests at several stages and one
 * added by hand. Stage changes go through the database rules, so each has its timeline.
 */
async function seedLeads(sql: Sql, s: string): Promise<void> {
  const ids = Object.fromEntries(
    (
      await sql.unsafe<{ id: string; username: string }[]>(`select id, username from ${s}.admins`)
    ).map((a) => [a.username, a.id]),
  );
  const website = `insert into ${s}.leads
      (name, organization, country, product, plan_interest, phone, email, message, consent, source_page, created_at)
    values ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, now() - make_interval(days => $10))
    returning id`;
  const add = async (values: (string | number | null)[]) => {
    const [row] = await sql.unsafe<{ id: string }[]>(website, values);
    if (!row) throw new Error("lead not inserted");
    return row.id;
  };
  await add([
    "Musu Kollie",
    "Greenfield Academy",
    "Liberia",
    "school-highschool",
    "managed",
    "+231 77 555 0101",
    "musu@greenfield.example",
    "We have 450 students and want report cards on the computer.",
    "/software/school",
    0,
  ]);
  await add([
    "Ibrahim Konneh",
    "Mano River Logistics",
    "Sierra Leone",
    "finance",
    "unsure",
    "+232 76 555 020",
    null,
    "We need to track trips, fuel and payments.",
    "/contact",
    1,
  ]);
  const clinic = await add([
    "Comfort Pewee",
    "Saint Luke's Clinic",
    "Liberia",
    "clinic",
    "unsure",
    "0886 555 030",
    "comfort@stlukes.example",
    "Two doctors, about 40 patients a day.",
    "/software/clinic",
    5,
  ]);
  await sql.unsafe(
    `update ${s}.leads set stage = 'contacted', assigned_admin_id = $2,
       follow_up_on = current_date + 1, next_step = 'Book a demo' where id = $1`,
    [clinic, adminId(ids, "maima")],
  );
  const college = await add([
    "Joseph Wleh",
    "St. Peter's College",
    "Liberia",
    "school-college",
    "handover",
    "+231 77 555 0404",
    "registrar@stpeters.example",
    "We have about 900 students across 4 programs and keep grades in Excel.",
    "/software/school",
    17,
  ]);
  await sql.unsafe(
    `insert into ${s}.lead_activities (lead_id, type, body, admin_id) values ($1, 'call', $2, $3)`,
    [college, "First call. 900 students, 4 programs, grades in Excel.", adminId(ids, "maima")],
  );
  await sql.unsafe(
    `update ${s}.leads set stage = 'quoted', assigned_admin_id = $2, follow_up_on = current_date + 6,
       quote_amount_minor = 400000, quote_currency = 'USD', quote_sent_on = current_date - 2,
       quote_note = 'College edition, Handover plan, data migration from Excel' where id = $1`,
    [college, adminId(ids, "owner")],
  );
  await add([
    "Fatu Kamara",
    "Paynesville Women's Cooperative",
    "Liberia",
    "finance",
    "managed",
    "+231 77 555 0606",
    "fatu@pwc.example",
    "About 300 members; savings and small loans.",
    "/software/finance",
    10,
  ]);
  const [pharmacy] = await sql.unsafe<{ id: string }[]>(
    `insert into ${s}.leads (source, name, organization, country, product, phone, message, created_at)
     values ('manual', 'Grace Flomo', 'Unity Pharmacy', 'Liberia', 'on-request', '0777 555 050',
             'Met at the business fair; asked about stock control.', now() - interval '119 days')
     returning id`,
  );
  await sql.unsafe(
    `update ${s}.leads set stage = 'lost', lost_reason = 'Chose a cheaper supplier' where id = $1`,
    [pharmacy?.id ?? null],
  );
}

/**
 * Clients from the mockup (Clients.dc.html), one per status: setting up, renewal due,
 * grace period and a Handover client in warranty. Dates are relative to today so the
 * statuses hold whenever the tests run.
 */
async function seedClients(sql: Sql, s: string): Promise<void> {
  const base = {
    country: "Liberia",
    contact_title: "Administrator",
    currency: "USD",
    milestone_scheme: [50, 30, 20],
    hosting_cost_minor: 1000,
    hosting_cost_currency: "USD",
  };
  const create = async (details: Record<string, unknown>) => {
    const [row] = await sql.unsafe<{ id: string }[]>(
      `select ${s}.create_client(null, $1::jsonb) as id`,
      [details as never],
    );
    if (!row) throw new Error("client not created");
    return row.id;
  };
  const goLive = (clientId: string, daysAgo: number) =>
    sql.unsafe(
      `update ${s}.deployments set environment = 'live', went_live_on = current_date - $2::int
       where client_id = $1`,
      [clientId, daysAgo],
    );

  await create({
    ...base,
    name: "Hope Medical Center",
    city: "Ganta",
    contact_name: "Esther Dolo",
    contact_phone: "+231 88 555 0601",
    contact_email: "admin@hopemedical.example",
    product: "clinic",
    plan: "managed",
    total_minor: 250000,
    signed_on: "2026-09-16",
    renewal_minor: 60000,
    target_go_live: "2026-11-15",
  });
  const riverside = await create({
    ...base,
    name: "Riverside Traders",
    city: "Monrovia",
    contact_name: "Moses Toe",
    contact_phone: "+231 77 555 0602",
    product: "finance",
    plan: "managed",
    total_minor: 150000,
    signed_on: "2025-10-01",
    renewal_minor: 30000,
  });
  await goLive(riverside, 345);
  const bright = await create({
    ...base,
    name: "Bright Future NGO",
    country: "Sierra Leone",
    city: "Freetown",
    contact_name: "Aminata Sesay",
    contact_email: "finance@brightfuture.example",
    product: "finance",
    plan: "managed",
    total_minor: 150000,
    signed_on: "2025-09-20",
    renewal_minor: 30000,
  });
  await goLive(bright, 377);
  const lakeside = await create({
    ...base,
    name: "Lakeside Institute",
    city: "Buchanan",
    contact_name: "Daniel Kpoto",
    contact_phone: "+231 88 555 0604",
    product: "school_college",
    plan: "handover",
    total_minor: 400000,
    signed_on: "2026-08-12",
    renewal_minor: null,
  });
  await goLive(lakeside, 18);
}
