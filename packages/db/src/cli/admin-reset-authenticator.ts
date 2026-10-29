// pnpm admin:reset-authenticator --username <name> --admin-url <url> [--project web] [--schema corex_web]
// Recovery when the only admin lost their phone: removes their authenticator and prints
// a 72-hour set-up link. With another admin available, use Settings → Team instead.
import { z } from "zod";
import { resetAdminAuthenticator } from "../admin/team.ts";
import { connect } from "../db.ts";
import { databaseUrl } from "../env.ts";
import { supabaseAdmin, supabaseAdminConfig } from "../supabase-admin.ts";
import { parseOptions, run } from "./args.ts";

const options = parseOptions(
  "admin:reset-authenticator --username <name> --admin-url <url> [--project <label>] [--schema corex_web]",
  {
    username: z.string(),
    "admin-url": z.url(),
    project: z.string().default("web"),
    schema: z.string().default("corex_web"),
  },
);

run(async () => {
  const sql = connect(databaseUrl(options.project));
  try {
    const link = await resetAdminAuthenticator(
      sql,
      supabaseAdmin(supabaseAdminConfig(options.project)),
      {
        schema: options.schema,
        username: options.username,
        adminUrl: options["admin-url"],
      },
    );
    console.log(`Set-up link (works once, for 72 hours):\n${link}`);
  } finally {
    await sql.end();
  }
});
