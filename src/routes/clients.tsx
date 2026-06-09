import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Users, ArrowRight, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus as PlusIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchAllRows } from "@/lib/fetch-all";
import { toast } from "sonner";
import { ImportClientsButton } from "@/components/clients/ImportClientsButton";
import { renameClient } from "@/lib/client-matching";
import { AuthGate } from "@/components/auth/AuthGate";
import { useAuth } from "@/contexts/auth-context";
import { PageNav } from "@/components/auth/PageNav";

export const Route = createFileRoute("/clients")({
  head: () => ({
    meta: [
      { title: "לקוחות — ניהול נסיעות" },
      { name: "description", content: "ניהול רשימת הלקוחות של עסק ההסעות: הוספה, עריכה, מחיקה וצפייה בפרטי קשר ותעריפים לכל לקוח." },
      { property: "og:title", content: "לקוחות — ניהול נסיעות" },
      { property: "og:description", content: "ניהול רשימת הלקוחות של עסק ההסעות: הוספה, עריכה ופרטי קשר לכל לקוח." },
      { property: "og:url", content: "https://asher-weinberger.com/clients" },
    ],
    links: [{ rel: "canonical", href: "https://asher-weinberger.com/clients" }],
  }),
  component: () => (
    <AuthGate page="clients">
      <ClientsPage />
    </AuthGate>
  ),
});

interface ClientRecord {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  vat_number: string | null;
  notes: string | null;
  collection_rate: number | null;
  markup_type: string | null;
  markup_value: number | null;
  markup_includes_vat: boolean | null;
  show_driver_price: boolean | null;
  show_full_price_breakdown: boolean | null;
  sort_by_date: string | null;
  sort_by_origin: string | null;
  exclude_from_total: boolean | null;
  created_at: string;
}

function ClientsPage() {
  const { canView } = useAuth();
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ClientRecord | null>(null);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const c = await fetchAllRows<ClientRecord>((from, to) =>
      supabase.from("clients").select("*").order("name").range(from, to),
    );
    if (!c.error) setClients(c.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeSync(["clients", "phone_routing"], load);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(q));
  }, [clients, search]);

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" richColors />
      <header className="border-b border-border/60 bg-card shadow-[var(--shadow-card)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">לקוחות</h1>
              <p className="text-xs text-muted-foreground">ניהול הלקוחות והגדרות תמחור</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setAdding(true)}>
              <Plus className="ml-2 h-4 w-4" />
              הוסף לקוח
            </Button>
            <ImportClientsButton onImported={load} />
            <PageNav current="clients" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
        <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="חיפוש לקוח"
              placeholder="חפש לקוח..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl bg-card p-12 text-center text-muted-foreground shadow-[var(--shadow-card)]">
            טוען...
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-card)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">שם</TableHead>
                  <TableHead className="text-right">טלפון</TableHead>
                  <TableHead className="text-right">מייל</TableHead>
                  <TableHead className="text-right">תוספת מחיר</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/30">
                    <TableCell
                      className="font-medium text-foreground"
                      onClick={() => setEditing(c)}
                    >
                      {c.name}
                    </TableCell>
                    <TableCell dir="ltr" className="text-right" onClick={() => setEditing(c)}>
                      {c.phone || "—"}
                    </TableCell>
                    <TableCell onClick={() => setEditing(c)}>{c.email || "—"}</TableCell>
                    <TableCell onClick={() => setEditing(c)}>
                      {c.markup_value != null && c.markup_type
                        ? c.markup_type === "percent"
                          ? `${c.markup_value}%`
                          : `₪${c.markup_value}`
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      <ClientFormDialog
        open={!!editing || adding}
        client={editing}
        onClose={() => {
          setEditing(null);
          setAdding(false);
        }}
        onSaved={() => {
          setEditing(null);
          setAdding(false);
          load();
        }}
      />

    </div>
  );
}

interface FormProps {
  open: boolean;
  client: ClientRecord | null;
  onClose: () => void;
  onSaved: () => void;
}

function ClientFormDialog({ open, client, onClose, onSaved }: FormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [vat, setVat] = useState("");
  const [notes, setNotes] = useState("");
  const [markupType, setMarkupType] = useState<"percent" | "fixed">("percent");
  const [markupValue, setMarkupValue] = useState("");
  const [markupIncludesVat, setMarkupIncludesVat] = useState(false);
  const [showDriverPrice, setShowDriverPrice] = useState(false);
  const [showFullBreakdown, setShowFullBreakdown] = useState(false);
  const [excludeFromTotal, setExcludeFromTotal] = useState(false);
  const [sortByDate, setSortByDate] = useState<"none" | "asc" | "desc">("none");
  const [sortByOrigin, setSortByOrigin] = useState<"none" | "asc" | "desc">("none");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [routedPhones, setRoutedPhones] = useState<Array<{ id?: string; phone: string }>>([]);
  const [newPhone, setNewPhone] = useState("");

  useEffect(() => {
    if (open) {
      setName(client?.name ?? "");
      setEmail(client?.email ?? "");
      setPhone(client?.phone ?? "");
      setVat(client?.vat_number ?? "");
      setNotes(client?.notes ?? "");
      setMarkupType((client?.markup_type as "percent" | "fixed") || "percent");
      setMarkupValue(client?.markup_value != null ? String(client.markup_value) : "");
      setMarkupIncludesVat(!!client?.markup_includes_vat);
      setShowDriverPrice(!!client?.show_driver_price);
      setShowFullBreakdown(!!client?.show_full_price_breakdown);
      setExcludeFromTotal(!!client?.exclude_from_total);
      setSortByDate(((client?.sort_by_date as "none" | "asc" | "desc") || "none"));
      setSortByOrigin(((client?.sort_by_origin as "none" | "asc" | "desc") || "none"));
      setNewPhone("");
      if (client) {
        supabase
          .from("phone_routing")
          .select("id, phone")
          .eq("client_id", client.id)
          .then(({ data }) => {
            setRoutedPhones((data ?? []) as Array<{ id: string; phone: string }>);
          });
      } else {
        setRoutedPhones([]);
      }
    }
  }, [open, client]);

  const save = async () => {
    if (!name.trim()) {
      toast.error("נדרש שם לקוח");
      return;
    }
    setSaving(true);
    // Include any pending phone still in the input field
    const pending = newPhone.trim();
    const mergedPhones = [...routedPhones];
    if (pending && !mergedPhones.some((p) => p.phone === pending)) {
      mergedPhones.push({ phone: pending });
    }
    // Normalize: trim, drop empty, dedupe
    const normalizedPhones = Array.from(
      new Map(
        mergedPhones
          .map((p) => ({ ...p, phone: p.phone.trim() }))
          .filter((p) => p.phone)
          .map((p) => [p.phone, p]),
      ).values(),
    );
    const payload = {
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      vat_number: vat.trim() || null,
      notes: notes.trim() || null,
      markup_type: markupValue.trim() ? markupType : null,
      markup_value: markupValue.trim() ? parseFloat(markupValue) : null,
      markup_includes_vat: markupIncludesVat,
      show_driver_price: showDriverPrice,
      show_full_price_breakdown: showFullBreakdown,
      exclude_from_total: excludeFromTotal,
      sort_by_date: sortByDate,
      sort_by_origin: sortByOrigin,
    };
    let clientId = client?.id;
    if (client) {
      const { error } = await supabase.from("clients").update(payload).eq("id", client.id);
      if (error) {
        setSaving(false);
        toast.error("שגיאה בשמירה: " + error.message);
        return;
      }
      // Cascade name change to trips/payments rows referencing the old name
      if (client.name.trim() !== name.trim()) {
        try {
          await renameClient(client.id, client.name, name);
        } catch (e) {
          setSaving(false);
          toast.error("שגיאה בעדכון שם: " + (e as Error).message);
          return;
        }
      }
    } else {
      const { data, error } = await supabase.from("clients").insert(payload).select("id").single();
      if (error || !data) {
        setSaving(false);
        toast.error("שגיאה בשמירה: " + (error?.message ?? ""));
        return;
      }
      clientId = (data as { id: string }).id;
    }
    if (clientId) {
      const existing = await supabase
        .from("phone_routing")
        .select("id, phone")
        .eq("client_id", clientId);
      const existingList = (existing.data ?? []) as Array<{ id: string; phone: string }>;
      const currentPhones = new Set(normalizedPhones.map((p) => p.phone));
      const toDelete = existingList.filter((e) => !currentPhones.has(e.phone)).map((e) => e.id);
      const existingPhones = new Set(existingList.map((e) => e.phone));
      const toInsert = normalizedPhones
        .filter((p) => !existingPhones.has(p.phone))
        .map((p) => ({ phone: p.phone, client_id: clientId! }));
      if (toDelete.length) {
        const del = await supabase.from("phone_routing").delete().in("id", toDelete);
        if (del.error) {
          setSaving(false);
          toast.error("שגיאה במחיקת ניתוב טלפון: " + del.error.message);
          return;
        }
      }
      if (toInsert.length) {
        const ins = await supabase.from("phone_routing").insert(toInsert);
        if (ins.error) {
          setSaving(false);
          toast.error("שגיאה בשמירת ניתוב טלפון: " + ins.error.message);
          return;
        }
      }
      // Cascade phone routing to existing trips: reassign any trip whose
      // phone matches a routed phone but is not yet linked to this client.
      const allPhones = normalizedPhones.map((p) => p.phone);
      if (allPhones.length) {
        const { data: updated, error: updErr } = await supabase
          .from("trips")
          .update({ client_id: clientId, client: name.trim() } as never)
          .in("phone", allPhones)
          .or(`client_id.is.null,client_id.neq.${clientId}`)
          .select("id");
        if (updErr) {
          setSaving(false);
          toast.error("שגיאה בשיוך נסיעות לפי טלפון: " + updErr.message);
          return;
        }
        const count = updated?.length ?? 0;
        if (count > 0) {
          toast.success(`שויכו ${count} נסיעות לפי ניתוב טלפון`);
        }
      }
    }
    setSaving(false);
    toast.success(client ? "הלקוח עודכן" : "הלקוח נוסף");
    onSaved();
  };

  const handleDelete = async () => {
    if (!client) return;
    setDeleting(true);
    const t = await supabase.from("trips").update({ client_id: null }).eq("client_id", client.id);
    if (t.error) {
      setDeleting(false);
      toast.error("שגיאה בניתוק נסיעות: " + t.error.message);
      return;
    }
    const { error } = await supabase.from("clients").delete().eq("id", client.id);
    setDeleting(false);
    setConfirmDelete(false);
    if (error) {
      toast.error("שגיאה במחיקה: " + error.message);
      return;
    }
    toast.success("הלקוח נמחק");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{client ? `עריכת ${client.name}` : "הוספת לקוח"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div>
            <Label>שם רשמי</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>טלפון</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
            </div>
            <div>
              <Label>מייל</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
            </div>
          </div>
          <div>
            <Label>ח"פ</Label>
            <Input value={vat} onChange={(e) => setVat(e.target.value)} dir="ltr" />
          </div>
          <div>
            <Label>הערות לדוח PDF</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>סוג תוספת</Label>
            <div className="mt-1 flex gap-2">
              <Button
                type="button"
                variant={markupType === "percent" ? "default" : "outline"}
                size="sm"
                onClick={() => setMarkupType("percent")}
              >
                אחוזים
              </Button>
              <Button
                type="button"
                variant={markupType === "fixed" ? "default" : "outline"}
                size="sm"
                onClick={() => setMarkupType("fixed")}
              >
                סכום קבוע
              </Button>
            </div>
          </div>
          <div>
            <Label>ערך התוספת ({markupType === "percent" ? "%" : "₪"})</Label>
            <Input
              type="number"
              step="0.01"
              value={markupValue}
              onChange={(e) => setMarkupValue(e.target.value)}
              dir="ltr"
              className="text-right"
              placeholder="ריק = ללא תוספת"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="markup-includes-vat"
              checked={markupIncludesVat}
              onCheckedChange={(v) => setMarkupIncludesVat(!!v)}
            />
            <Label htmlFor="markup-includes-vat" className="cursor-pointer">
              המחיר כבר כולל מע"מ (אל תוסיף מע"מ בדרישת תשלום ובדוח)
            </Label>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="show-driver-price"
              checked={showDriverPrice}
              onCheckedChange={(v) => setShowDriverPrice(!!v)}
            />
            <Label htmlFor="show-driver-price" className="cursor-pointer">
              הצג מחיר לנהג בדוח
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="show-full-breakdown"
              checked={showFullBreakdown}
              onCheckedChange={(v) => setShowFullBreakdown(!!v)}
            />
            <Label htmlFor="show-full-breakdown" className="cursor-pointer">
              הצג מחיר לנהג + מחיר ללקוח + מע"מ בדוח
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="exclude-from-total"
              checked={excludeFromTotal}
              onCheckedChange={(v) => setExcludeFromTotal(!!v)}
            />
            <Label htmlFor="exclude-from-total" className="cursor-pointer">
              אל תכלול את הלקוח בסה"כ החובות בדרישת תשלום
            </Label>
          </div>
          <div className="border-t pt-3 space-y-3">
            <Label>סינון נסיעות בדוח / אקסל</Label>
            <p className="text-xs text-muted-foreground">
              ניתן לבחור אחד או שניהם. אם נבחרים שניהם — קודם לפי תאריך, ובתוך אותו יום לפי א״ב של עיר מוצא.
            </p>
            <div>
              <Label className="text-sm">לפי תאריך</Label>
              <div className="mt-1 flex gap-2">
                <Button type="button" size="sm" variant={sortByDate === "none" ? "default" : "outline"} onClick={() => setSortByDate("none")}>ללא</Button>
                <Button type="button" size="sm" variant={sortByDate === "asc" ? "default" : "outline"} onClick={() => setSortByDate("asc")}>מההתחלה לסוף</Button>
                <Button type="button" size="sm" variant={sortByDate === "desc" ? "default" : "outline"} onClick={() => setSortByDate("desc")}>מהסוף להתחלה</Button>
              </div>
            </div>
            <div>
              <Label className="text-sm">לפי א״ב של עיר מוצא</Label>
              <div className="mt-1 flex gap-2">
                <Button type="button" size="sm" variant={sortByOrigin === "none" ? "default" : "outline"} onClick={() => setSortByOrigin("none")}>ללא</Button>
                <Button type="button" size="sm" variant={sortByOrigin === "asc" ? "default" : "outline"} onClick={() => setSortByOrigin("asc")}>מא׳ לת׳</Button>
                <Button type="button" size="sm" variant={sortByOrigin === "desc" ? "default" : "outline"} onClick={() => setSortByOrigin("desc")}>מת׳ לא׳</Button>
              </div>
            </div>
          </div>
          <div className="border-t pt-3">
            <Label>ניתוב לפי טלפון</Label>
            <p className="text-xs text-muted-foreground mt-1 mb-2">
              נסיעות עם מספרי הטלפון האלה — ישויכו ללקוח זה גם אם הפתק שונה.
            </p>
            <div className="space-y-2">
              {routedPhones.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={p.phone} dir="ltr" readOnly className="text-right flex-1" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setRoutedPhones(routedPhones.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="מספר טלפון חדש"
                  dir="ltr"
                  className="text-right flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const v = newPhone.trim();
                      if (!v) return;
                      setRoutedPhones((prev) =>
                        prev.some((p) => p.phone === v) ? prev : [...prev, { phone: v }],
                      );
                      setNewPhone("");
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const v = newPhone.trim();
                    if (!v) return;
                    setRoutedPhones((prev) =>
                      prev.some((p) => p.phone === v) ? prev : [...prev, { phone: v }],
                    );
                    setNewPhone("");
                  }}
                >
                  <PlusIcon className="ml-1 h-4 w-4" />
                  הוסף מספר
                </Button>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="sm:justify-start">
          <Button onClick={save} disabled={saving}>
            {saving ? "שומר..." : "שמור"}
          </Button>
          <Button variant="outline" onClick={onClose}>
            ביטול
          </Button>
          {client && (
            <Button
              variant="destructive"
              onClick={() => setConfirmDelete(true)}
              className="sm:mr-auto"
            >
              מחק לקוח
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
      {client && (
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>האם למחוק את הלקוח {client.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                פעולה זו תמחק את הלקוח מהמערכת אך לא תמחק את הנסיעות שלו.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>בטל</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "מוחק..." : "מחק"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </Dialog>
  );
}
