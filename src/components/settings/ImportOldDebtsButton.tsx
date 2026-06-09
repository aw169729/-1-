import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Loader2, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fetchAllClients, buildClientLookup, normalizeName } from "@/lib/client-matching";

const SKIP_KEYWORDS = ["באמצע", "לבדוק", "אין דוח", "אין נתונים", "אין חשבונית", "אושר עד", "נהג", "סה\"כ", 'סה״כ'];

function shouldSkipName(name: string): boolean {
  if (!name) return true;
  const t = name.trim();
  if (!t) return true;
  if (/^\d+(\.\d+)?$/.test(t)) return true;
  for (const kw of SKIP_KEYWORDS) if (t.includes(kw)) return true;
  return false;
}

/** Parse a header cell into a YYYY-MM string if it looks like a date in DD/MM/YYYY (or a JS Date / Excel serial). */
function headerToMonth(val: unknown): string | null {
  if (val == null) return null;
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }
  if (typeof val === "number" && isFinite(val)) {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val);
    if (d && d.y) return `${d.y}-${String(d.m).padStart(2, "0")}`;
    return null;
  }
  const s = String(val).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const month = String(parseInt(m[2], 10)).padStart(2, "0");
  return `${m[3]}-${month}`;
}

function toAmount(val: unknown): number {
  if (val == null) return 0;
  if (typeof val === "number") return val;
  const s = String(val).replace(/[₪,\s]/g, "").trim();
  if (!s || s === "-") return 0;
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

interface Props {
  onImported?: () => void;
}

export function ImportOldDebtsButton({ onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const checkAndStart = async (file: File) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("payments")
        .select("id")
        .lt("amount_paid", 0)
        .limit(1);
      if (error) throw error;
      if (data && data.length > 0) {
        setPendingFile(file);
        setConfirmReplace(true);
        setLoading(false);
        return;
      }
      await runImport(file, false);
    } catch (err) {
      console.error(err);
      toast.error("שגיאה: " + (err instanceof Error ? err.message : "לא ידוע"));
      setLoading(false);
    }
  };

  const runImport = async (file: File, replace: boolean) => {
    setLoading(true);
    try {
      if (replace) {
        const { error: delErr } = await supabase
          .from("payments")
          .delete()
          .lt("amount_paid", 0);
        if (delErr) throw delErr;
      }

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });
      if (rows.length < 2) {
        toast.error("הקובץ ריק");
        return;
      }

      const headerRow = rows[0];
      // Identify month columns starting at index 6 (column ז)
      const monthCols: { idx: number; month: string }[] = [];
      for (let i = 6; i < headerRow.length; i++) {
        const m = headerToMonth(headerRow[i]);
        if (m) monthCols.push({ idx: i, month: m });
      }
      if (monthCols.length === 0) {
        toast.error("לא נמצאו עמודות חודשים בכותרת");
        return;
      }

      const clients = await fetchAllClients();
      const lookup = buildClientLookup(clients);
      const clientById = new Map(clients.map((c) => [c.id, c.name]));

      let clientsTouched = 0;
      let recordsInserted = 0;
      const seenClients = new Set<string>();
      const inserts: { client: string; month: string; amount_paid: number }[] = [];

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row) continue;
        const rawName = row[0] == null ? "" : String(row[0]).trim();
        if (shouldSkipName(rawName)) continue;
        const clientId = lookup.get(normalizeName(rawName));
        if (!clientId) continue;
        const officialName = clientById.get(clientId) || rawName;

        let touchedThis = false;
        for (const { idx, month } of monthCols) {
          const amt = toAmount(row[idx]);
          if (amt > 0) {
            inserts.push({
              client: officialName,
              month,
              amount_paid: -Math.abs(amt),
            });
            recordsInserted++;
            touchedThis = true;
          }
        }
        if (touchedThis) seenClients.add(officialName);
      }

      if (inserts.length === 0) {
        toast.error("לא נמצאו חובות לייבוא");
        return;
      }

      // Insert in chunks
      const chunkSize = 500;
      for (let i = 0; i < inserts.length; i += chunkSize) {
        const chunk = inserts.slice(i, i + chunkSize);
        const { error } = await supabase.from("payments").insert(chunk as never);
        if (error) throw error;
      }

      clientsTouched = seenClients.size;
      toast.success(`יובאו חובות עבור ${clientsTouched} לקוחות, ${recordsInserted} רשומות חודשיות.`);
      onImported?.();
    } catch (err) {
      console.error(err);
      toast.error("שגיאה בייבוא: " + (err instanceof Error ? err.message : "לא ידוע"));
    } finally {
      setLoading(false);
      setPendingFile(null);
      if (inputRef.current) inputRef.current.value = "";
    }
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
          if (f) checkAndStart(f);
        }}
      />
      <Button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        variant="outline"
      >
        {loading ? (
          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="ml-2 h-4 w-4" />
        )}
        {loading ? "מייבא..." : "ייבא חובות ישנים מאקסל"}
      </Button>

      <AlertDialog open={confirmReplace} onOpenChange={setConfirmReplace}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">כבר קיים ייבוא חובות. להחליף?</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              נמצאו רשומות חוב קיימות (תשלומים שליליים). פעולה זו תמחק אותן ותייבא מחדש מהקובץ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingFile(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              בטל
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingFile) runImport(pendingFile, true);
                setConfirmReplace(false);
              }}
            >
              החלף
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
