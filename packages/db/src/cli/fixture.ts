// pnpm db:fixture --schema dev_college
// Rebuilds a local College with one sign-in per role (password Test@2026pass).
// Local Supabase only.
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { connect } from "../db.ts";
import { LOCAL_DATABASE_URL } from "../env.ts";
import { COLLEGE_ROLES, FIXTURE_PASSWORD, seedCollegeFixture } from "../fixtures/college.ts";
import { localSupabaseStatus } from "../local-supabase.ts";
import { parseOptions, run } from "./args.ts";

const options = parseOptions("db:fixture --schema <name>", { schema: z.string() });

run(async () => {
  const status = localSupabaseStatus();
  const sql = connect(LOCAL_DATABASE_URL);
  const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  try {
    const fixture = await seedCollegeFixture(sql, admin, options.schema);
    console.log(`Seeded ${fixture.schema}. Sign in with password ${FIXTURE_PASSWORD}:`);
    for (const role of COLLEGE_ROLES)
      console.log(`  ${role.padEnd(12)} ${fixture.users[role].email}`);
  } finally {
    await sql.end();
  }
});
