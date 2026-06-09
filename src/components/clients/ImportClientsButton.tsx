import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fetchAllRows } from "@/lib/fetch-all";

interface Props {
  onImported?: () => void;
}

const SKIP_KEYWORDS = ["באמצע", "לבדוק", "אין דוח", "אין נתונים", "אין חשבונית", "אושר עד", "נהג"];

function shouldSkipName(name: string): boolean {
  if (!name) return true;
  const trimmed = name.trim();
  if (!trimmed) return true;
  if (/^\d+(\.\d+)?$/.test(trimmed)) return true;
  for (const kw of SKIP_KEYWORDS) {
    if (trimmed.includes(kw)) return true;
  }
  return false;
}

function parseRate(val: unknown): number | null {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s || s === "-") return null;
  const num = Number(s.replace("%", "").trim());
  if (!isFinite(num)) return null;
  return num;
}

function cellToString(val: unknown): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s || s === "-") return null;
  return s;
}

export function ImportClientsButton({ onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });

      // Fetch all existing clients
      const { data: existing, error: fetchErr } = await fetchAllRows<{ id: string; name: string }>((from, to) =>
        supabase.from("clients").select("id, name").range(from, to),
      );
      if (fetchErr) throw fetchErr;
      const byName = new Map<string, string>();
      for (const c of existing) byName.set((c.name ?? "").trim(), c.id);

      let updated = 0;
      let created = 0;
      let skipped = 0;

      for (const row of rows) {
        const name = row?.[0] == null ? "" : String(row[0]).trim();
        if (shouldSkipName(name)) {
          skipped++;
          continue;
        }
        const collection_rate = parseRate(row?.[2]);
        const rateNum = collection_rate;
        const markup_type = rateNum != null ? "percent" : null;
        const markup_value = rateNum;
        const notes = cellToString(row?.[3]);
        const phone = cellToString(row?.[4]);
        const email = cellToString(row?.[5]);

        const existingId = byName.get(name);
        if (existingId) {
          const { error } = await supabase
            .from("clients")
            .update({ collection_rate, notes, phone, email, markup_type, markup_value } as never)
            .eq("id", existingId);
          if (error) throw error;
          updated++;
        } else {
          const { error } = await supabase
            .from("clients")
            .insert({ name, collection_rate, notes, phone, email, markup_type, markup_value } as never);
          if (error) throw error;
          created++;
        }
      }

      toast.success(
        `עודכנו ${updated} לקוחות. נוספו ${created} לקוחות. דולגו ${skipped} שורות.`,
      );
      onImported?.();
    } catch (err) {
      console.error(err);
      toast.error("שגיאה בייבוא: " + (err instanceof Error ? err.message : "לא ידוע"));
    } finally {
      setLoading(false);
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
          if (f) handleFile(f);
        }}
      />
      <Button
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        variant="outline"
      >
        {loading ? (
          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
        ) : (
          <Users className="ml-2 h-4 w-4" />
        )}
        {loading ? "מייבא..." : "ייבא לקוחות מאקסל"}
      </Button>
    </>
  );
}