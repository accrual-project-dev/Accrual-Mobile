import { describe, it, expect, beforeEach } from "vitest";
import {
  syncTransactionWithHolding,
  reverseTransactionWithHolding,
} from "../src/lib/holdingSyncEngine";
import {
  getSavedUsdtPref,
  saveUsdtPref,
  getSavedHoldings,
  saveHoldings,
  getHoldingActivities,
  sanitizeHoldingActivities,
  getStandardUsdtHoldingId,
  USD_IDR_ESTIMATE,
} from "../src/lib/marketPriceService";
import type { Wallet, InvestmentHolding } from "../src/lib/types";

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

describe("Transaction Update & Asset Integrity Suite", () => {
  const userId = "test-user-asset-integrity";

  const wallets: Wallet[] = [
    {
      id: "w-seabank",
      name: "SeaBank",
      classification: "bank",
      currency: "IDR",
      balance: 10000000,
    },
    {
      id: "w-usdt",
      name: "USDT",
      classification: "crypto",
      currency: "IDR",
      balance: 0,
    },
    {
      id: "w-cash",
      name: "Cash",
      classification: "cash",
      currency: "IDR",
      balance: 5000000,
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    saveUsdtPref(
      {
        units: 0,
        rate: 16000,
        costBasis: 0,
      },
      userId,
    );
    saveHoldings([], userId, false);
  });

  it("Scenario 1: Updates asset addition cleanly without double-recording or duplicating units", () => {
    const txId = "tx-add-001";
    // 1. Initial transaction: Deposit 1,600,000 IDR (100 USDT @ 16,000)
    const initialSync = syncTransactionWithHolding(
      {
        type: "transfer",
        amount: 1600000,
        wallet_id: "w-seabank",
        to_wallet_id: "w-usdt",
        occurred_on: "2026-10-21T10:00:00",
        note: "Buy USDT",
        customUnits: 100,
        customPrice: 16000,
        tx_id: txId,
      },
      wallets,
      userId,
    );

    expect(initialSync.synced).toBe(true);
    expect(initialSync.newUnits).toBe(100);

    let pref = getSavedUsdtPref(userId);
    expect(pref.units).toBe(100);

    let holdings = getSavedHoldings(userId);
    let usdtHolding = holdings.find((h) => h.symbol === "USDT");
    expect(usdtHolding).toBeDefined();
    let activities = getHoldingActivities(usdtHolding!);
    expect(activities.length).toBe(1);
    expect(activities[0].units).toBe(100);
    expect(activities[0].total_amount).toBe(1600000);

    // 2. User edits transaction: changes amount to 2,400,000 IDR (150 USDT @ 16,000)
    // First, reverse old transaction state
    const revResult = reverseTransactionWithHolding(
      {
        type: "transfer",
        amount: 1600000,
        wallet_id: "w-seabank",
        to_wallet_id: "w-usdt",
        occurred_on: "2026-10-21T10:00:00",
        note: "Buy USDT",
        customUnits: 100,
        customPrice: 16000,
        tx_id: txId,
      },
      wallets,
      userId,
    );

    expect(revResult.synced).toBe(true);
    pref = getSavedUsdtPref(userId);
    expect(pref.units).toBe(0); // Cleanly restored back to 0!

    // Next, sync new transaction state
    const updateSync = syncTransactionWithHolding(
      {
        type: "transfer",
        amount: 2400000,
        wallet_id: "w-seabank",
        to_wallet_id: "w-usdt",
        occurred_on: "2026-10-21T10:00:00",
        note: "Buy USDT Edited",
        customUnits: 150,
        customPrice: 16000,
        tx_id: txId,
      },
      wallets,
      userId,
    );

    expect(updateSync.synced).toBe(true);
    expect(updateSync.newUnits).toBe(150);

    pref = getSavedUsdtPref(userId);
    // Crucial check: Must be 150, NOT 250 (which happened previously due to duplication)!
    expect(pref.units).toBe(150);

    holdings = getSavedHoldings(userId);
    usdtHolding = holdings.find((h) => h.symbol === "USDT");
    activities = getHoldingActivities(usdtHolding!);
    // Crucial check: Exactly 1 activity row, NOT 2!
    expect(activities.length).toBe(1);
    expect(activities[0].units).toBe(150);
    expect(activities[0].total_amount).toBe(2400000);
    expect(activities[0].transaction_id).toBe(txId);
  });

  it("Scenario 2: Updates asset reduction cleanly without double-deduction or duplicating rows", () => {
    const txId = "tx-sub-001";
    // Baseline: User starts with 200 USDT
    saveUsdtPref(
      {
        units: 200,
        rate: 16000,
        costBasis: 3200000,
      },
      userId,
    );

    // 1. Initial transaction: Transfer out / liquidate 800,000 IDR (50 USDT @ 16,000)
    const initialSync = syncTransactionWithHolding(
      {
        type: "transfer",
        amount: 800000,
        wallet_id: "w-usdt",
        to_wallet_id: "w-seabank",
        occurred_on: "2026-10-21T11:00:00",
        note: "Liquidate USDT",
        customUnits: 50,
        customPrice: 16000,
        tx_id: txId,
      },
      wallets,
      userId,
    );

    expect(initialSync.synced).toBe(true);
    expect(initialSync.newUnits).toBe(150);

    let pref = getSavedUsdtPref(userId);
    expect(pref.units).toBe(150);

    // 2. User edits reduction: changes to 960,000 IDR (60 USDT @ 16,000)
    // Reversal of previous reduction:
    const revResult = reverseTransactionWithHolding(
      {
        type: "transfer",
        amount: 800000,
        wallet_id: "w-usdt",
        to_wallet_id: "w-seabank",
        occurred_on: "2026-10-21T11:00:00",
        note: "Liquidate USDT",
        customUnits: 50,
        customPrice: 16000,
        tx_id: txId,
      },
      wallets,
      userId,
    );

    expect(revResult.synced).toBe(true);
    pref = getSavedUsdtPref(userId);
    expect(pref.units).toBe(200); // 50 USDT restored back to 200!

    // Sync updated reduction:
    const updateSync = syncTransactionWithHolding(
      {
        type: "transfer",
        amount: 960000,
        wallet_id: "w-usdt",
        to_wallet_id: "w-seabank",
        occurred_on: "2026-10-21T11:00:00",
        note: "Liquidate USDT Edited",
        customUnits: 60,
        customPrice: 16000,
        tx_id: txId,
      },
      wallets,
      userId,
    );

    expect(updateSync.synced).toBe(true);
    expect(updateSync.newUnits).toBe(140);

    pref = getSavedUsdtPref(userId);
    // Crucial check: Must be 140, NOT 90 (which happened previously when 50 + 60 were both deducted)!
    expect(pref.units).toBe(140);

    const holdings = getSavedHoldings(userId);
    const usdtHolding = holdings.find((h) => h.symbol === "USDT");
    const activities = getHoldingActivities(usdtHolding!);
    // Crucial check: Exactly 1 sell activity, NOT 2!
    expect(activities.length).toBe(1);
    expect(activities[0].type).toBe("sell");
    expect(activities[0].units).toBe(60);
    expect(activities[0].total_amount).toBe(960000);
    expect(activities[0].transaction_id).toBe(txId);
  });

  it("Scenario 3: Changing destination from crypto to non-crypto restores asset balance and removes activity", () => {
    const txId = "tx-change-dest-001";
    // 1. Initial: SeaBank -> USDT (adds 100 USDT)
    syncTransactionWithHolding(
      {
        type: "transfer",
        amount: 1600000,
        wallet_id: "w-seabank",
        to_wallet_id: "w-usdt",
        occurred_on: "2026-10-21T12:00:00",
        note: "Deposit USDT",
        customUnits: 100,
        customPrice: 16000,
        tx_id: txId,
      },
      wallets,
      userId,
    );

    let pref = getSavedUsdtPref(userId);
    expect(pref.units).toBe(100);

    // 2. User edits transaction: Changes to SeaBank -> Cash (non-crypto)
    // wasCryptoInvolved is true, so reverse runs:
    const revResult = reverseTransactionWithHolding(
      {
        type: "transfer",
        amount: 1600000,
        wallet_id: "w-seabank",
        to_wallet_id: "w-usdt",
        occurred_on: "2026-10-21T12:00:00",
        note: "Deposit USDT",
        customUnits: 100,
        customPrice: 16000,
        tx_id: txId,
      },
      wallets,
      userId,
    );

    expect(revResult.synced).toBe(true);

    // isCryptoInvolved for SeaBank -> Cash is false, so syncTransactionWithHolding is NOT called.
    pref = getSavedUsdtPref(userId);
    expect(pref.units).toBe(0);

    const holdings = getSavedHoldings(userId);
    const usdtHolding = holdings.find((h) => h.symbol === "USDT");
    const activities = getHoldingActivities(usdtHolding!);
    // The activity was completely removed; only fallback initial or empty remains
    expect(activities.some((a) => a.transaction_id === txId)).toBe(false);
  });

  it("Scenario 4: Deleting an asset transaction cleanly restores units without generating ghost 'Rollback' logs", () => {
    const txId = "tx-delete-001";
    saveUsdtPref(
      {
        units: 100,
        rate: 16000,
        costBasis: 1600000,
      },
      userId,
    );

    // Liquidate 40 USDT
    syncTransactionWithHolding(
      {
        type: "transfer",
        amount: 640000,
        wallet_id: "w-usdt",
        to_wallet_id: "w-seabank",
        occurred_on: "2026-10-21T13:00:00",
        note: "Sell 40 USDT",
        customUnits: 40,
        customPrice: 16000,
        tx_id: txId,
      },
      wallets,
      userId,
    );

    let pref = getSavedUsdtPref(userId);
    expect(pref.units).toBe(60);

    // Now delete transaction
    const revResult = reverseTransactionWithHolding(
      {
        type: "transfer",
        amount: 640000,
        wallet_id: "w-usdt",
        to_wallet_id: "w-seabank",
        occurred_on: "2026-10-21T13:00:00",
        note: "Sell 40 USDT",
        customUnits: 40,
        customPrice: 16000,
        tx_id: txId,
      },
      wallets,
      userId,
    );

    expect(revResult.synced).toBe(true);

    pref = getSavedUsdtPref(userId);
    expect(pref.units).toBe(100); // Restored to 100!

    const holdings = getSavedHoldings(userId);
    const usdtHolding = holdings.find((h) => h.symbol === "USDT");
    const activities = getHoldingActivities(usdtHolding!);

    // Crucial: ZERO ghost "Rollback: Deleted..." activities in the log!
    expect(activities.some((a) => (a.note || "").includes("Rollback"))).toBe(false);
    expect(activities.some((a) => a.transaction_id === txId)).toBe(false);
  });

  it("Scenario 5: sanitizeHoldingActivities automatically collapses historical duplicates", () => {
    const duplicateActivities = [
      {
        id: "act-tx-tx-999",
        holding_id: "usdt-1",
        type: "buy" as const,
        date: "2026-10-21T10:00:00",
        units: 150,
        price_per_unit: 16000,
        total_amount: 2400000,
        transaction_id: "tx-999",
      },
      {
        id: "act-old-duplicate",
        holding_id: "usdt-1",
        type: "buy" as const,
        date: "2026-10-21T10:00:00",
        units: 100,
        price_per_unit: 16000,
        total_amount: 1600000,
        transaction_id: "tx-999", // Same tx_id from old bug!
      },
      {
        id: "act-legacy-1",
        holding_id: "usdt-1",
        type: "sell" as const,
        date: "2026-10-20",
        units: 50,
        price_per_unit: 16000,
        total_amount: 800000,
      },
      {
        id: "act-legacy-duplicate",
        holding_id: "usdt-1",
        type: "sell" as const,
        date: "2026-10-20",
        units: 50,
        price_per_unit: 16000,
        total_amount: 800000, // Exact duplicate legacy signature!
      },
    ];

    const sanitized = sanitizeHoldingActivities(duplicateActivities);
    expect(sanitized.length).toBe(2);
    expect(sanitized[0].transaction_id).toBe("tx-999");
    expect(sanitized[0].units).toBe(150); // Kept the latest one!
    expect(sanitized[1].type).toBe("sell");
  });
});
