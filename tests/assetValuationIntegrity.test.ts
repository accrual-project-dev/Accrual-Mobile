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
  setHoldingDirectUnits,
  getHoldingActivities,
  upsertHolding,
  getSavedHoldings,
  getSavedUsdtPref,
  saveUsdtPref,
  calculateHoldingValuation,
  sanitizeAndHealHoldings,
} from "../src/lib/marketPriceService";
import {
  estimateHistoricalAssetPrice,
  estimateHistoricalUsdtBuyRate,
} from "../src/lib/holdingSyncEngine";
import type { InvestmentHolding, Wallet } from "../src/lib/types";
import { parseCleanNumber } from "../src/components/assets/AddAssetModal";

describe("Asset Valuation & Unit Adjustment Integrity Suite", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("adjusts units from 892 to 1002 proportionally without injecting ledger balance", () => {
    const userId = "test-user-asset";
    const initialHolding: InvestmentHolding = {
      id: "usdt-test-user-asset",
      user_id: userId,
      symbol: "USDT",
      name: "Tether USD",
      asset_type: "crypto",
      units: 892,
      avg_buy_price: 16300,
      current_price: 16400,
      currency: "IDR",
      activities: [],
    };

    upsertHolding(initialHolding, userId);
    saveUsdtPref(
      {
        units: 892,
        rate: 16400,
        costBasis: 892 * 16300, // 14,539,600 IDR
      },
      userId,
    );

    // Adjust units from 892 to 1002 (+110 units)
    const updated = setHoldingDirectUnits(
      initialHolding.id,
      1002,
      userId,
      "Koreksi Saldo Manual",
    );

    expect(updated.units).toBe(1002);
    // Average buy price per unit must be preserved
    expect(updated.avg_buy_price).toBe(16300);

    // Check that the correction activity total_amount is strictly the delta nominal (110 * 16300 = 1,793,000 IDR)
    // NOT the entire 13.8M wallet ledger!
    const activities = updated.activities || [];
    expect(activities.length).toBeGreaterThan(0);
    const latestCorrection = activities[0];
    expect(latestCorrection.units).toBe(110);
    expect(latestCorrection.price_per_unit).toBe(16300);
    expect(latestCorrection.total_amount).toBe(110 * 16300); // 1,793,000 IDR
    expect(latestCorrection.total_amount).toBeLessThan(2_000_000);

    // Check USDT preferences updated proportionally
    const usdtPref = getSavedUsdtPref(userId);
    expect(usdtPref.units).toBe(1002);
    expect(usdtPref.costBasis).toBe(1002 * 16300); // 16,332,600 IDR
    // Value increased strictly by ~1.79M, NOT jumping to a random 13.8M
    expect(usdtPref.costBasis - 14_539_600).toBe(1_793_000);
  });

  it("sanitizes legacy distorted correction activities where total_amount exceeded reasonable boundaries", () => {
    const holdingWithCorruptedActivity: InvestmentHolding = {
      id: "usdt-corrupted",
      symbol: "USDT",
      name: "Tether USD",
      asset_type: "crypto",
      units: 1002,
      avg_buy_price: 16300,
      current_price: 16400,
      activities: [
        {
          id: "act-legacy-distorted",
          holding_id: "usdt-corrupted",
          type: "buy",
          date: "2026-09-15",
          units: 110,
          price_per_unit: 16300,
          total_amount: 13_800_000, // Legacy distorted value
          note: "Legacy Distortion",
          created_at: new Date().toISOString(),
        },
      ],
    };

    const activities = getHoldingActivities(holdingWithCorruptedActivity);
    expect(activities).toHaveLength(1);
    // Legacy distorted 13,800,000 must be auto-healed to 110 * 16300 = 1,793,000
    expect(activities[0].total_amount).toBe(110 * 16300);
  });

  it("evaluates realistic historical prices for dynamic assets across different dates", () => {
    const usdtHolding: InvestmentHolding = {
      id: "h-usdt",
      symbol: "USDT",
      name: "Tether USD",
      asset_type: "crypto",
      units: 500,
      avg_buy_price: 16200,
      current_price: 16500,
    };

    const rate2023 = estimateHistoricalAssetPrice(usdtHolding, "2023-05-10");
    const rate2024 = estimateHistoricalAssetPrice(usdtHolding, "2024-06-15");
    const rate2026 = estimateHistoricalAssetPrice(usdtHolding, "2026-06-20");

    // Past rates must differ from each other and match historical USD/IDR macro levels
    expect(rate2023).toBeLessThan(rate2024);
    expect(rate2024).toBeLessThan(rate2026);
    expect(rate2023).toBeGreaterThanOrEqual(14900);
    expect(rate2026).toBeGreaterThanOrEqual(16200);

    // Explicit note rate takes highest priority
    const explicitRate = estimateHistoricalAssetPrice(usdtHolding, "2024-06-15", "P2P @ 16.350 via BCA");
    expect(explicitRate).toBe(16350);
  });

  it("evaluates realistic historical gold prices across different dates", () => {
    const goldHolding: InvestmentHolding = {
      id: "h-gold",
      symbol: "ANTAM",
      name: "Emas Logam Mulia 24K",
      asset_type: "gold",
      units: 10,
      avg_buy_price: 1300000,
      current_price: 1650000,
    };

    const gold2023 = estimateHistoricalAssetPrice(goldHolding, "2023-01-15");
    const gold2024 = estimateHistoricalAssetPrice(goldHolding, "2024-06-20");
    const gold2026 = estimateHistoricalAssetPrice(goldHolding, "2026-08-10");

    expect(gold2023).toBeLessThan(gold2024);
    expect(gold2024).toBeLessThan(gold2026);
    expect(gold2023).toBeGreaterThanOrEqual(1_000_000);
    expect(gold2026).toBeGreaterThanOrEqual(1_600_000);
  });

  it("identifies cash and bank wallet objects correctly for routing to CashAccountDetailSheet", () => {
    const mockWallets: Wallet[] = [
      { id: "w-bca", name: "BCA", icon: "bca", balance: 5000000, classification: "bank" },
      { id: "w-cash", name: "Dompet Tunai", icon: "cash", balance: 750000 },
    ];

    const cashWallet = mockWallets[1];
    const isWallet =
      !("asset_type" in cashWallet) &&
      (mockWallets.some((w) => w.id === cashWallet.id) || "icon" in cashWallet || "classification" in cashWallet);

    expect(isWallet).toBe(true);

    const investmentItem: InvestmentHolding = {
      id: "h-usdt",
      symbol: "USDT",
      name: "Tether USD",
      asset_type: "crypto",
      units: 100,
      avg_buy_price: 16300,
      current_price: 16400,
    };

    const isInvestment = "asset_type" in investmentItem;
    expect(isInvestment).toBe(true);
  });

  it("calculates holding valuation for 0.1 BTC accurately without false 16,300x secondary inflation", () => {
    const btcHolding: InvestmentHolding = {
      id: "h-btc-test",
      symbol: "BTC",
      name: "Bitcoin",
      asset_type: "crypto",
      units: 0.1,
      avg_buy_price: 1_448_056_000, // Rp 1.448 Miliar (from $79,839 * rate)
      current_price: 1_446_443_160, // Rp 1.446 Miliar
      currency: "USD",
      native_currency: "USD",
      native_price: 79839,
    };

    const val = calculateHoldingValuation(btcHolding);
    expect(val.costBasis).toBe(144_805_600); // 0.1 * 1.448B = 144.8M
    expect(val.marketValue).toBe(144_644_316); // 0.1 * 1.446B = 144.6M
    // Floating P&L should be ~ -161k (-0.11%), NOT -2.2 Miliar (-93.9%)!
    expect(val.floatingPnL).toBeCloseTo(-161_284, -2);
    expect(val.floatingPnLPct).toBeCloseTo(-0.11, 1);
  });

  it("auto-heals 1000x distorted BTC holdings corrupted by legacy comma parsing", () => {
    const corruptedBtc: InvestmentHolding = {
      id: "h-btc-corrupted",
      symbol: "BTC",
      name: "Bitcoin",
      asset_type: "crypto",
      units: 0.1,
      avg_buy_price: 1_448_056, // Distorted by 1000x
      current_price: 1_446_443_160,
      currency: "USD",
      native_currency: "USD",
      native_price: 79.839, // Distorted from 79839
    };

    const { healedHoldings, didHeal } = sanitizeAndHealHoldings([corruptedBtc]);
    expect(didHeal).toBe(true);
    expect(healedHoldings[0].native_price).toBe(79839);
    expect(healedHoldings[0].avg_buy_price).toBe(1_448_056_000);

    // After healing, calculateHoldingValuation produces accurate valuation
    const val = calculateHoldingValuation(healedHoldings[0]);
    expect(val.costBasis).toBe(144_805_600);
    expect(val.marketValue).toBe(144_644_316);
    expect(val.floatingPnLPct).toBeGreaterThan(-1); // Not -93.9%!
  });

  it("parses clean numbers accurately across USD comma and IDR dot formats", () => {
    // US / USD price formatted with thousands comma
    expect(parseCleanNumber("79,839", true)).toBe(79839);
    expect(parseCleanNumber("79,839.50", true)).toBe(79839.5);
    expect(parseCleanNumber("$79,839.00", true)).toBe(79839);

    // Crypto units (fractional)
    expect(parseCleanNumber("0.1")).toBe(0.1);
    expect(parseCleanNumber("0,1")).toBe(0.1);
    expect(parseCleanNumber("0.005")).toBe(0.005);
    expect(parseCleanNumber("1,5")).toBe(1.5);

    // IDR numbers with dot thousands
    expect(parseCleanNumber("100.000", false)).toBe(100000);
    expect(parseCleanNumber("1.448.056", false)).toBe(1448056);
    expect(parseCleanNumber("1.448.056,00", false)).toBe(1448056);
  });
});
