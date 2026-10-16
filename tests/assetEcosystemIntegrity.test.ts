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

if (typeof (globalThis as any).window === "undefined") {
  (globalThis as any).window = globalThis;
}
(globalThis as any).window.dispatchEvent = () => true;
(globalThis as any).window.addEventListener = () => {};
(globalThis as any).window.removeEventListener = () => {};

import {
  upsertHolding,
  getSavedHoldings,
  deleteHolding,
  calculateHoldingValuation,
  calculatePortfolioSummary,
  USD_IDR_ESTIMATE,
} from "../src/lib/marketPriceService";
import { formatCompactCurrency } from "../src/lib/currency";
import type { InvestmentHolding } from "../src/lib/types";

describe("Asset Ecosystem & Portfolio Valuation Integrity", () => {
  const userId = "usr-audit-test-01";

  beforeEach(() => {
    mockLocalStorage.clear();
  });

  describe("Fixed Asset Multi-Instance Integrity", () => {
    it("preserves multiple fixed assets sharing the same preset category symbol without overwrite", () => {
      // 1. Add first property
      const propertyA: InvestmentHolding = {
        id: "fa-uuid-1111-aaaa",
        user_id: userId,
        symbol: "PROPERTY",
        name: "Rumah BSD Grand",
        asset_type: "fixed_asset",
        units: 1,
        avg_buy_price: 1_200_000_000,
        current_price: 1_300_000_000,
        currency: "IDR",
        annual_rate: 6,
        purchase_date: "2024-01-01",
      };

      upsertHolding(propertyA, userId);
      let holdings = getSavedHoldings(userId);
      expect(holdings).toHaveLength(1);
      expect(holdings[0].name).toBe("Rumah BSD Grand");

      // 2. Add second property with same symbol "PROPERTY" but different id
      const propertyB: InvestmentHolding = {
        id: "fa-uuid-2222-bbbb",
        user_id: userId,
        symbol: "PROPERTY",
        name: "Apartemen Sudirman Suites",
        asset_type: "fixed_asset",
        units: 1,
        avg_buy_price: 850_000_000,
        current_price: 900_000_000,
        currency: "IDR",
        annual_rate: 4,
        purchase_date: "2024-06-01",
      };

      upsertHolding(propertyB, userId);
      holdings = getSavedHoldings(userId);

      // Must have both properties preserved, not overwritten!
      expect(holdings).toHaveLength(2);
      const names = holdings.map((h) => h.name);
      expect(names).toContain("Rumah BSD Grand");
      expect(names).toContain("Apartemen Sudirman Suites");
    });

    it("updates existing fixed asset when matching ID without duplicating", () => {
      const vehicle: InvestmentHolding = {
        id: "fa-uuid-3333-cccc",
        user_id: userId,
        symbol: "VEHICLE",
        name: "Mobil Sedan",
        asset_type: "fixed_asset",
        units: 1,
        avg_buy_price: 300_000_000,
        current_price: 270_000_000,
        currency: "IDR",
      };

      upsertHolding(vehicle, userId);
      expect(getSavedHoldings(userId)).toHaveLength(1);

      // Update price / name of the same vehicle
      const updatedVehicle: InvestmentHolding = {
        ...vehicle,
        name: "Mobil Sedan Facelift",
        current_price: 260_000_000,
      };

      upsertHolding(updatedVehicle, userId);
      const holdings = getSavedHoldings(userId);
      expect(holdings).toHaveLength(1);
      expect(holdings[0].name).toBe("Mobil Sedan Facelift");
      expect(holdings[0].current_price).toBe(260_000_000);
    });

    it("matches non-fixed asset by symbol when updating", () => {
      const stock1: InvestmentHolding = {
        id: "stock-uuid-1",
        user_id: userId,
        symbol: "BBCA.JK",
        name: "Bank Central Asia",
        asset_type: "stock",
        units: 1000,
        avg_buy_price: 9800,
        current_price: 10200,
        currency: "IDR",
      };
      upsertHolding(stock1, userId);

      // Upsert with new units but same symbol
      const stock1Updated: InvestmentHolding = {
        ...stock1,
        id: "stock-uuid-diff",
        units: 1500,
      };
      upsertHolding(stock1Updated, userId);

      const holdings = getSavedHoldings(userId);
      expect(holdings).toHaveLength(1);
      expect(holdings[0].symbol).toBe("BBCA.JK");
      expect(holdings[0].units).toBe(1500);
    });
  });

  describe("Portfolio Valuation & PnL Integrity", () => {
    it("calculates accurate valuation and PnL for normalized holdings", () => {
      const stock: InvestmentHolding = {
        id: "stock-1",
        symbol: "TLKM.JK",
        name: "Telkom Indonesia",
        asset_type: "stock",
        units: 500,
        avg_buy_price: 3000,
        current_price: 3300,
        currency: "IDR",
      };

      const val = calculateHoldingValuation(stock);
      expect(val.costBasis).toBe(1_500_000);
      expect(val.marketValue).toBe(1_650_000);
      expect(val.floatingPnL).toBe(150_000);
      expect(val.floatingPnLPct).toBeCloseTo(10, 1);
    });

    it("self-heals legacy distorted USD holdings where buyPrice was stored in USD and currentPrice in IDR", () => {
      // Legacy bug case: avg_buy_price = 200 (USD), current_price = 3,500,000 (IDR)
      const legacyUsdHolding: InvestmentHolding = {
        id: "aapl-legacy",
        symbol: "AAPL",
        name: "Apple Inc.",
        asset_type: "stock",
        units: 10,
        avg_buy_price: 200,
        current_price: 3_500_000,
        currency: "USD",
        native_price: 200,
        native_currency: "USD",
      };

      const val = calculateHoldingValuation(legacyUsdHolding);

      // Instead of fake 1,749,900% ROI, costBasis is healed to IDR
      const expectedHealedBuyPrice = 200 * USD_IDR_ESTIMATE; // 3,260,000
      expect(val.costBasis).toBe(10 * expectedHealedBuyPrice);
      expect(val.marketValue).toBe(10 * 3_500_000);
      expect(val.floatingPnLPct).toBeLessThan(50); // Realistic ~7.36% ROI
    });

    it("aggregates portfolio summary across diverse asset pillars accurately", () => {
      const holdings: InvestmentHolding[] = [
        {
          id: "s1",
          symbol: "BBRI.JK",
          name: "Bank BRI",
          asset_type: "stock",
          units: 100,
          avg_buy_price: 5000,
          current_price: 5500,
          currency: "IDR",
        },
        {
          id: "g1",
          symbol: "ANTAM",
          name: "Emas Batangan Antam",
          asset_type: "gold",
          units: 10,
          avg_buy_price: 1_300_000,
          current_price: 1_400_000,
          currency: "IDR",
        },
        {
          id: "f1",
          symbol: "PROPERTY",
          name: "Tanah Kavling",
          asset_type: "fixed_asset",
          units: 1,
          avg_buy_price: 200_000_000,
          current_price: 220_000_000,
          currency: "IDR",
        },
      ];

      const summary = calculatePortfolioSummary(holdings);

      expect(summary.totalCostBasis).toBe(
        100 * 5000 + 10 * 1_300_000 + 200_000_000,
      );
      expect(summary.totalMarketValue).toBe(
        100 * 5500 + 10 * 1_400_000 + 220_000_000,
      );
      expect(summary.totalFloatingPnL).toBe(
        summary.totalMarketValue - summary.totalCostBasis,
      );
      expect(summary.byAssetType.stock.marketValue).toBe(550_000);
      expect(summary.byAssetType.gold.marketValue).toBe(14_000_000);
      expect(summary.byAssetType.fixed_asset.marketValue).toBe(220_000_000);
    });
  });

  describe("Multi-Currency Display & Compact Formatter", () => {
    it("formats compact currencies dynamically according to preferred currency", () => {
      // IDR Formatting
      expect(formatCompactCurrency(1_500_000_000, "IDR")).toBe("Rp 1.5B");
      expect(formatCompactCurrency(25_000_000, "IDR")).toBe("Rp 25M");
      expect(formatCompactCurrency(500_000, "IDR")).toBe("Rp 500k");

      // USD Formatting (converts from IDR using exchange rates)
      // 16,300,000 IDR ~ 1,000 USD
      const usdFormatted = formatCompactCurrency(16_300_000, "USD");
      expect(usdFormatted).toContain("$");
      expect(usdFormatted).toContain("1k");

      // EUR Formatting
      const eurFormatted = formatCompactCurrency(17_500_000, "EUR");
      expect(eurFormatted).toContain("€");
    });
  });
});
