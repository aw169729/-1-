import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Car as CarIcon } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { SummaryCards } from "@/components/trips/SummaryCards";
import { UploadTripsDialog } from "@/components/trips/UploadTripsDialog";
import { AddTripDialog } from "@/components/trips/AddTripDialog";
import { TripsTable } from "@/components/trips/TripsTable";
import { BillingMonthHeader } from "@/components/billing/BillingMonthHeader";
import { fetchBillingMonth, type BillingMonthInfo } from "@/lib/billing-month";
import type { Trip } from "@/components/trips/types";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { useAuth } from "@/contexts/auth-context";
import { AuthGate } from "@/components/auth/AuthGate";
import { PageNav } from "@/components/auth/PageNav";
import { fetchAllRows } from "@/lib/fetch-all";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ניהול נסיעות — דשבורד ראשי" },
      { name: "description", content: "מערכת לניהול נסיעות עבור עסק הסעות — דשבורד ראשי, מעקב נסיעות, סיכומים חודשיים והכנת דרישות תשלום." },
      { property: "og:title", content: "ניהול נסיעות — דשבורד ראשי" },
      { property: "og:description", content: "מערכת לניהול נסיעות עבור עסק הסעות — דשבורד ראשי, מעקב נסיעות וסיכומים חודשיים." },
      { property: "og:url", content: "https://asher-weinberger.com/" },
    ],
    links: [{ rel: "canonical", href: "https://asher-weinberger.com/" }],
  }),
  component: () => (
    <AuthGate page="trips">
      <Index />
    </AuthGate>
  ),
});

function Index() {
  const { canView } = useAuth();
  const [billing, setBilling] = useState<BillingMonthInfo | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!canView("trips")) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const info = await fetchBillingMonth();
      setBilling(info);
      const { data, error } = await fetchAllRows<Trip>((from, to) =>
        supabase
          .from("trips")
          .select("*")
          .eq("billing_month", info.month)
          .order("trip_date", { ascending: false })
          .range(from, to),
      );
      if (!error) setTrips(data);
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeSync(["trips", "clients", "phone_routing", "settings"], load);

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" richColors />
      <header className="border-b border-border/60 bg-card shadow-[var(--shadow-card)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <CarIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">ניהול נסיעות</h1>
              <p className="text-xs text-muted-foreground">מערכת ניהול עסק הסעות</p>
            </div>
          </div>
          <PageNav current="trips" />
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {billing && <BillingMonthHeader info={billing} onChanged={load} />}

        <h2 className="text-lg font-semibold text-foreground">סיכום חודשי</h2>

        <SummaryCards trips={trips} />

        <div className="flex flex-wrap items-center gap-3">
          <UploadTripsDialog onUploaded={load} />
          <AddTripDialog onAdded={load} />
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">נסיעות החודש</h2>
          {loading ? (
            <div className="rounded-xl bg-card p-12 text-center text-muted-foreground shadow-[var(--shadow-card)]">
              טוען נסיעות...
            </div>
          ) : (
            <TripsTable trips={trips} onChanged={load} />
          )}
        </div>
      </main>
    </div>
  );
}
