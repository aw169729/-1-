import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchVatRate, DEFAULT_VAT_RATE } from "@/lib/business-settings";

interface VatContextValue {
  vatRate: number;
  vatMultiplier: number;
  vatPlus: number;
  refresh: () => Promise<void>;
  loading: boolean;
}

const VatContext = createContext<VatContextValue>({
  vatRate: DEFAULT_VAT_RATE,
  vatMultiplier: DEFAULT_VAT_RATE / 100,
  vatPlus: 1 + DEFAULT_VAT_RATE / 100,
  refresh: async () => {},
  loading: true,
});

export function VatProvider({ children }: { children: ReactNode }) {
  const [vatRate, setVatRate] = useState<number>(DEFAULT_VAT_RATE);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const v = await fetchVatRate();
      setVatRate(v);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const value: VatContextValue = {
    vatRate,
    vatMultiplier: vatRate / 100,
    vatPlus: 1 + vatRate / 100,
    refresh,
    loading,
  };

  return <VatContext.Provider value={value}>{children}</VatContext.Provider>;
}

export function useVat() {
  return useContext(VatContext);
}
