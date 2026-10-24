// pnpm db:migrate:all --product <school|clinic|finance> [--project <label>]
// Migrates every registered schema of the product and stops at the first failure (SPEC.md 4.4).
import { z } from "zod";
import { connect } from "../db.ts";
import { databaseUrl } from "../env.ts";
import { migrateSchema } from "../migrations.ts";
import { PRODUCTS } from "../products.ts";
import { schemasFor } from "../registry.ts";
import { parseOptions, run } from "./args.ts";

const options = parseOptions(
  "db:migrate:all --product <school|clinic|finance> [--project <label>]",
  {
    product: z.enum(PRODUCTS),
    project: z.string().optional(),
  },
);

run(async () => {
  const entries = schemasFor(options.product, options.project);
  if (entries.length === 0) {
    console.log(`No registered ${options.product} schemas.`);
    return;
  }
  for (const entry of entries) {
    const sql = connect(databaseUrl(entry.project));
    try {
      const result = await migrateSchema(sql, entry.schema, entry.product);
      console.log(`${entry.project}/${entry.schema}: applied ${result.applied.length}`);
    } catch (error) {
      console.error(
        `Stopped at ${entry.project}/${entry.schema}; later schemas were not migrated.`,
      );
      throw error;
    } finally {
      await sql.end();
    }
  }
});
