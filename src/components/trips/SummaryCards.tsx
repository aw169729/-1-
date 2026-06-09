import { Car, DollarSign, Users } from "lucide-react";
import type { Trip } from "./types";

interface Props {
  trips: Trip[];
}

export function SummaryCards({ trips }: Props) {
  const total = trips.length;
  const revenue = trips.reduce((s, t) => s + (Number(t.price) || 0), 0);
  const clients = new Set(trips.map((t) => t.client).filter(Boolean)).size;

  const cards = [
    { label: "נסיעות החודש", value: total.toLocaleString("he-IL"), icon: Car, color: "text-blue-600 bg-blue-50" },
    { label: 'סה"כ הכנסה', value: "₪" + revenue.toLocaleString("he-IL", { maximumFractionDigits: 0 }), icon: DollarSign, color: "text-emerald-600 bg-emerald-50" },
    { label: "לקוחות פעילים", value: clients.toLocaleString("he-IL"), icon: Users, color: "text-purple-600 bg-purple-50" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className="rounded-xl bg-card p-5 shadow-[var(--shadow-card)] border border-border/40"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{c.value}</p>
              </div>
              <div className={`rounded-lg p-3 ${c.color}`}>
                <Icon className="h-6 w-6" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}