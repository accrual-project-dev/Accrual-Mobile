import { describe, it, expect, beforeEach, vi } from "vitest";

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

import { formatStoredCurrency } from "../src/lib/currency";
import {
  syncDailyStreakReminder,
  syncBillNotifications,
  checkBudgetThresholdAlerts,
  syncWeeklyDigestNotification,
  DAILY_REMINDER_NOTIFICATION_ID,
  WEEKLY_DIGEST_NOTIFICATION_ID,
  getWeeklyDigestDay,
  getWeeklyDigestTime,
  getMonthEndReviewTime,
} from "../src/lib/notifications";
import {
  generateActionCenterInsight,
  generateMonthlyFinancialReview,
  calculateExpenseVolatility,
} from "../src/lib/financialMath";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { Bill, Category, Transaction } from "../src/lib/types";

// Mock Capacitor LocalNotifications
vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    checkPermissions: vi.fn().mockResolvedValue({ display: "granted" }),
    requestPermissions: vi.fn().mockResolvedValue({ display: "granted" }),
    getPending: vi.fn().mockResolvedValue({ notifications: [] }),
    cancel: vi.fn().mockResolvedValue(undefined),
    schedule: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("Audit #23: Financial Intelligence, Notifications & Dynamic Scheduling Suite", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("1. Stored Currency Formatter (formatStoredCurrency)", () => {
    it("formats IDR accurately as default when no preferred currency is set", () => {
      const formatted = formatStoredCurrency(150000);
      expect(formatted).toBe("Rp 150.000");
    });

    it("respects preferred currency in localStorage and converts appropriately", () => {
      localStorage.setItem("trouvaille_preferred_currency", "USD");
      const formatted = formatStoredCurrency(158500); // 158,500 IDR ~ $10.00 at default rate
      expect(formatted).toMatch(/^\$[0-9]+(\.[0-9]{2})?$/);
      expect(formatted).toContain("$");
    });

    it("handles zero and negative values gracefully", () => {
      localStorage.setItem("trouvaille_preferred_currency", "IDR");
      expect(formatStoredCurrency(0)).toBe("Rp 0");
      expect(formatStoredCurrency(-50000)).toBe("-Rp 50.000");
    });
  });

  describe("2. Push Notifications & Daily Streak Localization (Rule 6)", () => {
    it("schedules daily streak reminder with pure Indonesian phrasing when isIndonesian is true", async () => {
      await syncDailyStreakReminder(false, true);

      expect(LocalNotifications.schedule).toHaveBeenCalledWith(
        expect.objectContaining({
          notifications: expect.arrayContaining([
            expect.objectContaining({
              id: DAILY_REMINDER_NOTIFICATION_ID,
              title: "Pertahankan Rekor Finansial Anda",
              body: expect.stringContaining("Belum ada transaksi tercatat hari ini"),
            }),
          ]),
        })
      );
    });

    it("schedules daily streak reminder with pure English phrasing when isIndonesian is false", async () => {
      await syncDailyStreakReminder(false, false);

      expect(LocalNotifications.schedule).toHaveBeenCalledWith(
        expect.objectContaining({
          notifications: expect.arrayContaining([
            expect.objectContaining({
              id: DAILY_REMINDER_NOTIFICATION_ID,
              title: "Maintain Your Financial Streak",
              body: expect.stringContaining("No transactions recorded today"),
            }),
          ]),
        })
      );
    });

    it("formats upcoming bill amounts using formatStoredCurrency in active preferred currency", async () => {
      localStorage.setItem("trouvaille_preferred_currency", "USD");

      const bills: Bill[] = [
        {
          id: "bill-1",
          user_id: "user-1",
          title: "Cloud Hosting",
          amount: 317000, // ~ $20 USD
          due_date: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
          category_id: "cat-1",
          is_paid: false,
          created_at: new Date().toISOString(),
        },
      ];

      await syncBillNotifications(bills, true);

      expect(LocalNotifications.schedule).toHaveBeenCalledWith(
        expect.objectContaining({
          notifications: expect.arrayContaining([
            expect.objectContaining({
              body: expect.stringMatching(/\$[0-9]+(\.[0-9]{2})?/),
            }),
          ]),
        })
      );
    });

    it("formats weekly digest spend in active preferred currency", async () => {
      localStorage.setItem("trouvaille_preferred_currency", "USD");

      const txs: Transaction[] = [
        {
          id: "tx-1",
          user_id: "u1",
          amount: 158500,
          type: "expense",
          occurred_on: new Date().toISOString().slice(0, 10),
          created_at: new Date().toISOString(),
        },
      ];

      await syncWeeklyDigestNotification(txs, true);

      expect(LocalNotifications.schedule).toHaveBeenCalledWith(
        expect.objectContaining({
          notifications: expect.arrayContaining([
            expect.objectContaining({
              id: WEEKLY_DIGEST_NOTIFICATION_ID,
              body: expect.stringMatching(/\$[0-9]+(\.[0-9]{2})?/),
            }),
          ]),
        })
      );
    });

    it("formats budget threshold alerts (80% and 100%) with preferred currency and no mixed English", async () => {
      localStorage.setItem("trouvaille_preferred_currency", "IDR");

      const categories: Category[] = [
        {
          id: "dining-cat",
          user_id: "u1",
          name: "Restoran & Kafe",
          budget_amount: 1000000,
          color: "#ffffff",
          icon: "utensils",
          created_at: new Date().toISOString(),
        },
      ];

      const txs: Transaction[] = [
        {
          id: "tx-1",
          user_id: "u1",
          category_id: "dining-cat",
          amount: 1050000,
          type: "expense",
          occurred_on: new Date().toISOString().slice(0, 10),
          created_at: new Date().toISOString(),
        },
      ];

      await checkBudgetThresholdAlerts(txs, categories, true);

      expect(LocalNotifications.schedule).toHaveBeenCalledWith(
        expect.objectContaining({
          notifications: expect.arrayContaining([
            expect.objectContaining({
              title: "Batas Anggaran Tercapai: Restoran & Kafe",
              body: expect.stringContaining("Pengeluaran telah mencapai 100%"),
            }),
          ]),
        })
      );
    });
  });

  describe("3. Financial Math Intelligence Multi-Currency Integration", () => {
    it("formats Action Center insight amounts with custom formatFn", () => {
      const customFormatter = (amt: number) => `USD $${(amt / 15000).toFixed(2)}`;

      const insight = generateActionCenterInsight({
        totalExpense: 300000,
        budget: 200000,
        projectedMonthEnd: 450000,
        projectedVariance: 250000,
        budgetRisk: "AT RISK",
        isAheadOfPace: true,
        paceDiff: 150000,
        consumedPct: 150,
        timePct: 50,
        categoryShifts: [],
        safeToSpend: 50000,
        unpaidBillsCount: 0,
        language: "en",
        formatFn: customFormatter,
      });

      expect(insight.title).toContain("USD $16.67");
      expect(insight.drillDownDetails?.explanation).toContain("USD $16.67");
    });

    it("formats Monthly Financial Review with custom formatFn and eliminates hardcoded 'Rp ... K' in English", () => {
      const customFormatter = (amt: number) => `€${(amt / 17000).toFixed(2)}`;

      const currentTxs: Transaction[] = [
        {
          id: "t1",
          user_id: "u1",
          amount: 340000,
          type: "expense",
          occurred_on: "2026-10-05T12:00:00",
          created_at: "2026-10-05T12:00:00",
        },
      ];

      const prevTxs: Transaction[] = [
        {
          id: "t0",
          user_id: "u1",
          amount: 170000,
          type: "expense",
          occurred_on: "2026-09-05T12:00:00",
          created_at: "2026-09-05T12:00:00",
        },
      ];

      const review = generateMonthlyFinancialReview(
        currentTxs,
        prevTxs,
        [],
        200000,
        new Date("2026-10-15"),
        "en",
        customFormatter
      );

      // Overrun check: 340000 - 200000 = 140000
      expect(review.whatNeedsAttention[0]).toContain("€8.24");
      expect(review.whatNeedsAttention[0]).not.toContain("Rp");
    });

    it("formats expense volatility run-rate and peak amounts using formatFn", () => {
      const customFormatter = (amt: number) => `SGD $${(amt / 12000).toFixed(2)}`;

      const txs: Transaction[] = [
        { id: "1", user_id: "u", amount: 120000, type: "expense", occurred_on: "2026-10-01T10:00:00", created_at: "2026-10-01" },
        { id: "2", user_id: "u", amount: 120000, type: "expense", occurred_on: "2026-10-02T10:00:00", created_at: "2026-10-02" },
        { id: "3", user_id: "u", amount: 120000, type: "expense", occurred_on: "2026-10-03T10:00:00", created_at: "2026-10-03" },
      ];

      const vol = calculateExpenseVolatility(
        txs,
        new Date("2026-10-04"),
        "en",
        customFormatter
      );

      expect(vol.status).toBe("sufficient");
      expect(vol.reason).toContain("SGD $");
    });
  });

  describe("4. Dynamic Schedule Alignment Helpers", () => {
    it("returns default schedule configurations when not customized", () => {
      expect(getWeeklyDigestDay()).toBe("sunday");
      expect(getWeeklyDigestTime()).toBe("19:30");
      expect(getMonthEndReviewTime()).toBe("20:00");
    });

    it("returns customized schedule preferences from localStorage", () => {
      localStorage.setItem("trouvaille_weekly_digest_day", "friday");
      localStorage.setItem("trouvaille_weekly_digest_time", "21:00");
      localStorage.setItem("trouvaille_month_end_review_time", "22:15");

      expect(getWeeklyDigestDay()).toBe("friday");
      expect(getWeeklyDigestTime()).toBe("21:00");
      expect(getMonthEndReviewTime()).toBe("22:15");
    });
  });
});
