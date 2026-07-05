import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetch-all";

const MIN_AUTO = 1;
const MAX_AUTO = 9999;

/** Find the `count` smallest unused 4-digit trip numbers (0001..9999). */
export async function findNextTripNumbers(count: number): Promise<string[]> {
  const { data, error } = await fetchAllRows<{ trip_number: string }>((from, to) =>
    supabase.from("trips").select("trip_number").range(from, to),
  );
  if (error) throw error;
  const used = new Set<number>();
  for (const r of data) {
    const n = Number(r.trip_number);
    if (Number.isInteger(n) && n >= MIN_AUTO && n <= MAX_AUTO) used.add(n);
  }
  const result: string[] = [];
  for (let i = MIN_AUTO; i <= MAX_AUTO && result.length < count; i++) {
    if (!used.has(i)) {
      used.add(i); // mark as used so next iteration skips it
      result.push(String(i).padStart(4, "0"));
    }
  }
  return result;
}

/** Find a single smallest unused 4-digit trip number, or null if none left. */
export async function findNextTripNumber(): Promise<string | null> {
  const [next] = await findNextTripNumbers(1);
  return next ?? null;
}
