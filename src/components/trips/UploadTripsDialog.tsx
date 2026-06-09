import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseExcelDate } from "@/lib/hebrew-date";
import { fetchBillingMonth } from "@/lib/billing-month";
import {
  fetchAllClients,
  buildClientLookup,
  normalizeName,
  createClient,
  addAliasToClient,
  type ClientRow,
} from "@/lib/client-matching";
import { ResolveClientsDialog, type Resolution } from "./ResolveClientsDialog";
import { AssignNoteDialog, type NoteGroup } from "./AssignNoteDialog";
import { fetchAllRows } from "@/lib/fetch-all";

interface Props {
  onUploaded: () => void;
}

const COLUMN_MAP: Record<string, string> = {
  "מספר נסיעה": "trip_number",
  "פתק": "client",
  "שם מזמין": "passenger_name",
  "מוצא": "origin",
  "יעד": "destination",
  "מחיר נהג": "price",
  "טלפון לקוח": "phone",
  "תאריך": "trip_date",
};

const MIN_AUTO = 1;
const MAX_AUTO = 9999;

async function findNextTripNumbers(count: number): Promise<string[]> {
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

export function UploadTripsDialog({ onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  // Flow A: has trip numbers — resolve unknown client names
  const [resolving, setResolving] = useState(false);
  const [pendingRows, setPendingRows] = useState<Array<Record<string, unknown>>>([]);
  const [unmatchedNames, setUnmatchedNames] = useState<string[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [saving, setSaving] = useState(false);

  // Flow B: no trip numbers / no פתק — assign note dialog
  const [assigning, setAssigning] = useState(false);
  const [unnumberedRows, setUnnumberedRows] = useState<Array<Record<string, unknown>>>([]);

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const billing = await fetchBillingMonth();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });

      const parsed = rows.map((row) => {
        const obj: Record<string, unknown> = {};
        for (const [hebKey, dbKey] of Object.entries(COLUMN_MAP)) {
          const val = row[hebKey];
          if (dbKey === "trip_date") obj[dbKey] = parseExcelDate(val);
          else if (dbKey === "price") obj[dbKey] = val == null || val === "" ? null : Number(val);
          else obj[dbKey] = val == null ? null : String(val).trim();
        }
        obj.billing_month = billing.month;
        return obj;
      });

      if (parsed.length === 0) {
        toast.error("לא נמצאו נסיעות בקובץ");
        return;
      }

      // Detect if trip numbers / פתק are missing
      const missingNumbers = parsed.every((r) => !r.trip_number);
      const missingNotes = parsed.every((r) => !r.client);

      // ── Flow B: no trip numbers ────────────────────────────────────────────
      if (missingNumbers) {
        const clientList = await fetchAllClients();
        setClients(clientList);
        setUnnumberedRows(parsed);
        setAssigning(true);
        return;
      }

      // ── Flow A: has trip numbers ───────────────────────────────────────────
      const withNumbers = parsed.filter((r) => r.trip_number);

      // Dedupe against DB and within file
      const numbers = withNumbers.map((r) => r.trip_number as string);
      const { data: existing, error: existingErr } = await supabase
        .from("trips")
        .select("trip_number")
        .in("trip_number", numbers);
      if (existingErr) throw existingErr;
      const existingSet = new Set((existing ?? []).map((e) => e.trip_number));

      const seenInFile = new Set<string>();
      const toInsert: Array<Record<string, unknown>> = [];
      let skipped = 0;
      for (const row of withNumbers) {
        const num = row.trip_number as string;
        if (existingSet.has(num) || seenInFile.has(num)) { skipped++; continue; }
        seenInFile.add(num);
        toInsert.push(row);
      }

      if (toInsert.length === 0) {
        toast.info(`לא נוספו נסיעות חדשות. דולגו ${skipped} כפולות.`);
        return;
      }

      // Match clients
      const clientList = await fetchAllClients();
      const lookup = buildClientLookup(clientList);
      const { data: routingData } = await fetchAllRows<{ phone: string; client_id: string }>((from, to) =>
        supabase.from("phone_routing").select("phone, client_id").range(from, to),
      );
      const phoneRouting = new Map<string, string>();
      for (const r of routingData) {
        if (r.phone) phoneRouting.set(r.phone.trim(), r.client_id);
      }
      const unmatched = new Set<string>();
      for (const row of toInsert) {
        const tripPhone = (row.phone as string | null)?.trim();
        if (tripPhone && phoneRouting.has(tripPhone)) {
          row.client_id = phoneRouting.get(tripPhone);
          continue;
        }
        const name = normalizeName(row.client as string | null);
        if (!name) continue;
        const id = lookup.get(name);
        if (id) row.client_id = id;
        else unmatched.add(name);
      }

      if (unmatched.size === 0) {
        await saveTrips(toInsert, skipped);
        return;
      }

      setPendingRows(toInsert);
      setUnmatchedNames(Array.from(unmatched));
      setClients(clientList);
      setResolving(true);
      toast.info(`נמצאו ${skipped} כפולות. נדרש לטפל ב-${unmatched.size} שמות לא מזוהים.`);
    } catch (err) {
      console.error(err);
      toast.error("שגיאה בהעלאת הקובץ: " + (err instanceof Error ? err.message : "לא ידוע"));
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const saveTrips = async (rows: Array<Record<string, unknown>>, skipped: number) => {
    const { error } = await supabase.from("trips").insert(rows as never);
    if (error) throw error;
    toast.success(`נוספו ${rows.length} נסיעות. דולגו ${skipped} כפולות.`);
    onUploaded();
  };

  // ── Flow B: assign notes + auto numbers ─────────────────────────────────
  const handleAssignNote = async (groups: NoteGroup[]) => {
    setSaving(true);
    try {
      // Assign client_id per row based on groups
      const rows = unnumberedRows.map((row, idx) => {
        const group = groups.find((g) => idx >= g.fromRow && idx <= g.toRow);
        const client = clients.find((c) => c.id === group?.clientId);
        return {
          ...row,
          client_id: group?.clientId ?? null,
          client: client?.name ?? row.client ?? null,
        };
      });

      // Auto-generate trip numbers
      const numbers = await findNextTripNumbers(rows.length);
      if (numbers.length < rows.length) {
        toast.error("לא מספיק מספרי נסיעה פנויים בטווח 0001–9999");
        return;
      }
      const finalRows = rows.map((row, idx) => ({ ...row, trip_number: numbers[idx] }));

      const { error } = await supabase.from("trips").insert(finalRows as never);
      if (error) throw error;

      toast.success(`נוספו ${finalRows.length} נסיעות עם מספרים אוטומטיים.`);
      setAssigning(false);
      setUnnumberedRows([]);
      onUploaded();
    } catch (err) {
      console.error(err);
      toast.error("שגיאה בשמירה: " + (err instanceof Error ? err.message : "לא ידוע"));
    } finally {
      setSaving(false);
    }
  };

  // ── Flow A: resolve unknown names ────────────────────────────────────────
  const handleResolve = async (resolutions: Record<string, Resolution>) => {
    setSaving(true);
    try {
      const nameToId = new Map<string, string>();
      for (const [name, res] of Object.entries(resolutions)) {
        if (res.mode === "new") {
          const created = await createClient(name);
          nameToId.set(name, created.id);
        } else {
          await addAliasToClient(res.clientId, name);
          nameToId.set(name, res.clientId);
        }
      }
      const finalRows = pendingRows.map((row) => {
        if (row.client_id) return row;
        const name = normalizeName(row.client as string | null);
        const id = nameToId.get(name);
        return id ? { ...row, client_id: id } : row;
      });
      const { error } = await supabase.from("trips").insert(finalRows as never);
      if (error) throw error;
      toast.success(`נוספו ${finalRows.length} נסיעות.`);
      setResolving(false);
      setPendingRows([]);
      setUnmatchedNames([]);
      onUploaded();
    } catch (err) {
      console.error(err);
      toast.error("שגיאה בשמירה: " + (err instanceof Error ? err.message : "לא ידוע"));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setResolving(false);
    setPendingRows([]);
    setUnmatchedNames([]);
    setAssigning(false);
    setUnnumberedRows([]);
    toast.info("ההעלאה בוטלה. לא נשמרו נסיעות.");
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <Button onClick={() => inputRef.current?.click()} disabled={loading} size="lg">
        {loading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Upload className="ml-2 h-4 w-4" />}
        {loading ? "מעלה..." : "העלה קובץ Excel"}
      </Button>

      {/* Flow A */}
      <ResolveClientsDialog
        open={resolving}
        unmatchedNames={unmatchedNames}
        clients={clients}
        saving={saving}
        onCancel={handleCancel}
        onConfirm={handleResolve}
      />

      {/* Flow B */}
      <AssignNoteDialog
        open={assigning}
        tripCount={unnumberedRows.length}
        clients={clients}
        saving={saving}
        onConfirm={handleAssignNote}
        onCancel={handleCancel}
      />
    </>
  );
}
