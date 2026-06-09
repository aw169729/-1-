import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetch-all";

export interface ClientRow {
  id: string;
  name: string;
  aliases: string[];
}

export function normalizeName(s: string | null | undefined): string {
  return (s ?? "").trim();
}

/** Build a lookup map from normalized name/alias -> client id. */
export function buildClientLookup(clients: ClientRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of clients) {
    const n = normalizeName(c.name);
    if (n) map.set(n, c.id);
    for (const a of c.aliases ?? []) {
      const an = normalizeName(a);
      if (an && !map.has(an)) map.set(an, c.id);
    }
  }
  return map;
}

export async function fetchAllClients(): Promise<ClientRow[]> {
  const { data, error } = await fetchAllRows<ClientRow>((from, to) =>
    supabase.from("clients").select("id, name, aliases").order("name").range(from, to),
  );
  if (error) throw error;
  return data;
}

export async function createClient(name: string): Promise<ClientRow> {
  const { data, error } = await supabase
    .from("clients")
    .insert({ name: normalizeName(name) } as never)
    .select("id, name, aliases")
    .single();
  if (error) throw error;
  return data as ClientRow;
}

export async function addAliasToClient(clientId: string, alias: string): Promise<void> {
  const aliasN = normalizeName(alias);
  const { data: current, error: fetchErr } = await supabase
    .from("clients")
    .select("aliases")
    .eq("id", clientId)
    .single();
  if (fetchErr) throw fetchErr;
  const existing: string[] = (current as { aliases: string[] | null })?.aliases ?? [];
  if (existing.some((a) => normalizeName(a) === aliasN)) return;
  const updated = [...existing, aliasN];
  const { error } = await supabase
    .from("clients")
    .update({ aliases: updated } as never)
    .eq("id", clientId);
  if (error) throw error;
}

/**
 * Rename a client and cascade the new name to trips.client and payments.client
 * rows that referenced the old name. Aliases are not touched, so historical
 * matches via alias keep working.
 */
export async function renameClient(
  clientId: string,
  oldName: string,
  newName: string,
): Promise<void> {
  const newN = normalizeName(newName);
  const oldN = normalizeName(oldName);
  if (!newN || newN === oldN) return;
  const upd = await supabase
    .from("clients")
    .update({ name: newN } as never)
    .eq("id", clientId);
  if (upd.error) throw upd.error;
  await supabase.from("trips").update({ client: newN } as never).eq("client", oldN);
  await supabase.from("payments").update({ client: newN } as never).eq("client", oldN);
}