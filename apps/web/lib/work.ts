import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

// Use cases live in content/work/*.mdx (SPEC.md 6.5).
const WORK_DIR = join(process.cwd(), "content", "work");

export const workFrontmatter = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  client: z.string().min(1),
  industry: z.string().min(1),
  type: z.enum(["client", "concept"]),
  year: z.number().int(),
  summary: z.string().min(1),
  stack: z.array(z.string()),
  liveUrl: z.union([z.url(), z.literal("")]),
  cover: z.string().startsWith("/"),
  gallery: z.array(z.string().startsWith("/")),
  draft: z.boolean(),
});

export type WorkMeta = z.infer<typeof workFrontmatter>;
export type WorkEntry = WorkMeta & { body: string };

/** Drafts show in development with a "Draft" badge and are hidden in production builds. */
export function showDrafts(nodeEnv = process.env.NODE_ENV): boolean {
  return nodeEnv !== "production";
}

function parseFile(file: string): WorkEntry {
  const raw = readFileSync(join(WORK_DIR, file), "utf8");
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
  if (!match?.[1]) throw new Error(`${file}: missing frontmatter`);
  const meta = workFrontmatter.parse(parseYamlSubset(match[1]));
  if (`${meta.slug}.mdx` !== file) throw new Error(`${file}: slug must match the file name`);
  return { ...meta, body: match[2] ?? "" };
}

/**
 * Parses the flat frontmatter used by use cases: `key: value` lines where values are
 * strings, numbers, booleans or JSON arrays. Kept tiny on purpose; content is ours.
 */
export function parseYamlSubset(source: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf(":");
    if (index < 1) throw new Error(`Invalid frontmatter line: ${line}`);
    const key = trimmed.slice(0, index).trim();
    const value = trimmed
      .slice(index + 1)
      .replace(/\s+#.*$/, "")
      .trim();
    if (value === "true" || value === "false") result[key] = value === "true";
    else if (/^-?\d+$/.test(value)) result[key] = Number(value);
    else if (value.startsWith("[") || value.startsWith('"'))
      result[key] = JSON.parse(value) as unknown;
    else result[key] = value;
  }
  return result;
}

export function allWork(includeDrafts = showDrafts()): WorkEntry[] {
  return readdirSync(WORK_DIR)
    .filter((file) => file.endsWith(".mdx"))
    .map(parseFile)
    .filter((entry) => includeDrafts || !entry.draft)
    .sort((a, b) => b.year - a.year || a.title.localeCompare(b.title));
}

export function workBySlug(slug: string, includeDrafts = showDrafts()): WorkEntry | undefined {
  return allWork(includeDrafts).find((entry) => entry.slug === slug);
}

/** Whether the "Our work" section and nav link appear (hidden when nothing is published). */
export function hasPublishedWork(includeDrafts = showDrafts()): boolean {
  return allWork(includeDrafts).length > 0;
}
