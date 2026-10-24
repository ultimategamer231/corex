// pnpm demo:seed --demo <college|highschool> [--project <label>]
// Rebuilds a public demo with its sample data and sign-ins (SPEC.md 11.4, 11.5).
// Without --project it uses the local stack; the nightly reset passes --project demo
// (DATABASE_URL_DEMO, SUPABASE_URL_DEMO, SUPABASE_SERVICE_ROLE_KEY_DEMO).
import { DEMO_PASSWORD, DEMOS } from "@corex/core/demo";
import { z } from "zod";
import { connect } from "../db.ts";
import { databaseUrl, LOCAL_PROJECT } from "../env.ts";
import { resetDemo } from "../demo/reset.ts";
import { supabaseAdmin, supabaseAdminConfig } from "../supabase-admin.ts";
import { parseOptions, run } from "./args.ts";

const options = parseOptions("demo:seed --demo <college|highschool> [--project <label>]", {
  demo: z.enum(["college", "highschool"]),
  project: z.string().default(LOCAL_PROJECT),
});

run(async () => {
  const started = Date.now();
  const sql = connect(databaseUrl(options.project));
  const admin = supabaseAdmin(supabaseAdminConfig(options.project));
  try {
    const result = await resetDemo(sql, admin, options.demo, {
      exposeLocally: options.project === LOCAL_PROJECT,
    });
    console.log(
      `${result.schema}: ${result.students} students, migrations applied ${result.migrations.applied.length}, ${((Date.now() - started) / 1000).toFixed(1)}s`,
    );
    console.log(`Sign in with password ${DEMO_PASSWORD}:`);
    for (const a of DEMOS[options.demo].accounts) console.log(`  ${a.label.padEnd(11)} ${a.email}`);
  } finally {
    await sql.end();
  }
});
