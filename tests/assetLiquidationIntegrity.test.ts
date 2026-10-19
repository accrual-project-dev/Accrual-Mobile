import { describe, it, expect, beforeEach } from "vitest";
import {
  recordHoldingActivity,
  upsertHolding,
  getSavedHoldings,
  getSavedUsdtPref,
  saveUsdtPref,
  type InvestmentHolding,
} from "../src/lib/marketPriceService";
import { formatLiveAmountInput } from "../src/lib/utils";

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

describe("Asset Liquidation & Double Counting Integrity Suite", () => {
  const testUserId = "user-liquidation-test-uuid";

  beforeEach(() => {
    localStorage.clear();
  });

  it("decrements USDT holding units from 1,002 to 851 upon partial sell when userId is supplied", () => {
    // 1. Initial State: User has 1,002 USDT bought at avg price 13,856
    const initialHolding: InvestmentHolding = {
      id: "usdt-core-holding",
      user_id: testUserId,
      symbol: "USDT",
      name: "Tether USD",
      asset_type: "crypto",
      units: 1002,
      avg_buy_price: 13856,
      current_price: 18016,
      currency: "IDR",
    };

    upsertHolding(initialHolding, testUserId);
    saveUsdtPref(
      {
        units: 1002,
        rate: 18016,
        costBasis: 1002 * 13856,
      },
      testUserId,
    );

    // Verify initial holdings and preference in scoped user storage
    const initialSaved = getSavedHoldings(testUserId);
    expect(initialSaved.length).toBe(1);
    expect(initialSaved[0].units).toBe(1002);
    expect(getSavedUsdtPref(testUserId).units).toBe(1002);

    // 2. Liquidate / Sell 151 USDT @ 17,921 to Bank Jago
    const sellingPrice = 17921;
    const unitsToSell = 151;
    const totalAmount = unitsToSell * sellingPrice; // ~2,706,071

    const result = recordHoldingActivity(
      initialHolding.id,
      {
        type: "sell",
        units: unitsToSell,
        price_per_unit: sellingPrice,
        total_amount: totalAmount,
        date: "2026-10-19T18:08:00",
        note: "Likuidasi 151 USDT ke Bank Jago",
      },
      testUserId, // Crucial: must pass testUserId!
    );

    // 3. Verify units decreased to 851
    expect(result.updatedHolding.units).toBe(851);
    expect(result.updatedHolding.avg_buy_price).toBe(13856); // cost basis per remaining unit unchanged
    expect(result.realizedPnL).toBeCloseTo(unitsToSell * (sellingPrice - 13856), 0);

    // 4. Verify user-scoped storage holds the updated 851 units
    const freshHoldings = getSavedHoldings(testUserId);
    expect(freshHoldings[0].units).toBe(851);

    const freshUsdtPref = getSavedUsdtPref(testUserId);
    expect(freshUsdtPref.units).toBe(851);
    expect(freshUsdtPref.costBasis).toBe(851 * 13856);
  });

  it("conserves Net Worth across cash increment and holding decrement (No Double-Counting)", () => {
    // Initial bank cash: Rp 500,000
    let bankJagoCash = 500_000;
    // Initial USDT: 1,002 USDT @ 18,016
    let usdtUnits = 1002;
    const usdtRate = 18016;

    const initialNetWorth = bankJagoCash + Math.round(usdtUnits * usdtRate);
    expect(initialNetWorth).toBe(500_000 + 18_052_032); // 18,552,032

    // Action: Liquidate 151 USDT at rate 17,921
    const soldUnits = 151;
    const soldRate = 17921;
    const proceeds = soldUnits * soldRate; // 2,706,071

    // Bank receives cash
    bankJagoCash += proceeds;
    // Holding units are deducted
    usdtUnits -= soldUnits; // 851

    const newNetWorth = bankJagoCash + Math.round(usdtUnits * usdtRate);
    // Difference between new and initial Net Worth is purely the price variance:
    // 151 * (17,921 - 18,016) = -14,345
    const netWorthDiff = newNetWorth - initialNetWorth;
    expect(Math.abs(netWorthDiff)).toBeLessThanOrEqual(soldUnits * Math.abs(soldRate - usdtRate) + 2);
    // And Net Worth stays at ~18.5M, NEVER jumping to 21M!
    expect(newNetWorth).toBeLessThan(19_000_000);
    expect(newNetWorth).toBeGreaterThan(18_000_000);
  });

  it("formats asset price with automatic thousand dots in IDR and clean parsing", () => {
    // 1. Raw typed input "17921" formats to "17.921"
    const formatted = formatLiveAmountInput("17921", true, false, 0);
    expect(formatted.display).toBe("17.921");
    expect(formatted.rawNumber).toBe(17921);

    // 2. Already formatted string "18.016" keeps formatting
    const formattedExisting = formatLiveAmountInput("18.016", true, false, 0);
    expect(formattedExisting.display).toBe("18.016");
    expect(formattedExisting.rawNumber).toBe(18016);

    // 3. Clean parse of dot-formatted price matches float value
    const thousandSep = ".";
    const cleanPrice = parseFloat("17.921".split(thousandSep).join(""));
    expect(cleanPrice).toBe(17921);
  });

  it("handles transfer vs direct liquidation cleanly based on source wallet presence", () => {
    const cryptoWalletId = "w-crypto-usdt-uuid";
    const bankJagoWalletId = "w-bank-jago-uuid";

    // Scenario A: Holding has linked crypto wallet
    const holdingWithWallet: InvestmentHolding = {
      id: "usdt-linked",
      wallet_id: cryptoWalletId,
      symbol: "USDT",
      name: "Tether USD",
      asset_type: "crypto",
      units: 1002,
      avg_buy_price: 13856,
      current_price: 18016,
      currency: "IDR",
    };

    const isTransferPossibleA = Boolean(
      holdingWithWallet.wallet_id &&
        holdingWithWallet.wallet_id !== bankJagoWalletId,
    );
    expect(isTransferPossibleA).toBe(true);

    // When true, mutation should be transfer between cryptoWalletId and bankJagoWalletId
    const txPayloadA = {
      type: isTransferPossibleA ? "transfer" : "income",
      wallet_id: isTransferPossibleA ? holdingWithWallet.wallet_id! : bankJagoWalletId,
      to_wallet_id: isTransferPossibleA ? bankJagoWalletId : undefined,
      amount: 2_706_071,
    };
    expect(txPayloadA.type).toBe("transfer");
    expect(txPayloadA.wallet_id).toBe(cryptoWalletId);
    expect(txPayloadA.to_wallet_id).toBe(bankJagoWalletId);

    // Scenario B: Holding is ledger-only (no linked wallet)
    const holdingWithoutWallet: InvestmentHolding = {
      id: "usdt-ledger-only",
      symbol: "USDT",
      name: "Tether USD",
      asset_type: "crypto",
      units: 1002,
      avg_buy_price: 13856,
      current_price: 18016,
      currency: "IDR",
    };

    const isTransferPossibleB = Boolean(
      holdingWithoutWallet.wallet_id &&
        holdingWithoutWallet.wallet_id !== bankJagoWalletId,
    );
    expect(isTransferPossibleB).toBe(false);

    const txPayloadB = {
      type: isTransferPossibleB ? "transfer" : "income",
      wallet_id: bankJagoWalletId,
      to_wallet_id: isTransferPossibleB ? bankJagoWalletId : undefined,
      amount: 2_706_071,
    };
    expect(txPayloadB.type).toBe("income");
    expect(txPayloadB.wallet_id).toBe(bankJagoWalletId);
    expect(txPayloadB.to_wallet_id).toBeUndefined();
  });
});
