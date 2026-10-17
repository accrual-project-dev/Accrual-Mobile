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
  calculateHoldingValuation,
  calculatePortfolioSummary,
  calculateTotalRealizedPnL,
  recordHoldingActivity,
  upsertHolding,
} from "../src/lib/marketPriceService";
import { calculateRealizedGains } from "../src/lib/portfolioAnalytics";
import type { InvestmentHolding } from "../src/types";

describe("Portfolio Multi-Currency Valuation & Realized P&L Suite", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("Valuation with Custom Broker Price Overrides", () => {
    it("uses current_price for valuation when is_custom_price is false", () => {
      const holding: InvestmentHolding = {
        id: "holding-bbca",
        symbol: "BBCA",
        name: "Bank Central Asia",
        asset_type: "stock",
        units: 100,
        avg_buy_price: 9000,
        current_price: 10000,
        currency: "IDR",
      };

      const val = calculateHoldingValuation(holding);
      expect(val.effectivePrice).toBe(10000);
      expect(val.marketValue).toBe(1000000);
      expect(val.costBasis).toBe(900000);
      expect(val.floatingPnL).toBe(100000);
      expect(val.floatingPnLPct).toBeCloseTo(11.11, 1);
    });

    it("respects custom broker price override when is_custom_price is true", () => {
      const holding: InvestmentHolding = {
        id: "holding-bbca-custom",
        symbol: "BBCA",
        name: "Bank Central Asia",
        asset_type: "stock",
        units: 100,
        avg_buy_price: 9000,
        current_price: 10000, // live feed
        is_custom_price: true,
        custom_price: 10500, // manual broker quote
        currency: "IDR",
      };

      const val = calculateHoldingValuation(holding);
      expect(val.effectivePrice).toBe(10500);
      expect(val.marketValue).toBe(1050000);
      expect(val.costBasis).toBe(900000);
      expect(val.floatingPnL).toBe(150000);
    });
  });

  describe("Realized P&L Recording & Liquidation Accounting", () => {
    it("computes and persists realized P&L when selling asset units", () => {
      const userId = "test-user-pnl";
      const holding: InvestmentHolding = {
        id: "holding-btc",
        user_id: userId,
        symbol: "BTC",
        name: "Bitcoin",
        asset_type: "crypto",
        units: 2,
        avg_buy_price: 500000000, // DCA: 500M IDR
        current_price: 800000000, // Current: 800M IDR
        currency: "IDR",
      };

      upsertHolding(holding, userId);

      // Sell 1 BTC at 900M IDR
      // Cost basis of 1 BTC = 500M IDR. Realized gain = 900M - 500M = 400M IDR.
      const result = recordHoldingActivity(
        holding.id,
        {
          type: "sell",
          units: 1,
          price_per_unit: 900000000,
          total_amount: 900000000,
          date: "2026-10-17T10:00:00",
          realized_pnl: 400000000,
          note: "Partial exit at profit",
        },
        userId,
      );

      expect(result.realizedPnL).toBe(400000000);
      expect(result.updatedHolding.units).toBe(1);
      expect(result.updatedHolding.avg_buy_price).toBe(500000000);

      const activities = result.updatedHolding.activities || [];
      expect(activities.length).toBe(1);
      expect(activities[0].type).toBe("sell");
      expect(activities[0].realized_pnl).toBe(400000000);
    });

    it("aggregates total realized P&L across portfolio holdings", () => {
      const holdings: InvestmentHolding[] = [
        {
          id: "h1",
          symbol: "AAPL",
          name: "Apple Inc.",
          asset_type: "stock",
          units: 10,
          avg_buy_price: 2500000,
          current_price: 3000000,
          currency: "IDR",
          activities: [
            {
              id: "act-1",
              holding_id: "h1",
              type: "sell",
              units: 5,
              price_per_unit: 3000000,
              total_amount: 15000000,
              date: "2026-10-15T09:00:00",
              realized_pnl: 2500000, // +2.5M
            },
          ],
        },
        {
          id: "h2",
          symbol: "ETH",
          name: "Ethereum",
          asset_type: "crypto",
          units: 2,
          avg_buy_price: 45000000,
          current_price: 40000000,
          currency: "IDR",
          activities: [
            {
              id: "act-2",
              holding_id: "h2",
              type: "sell",
              units: 1,
              price_per_unit: 40000000,
              total_amount: 40000000,
              date: "2026-10-16T14:30:00",
              realized_pnl: -5000000, // -5.0M loss
            },
          ],
        },
      ];

      const totalPnLResult = calculateTotalRealizedPnL(holdings);
      expect(totalPnLResult.totalRealizedPnL).toBe(-2500000);
      expect(totalPnLResult.realizedSalesCount).toBe(2);

      const summary = calculatePortfolioSummary(holdings);
      expect(summary.totalRealizedPnL).toBe(-2500000);
    });

    it("extracts realized gains breakdown for portfolio analytics", () => {
      const holdings: InvestmentHolding[] = [
        {
          id: "h-asii",
          symbol: "ASII",
          name: "Astra International",
          asset_type: "stock",
          units: 50,
          avg_buy_price: 5000,
          current_price: 6000,
          currency: "IDR",
          activities: [
            {
              id: "act-asii-sell",
              holding_id: "h-asii",
              type: "sell",
              units: 20,
              price_per_unit: 6200,
              total_amount: 124000,
              date: "2026-10-14T11:00:00",
              realized_pnl: 24000,
              note: "Profit taking",
            },
          ],
        },
      ];

      const gains = calculateRealizedGains(holdings);
      expect(gains.items.length).toBe(1);
      expect(gains.items[0].symbol).toBe("ASII");
      expect(gains.items[0].realizedPnL).toBe(24000);
      expect(gains.items[0].date).toBe("2026-10-14T11:00:00");
      expect(gains.totalRealizedPnL).toBe(24000);
    });
  });
});
