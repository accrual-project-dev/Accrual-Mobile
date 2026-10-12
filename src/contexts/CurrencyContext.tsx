import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  useCurrency as useCurrencyInternal,
  type SupportedCurrency,
  type CurrencyMeta,
  CURRENCY_METADATA,
  DEFAULT_RATES,
  formatCurrencyAmount,
} from "../lib/currency";

export { formatCurrencyAmount };

export interface CurrencyContextValue {
  preferredCurrency: SupportedCurrency;
  currencyMeta: CurrencyMeta;
  setPreferredCurrency: (curr: SupportedCurrency) => void;
  rates: Record<SupportedCurrency, number>;
  lastUpdated: number;
  isLoading: boolean;
  refreshRates: () => Promise<void>;
  convertFromIdr: (idrAmount: number, targetCurr?: SupportedCurrency) => number;
  convertToIdr: (foreignAmount: number, sourceCurr?: SupportedCurrency) => number;
  formatWithPreferred: (idrAmount: number, options?: { showCode?: boolean }) => string;
  formatCompactWithPreferred: (idrAmount: number) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const currencyState = useCurrencyInternal();
  const meta = useMemo(
    () => CURRENCY_METADATA[currencyState.preferredCurrency] || CURRENCY_METADATA.IDR,
    [currencyState.preferredCurrency]
  );

  const value: CurrencyContextValue = useMemo(
    () => ({
      ...currencyState,
      currencyMeta: meta,
    }),
    [currencyState, meta]
  );

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const context = useContext(CurrencyContext);
  if (!context) {
    // Graceful fallback if rendered outside of Provider (e.g. isolated test environments)
    return {
      preferredCurrency: "IDR",
      currencyMeta: CURRENCY_METADATA.IDR,
      setPreferredCurrency: () => {},
      rates: DEFAULT_RATES,
      lastUpdated: Date.now(),
      isLoading: false,
      refreshRates: async () => {},
      convertFromIdr: (amt: number) => amt,
      convertToIdr: (amt: number) => amt,
      formatWithPreferred: (amt: number) => `Rp ${Math.round(amt).toLocaleString("id-ID")}`,
      formatCompactWithPreferred: (amt: number) => {
        const abs = Math.abs(amt);
        if (abs >= 1_000_000_000) return (amt / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
        if (abs >= 1_000_000) return (amt / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
        if (abs >= 1_000) return Math.round(amt / 1_000) + "k";
        return Math.round(amt).toString();
      },
    };
  }
  return context;
}

export { CURRENCY_METADATA, DEFAULT_RATES, type SupportedCurrency, type CurrencyMeta };
