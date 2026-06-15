import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Wallet, ArrowRight, MessageCircle, Send, Mail, EyeOff, Eye, StickyNote, PlusCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { HEBREW_MONTHS } from "@/lib/hebrew-date";
import { Search } from "lucide-react";
import { fetchBillingMonth, type BillingMonthInfo } from "@/lib/billing-month";
import { computeClientPrice } from "@/lib/client-price";
import {
  fetchBusinessSettings,
  renderTemplate,
  DEFAULT_WHATSAPP_TEMPLATE,
} from "@/lib/business-settings";
import { openGmailCompose } from "@/lib/gmail";
import { useVat } from "@/contexts/vat-context";
import { renameClient } from "@/lib/client-matching";
import { fetchAllRows } from "@/lib/fetch-all";
import {
  fetchAdditionalCharges,
  addAdditionalCharge,
  deleteAdditionalCharge,
  buildAdditionalChargesMap,
  type AdditionalCharge,
} from "@/lib/additional-charges";
import {
  fetchExcludedSet,
  setTripsExcluded,
} from "@/lib/excluded-trip-months";

import { AuthGate } from "@/components/auth/AuthGate";
import { useAuth } from "@/contexts/auth-context";
import { PageNav } from "@/components/auth/PageNav";

export const Route = createFileRoute("/payments")({
  head: () => ({
    meta: [
      { title: "דרישות תשלום — ניהול נסיעות" },
      { name: "description", content: "ניהול דרישות תשלום חודשיות ללקוחות: יצירה, מעקב חובות, שליחה בוואטסאפ או באימייל וצפייה בהיסטוריית תשלומים." },
      { property: "og:title", content: "דרישות תשלום — ניהול נסיעות" },
      { property: "og:description", content: "ניהול דרישות תשלום חודשיות ללקוחות, מעקב חובות ושליחה בוואטסאפ או באימייל." },
      { property: "og:url", content: "https://asher-weinberger.com/payments" },
    ],
    links: [{ rel: "canonical", href: "https://asher-weinberger.com/payments" }],
  }),
  component: () => (
    <AuthGate page="payments">
      <PaymentsPage />
    </AuthGate>
  ),
});

type TripRow = {
  client: string | null;
  client_id: string | null;
  price: number | null;
  billing_month: string | null;
};
type PaymentRow = { client: string; month: string; amount_paid: number };
type ClientRow = {
  id: string;
  name: string;
  created_at: string;
  markup_type: string | null;
  markup_value: number | null;
  markup_includes_vat: boolean | null;
  aliases: string[] | null;
  phone: string | null;
  email: string | null;
  exclude_from_total: boolean | null;
  notes: string | null;
};

function formatMonthLabel(key: string): string {
  const [y, m] = key.split("-");
  const idx = parseInt(m, 10) - 1;
  return `${HEBREW_MONTHS[idx] ?? m} ${y}`;
}

function normalizePhoneForWa(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return "972" + digits.slice(1);
  return digits;
}

function PaymentsPage() {
  const { canView } = useAuth();
  const { vatPlus } = useVat();
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [clientsData, setClientsData] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [billing, setBilling] = useState<BillingMonthInfo | null>(null);
  const [dialog, setDialog] = useState<{
    client: string;
    month: string;
    debt: number;
  } | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "amount" | "oldest">("name");
  const [waTemplate, setWaTemplate] = useState<string>(DEFAULT_WHATSAPP_TEMPLATE);
  const [waDialog, setWaDialog] = useState<{
    clientName: string;
    phone: string;
    message: string;
  } | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Record<string, boolean>>({});
  const [bulkQueue, setBulkQueue] = useState<{ name: string; phone: string; message: string }[] | null>(null);
  const [bulkIndex, setBulkIndex] = useState(0);
  const [renameTarget, setRenameTarget] = useState<{ id: string; oldName: string } | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [notesTarget, setNotesTarget] = useState<{ id: string; name: string } | null>(null);
  const [notesInput, setNotesInput] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Excluded trip months
  const [excludedSet, setExcludedSet] = useState<Set<string>>(() => fetchExcludedSet());

  const reloadExcluded = () => setExcludedSet(fetchExcludedSet());

  // Additional manual charges
  const [additionalCharges, setAdditionalCharges] = useState<AdditionalCharge[]>([]);
  const [addChargeDialog, setAddChargeDialog] = useState<{ clientName: string } | null>(null);
  const [addChargeMonth, setAddChargeMonth] = useState("");
  const [addChargeAmount, setAddChargeAmount] = useState("");
  const [addChargeNote, setAddChargeNote] = useState("");
  const [breakdownDialog, setBreakdownDialog] = useState<{
    client: string; month: string;
    fromTrips: number; fromExtra: number; total: number; debt: number;
  } | null>(null);

  const loadAdditional = useCallback(() => {
    setAdditionalCharges(fetchAdditionalCharges());
  }, []);

  useEffect(() => { loadAdditional(); }, [loadAdditional]);

  const load = useCallback(async () => {
    setLoading(true);
    const [t, p, c, b, s] = await Promise.all([
      fetchAllRows<TripRow>((from, to) =>
        supabase.from("trips").select("client, client_id, price, billing_month").range(from, to),
      ),
      fetchAllRows<PaymentRow>((from, to) =>
        supabase.from("payments").select("client, month, amount_paid").range(from, to),
      ),
      fetchAllRows<ClientRow>((from, to) =>
        supabase
          .from("clients")
          .select("id, name, created_at, markup_type, markup_value, markup_includes_vat, aliases, phone, email, exclude_from_total, notes")
          .order("name")
          .range(from, to),
      ),
      fetchBillingMonth(),
      fetchBusinessSettings(),
    ]);
    if (!t.error) setTrips(t.data);
    if (!p.error) setPayments(p.data);
    if (!c.error) setClientsData(c.data);
    setBilling(b);
    setWaTemplate(s.whatsapp_template || DEFAULT_WHATSAPP_TEMPLATE);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeSync(["trips", "payments", "clients"], load);

  const additionalMap = useMemo(
    () => buildAdditionalChargesMap(additionalCharges),
    [additionalCharges],
  );

  // Build matrix: client -> month -> debt
  const { months, clients, debtMap, chargesMap, paidMap } = useMemo(() => {
    const _excluded = excludedSet; // reactive dependency
    const monthSet = new Set<string>();
    // Lookup: client_id -> ClientRow, alias/name -> ClientRow
    const byId = new Map<string, ClientRow>();
    const byAlias = new Map<string, ClientRow>();
    for (const c of clientsData) {
      byId.set(c.id, c);
      const n = (c.name ?? "").trim();
      if (n) byAlias.set(n, c);
      for (const a of c.aliases ?? []) {
        const an = (a ?? "").trim();
        if (an && !byAlias.has(an)) byAlias.set(an, c);
      }
    }

    // charges keyed by canonical client name
    const charges: Record<string, Record<string, number>> = {};
    for (const t of trips) {
      if (!t.billing_month) continue;
      let cfg: ClientRow | null = null;
      if (t.client_id) cfg = byId.get(t.client_id) ?? null;
      if (!cfg && t.client) cfg = byAlias.get(t.client.trim()) ?? null;
      if (!cfg) continue; // skip unresolved trips
      const mk = t.billing_month;
      monthSet.add(mk);
      const name = cfg.name;
      charges[name] ??= {};
      const clientPrice = computeClientPrice(t.price, cfg) ?? 0;
      const withVat = cfg.markup_includes_vat ? Number(clientPrice) : Number(clientPrice) * vatPlus;
      charges[name][mk] = (charges[name][mk] ?? 0) + withVat;
    }

    const paid: Record<string, Record<string, number>> = {};
    for (const p of payments) {
      if (!p.client) continue;
      const cfg = byAlias.get(p.client.trim());
      if (!cfg) continue;
      monthSet.add(p.month);
      const name = cfg.name;
      paid[name] ??= {};
      paid[name][p.month] = (paid[name][p.month] ?? 0) + Number(p.amount_paid ?? 0);
    }

    // Add months from additional charges
    for (const [clientName, monthMap] of Object.entries(additionalMap)) {
      for (const m of Object.keys(monthMap)) monthSet.add(m);
    }

    const debt: Record<string, Record<string, number>> = {};
    for (const c of clientsData) {
      const name = c.name;
      debt[name] = {};
      for (const m of monthSet) {
        const tripsExcluded = _excluded.has(`${name}|${m}`);
        const tripsAmt = tripsExcluded ? 0 : (charges[name]?.[m] ?? 0);
        const due = tripsAmt + (additionalMap[name]?.[m] ?? 0);
        const pd = paid[name]?.[m] ?? 0;
        const d = Math.round((due - pd) * 100) / 100;
        debt[name][m] = d > 0 ? d : 0;
      }
    }

    const monthsArr = Array.from(monthSet).sort();
    const clientsArr = clientsData
      .map((c) => c.name)
      .sort((a, b) => a.localeCompare(b, "he"));
    return { months: monthsArr, clients: clientsArr, debtMap: debt, chargesMap: charges, paidMap: paid };
  }, [trips, payments, clientsData, vatPlus, additionalMap, excludedSet]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Special keyword: "לא נכלל" → show only clients excluded from total
    const excludedKeyword = q.includes("לא נכלל") || q.includes("לא כלול") || q.includes("מוחרג");
    if (excludedKeyword) {
      const excludedNames = new Set(
        clientsData.filter((c) => c.exclude_from_total).map((c) => c.name),
      );
      const base = clients.filter((c) => excludedNames.has(c));
      return base.sort((a, b) => a.localeCompare(b, "he"));
    }
    // Search supports both name match and amount match.
    // If the query is numeric, also match clients whose total debt or any
    // monthly debt/charge/paid amount contains that number.
    const numericQ = q.replace(/[₪,\s]/g, "");
    const isNumeric = numericQ !== "" && !isNaN(Number(numericQ));
    const qNum = isNumeric ? Number(numericQ) : NaN;
    const base = q
      ? clients.filter((c) => {
          if (c.toLowerCase().includes(q)) return true;
          const clientNotes = clientsData.find((cl) => cl.name === c)?.notes ?? "";
          if (clientNotes.toLowerCase().includes(q)) return true;
          if (!isNumeric) return false;
          const cd = debtMap[c] ?? {};
          const ch = chargesMap[c] ?? {};
          const pd = paidMap[c] ?? {};
          const total = Object.values(cd).reduce((a, b) => a + b, 0);
          const values: number[] = [
            total,
            ...Object.values(cd),
            ...Object.values(ch),
            ...Object.values(pd),
          ];
          return values.some((v) => {
            // exact match (with 0.5 tolerance) OR substring match on rounded/2-decimal forms
            if (Math.abs(v - qNum) < 0.5) return true;
            const s2 = (Math.round(v * 100) / 100).toString();
            const s0 = Math.round(v).toString();
            return s2.includes(numericQ) || s0.includes(numericQ);
          });
        })
      : clients.slice();
    if (sortBy === "name") {
      return base.sort((a, b) => a.localeCompare(b, "he"));
    }
    if (sortBy === "amount") {
      return base.sort((a, b) => {
        const ta = Object.values(debtMap[a] ?? {}).reduce((x, y) => x + y, 0);
        const tb = Object.values(debtMap[b] ?? {}).reduce((x, y) => x + y, 0);
        if (tb !== ta) return tb - ta;
        return a.localeCompare(b, "he");
      });
    }
    // oldest: earliest unpaid month (excluding current billing month) first
    const now = new Date();
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const oldestMonth = (name: string): string | null => {
      const cd = debtMap[name] ?? {};
      const ms = Object.entries(cd)
        .filter(([m, v]) => v > 0 && m !== current)
        .map(([m]) => m)
        .sort();
      return ms[0] ?? null;
    };
    return base.sort((a, b) => {
      const oa = oldestMonth(a);
      const ob = oldestMonth(b);
      if (oa && ob) {
        if (oa !== ob) return oa.localeCompare(ob);
        return a.localeCompare(b, "he");
      }
      if (oa && !ob) return -1;
      if (!oa && ob) return 1;
      return a.localeCompare(b, "he");
    });
  }, [clients, search, sortBy, debtMap, chargesMap, paidMap, billing, clientsData]);

  const clientByName = useMemo(() => {
    const m = new Map<string, ClientRow>();
    for (const c of clientsData) m.set(c.name, c);
    return m;
  }, [clientsData]);

  const debtorsList = useMemo(() => {
    return clients
      .map((name) => {
        const cd = debtMap[name] ?? {};
        const total = Object.values(cd).reduce((a, b) => a + b, 0);
        const months = Object.entries(cd).filter(([, v]) => v > 0).map(([m]) => m).sort();
        return { name, total, months };
      })
      .filter((r) => r.total > 0);
  }, [clients, debtMap]);

  const { totalExclCurrent, totalExclLast2 } = useMemo(() => {
    const now = new Date();
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const sortedMonths = [...months].sort();
    const lastIdx = sortedMonths.length - 1;
    const prev = current
      ? sortedMonths[sortedMonths.indexOf(current) - 1] ?? sortedMonths[lastIdx - 1]
      : sortedMonths[lastIdx - 1];
    let exclCurrent = 0;
    let exclLast2 = 0;
    const excludedNames = new Set(
      clientsData.filter((c) => c.exclude_from_total).map((c) => c.name),
    );
    const namesForTotal = search.trim() ? filteredClients : clients;
    for (const name of namesForTotal) {
      if (excludedNames.has(name)) continue;
      const cd = debtMap[name] ?? {};
      for (const [m, v] of Object.entries(cd)) {
        if (m !== current) exclCurrent += v;
        if (m !== current && m !== prev) exclLast2 += v;
      }
    }
    return { totalExclCurrent: exclCurrent, totalExclLast2: exclLast2 };
  }, [clients, filteredClients, search, clientsData, debtMap, months, billing]);

  const buildMessage = useCallback(
    (clientName: string, monthsArr: string[], total: number) => {
      const monthLabel = monthsArr.map(formatMonthLabel).join(", ") || "";
      return renderTemplate(waTemplate, {
        clientName,
        month: monthLabel,
        amount: total.toLocaleString("he-IL"),
      });
    },
    [waTemplate],
  );

  const openWaForClient = (clientName: string) => {
    const cfg = clientByName.get(clientName);
    const cd = debtMap[clientName] ?? {};
    const monthsArr = Object.entries(cd).filter(([, v]) => v > 0).map(([m]) => m).sort();
    const total = Object.values(cd).reduce((a, b) => a + b, 0);
    const phone = normalizePhoneForWa(cfg?.phone);
    setWaDialog({
      clientName,
      phone,
      message: buildMessage(clientName, monthsArr, total),
    });
  };

  const openExternalLink = (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const sendWaDialog = () => {
    if (!waDialog) return;
    if (!waDialog.phone) {
      toast.error("אין מספר טלפון ללקוח");
      return;
    }
    const url = `https://web.whatsapp.com/send/?phone=${waDialog.phone}&text=${encodeURIComponent(waDialog.message)}&type=phone_number&app_absent=0`;
    openExternalLink(url);
    setWaDialog(null);
  };

  const openBulkDialog = () => {
    const init: Record<string, boolean> = {};
    for (const d of debtorsList) init[d.name] = true;
    setBulkSelected(init);
    setBulkOpen(true);
  };

  const startBulk = () => {
    const queue = debtorsList
      .filter((d) => bulkSelected[d.name])
      .map((d) => ({
        name: d.name,
        phone: normalizePhoneForWa(clientByName.get(d.name)?.phone),
        message: buildMessage(d.name, d.months, d.total),
      }));
    if (queue.length === 0) {
      toast.error("לא נבחרו לקוחות");
      return;
    }
    setBulkOpen(false);
    setBulkQueue(queue);
    setBulkIndex(0);
  };

  const sendCurrentBulk = () => {
    if (!bulkQueue) return;
    const item = bulkQueue[bulkIndex];
    if (!item) return;
    if (!item.phone) {
      toast.error(`אין טלפון ל-${item.name}, מדלג`);
    } else {
      const url = `https://web.whatsapp.com/send/?phone=${item.phone}&text=${encodeURIComponent(item.message)}&type=phone_number&app_absent=0`;
      openExternalLink(url);
    }
  };

  const nextBulk = () => {
    if (!bulkQueue) return;
    const next = bulkIndex + 1;
    if (next >= bulkQueue.length) {
      setBulkQueue(null);
      setBulkIndex(0);
      toast.success("השליחה הסתיימה");
    } else {
      setBulkIndex(next);
    }
  };

  const hasAnyTripsByName = useMemo(() => {
    const set = new Set<string>();
    const byId = new Map<string, ClientRow>();
    const byAlias = new Map<string, ClientRow>();
    for (const c of clientsData) {
      byId.set(c.id, c);
      if (c.name) byAlias.set(c.name.trim(), c);
      for (const a of c.aliases ?? []) {
        const an = (a ?? "").trim();
        if (an && !byAlias.has(an)) byAlias.set(an, c);
      }
    }
    for (const t of trips) {
      let cfg: ClientRow | null = null;
      if (t.client_id) cfg = byId.get(t.client_id) ?? null;
      if (!cfg && t.client) cfg = byAlias.get(t.client.trim()) ?? null;
      if (cfg) set.add(cfg.name);
    }
    return set;
  }, [trips, clientsData]);

  const rowColor = (_clientName: string, clientDebts: Record<string, number>): string => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthsWithDebt = Object.entries(clientDebts).filter(
      ([m, v]) => v > 0 && m !== currentMonth,
    ).length;
    if (monthsWithDebt === 0) return "bg-[#e8f5e9] hover:bg-[#dcedc8]";
    if (monthsWithDebt === 1) return "bg-[#fff9c4] hover:bg-[#fff59d]";
    return "bg-[#ffebee] hover:bg-[#ffcdd2]";
  };

  const openDialog = (client: string, month: string, debt: number) => {
    setDialog({ client, month, debt });
    setAmountInput(debt > 0 ? String(debt) : "");
  };

  const confirmPayment = async () => {
    if (!dialog) return;
    const amount = parseFloat(amountInput);
    if (isNaN(amount) || amount <= 0) {
      toast.error("יש להזין סכום חיובי");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("payments").insert({
      client: dialog.client,
      month: dialog.month,
      amount_paid: amount,
    });
    setSaving(false);
    if (error) {
      toast.error("שגיאה בשמירת התשלום");
      return;
    }
    toast.success("התשלום נשמר");
    setDialog(null);
    await load();
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" richColors />
      <header className="border-b border-border/60 bg-card shadow-[var(--shadow-card)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">דרישת תשלום</h1>
              <p className="text-xs text-muted-foreground">מעקב חובות לקוחות לפי חודש</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="default" onClick={openBulkDialog} disabled={debtorsList.length === 0}>
              <Send className="ml-2 h-4 w-4" />
              שלח לכולם
            </Button>
            <PageNav current="payments" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {loading ? (
          <div className="rounded-xl bg-card p-12 text-center text-muted-foreground shadow-[var(--shadow-card)]">
            טוען נתונים...
          </div>
        ) : clients.length === 0 ? (
          <div className="rounded-xl bg-card p-12 text-center text-muted-foreground shadow-[var(--shadow-card)]">
            אין נתונים להצגה
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-card)]">
            <div className="border-b border-border/60 bg-gradient-to-l from-primary/10 via-primary/5 to-transparent p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/15 p-2 text-primary">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">סה"כ חובות (ללא חודש נוכחי)</p>
                    <p className="text-2xl font-bold text-foreground">
                      ₪{totalExclCurrent.toLocaleString("he-IL", { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
                <div className="hidden h-12 w-px bg-border/60 sm:block" />
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-amber-500/15 p-2 text-amber-600 dark:text-amber-400">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">סה"כ חובות (ללא 2 חודשים אחרונים)</p>
                    <p className="text-2xl font-bold text-foreground">
                      ₪{totalExclLast2.toLocaleString("he-IL", { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="border-b border-border/60 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    aria-label="חיפוש לקוח או סכום או הערה"
                    placeholder="חיפוש לקוח או סכום או הערה..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pr-10"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="whitespace-nowrap text-sm text-muted-foreground">מיון:</Label>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="oldest">לפי חוב ישן (חודשים קודמים)</SelectItem>
                      <SelectItem value="amount">לפי סכום החוב</SelectItem>
                      <SelectItem value="name">לפי א'-ב'</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky right-0 z-30 bg-card text-right font-semibold text-foreground shadow-[-2px_0_4px_rgba(0,0,0,0.06)]">לקוח</TableHead>
                  {months.map((m) => (
                    <TableHead key={m} className="text-center font-semibold text-foreground">
                      {formatMonthLabel(m)}
                    </TableHead>
                  ))}
                  <TableHead className="sticky left-[96px] z-30 w-[100px] min-w-[100px] bg-card text-center font-semibold text-foreground">סה"כ חוב</TableHead>
                  <TableHead className="sticky left-0 z-30 w-24 min-w-[96px] bg-card text-center font-semibold text-foreground shadow-[-2px_0_6px_rgba(0,0,0,0.08)]">שליחה</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((c) => {
                  const cd = debtMap[c] ?? {};
                  const total = Object.values(cd).reduce((a, b) => a + b, 0);
                  const rowCls = rowColor(c, cd);
                  const stickyBg = rowCls.split(" ")[0];
                  return (
                    <TableRow key={c} className={rowCls}>
                      <TableCell className={`sticky right-0 z-10 font-medium text-foreground shadow-[-2px_0_4px_rgba(0,0,0,0.06)] ${stickyBg}`}>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="cursor-pointer text-foreground hover:underline"
                            onClick={() => {
                              const cfg = clientByName.get(c);
                              if (!cfg) return;
                              setRenameTarget({ id: cfg.id, oldName: c });
                              setRenameInput(c);
                            }}
                            title="לחץ לעריכת שם הלקוח"
                          >
                            {c}
                          </button>
                          {(() => {
                            const cfg = clientByName.get(c);
                            if (!cfg) return null;
                            const excluded = !!cfg.exclude_from_total;
                            return (
                              <button
                                type="button"
                                className={`rounded p-1 ${excluded ? "text-amber-600 hover:bg-amber-100" : "text-muted-foreground hover:bg-muted"}`}
                                title={excluded ? "כלול בסה\"כ החובות" : "אל תכלול בסה\"כ החובות"}
                                aria-label={excluded ? "כלול לקוח בסה\"כ החובות" : "החרג לקוח מסה\"כ החובות"}
                                onClick={async () => {
                                  const next = !excluded;
                                  const { error } = await supabase
                                    .from("clients")
                                    .update({ exclude_from_total: next })
                                    .eq("id", cfg.id);
                                  if (error) {
                                    toast.error("שגיאה: " + error.message);
                                    return;
                                  }
                                  toast.success(next ? "הלקוח הוסר מהסה\"כ" : "הלקוח נכלל בסה\"כ");
                                  await load();
                                }}
                              >
                                {excluded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            );
                          })()}
                          {clientByName.get(c)?.exclude_from_total && (
                            <span className="text-xs text-amber-700">(לא נכלל בסה"כ)</span>
                          )}
                          <button
                          type="button"
                          title="הוסף חיוב ידני"
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-primary"
                          onClick={() => {
                            setAddChargeDialog({ clientName: c });
                            setAddChargeMonth("");
                            setAddChargeAmount("");
                            setAddChargeNote("");
                          }}
                        >
                          <PlusCircle className="h-4 w-4" />
                        </button>
                        {(() => {
                            const cfg = clientByName.get(c);
                            if (!cfg) return null;
                            const hasNotes = !!(cfg.notes && cfg.notes.trim());
                            return (
                              <>
                                <button
                                  type="button"
                                  className={`rounded p-1 ${hasNotes ? "text-blue-600 hover:bg-blue-100" : "text-muted-foreground hover:bg-muted"}`}
                                  title={hasNotes ? "ערוך הערה" : "הוסף הערה"}
                                  aria-label={hasNotes ? "ערוך הערה ללקוח" : "הוסף הערה ללקוח"}
                                  onClick={() => {
                                    setNotesTarget({ id: cfg.id, name: c });
                                    setNotesInput(cfg.notes ?? "");
                                  }}
                                >
                                  <StickyNote className="h-4 w-4" />
                                </button>
                                {hasNotes && (
                                  <span className="text-xs italic text-muted-foreground">
                                    {cfg.notes}
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </TableCell>
                      {months.map((m) => {
                        const d = cd[m] ?? 0;
                        const charged = chargesMap[c]?.[m] ?? 0;
                        const paid = paidMap[c]?.[m] ?? 0;
                        const fullyPaid = d <= 0 && charged > 0 && paid > 0;
                        const partiallyPaid = d > 0 && paid > 0 && charged > 0;
                        const fmt = (n: number) => `₪${n.toLocaleString("he-IL")}`;
                        return (
                          <TableCell
                            key={m}
                            className={`text-center ${
                              d > 0
                                ? "cursor-pointer font-semibold text-foreground hover:underline"
                                : fullyPaid
                                  ? "cursor-pointer font-semibold text-green-700 hover:underline"
                                  : "text-muted-foreground"
                            }`}
                            onClick={() => {
                              const extra = additionalMap[c]?.[m] ?? 0;
                              const tripsAmt = chargesMap[c]?.[m] ?? 0;
                              if (extra > 0) {
                                setBreakdownDialog({
                                  client: c, month: m,
                                  fromTrips: tripsAmt, fromExtra: extra,
                                  total: tripsAmt + extra, debt: d,
                                });
                              } else if (d > 0) openDialog(c, m, d);
                              else if (fullyPaid) openDialog(c, m, charged);
                            }}
                          >
                            {(() => {
                              const extra = additionalMap[c]?.[m] ?? 0;
                              const tripsAmt = chargesMap[c]?.[m] ?? 0;
                              const grandTotal = tripsAmt + extra;
                              if (partiallyPaid) {
                                return (
                                  <div className="flex flex-col leading-tight">
                                    {extra > 0 && (
                                      <span className="text-xs font-semibold text-blue-600">
                                        סה"כ כללי {fmt(grandTotal)}
                                      </span>
                                    )}
                                    <span className="text-xs font-normal text-muted-foreground">
                                      שולם {fmt(paid)} מתוך {fmt(extra > 0 ? grandTotal : charged)}
                                    </span>
                                    <span className="font-semibold text-foreground">
                                      יתרה {fmt(d)}
                                    </span>
                                  </div>
                                );
                              }
                              if (d > 0 && extra > 0) {
                                return (
                                  <div className="flex flex-col leading-tight">
                                    <span className="text-xs font-semibold text-blue-600">
                                      סה"כ כללי {fmt(grandTotal)}
                                    </span>
                                    <span className="font-semibold text-foreground">
                                      יתרה {fmt(d)}
                                    </span>
                                  </div>
                                );
                              }
                              if (d > 0) return fmt(d);
                              if (fullyPaid) return fmt(charged);
                              return "";
                            })()}
                          </TableCell>
                        );
                      })}
                      <TableCell className={`sticky left-[96px] z-10 w-[100px] min-w-[100px] text-center font-bold text-foreground ${stickyBg}`}>
                        {total > 0 ? `₪${total.toLocaleString("he-IL")}` : "₪0"}
                      </TableCell>
                      <TableCell className={`sticky left-0 z-10 w-24 min-w-[96px] text-center shadow-[-2px_0_6px_rgba(0,0,0,0.08)] ${stickyBg}`}>
                        {total > 0 && (
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0 text-green-600 hover:bg-green-50 hover:text-green-700"
                              onClick={() => openWaForClient(c)}
                              aria-label="שלח וואטסאפ"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                              onClick={() => {
                                const cfg = clientByName.get(c);
                                if (!cfg?.email) {
                                  toast.error("אין כתובת מייל ללקוח");
                                  return;
                                }
                                const cd = debtMap[c] ?? {};
                                const monthsArr = Object.entries(cd).filter(([, v]) => v > 0).map(([m]) => m).sort();
                                const totalDebt = Object.values(cd).reduce((a, b) => a + b, 0);
                                const subject = `דרישת תשלום — ${c}`;
                                const body = buildMessage(c, monthsArr, totalDebt);
                                const res = openGmailCompose({ to: cfg.email, subject, body });
                                if (!res.ok && res.reason === "invalid") toast.error("כתובת מייל לא תקינה");
                              }}
                              aria-label="שלח מייל"
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">
              {dialog ? `${dialog.client} — ${formatMonthLabel(dialog.month)}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {dialog && (() => {
              const original = chargesMap[dialog.client]?.[dialog.month] ?? 0;
              const paidSoFar = paidMap[dialog.client]?.[dialog.month] ?? 0;
              const remaining = Math.round((original - paidSoFar) * 100) / 100;
              const fmt = (n: number) => `₪${n.toLocaleString("he-IL")}`;
              return (
                <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">סכום מקורי</span>
                    <span className="font-semibold text-foreground">{fmt(original)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">שולם עד כה</span>
                    <span className="font-semibold text-foreground">{fmt(paidSoFar)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border/60 pt-2 text-sm">
                    <span className="text-muted-foreground">יתרת חוב</span>
                    <span className="text-base font-bold text-foreground">{fmt(remaining > 0 ? remaining : 0)}</span>
                  </div>
                </div>
              );
            })()}
            <div className="space-y-2">
              <Label htmlFor="amount">סכום ששולם עכשיו</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                dir="ltr"
                className="text-right"
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-start">
            <Button onClick={confirmPayment} disabled={saving}>
              {saving ? "שומר..." : "אשר תשלום"}
            </Button>
            <Button variant="outline" onClick={() => setDialog(null)}>
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WhatsApp single-client dialog */}
      <Dialog open={!!waDialog} onOpenChange={(o) => !o && setWaDialog(null)}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">{waDialog?.clientName ?? ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-sm text-muted-foreground">
              טלפון: <span dir="ltr" className="font-mono text-foreground">{waDialog?.phone || "— חסר —"}</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa-msg">הודעה</Label>
              <Textarea
                id="wa-msg"
                rows={5}
                value={waDialog?.message ?? ""}
                onChange={(e) => setWaDialog((d) => (d ? { ...d, message: e.target.value } : d))}
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-start">
            <Button onClick={sendWaDialog}>
              <Send className="ml-2 h-4 w-4" />
              שלח
            </Button>
            <Button variant="outline" onClick={() => setWaDialog(null)}>
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk selection dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">שליחה מרוכזת</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto py-2">
            {debtorsList.length === 0 ? (
              <div className="text-sm text-muted-foreground">אין לקוחות עם חוב</div>
            ) : (
              <div className="space-y-2">
                {debtorsList.map((d) => {
                  const phone = clientByName.get(d.name)?.phone;
                  return (
                    <label
                      key={d.name}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 p-2 hover:bg-muted/30"
                    >
                      <Checkbox
                        checked={!!bulkSelected[d.name]}
                        onCheckedChange={(v) =>
                          setBulkSelected((s) => ({ ...s, [d.name]: !!v }))
                        }
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground">{d.name}</div>
                        <div className="text-xs text-muted-foreground">
                          ₪{d.total.toLocaleString("he-IL")}
                          {!phone && " · אין טלפון"}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter className="sm:justify-start">
            <Button onClick={startBulk}>
              <Send className="ml-2 h-4 w-4" />
              התחל שליחה
            </Button>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk queue dialog */}
      <Dialog open={!!bulkQueue} onOpenChange={(o) => !o && setBulkQueue(null)}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">
              {bulkQueue ? `${bulkIndex + 1} / ${bulkQueue.length} — ${bulkQueue[bulkIndex]?.name ?? ""}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-sm text-muted-foreground">
              טלפון:{" "}
              <span dir="ltr" className="font-mono text-foreground">
                {bulkQueue?.[bulkIndex]?.phone || "— חסר —"}
              </span>
            </div>
            <div className="space-y-2">
              <Label>הודעה</Label>
              <Textarea
                rows={5}
                value={bulkQueue?.[bulkIndex]?.message ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setBulkQueue((q) => {
                    if (!q) return q;
                    const copy = q.slice();
                    copy[bulkIndex] = { ...copy[bulkIndex], message: v };
                    return copy;
                  });
                }}
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-start">
            <Button onClick={sendCurrentBulk}>
              <Send className="ml-2 h-4 w-4" />
              פתח וואטסאפ
            </Button>
            <Button variant="outline" onClick={nextBulk}>
              {bulkQueue && bulkIndex + 1 >= bulkQueue.length ? "סיום" : "הבא"}
            </Button>
            <Button variant="ghost" onClick={() => setBulkQueue(null)}>
              סגור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add manual charge dialog */}
      <Dialog open={!!addChargeDialog} onOpenChange={(o) => !o && setAddChargeDialog(null)}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">
              הוסף חיוב ידני — {addChargeDialog?.clientName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>חודש</Label>
              <Input
                type="month"
                value={addChargeMonth}
                onChange={(e) => setAddChargeMonth(e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>סכום</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={addChargeAmount}
                onChange={(e) => setAddChargeAmount(e.target.value)}
                dir="ltr"
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>הערה (אופציונלי)</Label>
              <Input
                value={addChargeNote}
                onChange={(e) => setAddChargeNote(e.target.value)}
                placeholder="לדוגמה: חיוב נוסף על שירות"
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-start">
            <Button
              onClick={() => {
                if (!addChargeDialog) return;
                const amt = parseFloat(addChargeAmount);
                if (!addChargeMonth) { toast.error("יש לבחור חודש"); return; }
                if (isNaN(amt) || amt <= 0) { toast.error("יש להזין סכום חיובי"); return; }
                addAdditionalCharge(addChargeDialog.clientName, addChargeMonth, amt, addChargeNote);
                loadAdditional();
                toast.success(`חיוב של ₪${amt.toLocaleString("he-IL")} נוסף ל${addChargeDialog.clientName}`);
                setAddChargeDialog(null);
              }}
            >
              הוסף
            </Button>
            <Button variant="outline" onClick={() => setAddChargeDialog(null)}>ביטול</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Breakdown dialog */}
      <Dialog open={!!breakdownDialog} onOpenChange={(o) => !o && setBreakdownDialog(null)}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">
              {breakdownDialog ? `${breakdownDialog.client} — ${formatMonthLabel(breakdownDialog.month)}` : ""}
            </DialogTitle>
          </DialogHeader>
          {breakdownDialog && (() => {
            const isExcluded = excludedSet.has(`${breakdownDialog.client}|${breakdownDialog.month}`);
            const effectiveTrips = isExcluded ? 0 : breakdownDialog.fromTrips;
            const effectiveTotal = effectiveTrips + breakdownDialog.fromExtra;
            return (
              <div className="space-y-3 py-2">
                <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
                  <div className={`flex items-center justify-between text-sm ${isExcluded ? "opacity-40 line-through" : ""}`}>
                    <span className="text-muted-foreground">סה"כ מנסיעות</span>
                    <span className="font-semibold">₪{breakdownDialog.fromTrips.toLocaleString("he-IL")}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">סה"כ תוספת ידנית</span>
                    <span className="font-semibold text-blue-600">₪{breakdownDialog.fromExtra.toLocaleString("he-IL")}</span>
                  </div>
                  {additionalCharges
                    .filter(c => c.client === breakdownDialog.client && c.month === breakdownDialog.month)
                    .map(c => (
                      <div key={c.id} className="flex items-center justify-between text-xs text-muted-foreground pr-2">
                        <span className="truncate max-w-[60%]">{c.note || "חיוב ידני"}</span>
                        <div className="flex items-center gap-2">
                          <span>₪{c.amount.toLocaleString("he-IL")}</span>
                          <button
                            type="button"
                            onClick={() => {
                              deleteAdditionalCharge(c.id);
                              setAdditionalCharges(fetchAdditionalCharges());
                              setBreakdownDialog(null);
                            }}
                            className="text-red-400 hover:text-red-600 text-xs"
                            title="מחק חיוב"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))
                  }
                  <div className="flex items-center justify-between border-t border-border/60 pt-2 text-sm">
                    <span className="font-medium">סה"כ כללי</span>
                    <span className="text-base font-bold">₪{effectiveTotal.toLocaleString("he-IL")}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">יתרת חוב</span>
                    <span className="font-bold text-foreground">₪{breakdownDialog.debt.toLocaleString("he-IL")}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const next = !isExcluded;
                    setTripsExcluded(breakdownDialog.client, breakdownDialog.month, next);
                    reloadExcluded();
                    setBreakdownDialog((prev) => prev ? { ...prev, debt: next
                      ? Math.max(breakdownDialog.fromExtra - (paidMap[breakdownDialog.client]?.[breakdownDialog.month] ?? 0), 0)
                      : Math.max(breakdownDialog.fromTrips + breakdownDialog.fromExtra - (paidMap[breakdownDialog.client]?.[breakdownDialog.month] ?? 0), 0)
                    } : prev);
                  }}
                  className={`w-full rounded-lg border px-3 py-2 text-right text-sm transition-colors ${
                    isExcluded
                      ? "border-blue-400 bg-blue-50 text-blue-700"
                      : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  {isExcluded
                    ? "✓ הנסיעות מוחרגות (לחץ לביטול)"
                    : "אל תחשב נסיעות — כלולות בתוספת"}
                </button>
              </div>
            );
          })()}
          <DialogFooter className="sm:justify-start">
            <Button
              onClick={() => {
                if (!breakdownDialog) return;
                setBreakdownDialog(null);
                openDialog(breakdownDialog.client, breakdownDialog.month, breakdownDialog.debt);
              }}
            >
              סמן תשלום
            </Button>
            <Button variant="outline" onClick={() => setBreakdownDialog(null)}>סגור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename client dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">עריכת שם לקוח</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="rename-input">שם חדש</Label>
            <Input
              id="rename-input"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
            />
          </div>
          <DialogFooter className="sm:justify-start">
            <Button
              disabled={renaming}
              onClick={async () => {
                if (!renameTarget) return;
                const newN = renameInput.trim();
                if (!newN) {
                  toast.error("יש להזין שם");
                  return;
                }
                if (newN === renameTarget.oldName.trim()) {
                  setRenameTarget(null);
                  return;
                }
                setRenaming(true);
                try {
                  await renameClient(renameTarget.id, renameTarget.oldName, newN);
                  toast.success("השם עודכן");
                  setRenameTarget(null);
                  await load();
                } catch (e) {
                  toast.error("שגיאה: " + (e as Error).message);
                } finally {
                  setRenaming(false);
                }
              }}
            >
              {renaming ? "שומר..." : "שמור"}
            </Button>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Client notes dialog */}
      <Dialog open={!!notesTarget} onOpenChange={(o) => !o && setNotesTarget(null)}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">
              הערה ללקוח — {notesTarget?.name ?? ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="notes-input">הערה (תוצג רק כאן, לא ב-PDF)</Label>
            <Textarea
              id="notes-input"
              rows={4}
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
            />
          </div>
          <DialogFooter className="sm:justify-start">
            <Button
              disabled={savingNotes}
              onClick={async () => {
                if (!notesTarget) return;
                setSavingNotes(true);
                const { error } = await supabase
                  .from("clients")
                  .update({ notes: notesInput })
                  .eq("id", notesTarget.id);
                setSavingNotes(false);
                if (error) {
                  toast.error("שגיאה: " + error.message);
                  return;
                }
                toast.success("ההערה נשמרה");
                setNotesTarget(null);
                await load();
              }}
            >
              {savingNotes ? "שומר..." : "שמור"}
            </Button>
            <Button variant="outline" onClick={() => setNotesTarget(null)}>
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}