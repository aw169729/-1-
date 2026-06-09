export interface ClientPriceConfig {
  markup_type?: string | null;
  markup_value?: number | null;
}

export function computeClientPrice(driverPrice: number | null, cfg?: ClientPriceConfig | null): number | null {
  if (driverPrice == null) return null;
  if (!cfg || cfg.markup_value == null || !cfg.markup_type) return driverPrice;
  const v = Number(cfg.markup_value);
  if (cfg.markup_type === "percent") return Math.round(driverPrice * (1 + v / 100) * 100) / 100;
  if (cfg.markup_type === "fixed") return Math.round((driverPrice + v) * 100) / 100;
  return driverPrice;
}
