import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Supabase's Data API caps each request at ~1000 rows by default. To fetch
 * an unbounded result set we have to paginate manually with `.range()`.
 *
 * Pass a factory that builds a fresh query each call (the builder is
 * mutable, so we must rebuild for each page). The factory receives `from`
 * and `to` (inclusive) and should return a query that already has all the
 * filters / select / order applied, plus `.range(from, to)`.
 *
 * Example:
 *   const { data, error } = await fetchAllRows<TripRow>((from, to) =>
 *     supabase.from("trips").select("*").eq("billing_month", m).range(from, to)
 *   );
 */
const PAGE_SIZE = 1000;

export async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
): Promise<{ data: T[]; error: PostgrestError | null }> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) return { data: all, error };
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return { data: all, error: null };
}