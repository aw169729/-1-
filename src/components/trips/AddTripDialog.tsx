import { useEffect, useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fetchBillingMonth } from "@/lib/billing-month";
import { fetchAllClients, type ClientRow } from "@/lib/client-matching";
import { fetchAllRows } from "@/lib/fetch-all";

interface Props {
  onAdded: () => void;
}

const MIN_AUTO = 1;
const MAX_AUTO = 9999;

/** Find smallest unused 4-digit trip number (0001..9999). */
async function findNextTripNumber(): Promise<string | null> {
  const { data, error } = await fetchAllRows<{ trip_number: string }>((from, to) =>
    supabase.from("trips").select("trip_number").range(from, to),
  );
  if (error) throw error;
  const used = new Set<number>();
  for (const r of data) {
    const n = Number(r.trip_number);
    if (Number.isInteger(n) && n >= MIN_AUTO && n <= MAX_AUTO) used.add(n);
  }
  for (let i = MIN_AUTO; i <= MAX_AUTO; i++) {
    if (!used.has(i)) return String(i).padStart(4, "0");
  }
  return null;
}

export function AddTripDialog({ onAdded }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<ClientRow[]>([]);

  const today = new Date().toISOString().slice(0, 10);

  const [tripNumber, setTripNumber] = useState("");
  const [tripNumberLoading, setTripNumberLoading] = useState(false);
  const [clientId, setClientId] = useState<string>("");
  const [passengerName, setPassengerName] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [price, setPrice] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [tripDate, setTripDate] = useState<string>(today);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    fetchAllClients().then(setClients).catch((e) => {
      console.error(e);
      toast.error("שגיאה בטעינת לקוחות");
    });
    setTripNumberLoading(true);
    findNextTripNumber()
      .then((next) => {
        if (next) setTripNumber(next);
        else toast.error("לא נמצא מספר פנוי בטווח 0001-9999");
      })
      .catch((e) => {
        console.error(e);
        toast.error("שגיאה בחישוב מספר נסיעה");
      })
      .finally(() => setTripNumberLoading(false));
  }, [open]);

  const reset = () => {
    setTripNumber("");
    setClientId("");
    setPassengerName("");
    setOrigin("");
    setDestination("");
    setPrice("");
    setPhone("");
    setTripDate(today);
    setNotes("");
  };

  const handleSave = async () => {
    if (!tripNumber.trim()) {
      toast.error("נא להזין מספר נסיעה");
      return;
    }
    if (!clientId) {
      toast.error("נא לבחור לקוח");
      return;
    }
    setSaving(true);
    try {
      const billing = await fetchBillingMonth();
      const client = clients.find((c) => c.id === clientId);
      let numberToUse = tripNumber.trim();
      const payload = {
        trip_number: numberToUse,
        client: client?.name ?? null,
        client_id: clientId,
        passenger_name: passengerName.trim() || null,
        origin: origin.trim() || null,
        destination: destination.trim() || null,
        price: price === "" ? null : Number(price),
        phone: phone.trim() || null,
        trip_date: tripDate || null,
        billing_month: billing.month,
        notes: notes.trim() || null,
      };
      const { error } = await supabase.from("trips").insert(payload as never);
      if (error) {
        if (error.code === "23505") {
          // Race: find a fresh number and retry once
          const next = await findNextTripNumber();
          if (next) {
            numberToUse = next;
            const { error: e2 } = await supabase
              .from("trips")
              .insert({ ...payload, trip_number: next } as never);
            if (e2) {
              toast.error("מספר נסיעה כבר קיים");
              return;
            }
          } else {
            toast.error("מספר נסיעה כבר קיים");
            return;
          }
        } else {
          throw error;
        }
      }
      toast.success(`הנסיעה ${numberToUse} נוספה`);
      reset();
      setOpen(false);
      onAdded();
    } catch (err) {
      console.error(err);
      toast.error("שגיאה בשמירה: " + (err instanceof Error ? err.message : "לא ידוע"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" variant="outline">
          <Plus className="ml-2 h-4 w-4" />
          הוסף נסיעה ידנית
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>הוספת נסיעה ידנית</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>מספר נסיעה (אוטומטי)</Label>
            <div className="relative">
              <Input
                value={tripNumberLoading ? "" : tripNumber}
                readOnly
                placeholder={tripNumberLoading ? "מחשב..." : ""}
                className="bg-muted text-muted-foreground cursor-default"
              />
              {tripNumberLoading && (
                <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>תאריך</Label>
            <Input type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>לקוח *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="בחר לקוח" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>שם מזמין</Label>
            <Input value={passengerName} onChange={(e) => setPassengerName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>מוצא</Label>
            <Input value={origin} onChange={(e) => setOrigin(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>יעד</Label>
            <Input value={destination} onChange={(e) => setDestination(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>מחיר נהג</Label>
            <Input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>טלפון לקוח</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>הערות</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            ביטול
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            שמור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}