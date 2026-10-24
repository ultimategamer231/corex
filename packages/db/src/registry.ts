import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { PRODUCTS } from "./products.ts";
import { assertSchemaName } from "./schema-name.ts";

const entrySchema = z.object({
  schema: z.string().refine((value) => {
    try {
      assertSchemaName(value);
      return true;
    } catch {
      return false;
    }
  }, "invalid schema name"),
  product: z.enum(PRODUCTS),
  /** Supabase project label; the database URL comes from DATABASE_URL_<PROJECT>. */
  project: z.string().regex(/^[a-z][a-z0-9_]*$/),
  org: z.string().min(1),
});

const registrySchema = z.object({ schemas: z.array(entrySchema) });

export type RegistryEntry = z.infer<typeof entrySchema>;

/** `packages/db/schemas.json`, or `COREX_SCHEMA_REGISTRY` (tests use a temporary file). */
export function registryPath(): string {
  return process.env.COREX_SCHEMA_REGISTRY ?? join(import.meta.dirname, "..", "schemas.json");
}

export function readRegistry(path = registryPath()): RegistryEntry[] {
  if (!existsSync(path)) return [];
  const parsed = registrySchema.parse(JSON.parse(readFileSync(path, "utf8")));
  return parsed.schemas;
}

export function addToRegistry(entry: RegistryEntry, path = registryPath()): void {
  const entries = readRegistry(path);
  if (
    entries.some(
      (existing) => existing.schema === entry.schema && existing.project === entry.project,
    )
  ) {
    return;
  }
  const next = [...entries, entrySchema.parse(entry)].sort((a, b) =>
    `${a.project}.${a.schema}`.localeCompare(`${b.project}.${b.schema}`),
  );
  writeFileSync(path, `${JSON.stringify({ schemas: next }, null, 2)}\n`);
}

/** Schemas of one product, optionally limited to one project. */
export function schemasFor(product: string, project?: string, path = registryPath()) {
  return readRegistry(path).filter(
    (entry) => entry.product === product && (project === undefined || entry.project === project),
  );
}
