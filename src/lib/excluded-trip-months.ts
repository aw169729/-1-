import { supabase } from "@/integrations/supabase/client";

export async function fetchExcludedSet(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("excluded_trip_months")
    .select("client, month");
  if (error) {
    console.error("fetchExcludedSet:", error);
    return new Set();
  }
  return new Set((data ?? []).map((r) => `${r.client}|${r.month}`));
}

export async function setTripsExcluded(
  client: string,
  month: string,
  excluded: boolean,
): Promise<void> {
  if (excluded) {
    const { error } = await supabase
      .from("excluded_trip_months")
      .insert({ client, month })
      .select()
      .maybeSingle();
    if (error && error.code !== "23505") console.error("setTripsExcluded insert:", error);
  } else {
    const { error } = await supabase
      .from("excluded_trip_months")
      .delete()
      .eq("client", client)
      .eq("month", month);
    if (error) console.error("setTripsExcluded delete:", error);
  }
}
