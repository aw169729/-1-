import { supabase } from "@/integrations/supabase/client";

export interface BusinessSettings {
  business_name: string;
  business_phone: string;
  business_email: string;
  global_note: string;
  business_logo: string;
  whatsapp_template: string;
}

const KEYS = ["business_name", "business_phone", "business_email", "global_note", "business_logo", "whatsapp_template"] as const;

export const DEFAULT_WHATSAPP_TEMPLATE =
  "שלום {שם_לקוח}, נשמח לקבל תשלום עבור חודש {חודש} בסך ₪{סכום}. תודה.";

export async function fetchBusinessSettings(): Promise<BusinessSettings> {
  const { data, error } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", KEYS as unknown as string[]);
  if (error) throw error;
  const map = new Map((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
  return {
    business_name: map.get("business_name") ?? "",
    business_phone: map.get("business_phone") ?? "",
    business_email: map.get("business_email") ?? "",
    global_note: map.get("global_note") ?? "",
    business_logo: map.get("business_logo") ?? "",
    whatsapp_template: map.get("whatsapp_template") ?? DEFAULT_WHATSAPP_TEMPLATE,
  };
}

export function renderTemplate(
  template: string,
  vars: { clientName: string; month: string; amount: number | string },
): string {
  return template
    .replaceAll("{שם_לקוח}", vars.clientName)
    .replaceAll("{חודש}", vars.month)
    .replaceAll("{סכום}", String(vars.amount));
}

export async function saveBusinessSettings(s: BusinessSettings): Promise<void> {
  for (const key of KEYS) {
    const value = s[key] ?? "";
    // upsert by key
    const existing = await supabase.from("settings").select("id").eq("key", key).maybeSingle();
    if (existing.data?.id) {
      const { error } = await supabase.from("settings").update({ value }).eq("key", key);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("settings").insert({ key, value });
      if (error) throw error;
    }
  }
}

export const DEFAULT_VAT_RATE = 18;

export async function fetchVatRate(): Promise<number> {
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "vat_rate")
    .maybeSingle();
  if (error) return DEFAULT_VAT_RATE;
  const raw = data?.value;
  if (raw == null || raw === "") return DEFAULT_VAT_RATE;
  const n = Number(raw);
  return isFinite(n) && n >= 0 ? n : DEFAULT_VAT_RATE;
}

export async function saveVatRate(rate: number): Promise<void> {
  const value = String(rate);
  const existing = await supabase.from("settings").select("id").eq("key", "vat_rate").maybeSingle();
  if (existing.data?.id) {
    const { error } = await supabase.from("settings").update({ value }).eq("key", "vat_rate");
    if (error) throw error;
  } else {
    const { error } = await supabase.from("settings").insert({ key: "vat_rate", value });
    if (error) throw error;
  }
}