// pnpm admin:verify-log [--schema corex_web] [--project <label>]
// Recomputes the Corex Admin activity log hash chain and reports the first broken
// entry (SPEC-ADMIN.md LOG-02). Exits 1 when the chain is broken.
import { z } from "zod";
import { verifyActivityLog } from "../admin/verify-log.ts";
import { connect } from "../db.ts";
import { databaseUrl } from "../env.ts";
import { parseOptions, run } from "./args.ts";

const options = parseOptions("admin:verify-log [--schema corex_web] [--project <label>]", {
  schema: z.string().default("corex_web"),
  project: z.string().optional(),
});

run(async () => {
  const sql = connect(databaseUrl(options.project));
  try {
    const result = await verifyActivityLog(sql, options.schema);
    if (result.ok) {
      console.log(`${options.schema}: activity log intact (${result.checked} entries checked).`);
    } else {
      console.error(
        `${options.schema}: activity log broken at entry ${result.seq}: ${result.reason} (${result.checked} entries checked before it).`,
      );
      process.exitCode = 1;
    }
  } finally {
    await sql.end();
  }
});
