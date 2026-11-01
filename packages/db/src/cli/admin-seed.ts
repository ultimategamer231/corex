// pnpm admin:seed [--schema corex_web] [--project <label>]
// Loads the mockup's sample leads, clients, contracts, invoices and prices into Corex
// Admin, every row marked is_sample (SPEC-ADMIN.md 13). Refuses unless
// ADMIN_ALLOW_SEED=true, and never in production. Remove with pnpm admin:unseed.
import { z } from "zod";
import { seedAdminSample } from "../fixtures/admin.ts";
import { connect } from "../db.ts";
import { databaseUrl } from "../env.ts";
import { parseOptions, run } from "./args.ts";
import { seedAllowed } from "./sample-guard.ts";

const options = parseOptions("admin:seed [--schema corex_web] [--project <label>]", {
  schema: z.string().default("corex_web"),
  project: z.string().optional(),
});

run(async () => {
  const refusal = seedAllowed(process.env);
  if (refusal) throw new Error(refusal);
  const sql = connect(databaseUrl(options.project));
  try {
    await seedAdminSample(sql, options.schema);
    console.log(
      `${options.schema}: sample data loaded. The admin shows a "Sample data" chip until pnpm admin:unseed removes it.`,
    );
  } finally {
    await sql.end();
  }
});
