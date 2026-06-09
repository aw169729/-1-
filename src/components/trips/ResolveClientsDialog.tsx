import { useState } from "react";
import { Loader2, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ClientRow } from "@/lib/client-matching";
import { supabase } from "@/integrations/supabase/client";
import { formatDateHebrew } from "@/lib/hebrew-date";

export type Resolution =
  | { mode: "new" }
  | { mode: "existing"; clientId: string };

interface Props {
  open: boolean;
  unmatchedNames: string[];
  clients: ClientRow[];
  saving: boolean;
  onCancel: () => void;
  onConfirm: (resolutions: Record<string, Resolution>) => void;
}

interface PreviewTrip {
  id: string;
  trip_date: string | null;
  origin: string | null;
  destination: string | null;
  passenger_name: string | null;
  phone: string | null;
  price: number | null;
}

export function ResolveClientsDialog({ open, unmatchedNames, clients, saving, onCancel, onConfirm }: Props) {
  const [state, setState] = useState<Record<string, Resolution>>({});
  const [openTrips, setOpenTrips] = useState<Record<string, boolean>>({});
  const [tripsByName, setTripsByName] = useState<Record<string, PreviewTrip[]>>({});
  const [loadingName, setLoadingName] = useState<string | null>(null);

  const setMode = (name: string, mode: "new" | "existing") => {
    setState((s) => ({ ...s, [name]: mode === "new" ? { mode: "new" } : { mode: "existing", clientId: "" } }));
  };
  const setClient = (name: string, clientId: string) => {
    setState((s) => ({ ...s, [name]: { mode: "existing", clientId } }));
  };

  const toggleTrips = async (name: string) => {
    const next = !openTrips[name];
    setOpenTrips((s) => ({ ...s, [name]: next }));
    if (next && !tripsByName[name]) {
      setLoadingName(name);
      const { data } = await supabase
        .from("trips")
        .select("id, trip_date, origin, destination, passenger_name, phone, price")
        .eq("client", name)
        .order("trip_date", { ascending: true })
        .limit(50);
      setTripsByName((s) => ({ ...s, [name]: (data ?? []) as PreviewTrip[] }));
      setLoadingName(null);
    }
  };

  const allResolved = unmatchedNames.every((n) => {
    const r = state[n];
    if (!r) return false;
    if (r.mode === "new") return true;
    return !!r.clientId;
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onCancel()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>שמות לקוחות לא מזוהים</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          נמצאו {unmatchedNames.length} שמות שלא מזוהים במערכת. בחר עבור כל אחד מה לעשות:
        </p>
        <div className="space-y-3">
          {unmatchedNames.map((name) => {
            const r = state[name];
            const showTrips = !!openTrips[name];
            const trips = tripsByName[name] ?? [];
            return (
              <div key={name} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold">{name}</div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleTrips(name)}
                  >
                    <Eye className="ml-1 h-3 w-3" />
                    {showTrips ? "הסתר נסיעות" : "הצג נסיעות"}
                  </Button>
                </div>
                {showTrips && (
                  <div className="rounded-md border bg-muted/30 p-2 text-xs">
                    {loadingName === name ? (
                      <div className="text-muted-foreground">טוען...</div>
                    ) : trips.length === 0 ? (
                      <div className="text-muted-foreground">אין נסיעות</div>
                    ) : (
                      <table className="w-full">
                        <thead className="text-muted-foreground">
                          <tr>
                            <th className="text-right font-normal py-1">תאריך</th>
                            <th className="text-right font-normal py-1">מוצא</th>
                            <th className="text-right font-normal py-1">יעד</th>
                            <th className="text-right font-normal py-1">שם מזמין</th>
                            <th className="text-right font-normal py-1">טלפון</th>
                            <th className="text-right font-normal py-1">מחיר</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trips.map((t) => (
                            <tr key={t.id} className="border-t border-border/40">
                              <td className="py-1">{formatDateHebrew(t.trip_date)}</td>
                              <td className="py-1">{t.origin || "—"}</td>
                              <td className="py-1">{t.destination || "—"}</td>
                              <td className="py-1">{t.passenger_name || "—"}</td>
                              <td className="py-1" dir="ltr">{t.phone || "—"}</td>
                              <td className="py-1">{t.price != null ? `₪${Number(t.price).toLocaleString("he-IL")}` : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    type="button"
                    size="sm"
                    variant={r?.mode === "new" ? "default" : "outline"}
                    onClick={() => setMode(name, "new")}
                  >
                    לקוח חדש
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={r?.mode === "existing" ? "default" : "outline"}
                    onClick={() => setMode(name, "existing")}
                  >
                    צרף ללקוח קיים
                  </Button>
                </div>
                {r?.mode === "existing" && (
                  <Select value={r.clientId} onValueChange={(v) => setClient(name, v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר לקוח..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            ביטול
          </Button>
          <Button onClick={() => onConfirm(state)} disabled={!allResolved || saving}>
            {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            אשר ושמור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}