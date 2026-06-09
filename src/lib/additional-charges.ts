/**
 * Additional (manual) charges per client per month.
 * Stored in localStorage under the key "additional-charges-v1".
 * Each entry: { id, client, month ("YYYY-MM"), amount, note, created_at }
 */

const STORAGE_KEY = "additional-charges-v1";

export interface AdditionalCharge {
  id: string;
  client: string;
  month: string; // "YYYY-MM"
  amount: number;
  note: string;
  created_at: string;
}

function readAll(): AdditionalCharge[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items: AdditionalCharge[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function fetchAdditionalCharges(): AdditionalCharge[] {
  return readAll();
}

export function addAdditionalCharge(
  client: string,
  month: string,
  amount: number,
  note: string,
): AdditionalCharge {
  const all = readAll();
  const item: AdditionalCharge = {
    id: crypto.randomUUID(),
    client,
    month,
    amount,
    note,
    created_at: new Date().toISOString(),
  };
  writeAll([...all, item]);
  return item;
}

export function deleteAdditionalCharge(id: string) {
  writeAll(readAll().filter((c) => c.id !== id));
}

/** Returns map: client → month → total additional amount */
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
