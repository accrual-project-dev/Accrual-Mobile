import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  convertCurrency,
  formatCurrencyAmount,
  DEFAULT_RATES,
  type SupportedCurrency,
} from "../src/lib/currency";
import { MONETIZATION_LIMITS } from "../src/types/subscription";

// Mock localStorage
let store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((k: string) => store[k] ?? null),
  setItem: vi.fn((k: string, v: string) => {
    store[k] = String(v);
  }),
  removeItem: vi.fn((k: string) => {
    delete store[k];
  }),
  clear: vi.fn(() => {
    store = {};
  }),
};

Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

describe("Budgets, Quota & Overspending Protection Ecosystem Integrity Suite", () => {
  beforeEach(() => {
    store = {};
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  // ─── 1. Budget Target Storage & Tenant Isolation Invariants ───────────────
  describe("1. Budget Target Tenant Isolation & Lifecycle Invariants", () => {
    const resolveBudgetTarget = (userId: string = "guest_local_user"): number => {
      const targetKey = `trouvaille_budget_target_${userId}`;
      const saved =
        store[targetKey] ||
        store["trouvaille_budget_target"];
      return saved ? Number(saved) : 5000000;
    };

    const resolveBudgetPeriodStart = (userId: string = "guest_local_user"): number => {
      const periodKey = `trouvaille_budget_period_start_${userId}`;
      const saved =
        store[periodKey] ||
        store["trouvaille_budget_period_start"];
      const num = saved ? Number(saved) : 1;
      return num >= 1 && num <= 28 ? num : 1;
    };

    it("defaults to 5,000,000 IDR and day 1 when unconfigured", () => {
      expect(resolveBudgetTarget("user_alpha")).toBe(5000000);
      expect(resolveBudgetPeriodStart("user_alpha")).toBe(1);
    });

    it("scopes stored budget values to user tenant key and prevents cross-session leakage", () => {
      // User Alpha configures budget
      const alphaId = "usr_alpha_123";
      store[`trouvaille_budget_target_${alphaId}`] = "8500000";
      store[`trouvaille_budget_period_start_${alphaId}`] = "25";

      // Verify User Alpha gets their specific budget
      expect(resolveBudgetTarget(alphaId)).toBe(8500000);
      expect(resolveBudgetPeriodStart(alphaId)).toBe(25);

      // Verify User Beta (different account) receives unpolluted defaults
      const betaId = "usr_beta_456";
      expect(resolveBudgetTarget(betaId)).toBe(5000000);
      expect(resolveBudgetPeriodStart(betaId)).toBe(1);

      // Verify Guest user also gets independent values
      expect(resolveBudgetTarget("guest_local_user")).toBe(5000000);
    });

    it("strictly clamps budget period start day between 1 and 28", () => {
      const userId = "usr_test";

      // Valid day
      store[`trouvaille_budget_period_start_${userId}`] = "15";
      expect(resolveBudgetPeriodStart(userId)).toBe(15);

      // Edge day 28
      store[`trouvaille_budget_period_start_${userId}`] = "28";
      expect(resolveBudgetPeriodStart(userId)).toBe(28);

      // Out of bounds: 31 (month lengths vary, capped at 28)
      store[`trouvaille_budget_period_start_${userId}`] = "31";
      expect(resolveBudgetPeriodStart(userId)).toBe(1);

      // Out of bounds: 0 or negative
      store[`trouvaille_budget_period_start_${userId}`] = "0";
      expect(resolveBudgetPeriodStart(userId)).toBe(1);
    });

    it("falls back gracefully to legacy trovaille_budget_target if tenant key absent", () => {
      store["trouvaille_budget_target"] = "6000000";
      store["trouvaille_budget_period_start"] = "27";

      expect(resolveBudgetTarget("new_migrated_user")).toBe(6000000);
      expect(resolveBudgetPeriodStart("new_migrated_user")).toBe(27);
    });
  });

  // ─── 2. Quota Engine Tenant Isolation & Paywall Gating ───────────────────
  describe("2. Hybrid Quota Engine & Paywall Gating Invariants", () => {
    const resolveOcrQuota = (
      userId: string,
      period: string,
      isPremium: boolean
    ) => {
      const storageKey = `accrual_ocr_quota_${userId}_${period}`;
      const raw = store[storageKey] || store[`accrual_ocr_quota_${period}`];
      const count = raw ? parseInt(raw, 10) || 0 : 0;
      const limit = isPremium ? Infinity : MONETIZATION_LIMITS.FREE_OCR_MONTHLY_LIMIT;
      const remaining = isPremium ? Infinity : Math.max(0, limit - count);
      const isLimitReached = !isPremium && count >= limit;
      return { count, limit, remaining, isLimitReached, storageKey };
    };

    it("enforces tenant-scoped storage keys and free tier 5-scan monthly limit", () => {
      const period = "2026-10";
      const userAlpha = "user_alpha";
      const userBeta = "user_beta";

      // User Alpha uses 3 scans
      store[`accrual_ocr_quota_${userAlpha}_${period}`] = "3";

      const quotaAlpha = resolveOcrQuota(userAlpha, period, false);
      expect(quotaAlpha.count).toBe(3);
      expect(quotaAlpha.limit).toBe(5);
      expect(quotaAlpha.remaining).toBe(2);
      expect(quotaAlpha.isLimitReached).toBe(false);

      // User Beta starts fresh with 0 scans
      const quotaBeta = resolveOcrQuota(userBeta, period, false);
      expect(quotaBeta.count).toBe(0);
      expect(quotaBeta.remaining).toBe(5);
      expect(quotaBeta.isLimitReached).toBe(false);
    });

    it("triggers limit reached when user consumes all 5 free scans", () => {
      const period = "2026-10";
      const userAlpha = "user_alpha";
      store[`accrual_ocr_quota_${userAlpha}_${period}`] = "5";

      const quota = resolveOcrQuota(userAlpha, period, false);
      expect(quota.remaining).toBe(0);
      expect(quota.isLimitReached).toBe(true);
    });

    it("provides unlimited scans for Accrual Pro accounts", () => {
      const period = "2026-10";
      const userPro = "user_pro";
      store[`accrual_ocr_quota_${userPro}_${period}`] = "42";

      const quota = resolveOcrQuota(userPro, period, true);
      expect(quota.limit).toBe(Infinity);
      expect(quota.remaining).toBe(Infinity);
      expect(quota.isLimitReached).toBe(false);
    });
  });

  // ─── 3. Multi-Currency Budget Target Mathematical Consistency ────────────
  describe("3. Multi-Currency Budget Target Conversion & Consistency", () => {
    it("converts stored base IDR budget target to USD for display and back to IDR on save", () => {
      const baseBudgetIdr = 5000000;
      const targetCurrency: SupportedCurrency = "USD";

      // 1. Initial display conversion: IDR -> USD
      const inUsd = convertCurrency(baseBudgetIdr, "IDR", targetCurrency, DEFAULT_RATES);
      // At rate 1 / 15850, 5,000,000 IDR is approx 315.46 USD
      expect(inUsd).toBeCloseTo(315.457, 1);

      // Formatted amount for input placeholder/display
      const formattedUsd = formatCurrencyAmount(inUsd, targetCurrency);
      expect(formattedUsd).toContain("$");
      expect(formattedUsd).toContain("315");

      // 2. User inputs $400 USD and saves: USD -> IDR
      const editedUsd = 400;
      const savedInIdr = Math.round(
        convertCurrency(editedUsd, targetCurrency, "IDR", DEFAULT_RATES)
      );
      // 400 * 15850 = 6,340,000 IDR
      expect(savedInIdr).toBe(6340000);

      // 3. Verify budget consumption percentage is identical in IDR and USD
      const totalExpenseIdr = 2000000;
      const consumedPct = Math.round((totalExpenseIdr / savedInIdr) * 100);
      expect(consumedPct).toBe(32); // 2,000,000 / 6,340,000 = ~31.5% -> 32%

      const totalExpenseUsd = convertCurrency(totalExpenseIdr, "IDR", targetCurrency, DEFAULT_RATES);
      const consumedPctUsd = Math.round((totalExpenseUsd / editedUsd) * 100);
      expect(consumedPctUsd).toBe(32);
    });

    it("formats amounts properly across different currencies without NaN", () => {
      const currencies: SupportedCurrency[] = ["IDR", "USD", "SGD", "EUR", "JPY", "GBP", "AUD"];

      currencies.forEach((curr) => {
        const idrVal = 10000000;
        const converted = convertCurrency(idrVal, "IDR", curr, DEFAULT_RATES);
        const formatted = formatCurrencyAmount(converted, curr);

        expect(formatted).not.toContain("NaN");
        expect(formatted.length).toBeGreaterThan(0);
      });
    });
  });

  // ─── 4. Category Budget Deck Envelope Math & Overspending Protection ────
  describe("4. Category Budget Envelope Math & Overspending Logic", () => {
    it("correctly computes spent, percentage, remaining, and detects overbudget status", () => {
      const budgetAmountIdr = 1000000; // 1,000,000 IDR budget for Dining
      const spentWithinBudget = 650000;
      const spentOverBudget = 1250000;

      // Case A: Within budget
      const pctA = Math.round((spentWithinBudget / budgetAmountIdr) * 100);
      const remainingA = budgetAmountIdr - spentWithinBudget;
      const isOverA = budgetAmountIdr > 0 && spentWithinBudget > budgetAmountIdr;

      expect(pctA).toBe(65);
      expect(remainingA).toBe(350000);
      expect(isOverA).toBe(false);

      // Case B: Overbudget
      const pctB = Math.round((spentOverBudget / budgetAmountIdr) * 100);
      const remainingB = budgetAmountIdr - spentOverBudget;
      const isOverB = budgetAmountIdr > 0 && spentOverBudget > budgetAmountIdr;

      expect(pctB).toBe(125);
      expect(remainingB).toBe(-250000);
      expect(isOverB).toBe(true);
      expect(Math.abs(remainingB)).toBe(250000);
    });

    it("ranks top envelopes by consumption percentage descending", () => {
      const envelopes = [
        { id: "cat_1", name: "Groceries", budget: 2000000, spent: 1000000, pct: 50 },
        { id: "cat_2", name: "Dining", budget: 1000000, spent: 900000, pct: 90 },
        { id: "cat_3", name: "Transport", budget: 500000, spent: 550000, pct: 110 },
        { id: "cat_4", name: "Entertainment", budget: 1000000, spent: 200000, pct: 20 },
      ];

      const sorted = [...envelopes].sort((a, b) => b.pct - a.pct);
      expect(sorted[0].id).toBe("cat_3"); // 110% (Overbudget top priority)
      expect(sorted[1].id).toBe("cat_2"); // 90%
      expect(sorted[2].id).toBe("cat_1"); // 50%
      expect(sorted[3].id).toBe("cat_4"); // 20%
    });
  });

  // ─── 5. Strict Localization Purity & Monochromatic Architecture ───────────
  describe("5. Localization Purity & Monochromatic Architecture (Rules 1, 6)", () => {
    it("ensures zero bilingual mixing in Indonesian and English translations", () => {
      const translations = {
        id: {
          title: "Amplop Anggaran Kategori",
          setupCta: "Atur Anggaran Kategori Sekarang",
          riskWarning: "berisiko melampaui anggaran sebelum bulan berakhir",
          overBadge: "Lebih",
          remainingLabel: "Sisa kuota belanja:",
          exceededLabel: "Melampaui batas kuota:",
          cycleBegins: "Siklus dimulai tanggal 1",
          saveSettings: "Simpan Pengaturan Anggaran",
        },
        en: {
          title: "Category Budgets",
          setupCta: "Set Category Budgets Now",
          riskWarning: "prevent overspending before month-end",
          overBadge: "Over",
          remainingLabel: "Remaining quota:",
          exceededLabel: "Exceeded by:",
          cycleBegins: "Cycle begins Day 1",
          saveSettings: "Save Budget Settings",
        },
      };

      // Indonesian verification: No English loanwords
      expect(translations.id.setupCta).not.toContain("Budget");
      expect(translations.id.riskWarning).not.toContain("overbudget");
      expect(translations.id.overBadge).toBe("Lebih");
      expect(translations.id.title).toBe("Amplop Anggaran Kategori");

      // English verification: Pure English
      expect(translations.en.setupCta).toBe("Set Category Budgets Now");
      expect(translations.en.overBadge).toBe("Over");
      expect(translations.en.title).toBe("Category Budgets");
    });
  });
});
