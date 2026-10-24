// pnpm db:provision --schema <name> --product <school|clinic|finance> --org "<name>" --admin-email <email>
//   --project <label> [--admin-name "<name>"] [--redirect-to <url>]
// --project local provisions on the local stack and records it in the git-ignored schemas.local.json.
import { z } from "zod";
import { connect } from "../db.ts";
import { databaseUrl, LOCAL_PROJECT } from "../env.ts";
import { PRODUCTS } from "../products.ts";
import { provisionSchema } from "../provision.ts";
import { registryPath } from "../registry.ts";
import { supabaseAdmin, supabaseAdminConfig } from "../supabase-admin.ts";
import { parseOptions, run } from "./args.ts";

const options = parseOptions(
  'db:provision --schema <name> --product <school|clinic|finance> --org "<name>" --admin-email <email> --project <label|local> [--admin-name "<name>"] [--redirect-to <url>]',
  {
    schema: z.string(),
    product: z.enum(PRODUCTS),
    org: z.string().min(1),
    "admin-email": z.string(),
    "admin-name": z.string().optional(),
    project: z
      .string()
      .regex(/^[a-z][a-z0-9_]*$/)
      .default("local"),
    "redirect-to": z.url().optional(),
  },
);

run(async () => {
  const local = options.project === LOCAL_PROJECT;
  const sql = connect(databaseUrl(options.project));
  try {
    const supabase = supabaseAdmin(supabaseAdminConfig(options.project));
    const result = await provisionSchema(sql, supabase, {
      schema: options.schema,
      product: options.product,
      org: options.org,
      adminEmail: options["admin-email"],
      adminName: options["admin-name"],
      project: options.project,
      redirectTo: options["redirect-to"],
      exposeLocally: local,
    });
    console.log(
      `Provisioned ${options.schema} (${options.product}) for "${options.org}" in project "${options.project}".`,
    );
    console.log(
      `  Migrations applied: ${result.migrations.applied.length}, already present: ${result.migrations.skipped.length}`,
    );
    console.log(`  Storage bucket: ${options.schema} (private)`);
    console.log(
      `  First ${result.adminRole}: ${options["admin-email"]} ${result.invited ? "(invitation email sent)" : "(existing user)"}`,
    );
    console.log(
      `  Registered in ${registryPath(options.project)}${local ? "" : "; commit that change"}.`,
    );
    if (result.exposed) {
      console.log("  Exposed to the local API.");
    } else {
      console.log(
        `\nReminder: add "${options.schema}" to Exposed schemas in the Supabase dashboard (Project Settings > Data API), or the app cannot reach it.`,
      );
    }
  } finally {
    await sql.end();
  }
});
