import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { LOCAL_PROJECT } from "./env.ts";
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

/**
 * Registry file: `COREX_SCHEMA_REGISTRY` if set (tests), else `schemas.local.json`
 * for the local stack (git-ignored, so local schemas never reach the committed
 * registry or the nightly backup), else the committed `schemas.json`.
 */
export function registryPath(project?: string): string {
  if (process.env.COREX_SCHEMA_REGISTRY) return process.env.COREX_SCHEMA_REGISTRY;
  const file = project === LOCAL_PROJECT ? "schemas.local.json" : "schemas.json";
  return join(import.meta.dirname, "..", file);
}

export function readRegistry(path = registryPath()): RegistryEntry[] {
  if (!existsSync(path)) return [];
  const parsed = registrySchema.parse(JSON.parse(readFileSync(path, "utf8")));
  return parsed.schemas;
}

export function addToRegistry(entry: RegistryEntry, path = registryPath(entry.project)): void {
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
export function schemasFor(product: string, project?: string, path = registryPath(project)) {
  return readRegistry(path).filter(
    (entry) => entry.product === product && (project === undefined || entry.project === project),
  );
}
