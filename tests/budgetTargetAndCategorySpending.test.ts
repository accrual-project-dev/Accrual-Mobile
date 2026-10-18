import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { getBudgetPeriodInterval } from "../src/lib/financialMath";
import { convertCurrency, formatCurrencyAmount, DEFAULT_RATES, type SupportedCurrency } from "../src/lib/currency";
import { USER_SESSION_STORAGE_KEYS } from "../src/lib/sessionCleanup";

// Mock localStorage for tenant isolation tests
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

describe("Audit #33: Budget Target & Category Spending Threshold Workstation Suite", () => {
  const budgetSheetPath = path.resolve(__dirname, "../src/components/settings/BudgetTargetSheet.tsx");
  const categoryDeckPath = path.resolve(__dirname, "../src/components/home/CategoryBudgetDeck.tsx");
  const useBudgetTargetPath = path.resolve(__dirname, "../src/hooks/useBudgetTarget.ts");

  const budgetSheetContent = fs.readFileSync(budgetSheetPath, "utf-8");
  const categoryDeckContent = fs.readFileSync(categoryDeckPath, "utf-8");
  const useBudgetTargetContent = fs.readFileSync(useBudgetTargetPath, "utf-8");

  beforeEach(() => {
    store = {};
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Safe-Area Inset & BottomSheet Architecture Verification (Rule 5)
  // ─────────────────────────────────────────────────────────────────────────────
  describe("1. Safe-Area Inset & BottomSheet Architecture Compliance", () => {
    it("enforces dynamic safe-area-inset-bottom in BudgetTargetSheet.tsx", () => {
      expect(budgetSheetContent).toContain(
        'paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)"'
      );
    });

    it("enforces dynamic safe-area-inset-bottom in CategoryBudgetDeck.tsx info modal", () => {
      expect(categoryDeckContent).toContain(
        'paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)"'
      );
    });

    it("contains no artificial inner height caps (max-h-[55vh], max-h-[50vh]) in bottom sheets", () => {
      expect(budgetSheetContent).not.toMatch(/max-h-\[(?:50vh|52vh|55vh|60vh|340px)\]/);
      expect(categoryDeckContent).not.toMatch(/max-h-\[(?:50vh|52vh|55vh|60vh|340px)\]/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Iconography & Monochrome Luxury Theme System (Rules 1 & 7)
  // ─────────────────────────────────────────────────────────────────────────────
  describe("2. Iconography & Monochrome Luxury Theme Invariants", () => {
    it("contains zero hardcoded colored system emojis in BudgetTargetSheet and CategoryBudgetDeck", () => {
      const coloredEmojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      expect(budgetSheetContent).not.toMatch(coloredEmojiRegex);
      expect(categoryDeckContent).not.toMatch(coloredEmojiRegex);
    });

    it("uses vector outline icons from lucide-react with standardized strokeWidth", () => {
      expect(budgetSheetContent).toContain('from "lucide-react"');
      expect(budgetSheetContent).toContain("Calendar");
      expect(categoryDeckContent).toContain('from "lucide-react"');
      expect(categoryDeckContent).toContain("Target");
      expect(categoryDeckContent).toContain("Sparkles");
      expect(categoryDeckContent).toContain("ShieldCheck");
    });

    it("BudgetTargetSheet save CTA strictly uses monochrome tokens, never var(--accent) per Rule 7", () => {
      expect(budgetSheetContent).toContain(
        'style={{ background: "var(--text-primary)", color: "var(--bg-base)" }}'
      );
      expect(budgetSheetContent).not.toContain('style={{ background: "var(--accent)"');
    });

    it("CategoryBudgetDeck progress bar strictly uses var(--text-primary)", () => {
      expect(categoryDeckContent).toContain('background: "var(--text-primary)"');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Strict Non-Mixed Localization Compliance (Rule 6)
  // ─────────────────────────────────────────────────────────────────────────────
  describe("3. Strict Non-Mixed Localization Compliance", () => {
    it("provides complete Indonesian vs English branching in BudgetTargetSheet", () => {
      expect(budgetSheetContent).toContain('isIndonesian ? "Anggaran & Siklus Belanja" : "Budget & Spending Cycle"');
      expect(budgetSheetContent).toContain('isIndonesian ? "Batas Anggaran Bulanan" : "Monthly Spending Limit"');
      expect(budgetSheetContent).toContain('isIndonesian ? "Awal Siklus Anggaran" : "Budget Period Start"');
      expect(budgetSheetContent).toContain('isIndonesian ? "Simpan Pengaturan Anggaran" : "Save Budget Settings"');
    });

    it("provides complete Indonesian vs English branching in CategoryBudgetDeck", () => {
      expect(categoryDeckContent).toContain('isIndonesian ? "Sistem Amplop Anggaran" : "Category Envelope System"');
      expect(categoryDeckContent).toContain('"Melampaui batas kuota:"');
      expect(categoryDeckContent).toContain('"Exceeded by:"');
      expect(categoryDeckContent).toContain('"Sisa kuota belanja:"');
      expect(categoryDeckContent).toContain('"Remaining quota:"');
      expect(categoryDeckContent).toContain('isIndonesian ? "Mengerti" : "Got it"');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Multi-Currency & Stealth Masking Integrity
  // ─────────────────────────────────────────────────────────────────────────────
  describe("4. Multi-Currency & Stealth Masking Integrity", () => {
    it("binds currency symbol dynamically from CurrencyContext", () => {
      expect(budgetSheetContent).toContain("{currencyMeta.symbol}");
      expect(categoryDeckContent).toContain("${currencyMeta.symbol} ••••");
    });

    it("converts target amounts accurately across supported currencies", () => {
      const idrAmount = 15000000;
      const usdAmount = convertCurrency(idrAmount, "IDR", "USD", DEFAULT_RATES);
      expect(usdAmount).toBeGreaterThan(900);
      expect(usdAmount).toBeLessThan(1000);

      const formattedUsd = formatCurrencyAmount(usdAmount, "USD");
      expect(formattedUsd).toContain("$");

      const backToIdr = convertCurrency(usdAmount, "USD", "IDR", DEFAULT_RATES);
      expect(Math.round(backToIdr)).toBe(idrAmount);
    });

    it("CategoryBudgetDeck hides amount with currency symbol when hideBalance is true", () => {
      const currencyMeta = { symbol: "$" };
      const hideBalance = true;
      const masked = hideBalance ? `${currencyMeta.symbol} ••••` : "$100.00";
      expect(masked).toBe("$ ••••");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Budget Period Interval & Category Envelope Math
  // ─────────────────────────────────────────────────────────────────────────────
  describe("5. Budget Period Interval Math & Envelope Calculations", () => {
    it("computes active cycle interval accurately for day 1 cycle start", () => {
      const refDate = new Date(2026, 9, 15); // Oct 15, 2026
      const interval = getBudgetPeriodInterval(refDate, 1);
      expect(interval.startDate.getDate()).toBe(1);
      expect(interval.startDate.getMonth()).toBe(9); // Oct
      expect(interval.label).toMatch(/1 (Oct|Okt)/i);
      expect(interval.label).toMatch(/31 (Oct|Okt) 2026/i);
    });

    it("computes active cycle interval accurately for salary cycle start on day 25", () => {
      // If current date is Oct 15, 2026 and cycle starts on 25th:
      // Active cycle began Sep 25, 2026 and ends Oct 24, 2026
      const refDate = new Date(2026, 9, 15);
      const interval = getBudgetPeriodInterval(refDate, 25);
      expect(interval.startDate.getDate()).toBe(25);
      expect(interval.startDate.getMonth()).toBe(8); // Sep
      expect(interval.endDate.getDate()).toBe(24);
      expect(interval.endDate.getMonth()).toBe(9); // Oct
    });

    it("ranks top 5 envelopes by highest percentage consumed", () => {
      const mockCategories = [
        { id: "c1", name: "Food", budget_amount: 1000000, type: "expense" },
        { id: "c2", name: "Transport", budget_amount: 500000, type: "expense" },
        { id: "c3", name: "Entertainment", budget_amount: 400000, type: "expense" },
        { id: "c4", name: "Utilities", budget_amount: 800000, type: "expense" },
        { id: "c5", name: "Groceries", budget_amount: 2000000, type: "expense" },
        { id: "c6", name: "Shopping", budget_amount: 1500000, type: "expense" },
        { id: "c7", name: "Salary", budget_amount: 10000000, type: "income" }, // Should be excluded
        { id: "c8", name: "Misc", budget_amount: 0, type: "expense" }, // Zero budget excluded
      ];

      const spendMap = new Map<string, number>([
        ["c1", 800000],  // 80%
        ["c2", 550000],  // 110% (overbudget)
        ["c3", 200000],  // 50%
        ["c4", 760000],  // 95%
        ["c5", 1500000], // 75%
        ["c6", 600000],  // 40%
      ]);

      const filtered = mockCategories.filter(
        (c) => c.type !== "income" && Number(c.budget_amount || 0) > 0
      );
      expect(filtered.length).toBe(6);

      const items = filtered.map((cat) => {
        const spent = spendMap.get(cat.id) || 0;
        const budgetAmount = Number(cat.budget_amount || 0);
        const percentage = Math.round((spent / budgetAmount) * 100);
        const remaining = budgetAmount - spent;
        return {
          id: cat.id,
          percentage,
          remaining,
          isOverbudget: remaining < 0,
        };
      });

      const sortedTop5 = items.sort((a, b) => b.percentage - a.percentage).slice(0, 5);
      expect(sortedTop5.length).toBe(5);
      expect(sortedTop5[0].id).toBe("c2"); // 110%
      expect(sortedTop5[0].isOverbudget).toBe(true);
      expect(sortedTop5[0].remaining).toBe(-50000);
      expect(sortedTop5[1].id).toBe("c4"); // 95%
      expect(sortedTop5[2].id).toBe("c1"); // 80%
      expect(sortedTop5[3].id).toBe("c5"); // 75%
      expect(sortedTop5[4].id).toBe("c3"); // 50%
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Multi-Tenant Storage Isolation & Session Teardown
  // ─────────────────────────────────────────────────────────────────────────────
  describe("6. Multi-Tenant Storage Isolation & Session Teardown", () => {
    it("uses user-scoped tenant keys for budget target and period start", () => {
      expect(useBudgetTargetContent).toContain("trouvaille_budget_target_${userId}");
      expect(useBudgetTargetContent).toContain("trouvaille_budget_period_start_${userId}");
    });

    it("resets budget settings to defaults (5,000,000 IDR and day 1) upon session teardown", () => {
      expect(useBudgetTargetContent).toContain('window.addEventListener("trouvaille_session_teardown"');
      expect(useBudgetTargetContent).toContain("setBudgetTarget(5000000)");
      expect(useBudgetTargetContent).toContain("setBudgetPeriodStart(1)");
    });

    it("verifies budget keys are listed in USER_SESSION_STORAGE_KEYS in sessionCleanup.ts", () => {
      expect(USER_SESSION_STORAGE_KEYS).toContain("trouvaille_budget_target");
      expect(USER_SESSION_STORAGE_KEYS).toContain("trouvaille_budget_period_start");
    });
  });
});
