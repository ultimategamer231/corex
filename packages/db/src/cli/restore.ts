// pnpm db:restore --schema <name> [--key <backup key>] [--project <label>] --confirm <name>
// Restores one schema from its newest backup (or --key). The current schema is backed up
// first, then replaced; other schemas are not touched (docs/database.md).
import { z } from "zod";
import { backupStorageFromEnv, restoreSchema } from "../backup.ts";
import { databaseUrl, LOCAL_PROJECT } from "../env.ts";
import { parseOptions, run } from "./args.ts";

const options = parseOptions(
  "db:restore --schema <name> [--key <backup key>] [--project <label>] --confirm <name>",
  {
    schema: z.string(),
    key: z.string().optional(),
    project: z
      .string()
      .regex(/^[a-z][a-z0-9_]*$/)
      .default(LOCAL_PROJECT),
    confirm: z.string(),
  },
);

run(async () => {
  // Replacing a client's data is never done by accident: the name must be typed twice.
  if (options.confirm !== options.schema) {
    console.error(`Pass --confirm ${options.schema} to replace that schema.`);
    process.exit(2);
  }
  const result = await restoreSchema({
    databaseUrl: databaseUrl(options.project),
    schema: options.schema,
    project: options.project,
    storage: backupStorageFromEnv(),
    key: options.key,
  });
  console.log(`Restored ${options.project}/${options.schema} from ${result.key}.`);
  if (result.safetyKey) console.log(`The data before the restore is saved as ${result.safetyKey}.`);
});
