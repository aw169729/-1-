import { supabase } from "@/integrations/supabase/client";

export interface AdditionalCharge {
  id: string;
  client: string;
  month: string;
  amount: number;
  note: string;
  created_at: string;
}

export async function fetchAdditionalCharges(): Promise<AdditionalCharge[]> {
  const { data, error } = await supabase
    .from("additional_charges")
    .select("*")
    .order("created_at");
  if (error) {
    console.error("fetchAdditionalCharges:", error);
    return [];
  }
  return data ?? [];
}

export async function addAdditionalCharge(
  client: string,
  month: string,
  amount: number,
  note: string,
): Promise<AdditionalCharge | null> {
  const { data, error } = await supabase
    .from("additional_charges")
    .insert({ client, month, amount, note })
    .select()
    .single();
  if (error) {
    console.error("addAdditionalCharge:", error);
    return null;
  }
  return data;
}

export async function deleteAdditionalCharge(id: string): Promise<void> {
  const { error } = await supabase
    .from("additional_charges")
    .delete()
    .eq("id", id);
  if (error) console.error("deleteAdditionalCharge:", error);
}

export function buildAdditionalChargesMap(
  charges: AdditionalCharge[],
): Record<string, Record<string, number>> {
  const map: Record<string, Record<string, number>> = {};
  for (const c of charges) {
    map[c.client] ??= {};
    map[c.client][c.month] = (map[c.client][c.month] ?? 0) + c.amount;
  }
  return map;
}
