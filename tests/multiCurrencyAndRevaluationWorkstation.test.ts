import { describe, it, expect, beforeEach } from "vitest";

// Polyfill localStorage in node test environment
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = String(v);
  },
  removeItem: (k: string) => {
    delete store[k];
  },
  clear: () => {
    for (const k in store) delete store[k];
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

import {
  CURRENCY_METADATA,
  DEFAULT_RATES,
  convertCurrency,
  calculateCrossRate,
  getCrossRateMatrix,
  calculateForeignAssetRevaluation,
  formatCurrencyAmount,
  formatCompactCurrency,
  getCachedRates,
  saveCachedRates,
  type SupportedCurrency,
} from "../src/lib/currency";

describe("Audit #42: Multi-Currency Exchange Rate Conversion & Foreign Asset Revaluation Workstation Suite", () => {
  beforeEach(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
  });

  describe("1. Currency Metadata & Verification", () => {
    it("provides complete metadata for all 13 supported world currencies", () => {
      const currencies: SupportedCurrency[] = [
        "IDR", "USD", "SGD", "EUR", "JPY", "MYR",
        "THB", "AUD", "GBP", "CNY", "SAR", "AED", "USDT",
      ];

      currencies.forEach((code) => {
        const meta = CURRENCY_METADATA[code];
        expect(meta).toBeDefined();
        expect(meta.code).toBe(code);
        expect(meta.symbol.length).toBeGreaterThan(0);
        expect(meta.name.length).toBeGreaterThan(0);
        expect(meta.countryCode.length).toBe(2);
        expect([0, 2]).toContain(meta.decimals);
      });
    });

    it("verifies JPY and IDR have 0 decimal places, others have 2 decimal places", () => {
      expect(CURRENCY_METADATA.IDR.decimals).toBe(0);
      expect(CURRENCY_METADATA.JPY.decimals).toBe(0);
      expect(CURRENCY_METADATA.USD.decimals).toBe(2);
      expect(CURRENCY_METADATA.SGD.decimals).toBe(2);
      expect(CURRENCY_METADATA.EUR.decimals).toBe(2);
    });
  });

  describe("2. Cross-Currency Conversion & Matrix (calculateCrossRate & convertCurrency)", () => {
    it("converts between base IDR and foreign currencies accurately", () => {
      const usdInIdr = convertCurrency(100, "USD", "IDR");
      expect(usdInIdr).toBeCloseTo(100 * 15850, -2);

      const idrInUsd = convertCurrency(1585000, "IDR", "USD");
      expect(idrInUsd).toBeCloseTo(100, 1);
    });

    it("converts between two foreign currencies via cross rates (e.g. USD to SGD)", () => {
      // 1 USD = 15850 IDR, 1 SGD = 11820 IDR => 1 USD = 15850 / 11820 ≈ 1.3409 SGD
      const rateUsdToSgd = calculateCrossRate("USD", "SGD");
      expect(rateUsdToSgd).toBeCloseTo(15850 / 11820, 2);

      const convertedSgd = convertCurrency(100, "USD", "SGD");
      expect(convertedSgd).toBeCloseTo(100 * (15850 / 11820), 1);
    });

    it("guarantees identity conversion (same currency returns exact amount)", () => {
      expect(convertCurrency(500, "USD", "USD")).toBe(500);
      expect(convertCurrency(1000000, "IDR", "IDR")).toBe(1000000);
      expect(calculateCrossRate("EUR", "EUR")).toBe(1);
    });

    it("handles zero and negative amounts without NaN or exceptions", () => {
      expect(convertCurrency(0, "USD", "IDR")).toBe(0);
      expect(convertCurrency(-100, "USD", "IDR")).toBeCloseTo(-1585000, -2);
    });

    it("builds a consistent cross rate matrix where reciprocal rates multiply to ~1.0", () => {
      const matrix = getCrossRateMatrix(["USD", "SGD", "EUR"]);
      const usdToSgd = matrix["USD_SGD"];
      const sgdToUsd = matrix["SGD_USD"];
      expect(usdToSgd * sgdToUsd).toBeCloseTo(1.0, 4);
    });
  });

  describe("3. Foreign Asset Revaluation Engine (calculateForeignAssetRevaluation)", () => {
    it("decomposes total gain into capital gain and FX gain when both are positive", () => {
      // Example: Buy 10 AAPL @ $150 when 1 USD = Rp 15,000 (Cost Basis = Rp 22,500,000)
      // Now AAPL @ $180, 1 USD = Rp 16,000 (Market Value = Rp 28,800,000)
      // Total Base Gain = Rp 6,300,000 (+28.0%)
      // Pure Capital Gain = (180 - 150) * 10 * 15,000 = Rp 4,500,000 (+20.0%)
      // Currency FX Gain = 1,800 * (16,000 - 15,000) = Rp 1,800,000 (+8.0%)
      // Sum = 4,500,000 + 1,800,000 = 6,300,000
      const res = calculateForeignAssetRevaluation({
        units: 10,
        nativeCostPrice: 150,
        nativeCurrentPrice: 180,
        nativeCurrency: "USD",
        baseCurrency: "IDR",
        costExchangeRate: 15000,
        currentExchangeRate: 16000,
        isIndonesian: true,
      });

      expect(res.nativeCostBasis).toBe(1500);
      expect(res.nativeMarketValue).toBe(1800);
      expect(res.nativeGain).toBe(300);
      expect(res.nativeGainPct).toBe(20.0);

      expect(res.baseCostBasis).toBe(22500000);
      expect(res.baseMarketValue).toBe(28800000);
      expect(res.totalBaseGain).toBe(6300000);
      expect(res.totalBaseGainPct).toBe(28.0);

      expect(res.assetCapitalGainBase).toBe(4500000);
      expect(res.currencyFxGainBase).toBe(1800000);
      expect(res.assetCapitalGainBase + res.currencyFxGainBase).toBe(res.totalBaseGain);

      expect(res.fxGainType).toBe("GAIN");
      expect(res.statusBadge).toContain("LABA KURS");
      expect(res.verdict).toContain("Apresiasi nilai tukar");
      expect(res.verdict).not.toMatch(/appreciation|portfolio|return/i);
    });

    it("accurately attributes foreign currency depreciation (FX Loss) eroding asset gains", () => {
      // Buy 100 Nintendo @ 8,000 JPY when 1 JPY = Rp 115 (Cost Basis = Rp 92,000,000)
      // Now Nintendo @ 9,000 JPY (+12.5%), but 1 JPY weakened to Rp 105 (-8.7%)
      // Native Market Value = 900,000 JPY
      // Base Market Value = 900,000 * 105 = Rp 94,500,000
      // Total Base Gain = Rp 2,500,000
      // Capital Gain = (9000 - 8000) * 100 * 115 = Rp 11,500,000
      // FX Gain = 900,000 * (105 - 115) = -Rp 9,000,000
      // Total = 11,500,000 - 9,000,000 = Rp 2,500,000
      const res = calculateForeignAssetRevaluation({
        units: 100,
        nativeCostPrice: 8000,
        nativeCurrentPrice: 9000,
        nativeCurrency: "JPY",
        baseCurrency: "IDR",
        costExchangeRate: 115,
        currentExchangeRate: 105,
        isIndonesian: true,
      });

      expect(res.nativeGainPct).toBe(12.5);
      expect(res.assetCapitalGainBase).toBe(11500000);
      expect(res.currencyFxGainBase).toBe(-9000000);
      expect(res.totalBaseGain).toBe(2500000);

      expect(res.fxGainType).toBe("LOSS");
      expect(res.statusBadge).toContain("RUGI KURS");
      expect(res.verdict).toContain("Pelemahan kurs");
    });

    it("handles base currency domestic assets without FX exposure", () => {
      const res = calculateForeignAssetRevaluation({
        units: 100,
        nativeCostPrice: 5000,
        nativeCurrentPrice: 6000,
        nativeCurrency: "IDR",
        baseCurrency: "IDR",
        isIndonesian: true,
      });

      expect(res.currencyFxGainBase).toBe(0);
      expect(res.statusBadge).toBe("MATA UANG DASAR");
      expect(res.fxGainType).toBe("NEUTRAL");
    });

    it("supports pure English localization without mixed bilingual terms", () => {
      const res = calculateForeignAssetRevaluation({
        units: 10,
        nativeCostPrice: 150,
        nativeCurrentPrice: 180,
        nativeCurrency: "USD",
        baseCurrency: "IDR",
        costExchangeRate: 15000,
        currentExchangeRate: 16000,
        isIndonesian: false,
      });

      expect(res.statusBadge).toContain("FX GAIN");
      expect(res.verdict).toContain("Exchange rate appreciation");
      expect(res.verdict).not.toMatch(/laba|kurs|apresiasi/i);
    });

    it("handles zero units gracefully without crashing", () => {
      const res = calculateForeignAssetRevaluation({
        units: 0,
        nativeCostPrice: 150,
        nativeCurrentPrice: 180,
        nativeCurrency: "USD",
        baseCurrency: "IDR",
      });

      expect(res.baseMarketValue).toBe(0);
      expect(res.totalBaseGain).toBe(0);
      expect(res.totalBaseGainPct).toBe(0);
    });
  });

  describe("4. Formatting & Currency Display (formatCurrencyAmount & formatCompactCurrency)", () => {
    it("formats IDR with Rp prefix and without decimals", () => {
      expect(formatCurrencyAmount(150000, "IDR")).toBe("Rp 150.000");
      expect(formatCurrencyAmount(-50000, "IDR")).toBe("-Rp 50.000");
    });

    it("formats USD with $ prefix and 2 decimals", () => {
      expect(formatCurrencyAmount(125.5, "USD")).toBe("$125.50");
      expect(formatCurrencyAmount(-25, "USD")).toBe("-$25.00");
    });

    it("formats compact currencies cleanly across thresholds (k, M, B)", () => {
      expect(formatCompactCurrency(500000, "IDR")).toBe("Rp 500k");
      expect(formatCompactCurrency(1500000, "IDR")).toBe("Rp 1.5M");
      expect(formatCompactCurrency(2000000000, "IDR")).toBe("Rp 2B");
      expect(formatCompactCurrency(-5000000, "IDR")).toBe("-Rp 5M");
    });
  });

  describe("5. Exchange Rate Cache & Resilient Fallbacks", () => {
    it("returns default rates when cache is empty", () => {
      const cached = getCachedRates();
      expect(cached.base).toBe("IDR");
      expect(cached.rates.USD).toBe(DEFAULT_RATES.USD);
      expect(cached.rates.SGD).toBe(DEFAULT_RATES.SGD);
    });

    it("persists and retrieves updated rates in localStorage", () => {
      const customRates = {
        base: "IDR" as const,
        timestamp: Date.now(),
        rates: {
          ...DEFAULT_RATES,
          USD: 1 / 16000,
        },
      };
      saveCachedRates(customRates);

      const retrieved = getCachedRates();
      expect(retrieved.rates.USD).toBe(1 / 16000);
    });
  });
});
