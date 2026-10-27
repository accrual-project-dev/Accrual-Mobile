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

import { hasGuestData, discardGuestData } from "../src/lib/guestMigration";
import { WALLETS_BACKUP_STORAGE_KEY } from "../src/hooks/useWallets";
import { parseCleanNumber } from "../src/components/assets/AddAssetModal";
import {
  setSecurityPin,
  verifySecurityPin,
  getSecuritySettings,
  getPinLockoutState,
  clearSecurityPin,
} from "../src/lib/biometricAuth";
import { calculateBalanceSheet } from "../src/lib/financialAccounting";
import { calculateReportSummary } from "../src/lib/reportExportService";
import { calculateMonthCalendarRunway } from "../src/lib/calendarForecasting";
import type { Transaction, Wallet, InvestmentHolding } from "../src/lib/types";

describe("End-to-End Pre-Launch Audit Remediation Suite", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("1. preserves guest data detection when transitioning to LoginPage via pending migration flag", () => {
    localStorage.setItem(
      WALLETS_BACKUP_STORAGE_KEY,
      JSON.stringify([{ id: "w-1", name: "Cash", balance: 50000 }]),
    );
    localStorage.setItem("trouvaille_pending_guest_migration", "true");
    // Even after guest_mode is cleared on exitGuestMode(), hasGuestData() remains true
    expect(hasGuestData()).toBe(true);

    discardGuestData();
    expect(localStorage.getItem("trouvaille_pending_guest_migration")).toBeNull();
    expect(hasGuestData()).toBe(false);
  });

  it("2. parses Indonesian dot thousand separators and USD decimals accurately via parseCleanNumber", () => {
    expect(parseCleanNumber("1.448.056.000", false)).toBe(1448056000);
    expect(parseCleanNumber("100.000", false)).toBe(100000);
    expect(parseCleanNumber("79,839", true)).toBe(79839);
    expect(parseCleanNumber("0,1", false)).toBe(0.1);
    expect(parseCleanNumber("0.1", false)).toBe(0.1);
  });

  it("3. stores pinLength and does not penalize partial 4th/5th digits on a 6-digit Security PIN", async () => {
    clearSecurityPin();
    await setSecurityPin("123456");

    const settings = getSecuritySettings();
    expect(settings.hasPin).toBe(true);
    expect(settings.pinLength).toBe(6);

    // Partial 4-digit and 5-digit checks must return false without recording failed lockout attempts
    const ok4 = await verifySecurityPin("1234");
    const ok5 = await verifySecurityPin("12345");
    expect(ok4).toBe(false);
    expect(ok5).toBe(false);
    expect(getPinLockoutState().attempts).toBe(0);

    // Full 6-digit PIN succeeds
    const ok6 = await verifySecurityPin("123456");
    expect(ok6).toBe(true);
  });

  it("4. includes fixed_asset wallets and active InvestmentHoldings in Neraca (calculateBalanceSheet)", () => {
    const wallets: Wallet[] = [
      { id: "w-cash", name: "BCA", balance: 0, classification: "liquid" } as Wallet,
      { id: "w-prop", name: "Apartemen", balance: 0, classification: "fixed_asset" } as Wallet,
    ];
    const txs: Transaction[] = [
      {
        id: "t-1",
        wallet_id: "w-cash",
        amount: 10000000,
        type: "income",
        occurred_on: "2026-10-01T10:00:00",
        note: "Opening Balance (Auto-init)",
      } as Transaction,
      {
        id: "t-2",
        wallet_id: "w-prop",
        amount: 500000000,
        type: "income",
        occurred_on: "2026-10-01T10:00:00",
        note: "Opening Balance (Auto-init)",
      } as Transaction,
    ];
    const holdings: InvestmentHolding[] = [
      {
        id: "h-btc",
        symbol: "BTC",
        name: "Bitcoin",
        asset_type: "crypto",
        units: 0.1,
        avg_buy_price: 1400000000,
        current_price: 1500000000,
        currency: "IDR",
        last_price_updated_at: "2026-10-27T10:00:00Z",
      },
    ];

    const bs = calculateBalanceSheet(wallets, txs, txs, { holdings });
    expect(bs.liquidAssets.total).toBe(10000000);
    // 500M fixed_asset wallet + 150M BTC holding = 650M
    expect(bs.investmentAssets.total).toBe(650000000);
    expect(bs.netWorth).toBe(660000000);
    expect(bs.isBalanced).toBe(true);
  });

  it("5. excludes Opening Balance and Balance Correction transactions from report cashflow summary and calendar runway", () => {
    const txs: Transaction[] = [
      {
        id: "tx-open",
        amount: 50000000,
        type: "income",
        occurred_on: "2026-10-01T08:00:00",
        note: "Opening Balance (Auto-init)",
      } as Transaction,
      {
        id: "tx-corr",
        amount: 2000000,
        type: "expense",
        occurred_on: "2026-10-02T09:00:00",
        note: "[Penyesuaian Saldo] Koreksi",
      } as Transaction,
      {
        id: "tx-real-inc",
        amount: 15000000,
        type: "income",
        occurred_on: "2026-10-05T12:00:00",
        note: "Gaji Bulanan",
      } as Transaction,
      {
        id: "tx-real-exp",
        amount: 500000,
        type: "expense",
        occurred_on: "2026-10-06T13:00:00",
        note: "Makan Siang",
      } as Transaction,
    ];

    const summary = calculateReportSummary(
      txs,
      { dateRange: "all" },
      [],
      true,
    );
    expect(summary.totalIncome).toBe(15000000);
    expect(summary.totalExpense).toBe(500000);
    expect(summary.netCashflow).toBe(14500000);

    const runway = calculateMonthCalendarRunway({
      year: 2026,
      month: 10,
      transactions: txs,
      bills: [],
      currentLiquidAssets: 14500000,
      referenceDate: new Date(2026, 9, 10),
    });
    const oct1Cell = runway.days.find((d) => d.date === "2026-10-01");
    const oct2Cell = runway.days.find((d) => d.date === "2026-10-02");
    expect(oct1Cell?.actualInflow).toBe(0);
    expect(oct2Cell?.actualOutflow).toBe(0);
  });
});
