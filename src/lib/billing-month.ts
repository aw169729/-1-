import { supabase } from "@/integrations/supabase/client";
import { HEBREW_MONTHS } from "./hebrew-date";

export interface BillingMonthInfo {
  month: string; // YYYY-MM
  startDate: string; // YYYY-MM-DD
}

export async function fetchBillingMonth(): Promise<BillingMonthInfo> {
  const { data, error } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", ["current_billing_month", "current_billing_month_start"]);
  if (error) throw error;
  const map = new Map((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
  return {
    month: map.get("current_billing_month") ?? "2026-04",
    startDate: map.get("current_billing_month_start") ?? "2026-03-26",
  };
}

export async function setBillingMonth(month: string, startDate: string): Promise<void> {
  const { error: e1 } = await supabase
    .from("settings")
    .update({ value: month })
    .eq("key", "current_billing_month");
  if (e1) throw e1;
  const { error: e2 } = await supabase
    .from("settings")
    .update({ value: startDate })
    .eq("key", "current_billing_month_start");
  if (e2) throw e2;
}

export function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatBillingMonthLabel(month: string): string {
  const [y, m] = month.split("-");
  const idx = parseInt(m, 10) - 1;
  return `${HEBREW_MONTHS[idx] ?? m} ${y}`;
}

export function formatStartDateLabel(startDate: string): string {
  // YYYY-MM-DD -> DD/M/YYYY (no leading zero on month, per spec example "26/3/2026")
  const [y, m, d] = startDate.split("-");
  return `${parseInt(d, 10)}/${parseInt(m, 10)}/${y}`;
}