import { useState, useEffect, useCallback, useMemo } from "react";

export type SupportedCurrency =
  | "IDR"
  | "USD"
  | "SGD"
  | "EUR"
  | "JPY"
  | "MYR"
  | "THB"
  | "AUD"
  | "GBP"
  | "CNY"
  | "SAR"
  | "AED"
  | "USDT";

export interface CurrencyMeta {
  code: SupportedCurrency;
  symbol: string;
  name: string;
  countryCode: string;
  decimals: number;
}

export const CURRENCY_METADATA: Record<SupportedCurrency, CurrencyMeta> = {
  IDR: { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah", countryCode: "ID", decimals: 0 },
  USD: { code: "USD", symbol: "$", name: "US Dollar", countryCode: "US", decimals: 2 },
  SGD: { code: "SGD", symbol: "S$", name: "Singapore Dollar", countryCode: "SG", decimals: 2 },
  EUR: { code: "EUR", symbol: "€", name: "Euro", countryCode: "EU", decimals: 2 },
  JPY: { code: "JPY", symbol: "¥", name: "Japanese Yen", countryCode: "JP", decimals: 0 },
  MYR: { code: "MYR", symbol: "RM", name: "Malaysian Ringgit", countryCode: "MY", decimals: 2 },
  THB: { code: "THB", symbol: "฿", name: "Thai Baht", countryCode: "TH", decimals: 2 },
  AUD: { code: "AUD", symbol: "A$", name: "Australian Dollar", countryCode: "AU", decimals: 2 },
  GBP: { code: "GBP", symbol: "£", name: "British Pound", countryCode: "GB", decimals: 2 },
  CNY: { code: "CNY", symbol: "¥", name: "Chinese Yuan", countryCode: "CN", decimals: 2 },
  SAR: { code: "SAR", symbol: "﷼", name: "Saudi Riyal", countryCode: "SA", decimals: 2 },
  AED: { code: "AED", symbol: "د.إ", name: "UAE Dirham", countryCode: "AE", decimals: 2 },
  USDT: { code: "USDT", symbol: "₮", name: "Tether USD", countryCode: "US", decimals: 2 },
};

// Default offline fallback rates (Units of Foreign Currency per 1 IDR)
export const DEFAULT_RATES: Record<SupportedCurrency, number> = {
  IDR: 1,
  USD: 1 / 15850,
  SGD: 1 / 11820,
  EUR: 1 / 17150,
  JPY: 1 / 106,
  MYR: 1 / 3580,
  THB: 1 / 460,
  AUD: 1 / 10250,
  GBP: 1 / 20500,
  CNY: 1 / 2180,
  SAR: 1 / 4225,
  AED: 1 / 4315,
  USDT: 1 / 15900,
};

export interface ExchangeRatesData {
  base: "IDR";
  timestamp: number;
  rates: Record<SupportedCurrency, number>;
}

const STORAGE_KEY = "trouvaille_exchange_rates_v1";
const PREFERRED_CURRENCY_KEY = "trouvaille_preferred_currency";

export function getCachedRates(): ExchangeRatesData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.rates && parsed.rates.USD) {
        return parsed;
      }
    }
  } catch {
    // ignore parse failure
  }
  return {
    base: "IDR",
    timestamp: Date.now(),
    rates: { ...DEFAULT_RATES },
  };
}

export function saveCachedRates(data: ExchangeRatesData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore storage quota errors
  }
}

/**
 * Fetch live exchange rates with IDR as base.
 * Gracefully falls back to cached or default rates when offline.
 */
export async function fetchLiveExchangeRates(): Promise<ExchangeRatesData> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/IDR", {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    if (json && json.rates) {
      const newRates: Record<SupportedCurrency, number> = {
        IDR: 1,
        USD: json.rates.USD || DEFAULT_RATES.USD,
        SGD: json.rates.SGD || DEFAULT_RATES.SGD,
        EUR: json.rates.EUR || DEFAULT_RATES.EUR,
        JPY: json.rates.JPY || DEFAULT_RATES.JPY,
        MYR: json.rates.MYR || DEFAULT_RATES.MYR,
        THB: json.rates.THB || DEFAULT_RATES.THB,
        AUD: json.rates.AUD || DEFAULT_RATES.AUD,
        GBP: json.rates.GBP || DEFAULT_RATES.GBP,
        CNY: json.rates.CNY || DEFAULT_RATES.CNY,
        SAR: json.rates.SAR || DEFAULT_RATES.SAR,
        AED: json.rates.AED || DEFAULT_RATES.AED,
        USDT: json.rates.USDT || json.rates.USD || DEFAULT_RATES.USDT,
      };
      const data: ExchangeRatesData = {
        base: "IDR",
        timestamp: Date.now(),
        rates: newRates,
      };
      saveCachedRates(data);
      return data;
    }
  } catch (err) {
    console.warn("Could not fetch live exchange rates, falling back to cache/default:", err);
  }
  return getCachedRates();
}

/**
 * Convert any amount from one supported currency to another.
 */
export function convertCurrency(
  amount: number,
  from: SupportedCurrency,
  to: SupportedCurrency,
  customRates?: Record<SupportedCurrency, number>
): number {
  if (from === to || amount === 0) return amount;
  const rates = customRates || getCachedRates().rates;

  const rateFrom = rates[from] || DEFAULT_RATES[from] || 1;
  const rateTo = rates[to] || DEFAULT_RATES[to] || 1;

  // Convert to base IDR first: amount / rateFrom
  const amountInIdr = from === "IDR" ? amount : amount / rateFrom;

  // Convert IDR to target: amountInIdr * rateTo
  const targetAmount = to === "IDR" ? amountInIdr : amountInIdr * rateTo;

  return targetAmount;
}

const FORMATTER_CACHE = new Map<string, Intl.NumberFormat>();

export function getCachedNumberFormatter(
  locale: string,
  options?: Intl.NumberFormatOptions
): Intl.NumberFormat {
  const key = `${locale}_${options?.style ?? "dec"}_${options?.currency ?? ""}_${options?.minimumFractionDigits ?? "def"}_${options?.maximumFractionDigits ?? "def"}`;
  let formatter = FORMATTER_CACHE.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    FORMATTER_CACHE.set(key, formatter);
  }
  return formatter;
}

/**
 * Format currency with internationalization standard and native symbol.
 */
export function formatCurrencyAmount(
  amount: number,
  currency: SupportedCurrency = "IDR",
  options?: { showCode?: boolean }
): string {
  const meta = CURRENCY_METADATA[currency] || CURRENCY_METADATA.IDR;
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  let formattedNumber = "";
  if (meta.decimals === 0) {
    const locale = currency === "IDR" ? "id-ID" : "ja-JP";
    formattedNumber = getCachedNumberFormatter(locale).format(Math.round(absAmount));
  } else {
    formattedNumber = getCachedNumberFormatter("en-US", {
      minimumFractionDigits: meta.decimals,
      maximumFractionDigits: meta.decimals,
    }).format(absAmount);
  }

  const sign = isNegative ? "-" : "";
  const prefix = meta.symbol === "Rp" ? "Rp " : meta.symbol;
  const codeSuffix = options?.showCode ? ` ${currency}` : "";

  return `${sign}${prefix}${formattedNumber}${codeSuffix}`;
}

/**
 * Format compact currency for limited width displays (e.g. 1.2M, 500k, 2.5B).
 */
export function formatCompactRupiah(val: number): string {
  const abs = Math.abs(val);
  let formatted = "";
  if (abs >= 1000000000) {
    formatted = (abs / 1000000000).toFixed(1).replace(/\.0$/, "") + "B";
  } else if (abs >= 1000000) {
    formatted = (abs / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  } else if (abs >= 1000) {
    formatted = Math.round(abs / 1000) + "k";
  } else {
    formatted = abs.toString();
  }
  return val < 0 ? `-${formatted}` : formatted;
}

/**
 * Format compact currency for any preferred currency (e.g. $1.5k, €250, Rp 500k, Rp 1.2M).
 */
export function formatCompactCurrency(
  idrAmount: number,
  preferredCurrency: SupportedCurrency = "IDR",
  rates?: Record<SupportedCurrency, number>
): string {
  const converted = convertCurrency(idrAmount, "IDR", preferredCurrency, rates);
  const meta = CURRENCY_METADATA[preferredCurrency] || CURRENCY_METADATA.IDR;
  const abs = Math.abs(converted);
  let numStr = "";
  if (abs >= 1_000_000_000) {
    numStr = (abs / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
  } else if (abs >= 1_000_000) {
    numStr = (abs / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  } else if (abs >= 1_000) {
    numStr = (abs / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  } else {
    numStr = meta.decimals === 0 ? Math.round(abs).toString() : abs.toFixed(meta.decimals);
  }
  const prefix = meta.symbol === "Rp" ? "Rp " : meta.symbol;
  const sign = idrAmount < 0 ? "-" : "";
  return `${sign}${prefix}${numStr}`;
}

/**
 * React hook to access and manage the active viewing currency across the app.
 */
export function useCurrency() {
  const [preferredCurrency, setPreferredCurrencyState] = useState<SupportedCurrency>(() => {
    try {
      const saved = localStorage.getItem(PREFERRED_CURRENCY_KEY) as SupportedCurrency;
      if (saved && CURRENCY_METADATA[saved]) return saved;
    } catch {
      // fallback
    }
    return "IDR";
  });

  const [ratesData, setRatesData] = useState<ExchangeRatesData>(getCachedRates);
  const [isLoading, setIsLoading] = useState(false);

  const setPreferredCurrency = useCallback((curr: SupportedCurrency) => {
    setPreferredCurrencyState(curr);
    try {
      localStorage.setItem(PREFERRED_CURRENCY_KEY, curr);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("trouvaille_currency_changed", { detail: curr }));
      }
    } catch {
      // ignore
    }
  }, []);

  const refreshRates = useCallback(async () => {
    setIsLoading(true);
    const updated = await fetchLiveExchangeRates();
    setRatesData(updated);
    setIsLoading(false);
  }, []);

  // Check rate freshness on mount: fetch if cached rates are older than 24 hours
  useEffect(() => {
    const isStale = Date.now() - ratesData.timestamp > 24 * 60 * 60 * 1000;
    if (isStale) {
      let isMounted = true;
      fetchLiveExchangeRates().then((updated) => {
        if (isMounted) setRatesData(updated);
      });
      return () => {
        isMounted = false;
      };
    }
  }, [ratesData.timestamp]);

  // Synchronize across tabs and storage events
  useEffect(() => {
    const handleSync = () => {
      try {
        const saved = localStorage.getItem(PREFERRED_CURRENCY_KEY) as SupportedCurrency;
        if (saved && CURRENCY_METADATA[saved] && saved !== preferredCurrency) {
          setPreferredCurrencyState(saved);
        }
      } catch {}
    };
    window.addEventListener("trouvaille_currency_changed", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("trouvaille_currency_changed", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, [preferredCurrency]);

  const convertFromIdr = useCallback(
    (idrAmount: number, targetCurr: SupportedCurrency = preferredCurrency) => {
      return convertCurrency(idrAmount, "IDR", targetCurr, ratesData.rates);
    },
    [preferredCurrency, ratesData.rates]
  );

  const convertToIdr = useCallback(
    (foreignAmount: number, sourceCurr: SupportedCurrency = preferredCurrency) => {
      return convertCurrency(foreignAmount, sourceCurr, "IDR", ratesData.rates);
    },
    [preferredCurrency, ratesData.rates]
  );

  const formatWithPreferred = useCallback(
    (idrAmount: number, options?: { showCode?: boolean }) => {
      const converted = convertFromIdr(idrAmount, preferredCurrency);
      return formatCurrencyAmount(converted, preferredCurrency, options);
    },
    [convertFromIdr, preferredCurrency]
  );

  const formatCompactWithPreferred = useCallback(
    (idrAmount: number) => {
      return formatCompactCurrency(idrAmount, preferredCurrency, ratesData.rates);
    },
    [preferredCurrency, ratesData.rates]
  );

  return useMemo(
    () => ({
      preferredCurrency,
      setPreferredCurrency,
      rates: ratesData.rates,
      lastUpdated: ratesData.timestamp,
      isLoading,
      refreshRates,
      convertFromIdr,
      convertToIdr,
      formatWithPreferred,
      formatCompactWithPreferred,
    }),
    [
      preferredCurrency,
      setPreferredCurrency,
      ratesData.rates,
      ratesData.timestamp,
      isLoading,
      refreshRates,
      convertFromIdr,
      convertToIdr,
      formatWithPreferred,
      formatCompactWithPreferred,
    ]
  );
}
