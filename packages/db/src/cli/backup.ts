// pnpm db:backup --schema <name> [--project <label>] [--keep-days 30]
// pnpm db:backup --all [--project <label>] [--keep-days 30]   every registered schema
import { z } from "zod";
import { backupSchema, backupStorageFromEnv, pruneBackups } from "../backup.ts";
import { databaseUrl, LOCAL_PROJECT } from "../env.ts";
import { readRegistry, registryPath } from "../registry.ts";
import { parseOptions, run } from "./args.ts";

const options = parseOptions(
  "db:backup (--schema <name> | --all true) [--project <label>] [--keep-days 30]",
  {
    schema: z.string().optional(),
    all: z.enum(["true"]).optional(),
    project: z
      .string()
      .regex(/^[a-z][a-z0-9_]*$/)
      .optional(),
    "keep-days": z.coerce.number().int().min(1).default(30),
  },
);

run(async () => {
  const storage = backupStorageFromEnv();
  const targets = options.all
    ? readRegistry(registryPath(options.project))
        .filter((entry) => options.project === undefined || entry.project === options.project)
        .map((entry) => ({ schema: entry.schema, project: entry.project }))
    : options.schema
      ? [{ schema: options.schema, project: options.project ?? LOCAL_PROJECT }]
      : [];
  if (targets.length === 0) {
    console.error(
      options.all ? "No registered schemas to back up." : "Pass --schema <name> or --all true.",
    );
    process.exit(options.all ? 0 : 2);
  }

  const failures: string[] = [];
  for (const target of targets) {
    try {
      const url = databaseUrl(target.project);
      const result = await backupSchema({ databaseUrl: url, ...target, storage });
      const pruned = await pruneBackups({ storage, ...target, keepDays: options["keep-days"] });
      console.log(
        `${result.key} (${result.bytes} bytes); removed ${pruned.length} older than ${options["keep-days"]} days`,
      );
    } catch (error) {
      failures.push(target.schema);
      console.error(
        `${target.project}/${target.schema}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  // Back up every schema even if one fails, then report failure for the workflow.
  if (failures.length > 0) {
    console.error(`Backup failed for: ${failures.join(", ")}`);
    process.exit(1);
  }
});
