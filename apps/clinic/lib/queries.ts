type Result<T> = { data: T; error: null } | { data: null; error: { message: string } };

/**
 * The data of a successful read; throws on a failed one so the page shows the error
 * boundary (CORE-09 error state). A `maybeSingle()` read can still return null.
 */
export function rows<T>(result: Result<T>): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

const CHUNK = 1000;

/**
 * Every row of a read, fetched in pages: the API returns at most 1,000 rows per
 * request, and reports must add up every entry. `page` runs the query for a range.
 */
export async function selectAll<T>(
  page: (from: number, to: number) => PromiseLike<Result<T[]>>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += CHUNK) {
    const chunk = rows(await page(from, from + CHUNK - 1));
    out.push(...chunk);
    if (chunk.length < CHUNK) return out;
  }
}

/**
 * Rows for many ids, read in groups: ids travel in the URL, so a long list would make
 * the request too long. `read` runs the query for one group.
 */
export async function selectIn<T>(
  ids: string[],
  read: (group: string[]) => PromiseLike<Result<T[]>>,
  size = 150,
): Promise<T[]> {
  const out: T[] = [];
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += size) {
    out.push(...rows(await read(unique.slice(i, i + size))));
  }
  return out;
}
