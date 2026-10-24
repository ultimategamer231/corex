// pnpm db:fixture --schema dev_school [--product school|finance|clinic]
// Rebuilds a local fixture with one sign-in per role (password Test@2026pass):
// a school (College and High School data), a finance business or a clinic.
// Local Supabase only.
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { connect } from "../db.ts";
import { LOCAL_DATABASE_URL } from "../env.ts";
import { seedClinicFixture } from "../fixtures/clinic.ts";
import { seedFinanceFixture } from "../fixtures/finance.ts";
import { FIXTURE_PASSWORD, seedSchoolFixture } from "../fixtures/school.ts";
import { localSupabaseStatus } from "../local-supabase.ts";
import { parseOptions, run } from "./args.ts";

const options = parseOptions("db:fixture --schema <name> [--product school|finance|clinic]", {
  schema: z.string(),
  product: z.enum(["school", "finance", "clinic"]).default("school"),
});

run(async () => {
  const status = localSupabaseStatus();
  const sql = connect(LOCAL_DATABASE_URL);
  const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  try {
    const fixture =
      options.product === "finance"
        ? await seedFinanceFixture(sql, admin, options.schema)
        : options.product === "clinic"
          ? await seedClinicFixture(sql, admin, options.schema)
          : await seedSchoolFixture(sql, admin, options.schema);
    console.log(`Seeded ${fixture.schema}. Sign in with password ${FIXTURE_PASSWORD}:`);
    for (const [role, user] of Object.entries(fixture.users))
      console.log(`  ${role.padEnd(12)} ${user.email}`);
  } finally {
    await sql.end();
  }
});
