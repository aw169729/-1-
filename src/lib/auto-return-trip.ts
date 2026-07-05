import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetch-all";
import { findNextTripNumbers } from "@/lib/trip-numbers";

type Row = Record<string, unknown>;

function routeKey(clientId: string, date: string, origin: string, destination: string): string {
  return `${clientId}|${date}|${origin.trim()}|${destination.trim()}`;
}

/**
 * For clients flagged with `auto_return_trip`, makes sure every trip in `rows`
 * has a same-day return leg (destination -> origin). A return leg that
 * already exists — either in the DB or elsewhere in `rows` — is left alone,
 * so uploading a day that already has both directions adds nothing.
 */
export async function withAutoReturnTrips(rows: Row[]): Promise<Row[]> {
  const clientIds = Array.from(
    new Set(
      rows.map((r) => r.client_id).filter((id): id is string => typeof id === "string" && !!id),
    ),
  );
  if (clientIds.length === 0) return rows;

  const { data: flagged, error } = await supabase
    .from("clients")
    .select("id")
    .eq("auto_return_trip", true)
    .in("id", clientIds);
  if (error) throw error;
  const flaggedIds = new Set((flagged ?? []).map((c) => (c as { id: string }).id));
  if (flaggedIds.size === 0) return rows;

  const relevant = rows.filter(
    (r) =>
      typeof r.client_id === "string" &&
      flaggedIds.has(r.client_id) &&
      r.origin &&
      r.destination &&
      r.trip_date,
  );
  if (relevant.length === 0) return rows;

  const dates = Array.from(new Set(relevant.map((r) => r.trip_date as string)));
  const { data: existing, error: existingErr } = await fetchAllRows<Row>((from, to) =>
    supabase
      .from("trips")
      .select("client_id, trip_date, origin, destination")
      .in("client_id", Array.from(flaggedIds))
      .in("trip_date", dates)
      .range(from, to),
  );
  if (existingErr) throw existingErr;

  const existingPairs = new Set<string>();
  for (const t of [...existing, ...rows]) {
    if (typeof t.client_id === "string" && t.trip_date && t.origin && t.destination) {
      existingPairs.add(
        routeKey(t.client_id, t.trip_date as string, t.origin as string, t.destination as string),
      );
    }
  }

  const mirrors: Row[] = [];
  const createdKeys = new Set<string>();
  for (const r of relevant) {
    const clientId = r.client_id as string;
    const date = r.trip_date as string;
    const origin = r.origin as string;
    const destination = r.destination as string;
    const mirrorKey = routeKey(clientId, date, destination, origin);
    if (existingPairs.has(mirrorKey) || createdKeys.has(mirrorKey)) continue;
    createdKeys.add(mirrorKey);
    mirrors.push({ ...r, origin: destination, destination: origin });
  }
  if (mirrors.length === 0) return rows;

  const numbers = await findNextTripNumbers(mirrors.length);
  mirrors.forEach((m, i) => {
    m.trip_number = numbers[i];
  });

  return [...rows, ...mirrors];
}
