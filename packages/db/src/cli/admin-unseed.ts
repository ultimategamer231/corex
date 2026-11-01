// pnpm admin:unseed [--schema corex_web] [--project <label>]
// Removes only the rows pnpm admin:seed marked is_sample (SPEC-ADMIN.md 13). Real
// records are never touched; if one uses sample data, nothing is removed.
import { z } from "zod";
import { removeAdminSample } from "../fixtures/admin.ts";
import { connect } from "../db.ts";
import { databaseUrl } from "../env.ts";
import { parseOptions, run } from "./args.ts";

const options = parseOptions("admin:unseed [--schema corex_web] [--project <label>]", {
  schema: z.string().default("corex_web"),
  project: z.string().optional(),
});

run(async () => {
  const sql = connect(databaseUrl(options.project));
  try {
    const removed = await removeAdminSample(sql, options.schema);
    const summary = Object.entries(removed)
      .map(([table, n]) => `${n} ${table.replace(/_/g, " ")}`)
      .join(", ");
    console.log(`${options.schema}: sample data removed (${summary}).`);
  } finally {
    await sql.end();
  }
});
