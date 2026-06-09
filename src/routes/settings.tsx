import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { Settings as SettingsIcon, ArrowRight, Users, Loader2, Save, Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { fetchVatRate, saveVatRate, DEFAULT_VAT_RATE } from "@/lib/business-settings";
import { fetchAllRows } from "@/lib/fetch-all";
import { useVat } from "@/contexts/vat-context";
import { AuthGate } from "@/components/auth/AuthGate";
import { useAuth } from "@/contexts/auth-context";
import { PageNav } from "@/components/auth/PageNav";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "הגדרות — ניהול נסיעות" },
      { name: "description", content: "הגדרות העסק: פרטי חברה, אחוז מע״מ, תבניות מסמכים, ייבוא וייצוא נתונים וניהול כללי של מערכת ניהול הנסיעות." },
      { property: "og:title", content: "הגדרות — ניהול נסיעות" },
      { property: "og:description", content: "הגדרות העסק, מע״מ, תבניות מסמכים וניהול כללי של המערכת." },
      { property: "og:url", content: "https://asher-weinberger.com/settings" },
    ],
    links: [{ rel: "canonical", href: "https://asher-weinberger.com/settings" }],
  }),
  component: () => (
    <AuthGate page="settings">
      <SettingsPage />
    </AuthGate>
  ),
});

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

interface MissingClient {
  id: string;
  name: string;
  email: string;
  phone: string;
  vat_number: string;
  collection_rate: string;
}

function SettingsPage() {
  const { canView } = useAuth();
  const { refresh: refreshVat } = useVat();
  // VAT
  const [vatInput, setVatInput] = useState<string>(String(DEFAULT_VAT_RATE));
  const [vatLoading, setVatLoading] = useState(true);
  const [vatSaving, setVatSaving] = useState(false);

  // Import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [missingDialog, setMissingDialog] = useState<MissingClient[] | null>(null);
  const [missingSaving, setMissingSaving] = useState(false);

  // Reset
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const loadVat = useCallback(async () => {
    setVatLoading(true);
    const v = await fetchVatRate();
    setVatInput(String(v));
    setVatLoading(false);
  }, []);

  useEffect(() => {
    loadVat();
  }, [loadVat]);

  const handleSaveVat = async () => {
    const n = Number(vatInput);
    if (!isFinite(n) || n < 0 || n > 100) {
      toast.error("יש להזין אחוז בין 0 ל-100");
      return;
    }
    setVatSaving(true);
    try {
      await saveVatRate(n);
      await refreshVat();
      toast.success("אחוז המע\"מ נשמר");
    } catch (e) {
      console.error(e);
      toast.error("שגיאה בשמירה");
    } finally {
      setVatSaving(false);
    }
  };

  const checkMissingFields = async () => {
    const { data, error } = await fetchAllRows<{
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
      vat_number: string | null;
      collection_rate: number | null;
    }>((from, to) =>
      supabase
        .from("clients")
        .select("id, name, email, phone, vat_number, collection_rate")
        .order("name")
        .range(from, to),
    );
    if (error) {
      console.error(error);
      return;
    }
    const missing: MissingClient[] = [];
    for (const c of data) {
      const emailMissing = !c.email || !String(c.email).trim();
      const phoneMissing = !c.phone || !String(c.phone).trim();
      const vatMissing = !c.vat_number || !String(c.vat_number).trim();
      const rateMissing = c.collection_rate == null;
      if (emailMissing || phoneMissing || vatMissing || rateMissing) {
        missing.push({
          id: c.id,
          name: c.name,
          email: c.email ?? "",
          phone: c.phone ?? "",
          vat_number: c.vat_number ?? "",
          collection_rate: c.collection_rate != null ? String(c.collection_rate) : "",
        });
      }
    }
    if (missing.length > 0) {
      setMissingDialog(missing);
    } else {
      toast.success("כל הלקוחות מלאים בכל השדות");
    }
  };

  const handleFile = async (file: File) => {
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });

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

      toast.success(`עודכנו ${updated} לקוחות. נוספו ${created}. דולגו ${skipped} שורות.`);
      await checkMissingFields();
    } catch (err) {
      console.error(err);
      toast.error("שגיאה בייבוא: " + (err instanceof Error ? err.message : "לא ידוע"));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const allMissingFilled = (list: MissingClient[]): boolean => {
    return list.every(
      (c) =>
        c.email.trim() !== "" &&
        c.phone.trim() !== "" &&
        c.vat_number.trim() !== "" &&
        c.collection_rate.trim() !== "",
    );
  };

  const updateMissingField = (id: string, field: keyof MissingClient, value: string) => {
    setMissingDialog((prev) =>
      prev ? prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)) : prev,
    );
  };

  const saveMissing = async () => {
    if (!missingDialog) return;
    if (!allMissingFilled(missingDialog)) {
      toast.error("יש למלא את כל השדות עבור כל הלקוחות");
      return;
    }
    setMissingSaving(true);
    try {
      for (const c of missingDialog) {
        const rateNum = Number(c.collection_rate);
        const payload: Record<string, unknown> = {
          email: c.email.trim(),
          phone: c.phone.trim(),
          vat_number: c.vat_number.trim(),
          collection_rate: isFinite(rateNum) ? rateNum : null,
        };
        if (isFinite(rateNum)) {
          payload.markup_type = "percent";
          payload.markup_value = rateNum;
        }
        const { error } = await supabase
          .from("clients")
          .update(payload as never)
          .eq("id", c.id);
        if (error) throw error;
      }
      toast.success("הפרטים נשמרו");
      setMissingDialog(null);
    } catch (e) {
      console.error(e);
      toast.error("שגיאה בשמירה");
    } finally {
      setMissingSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const t = await supabase.from("trips").delete().not("id", "is", null);
      if (t.error) throw t.error;
      const p = await supabase.from("payments").delete().not("id", "is", null);
      if (p.error) throw p.error;
      toast.success("כל הנסיעות והתשלומים נמחקו");
      setConfirmReset(false);
    } catch (e) {
      console.error(e);
      toast.error("שגיאה במחיקה: " + (e instanceof Error ? e.message : "לא ידוע"));
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" richColors />
      <header className="border-b border-border/60 bg-card shadow-[var(--shadow-card)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <SettingsIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">הגדרות</h1>
              <p className="text-xs text-muted-foreground">הגדרות מערכת ופעולות תחזוקה</p>
            </div>
          </div>
          <PageNav current="settings" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        {/* חלק א — ייבוא לקוחות */}
        <section className="space-y-3 rounded-xl bg-card p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-lg font-semibold text-foreground">ייבוא לקוחות מאקסל</h2>
          <p className="text-sm text-muted-foreground">
            הקובץ צריך להכיל: עמודה א=שם, ב=סה"כ (יתעלם), ג=אחוז גבייה, ד=הערות, ה=טלפון, ו=מייל.
            הייבוא יעדכן שם, מייל, טלפון וח"פ של לקוחות קיימים. לאחר הייבוא תופיע חלונית להשלמת שדות חסרים.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={importing}>
            {importing ? (
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            ) : (
              <Users className="ml-2 h-4 w-4" />
            )}
            {importing ? "מייבא..." : "ייבא לקוחות מאקסל"}
          </Button>
        </section>

        {/* חלק ב — אחוז מע"מ */}
        <section className="space-y-3 rounded-xl bg-card p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-lg font-semibold text-foreground">אחוז מע"מ</h2>
          <p className="text-sm text-muted-foreground">
            ערך זה משמש לחישוב מע"מ בכל המערכת — בדוחות PDF ובדרישות תשלום.
          </p>
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="vat-rate">אחוז מע"מ</Label>
              <Input
                id="vat-rate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={vatInput}
                onChange={(e) => setVatInput(e.target.value)}
                className="w-32 text-right"
                dir="ltr"
                disabled={vatLoading}
              />
            </div>
            <Button onClick={handleSaveVat} disabled={vatSaving || vatLoading}>
              <Save className="ml-2 h-4 w-4" />
              {vatSaving ? "שומר..." : "שמור"}
            </Button>
          </div>
        </section>

        {/* חלק ג — מחיקת נתונים */}
        <section className="space-y-3 rounded-xl border border-destructive/30 bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h2 className="text-lg font-semibold text-destructive">אזור מסוכן</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            פעולה זו תמחק את כל הנסיעות, החובות הישנים והתשלומים. הלקוחות וההגדרות יישמרו.
          </p>
          <Button
            variant="destructive"
            onClick={() => setConfirmReset(true)}
            disabled={resetting}
          >
            <Trash2 className="ml-2 h-4 w-4" />
            אפס נתוני נסיעות ותשלומים
          </Button>
        </section>
      </main>

      {/* חלונית השלמת שדות חסרים */}
      <Dialog
        open={!!missingDialog}
        onOpenChange={(o) => {
          if (!o) {
            // prevent closing unless all filled
            if (missingDialog && !allMissingFilled(missingDialog)) {
              toast.error("לא ניתן לסגור עד שכל השדות מולאו");
              return;
            }
            setMissingDialog(null);
          }
        }}
      >
        <DialogContent
          className="max-w-4xl max-h-[90vh] overflow-y-auto"
          dir="rtl"
          onInteractOutside={(e) => {
            if (missingDialog && !allMissingFilled(missingDialog)) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (missingDialog && !allMissingFilled(missingDialog)) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>השלמת פרטי לקוחות חסרים</DialogTitle>
            <DialogDescription>
              חובה למלא את כל השדות (מייל, טלפון, ח"פ, אחוז גבייה) לכל לקוח. לא ניתן לסגור את החלונית עד שכל השדות מולאו.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {missingDialog?.map((c) => (
              <div
                key={c.id}
                className="rounded-lg border border-border/60 p-3"
              >
                <div className="mb-2 font-semibold text-foreground">{c.name}</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <Label className="text-xs">מייל</Label>
                    <Input
                      dir="ltr"
                      value={c.email}
                      onChange={(e) => updateMissingField(c.id, "email", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">טלפון</Label>
                    <Input
                      dir="ltr"
                      value={c.phone}
                      onChange={(e) => updateMissingField(c.id, "phone", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">ח"פ</Label>
                    <Input
                      dir="ltr"
                      value={c.vat_number}
                      onChange={(e) => updateMissingField(c.id, "vat_number", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">אחוז גבייה</Label>
                    <Input
                      dir="ltr"
                      type="number"
                      step="0.01"
                      value={c.collection_rate}
                      onChange={(e) => updateMissingField(c.id, "collection_rate", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border/60 bg-card pt-3">
            <Button
              onClick={saveMissing}
              disabled={
                missingSaving || !missingDialog || !allMissingFilled(missingDialog)
              }
            >
              {missingSaving ? "שומר..." : "שמור והמשך"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* אישור איפוס */}
      <AlertDialog open={confirmReset} onOpenChange={(o) => !resetting && setConfirmReset(o)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>לאפס את כל הנסיעות והתשלומים?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק את כל הנסיעות, החובות הישנים והתשלומים. הלקוחות וההגדרות יישמרו. האם להמשיך?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleReset();
              }}
              disabled={resetting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {resetting ? "מוחק..." : "כן, מחק הכל"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
