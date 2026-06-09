/**
 * Stores which client+month combos should have trips excluded from debt calc.
 * Key format: "ClientName|YYYY-MM"
 */
const KEY = "excluded-trip-months-v1";

function readAll(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeAll(s: Set<string>) {
  localStorage.setItem(KEY, JSON.stringify(Array.from(s)));
}

export function isTripsExcluded(client: string, month: string): boolean {
  return readAll().has(`${client}|${month}`);
}

export function setTripsExcluded(client: string, month: string, excluded: boolean) {
  const s = readAll();
  const k = `${client}|${month}`;
  if (excluded) s.add(k); else s.delete(k);
  writeAll(s);
}

export function fetchExcludedSet(): Set<string> {
  return readAll();
}
