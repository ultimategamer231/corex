import type { SchoolDb } from "./supabase";

export type TermRow = {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  is_current: boolean;
  registration_opens_on: string | null;
  registration_closes_on: string | null;
  academic_year_id: string;
  academic_years: { name: string } | null;
};

const TERM_COLUMNS =
  "id, name, starts_on, ends_on, is_current, registration_opens_on, registration_closes_on, academic_year_id, academic_years(name)";

/** All terms, newest first. */
export async function listTerms(db: SchoolDb): Promise<TermRow[]> {
  const { data, error } = await db
    .from("terms")
    .select(TERM_COLUMNS)
    .order("starts_on", { ascending: false });
  if (error) throw new Error(error.message);
  return data as TermRow[];
}

/** The term marked current, or the most recent one. */
export async function currentTerm(db: SchoolDb): Promise<TermRow | null> {
  const terms = await listTerms(db);
  return terms.find((t) => t.is_current) ?? terms[0] ?? null;
}

export function termLabel(t: Pick<TermRow, "name" | "academic_years">): string {
  return t.academic_years ? `${t.academic_years.name} ${t.name}` : t.name;
}

type Result<T> = { data: T; error: null } | { data: null; error: { message: string } };

/**
 * The data of a successful read; throws on a failed one so the page shows the error
 * boundary (CORE-09 error state). A `maybeSingle()` read can still return null.
 */
export function rows<T>(result: Result<T>): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}
