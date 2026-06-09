import { useEffect, useMemo, useState } from "react";
import { Trash2, Search, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDateHebrew } from "@/lib/hebrew-date";
import { computeClientPrice } from "@/lib/client-price";
import { fetchAllRows } from "@/lib/fetch-all";
import type { Trip } from "./types";

interface Props {
  trips: Trip[];
  onChanged: () => void;
}

interface ClientOption {
  id: string;
  name: string;
  markup_type?: string | null;
  markup_value?: number | null;
}

export function TripsTable({ trips, onChanged }: Props) {
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("__all__");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [clientList, setClientList] = useState<ClientOption[]>([]);
  const [editTrip, setEditTrip] = useState<Trip | null>(null);
  const [editForm, setEditForm] = useState<Partial<Trip>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAllRows<ClientOption>((from, to) =>
      supabase
        .from("clients")
        .select("id, name, markup_type, markup_value")
        .order("name")
        .range(from, to),
    ).then(({ data }) => setClientList(data));
  }, []);

  const clientNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clientList) m.set(c.id, c.name);
    return m;
  }, [clientList]);

  const clientById = useMemo(() => {
    const m = new Map<string, ClientOption>();
    for (const c of clientList) m.set(c.id, c);
    return m;
  }, [clientList]);

  const displayClient = (t: Trip): string => {
    if (t.client_id && clientNameById.has(t.client_id)) {
      return clientNameById.get(t.client_id)!;
    }
    return t.client ?? "";
  };

  const clients = useMemo(() => {
    const set = new Set<string>();
    trips.forEach((t) => {
      const name = displayClient(t);
      if (name) set.add(name);
    });
    return Array.from(set).sort();
  }, [trips, clientNameById]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trips.filter((t) => {
      const name = displayClient(t);
      if (clientFilter !== "__all__" && name !== clientFilter) return false;
      if (!q) return true;
      const hay = [
        t.trip_number,
        name,
        t.passenger_name,
        t.origin,
        t.destination,
        t.phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [trips, search, clientFilter, clientNameById]);

  const assignClient = async (tripId: string, clientId: string) => {
    setEditingId(null);
    const client = clientList.find((c) => c.id === clientId);
    const { error } = await supabase
      .from("trips")
      .update({ client_id: clientId, client: client?.name ?? null })
      .eq("id", tripId);
    if (error) {
      toast.error("שגיאה בשמירה");
      console.error(error);
    } else {
      toast.success("נשמר");
      onChanged();
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    const { error } = await supabase.from("trips").delete().eq("id", id);
    if (error) {
      toast.error("שגיאה במחיקה");
    } else {
      toast.success("הנסיעה נמחקה");
      onChanged();
    }
  };

  const openEdit = (t: Trip) => {
    setEditTrip(t);
    setEditForm({
      client_id: t.client_id ?? null,
      trip_date: t.trip_date,
      origin: t.origin,
      destination: t.destination,
      passenger_name: t.passenger_name,
      phone: t.phone,
      notes: t.notes ?? null,
      price: t.price,
    });
  };

  const handleSaveEdit = async () => {
    if (!editTrip) return;
    setSaving(true);
    const clientId = editForm.client_id ?? null;
    const clientName = clientId
      ? (clientList.find((c) => c.id === clientId)?.name ?? null)
      : (editTrip.client ?? null);
    const priceVal =
      editForm.price === null || editForm.price === undefined || editForm.price === ("" as unknown as number)
        ? null
        : Number(editForm.price);
    const newDate = editForm.trip_date || null;
    const newBillingMonth = newDate ? newDate.slice(0, 7) : null;
    const { error } = await supabase
      .from("trips")
      .update({
        client_id: clientId,
        client: clientName,
        trip_date: newDate,
        billing_month: newBillingMonth,
        origin: editForm.origin || null,
        destination: editForm.destination || null,
        passenger_name: editForm.passenger_name || null,
        phone: editForm.phone || null,
        notes: editForm.notes || null,
        price: priceVal,
      })
      .eq("id", editTrip.id);
    setSaving(false);
    if (error) {
      toast.error("שגיאה בשמירה");
      console.error(error);
    } else {
      toast.success("הנסיעה עודכנה");
      setEditTrip(null);
      onChanged();
    }
  };

  return (
    <div className="rounded-xl bg-card shadow-[var(--shadow-card)] border border-border/40">
      <div className="flex flex-col gap-3 border-b border-border/60 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="חיפוש חופשי..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10"
          />
        </div>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="sm:w-[200px]">
            <SelectValue placeholder="סנן לפי לקוח" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">כל הלקוחות</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr className="text-right">
              <th className="px-4 py-3 font-medium">מספר נסיעה</th>
              <th className="px-4 py-3 font-medium">תאריך</th>
              <th className="px-4 py-3 font-medium">פתק</th>
              <th className="px-4 py-3 font-medium">שם מזמין</th>
              <th className="px-4 py-3 font-medium">מוצא</th>
              <th className="px-4 py-3 font-medium">יעד</th>
              <th className="px-4 py-3 font-medium">הערות</th>
              <th className="px-4 py-3 font-medium">טלפון</th>
              <th className="px-4 py-3 font-medium">מחיר לנהג</th>
              <th className="px-4 py-3 font-medium">מחיר ללקוח</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-muted-foreground">
                  אין נסיעות להצגה
                </td>
              </tr>
            ) : (
              filtered.map((t) => {
                const cfg = t.client_id ? clientById.get(t.client_id) : null;
                const cp = computeClientPrice(t.price, cfg);
                return (
                <tr key={t.id} className="border-t border-border/60 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-foreground">{t.trip_number}</td>
                  <td className="px-4 py-3 text-foreground">{formatDateHebrew(t.trip_date)}</td>
                  <td className="px-4 py-3">
                    {editingId === t.id ? (
                      <Select
                        open
                        value={t.client_id ?? undefined}
                        onValueChange={(v) => assignClient(t.id, v)}
                        onOpenChange={(o) => {
                          if (!o) setEditingId(null);
                        }}
                      >
                        <SelectTrigger className="h-8 w-[180px]">
                          <SelectValue placeholder="בחר לקוח" />
                        </SelectTrigger>
                        <SelectContent>
                          {clientList.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <button
                        onClick={() => setEditingId(t.id)}
                        className="group inline-flex items-center gap-1 rounded px-1 py-0.5 text-right text-foreground hover:bg-accent"
                      >
                        <span>{displayClient(t) || <span className="text-muted-foreground">—</span>}</span>
                        <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground">{t.passenger_name || "—"}</td>
                  <td className="px-4 py-3 text-foreground">{t.origin || "—"}</td>
                  <td className="px-4 py-3 text-foreground">{t.destination || "—"}</td>
                  <td className="px-4 py-3 text-foreground">{t.notes || ""}</td>
                  <td className="px-4 py-3 text-foreground" dir="ltr">
                    {t.phone || "—"}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {t.price != null ? "₪" + Number(t.price).toLocaleString("he-IL") : "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {cp != null ? "₪" + cp.toLocaleString("he-IL") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(t.id)}
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(t)}
                      className="h-8 w-8 text-foreground hover:bg-accent"
                      title="ערוך"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק את הנסיעה?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו לא ניתנת לביטול. הנסיעה תימחק לצמיתות.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editTrip} onOpenChange={(o) => !o && setEditTrip(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכת נסיעה</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>פתק (לקוח)</Label>
              <Select
                value={editForm.client_id ?? "__none__"}
                onValueChange={(v) =>
                  setEditForm((f) => ({ ...f, client_id: v === "__none__" ? null : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר לקוח" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— ללא —</SelectItem>
                  {clientList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>תאריך</Label>
              <Input
                type="date"
                value={editForm.trip_date ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, trip_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>מחיר לנהג</Label>
              <Input
                type="number"
                step="0.01"
                value={editForm.price ?? ""}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    price: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>מוצא</Label>
              <Input
                value={editForm.origin ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, origin: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>יעד</Label>
              <Input
                value={editForm.destination ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, destination: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>שם מזמין</Label>
              <Input
                value={editForm.passenger_name ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, passenger_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>טלפון</Label>
              <Input
                dir="ltr"
                value={editForm.phone ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>הערות</Label>
              <Textarea
                rows={3}
                value={editForm.notes ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setEditTrip(null)} disabled={saving}>
              ביטול
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? "שומר..." : "שמור שינויים"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}