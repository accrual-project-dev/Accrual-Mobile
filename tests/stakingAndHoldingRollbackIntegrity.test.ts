import { describe, it, expect, beforeEach } from "vitest";
import {
  upsertHolding,
  deleteHolding,
  getSavedHoldings,
  saveUsdtPref,
  getSavedUsdtPref,
  type InvestmentHolding,
  type UsdtValuationPref,
} from "../src/lib/marketPriceService";
import {
  reverseTransactionWithHolding,
  syncTransactionWithHolding,
} from "../src/lib/holdingSyncEngine";
import type { Wallet } from "../src/lib/types";

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
    for (const k in store) {
      delete store[k];
    }
  },
  key: (i: number) => Object.keys(store)[i] ?? null,
  get length() {
    return Object.keys(store).length;
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

describe("Staking, Asset Deletion Restoration & Transaction Rollback Suite", () => {
  const testUserId = "user-audit-pilar1-uuid";

  const usdtWallet: Wallet = {
    id: "w-usdt",
    user_id: testUserId,
    name: "Tether USDT",
    icon: "/icons/Budgets/USDT.png",
    classification: "investment",
    created_at: "2026-01-01T00:00:00Z",
  };

  const bankJagoWallet: Wallet = {
    id: "w-jago",
    user_id: testUserId,
    name: "Bank Jago",
    icon: "/icons/bank.png",
    classification: "bank",
    created_at: "2026-01-01T00:00:00Z",
  };

  const wallets: Wallet[] = [usdtWallet, bankJagoWallet];

  beforeEach(() => {
    localStorage.clear();
  });

  it("safely restores a deleted holding with its exact units, valuation, and cost basis upon Undo", () => {
    const originalHolding: InvestmentHolding = {
      id: "holding-bbca-1",
      user_id: testUserId,
      symbol: "BBCA",
      name: "Bank Central Asia",
      asset_type: "stock",
      units: 1000,
      avg_buy_price: 9500,
      current_price: 10200,
      currency: "IDR",
    };

    upsertHolding(originalHolding, testUserId);
    expect(getSavedHoldings(testUserId).length).toBe(1);

    // Delete holding
    deleteHolding(originalHolding.id, testUserId);
    expect(getSavedHoldings(testUserId).length).toBe(0);

    // Undo / Restore
    upsertHolding(originalHolding, testUserId);
    const restored = getSavedHoldings(testUserId);
    expect(restored.length).toBe(1);
    expect(restored[0].symbol).toBe("BBCA");
    expect(restored[0].units).toBe(1000);
    expect(restored[0].avg_buy_price).toBe(9500);
  });

  it("safely restores USDT preferences upon Undo deletion", () => {
    const originalUsdtPref: UsdtValuationPref = {
      units: 1002,
      rate: 18016,
      costBasis: 1002 * 13856,
    };

    saveUsdtPref(originalUsdtPref, testUserId);
    expect(getSavedUsdtPref(testUserId).units).toBe(1002);

    // Delete / Clear USDT pref
    const cleared: UsdtValuationPref = {
      units: 0,
      costBasis: 0,
      rate: 18016,
    };
    saveUsdtPref(cleared, testUserId);
    expect(getSavedUsdtPref(testUserId).units).toBe(0);

    // Restore on Undo
    saveUsdtPref(originalUsdtPref, testUserId);
    const restored = getSavedUsdtPref(testUserId);
    expect(restored.units).toBe(1002);
    expect(restored.costBasis).toBe(1002 * 13856);
  });

  it("rolls back crypto holding units when a withdrawal transfer transaction is deleted from TransactionsPage", () => {
    // 1. Initial State: 1,002 USDT in pref
    saveUsdtPref(
      {
        units: 1002,
        rate: 17921,
        costBasis: 1002 * 14000,
      },
      testUserId,
    );

    // 2. User performs transfer out (liquidation): 151 USDT @ 17,921 to Bank Jago
    const transferTx = {
      type: "transfer",
      amount: 151 * 17921,
      wallet_id: usdtWallet.id,
      to_wallet_id: bankJagoWallet.id,
      occurred_on: "2026-10-19T10:00:00Z",
      note: "P2P Liquidation to Bank Jago",
      customUnits: 151,
      customPrice: 17921,
    };

    const syncRes = syncTransactionWithHolding(transferTx, wallets, testUserId);
    expect(syncRes.synced).toBe(true);
    expect(getSavedUsdtPref(testUserId).units).toBe(851);

    // 3. User deletes the transaction on TransactionsPage -> reverseTransactionWithHolding is triggered
    const reverseRes = reverseTransactionWithHolding(transferTx, wallets, testUserId);
    expect(reverseRes.synced).toBe(true);
    expect(reverseRes.action).toBe("buy"); // Buy back / restore units
    expect(getSavedUsdtPref(testUserId).units).toBe(1002);
  });
});
