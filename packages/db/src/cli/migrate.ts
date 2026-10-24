// pnpm db:migrate --schema <name> --product <school|clinic|finance|web> [--project <label>]
import { z } from "zod";
import { connect } from "../db.ts";
import { databaseUrl } from "../env.ts";
import { migrateSchema } from "../migrations.ts";
import { MIGRATION_TARGETS } from "../products.ts";
import { parseOptions, run } from "./args.ts";

const options = parseOptions(
  "db:migrate --schema <name> --product <school|clinic|finance|web> [--project <label>]",
  {
    schema: z.string(),
    product: z.enum(MIGRATION_TARGETS),
    project: z.string().optional(),
  },
);

run(async () => {
  const sql = connect(databaseUrl(options.project));
  try {
    const result = await migrateSchema(sql, options.schema, options.product);
    console.log(
      `${result.schema}: applied ${result.applied.length} (${result.applied.join(", ") || "none"}), up to date ${result.skipped.length}`,
    );
  } finally {
    await sql.end();
  }
});
