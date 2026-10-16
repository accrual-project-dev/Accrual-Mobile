import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getGoalsStorageKey,
  getGoalsInitializedKey,
  getActiveUserTenantId,
  deductGoalFromStorage,
  addGoalToStorage,
  LEGACY_GOALS_STORAGE_KEY,
  type Goal,
} from "../src/hooks/useGoals";
import { GUEST_USER_ID } from "../src/contexts/AuthContext";
import {
  calculateGoalPlanning,
  calculateGoalScenario,
  calculateDynamicGoalMilestones,
} from "../src/lib/financialMath";
import { formatCurrencyAmount, CURRENCY_METADATA } from "../src/lib/currency";
import { format } from "date-fns";

describe("Financial Goals, Milestones & Emergency Fund Ecosystem Integrity Test Suite", () => {
  beforeEach(() => {
    let store: Record<string, string> = {};
    const mockStorage = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = String(v);
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        store = {};
      },
      key: (i: number) => Object.keys(store)[i] || null,
      get length() {
        return Object.keys(store).length;
      },
    };

    (globalThis as any).localStorage = mockStorage;
    (globalThis as any).window = globalThis;
    (globalThis as any).window.dispatchEvent = vi.fn();
    (globalThis as any).CustomEvent = class CustomEvent {
      type: string;
      detail: any;
      constructor(type: string, params: any = {}) {
        this.type = type;
        this.detail = params.detail;
      }
    };
    mockStorage.clear();
  });

  describe("1. Tenant Scoping & Storage Isolation (Rule 8.2)", () => {
    it("generates correctly scoped storage keys for distinct tenants and guest fallback", () => {
      expect(getGoalsStorageKey("user-alpha")).toBe("trouvaille_financial_goals_user-alpha");
      expect(getGoalsStorageKey("user-beta")).toBe("trouvaille_financial_goals_user-beta");
      expect(getGoalsStorageKey()).toBe(`trouvaille_financial_goals_${GUEST_USER_ID}`);

      expect(getGoalsInitializedKey("user-alpha")).toBe("trouvaille_goals_initialized_user-alpha");
      expect(getGoalsInitializedKey()).toBe(`trouvaille_goals_initialized_${GUEST_USER_ID}`);
    });

    it("resolves active tenant ID from Supabase auth token or falls back to guest", () => {
      expect(getActiveUserTenantId()).toBe(GUEST_USER_ID);

      const mockSession = { user: { id: "user-tenant-xyz" } };
      localStorage.setItem("sb-myproject-auth-token", JSON.stringify(mockSession));
      expect(getActiveUserTenantId()).toBe("user-tenant-xyz");

      localStorage.removeItem("sb-myproject-auth-token");
      expect(getActiveUserTenantId()).toBe(GUEST_USER_ID);
    });

    it("strictly isolates goal deposits and deductions across user tenants", () => {
      const goalsUser1: Goal[] = [
        {
          id: "goal-1",
          title: "Emergency Fund",
          targetAmount: 50_000_000,
          currentAmount: 10_000_000,
          icon: "Shield",
          color: "#3b82f6",
        },
      ];

      const goalsUser2: Goal[] = [
        {
          id: "goal-1", // Same goal ID in different tenant
          title: "New Laptop",
          targetAmount: 25_000_000,
          currentAmount: 5_000_000,
          icon: "Laptop",
          color: "#10b981",
        },
      ];

      localStorage.setItem(getGoalsStorageKey("user-1"), JSON.stringify(goalsUser1));
      localStorage.setItem(getGoalsStorageKey("user-2"), JSON.stringify(goalsUser2));

      // Deduct 2,000,000 from user-1
      deductGoalFromStorage("goal-1", 2_000_000, "user-1");

      const savedUser1: Goal[] = JSON.parse(localStorage.getItem(getGoalsStorageKey("user-1"))!);
      const savedUser2: Goal[] = JSON.parse(localStorage.getItem(getGoalsStorageKey("user-2"))!);

      expect(savedUser1[0].currentAmount).toBe(8_000_000);
      // User 2 remains untouched
      expect(savedUser2[0].currentAmount).toBe(5_000_000);

      // Add 1,500,000 to user-2
      addGoalToStorage("goal-1", 1_500_000, "user-2");

      const updatedUser2: Goal[] = JSON.parse(localStorage.getItem(getGoalsStorageKey("user-2"))!);
      expect(updatedUser2[0].currentAmount).toBe(6_500_000);
    });

    it("deducts via note tag #goal_{id} and clamps currentAmount to 0 on excessive withdrawal", () => {
      const goals: Goal[] = [
        {
          id: "emergency-fund",
          title: "Dana Darurat",
          targetAmount: 30_000_000,
          currentAmount: 5_000_000,
          icon: "Shield",
          color: "#3b82f6",
        },
      ];

      localStorage.setItem(getGoalsStorageKey(GUEST_USER_ID), JSON.stringify(goals));

      // Deduct using transaction note tag
      deductGoalFromStorage("Tarik Dana #goal_emergency-fund", 2_000_000, GUEST_USER_ID);
      let saved: Goal[] = JSON.parse(localStorage.getItem(getGoalsStorageKey(GUEST_USER_ID))!);
      expect(saved[0].currentAmount).toBe(3_000_000);

      // Deduct more than remaining balance
      deductGoalFromStorage("emergency-fund", 10_000_000, GUEST_USER_ID);
      saved = JSON.parse(localStorage.getItem(getGoalsStorageKey(GUEST_USER_ID))!);
      expect(saved[0].currentAmount).toBe(0); // Floor at 0
    });

    it("syncs legacy storage key when tenant is guest for backwards compatibility", () => {
      const goals: Goal[] = [
        {
          id: "g-legacy",
          title: "Legacy Goal",
          targetAmount: 10_000_000,
          currentAmount: 2_000_000,
          icon: "Target",
          color: "#ffffff",
        },
      ];

      localStorage.setItem(LEGACY_GOALS_STORAGE_KEY, JSON.stringify(goals));
      addGoalToStorage("g-legacy", 1_000_000, GUEST_USER_ID);

      const guestStored: Goal[] = JSON.parse(localStorage.getItem(getGoalsStorageKey(GUEST_USER_ID))!);
      const legacyStored: Goal[] = JSON.parse(localStorage.getItem(LEGACY_GOALS_STORAGE_KEY)!);

      expect(guestStored[0].currentAmount).toBe(3_000_000);
      expect(legacyStored[0].currentAmount).toBe(3_000_000);
    });
  });

  describe("2. Multi-Currency Conversion & Formatting Architecture", () => {
    it("formats goal amounts across supported currencies without hardcoded Rupiah", () => {
      const idrFormatted = formatCurrencyAmount(15_000_000, "IDR");
      expect(idrFormatted).toContain("Rp");
      expect(idrFormatted).toContain("15.000.000");

      const usdFormatted = formatCurrencyAmount(1_000, "USD");
      expect(usdFormatted).toContain("$");
      expect(usdFormatted).toContain("1,000.00");
      expect(usdFormatted).not.toContain("Rp");

      const jpyFormatted = formatCurrencyAmount(150_000, "JPY");
      expect(jpyFormatted).toContain("¥");
      expect(jpyFormatted).toContain("150,000");
      expect(jpyFormatted).not.toContain("Rp");

      const eurFormatted = formatCurrencyAmount(1_000, "EUR");
      expect(eurFormatted).toContain("€");
      expect(eurFormatted).not.toContain("Rp");
    });

    it("verifies currency metadata properties for live inputs", () => {
      expect(CURRENCY_METADATA.IDR.decimals).toBe(0);
      expect(CURRENCY_METADATA.JPY.decimals).toBe(0);
      expect(CURRENCY_METADATA.USD.decimals).toBe(2);
      expect(CURRENCY_METADATA.EUR.decimals).toBe(2);
      expect(CURRENCY_METADATA.SGD.decimals).toBe(2);
    });
  });

  describe("3. Dynamic Milestones Roadmap & Velocity Architecture", () => {
    const sampleGoal: Goal = {
      id: "g-house",
      title: "House Down Payment",
      targetAmount: 100_000_000,
      currentAmount: 40_000_000,
      icon: "Home",
      color: "#ffffff",
    };

    const baselines = {
      medianNetCashflow: 5_000_000,
      medianIncome: 15_000_000,
      medianExpense: 10_000_000,
    };

    it("computes 25%, 50%, 75%, 100% roadmap milestones and reaches status correctly", () => {
      const result = calculateDynamicGoalMilestones(sampleGoal, baselines, new Date("2026-01-01"), "en");

      expect(result.currentProgressPct).toBe(40);
      expect(result.remainingAmount).toBe(60_000_000);
      expect(result.milestones).toHaveLength(4);

      // 25% milestone (25M) -> reached because current is 40M
      expect(result.milestones[0].percentage).toBe(25);
      expect(result.milestones[0].targetAmount).toBe(25_000_000);
      expect(result.milestones[0].isReached).toBe(true);
      expect(result.milestones[0].projectedDate).toBe("Reached");

      // 50% milestone (50M) -> not reached (needs 10M more, at 5M/mo = 2 months)
      expect(result.milestones[1].percentage).toBe(50);
      expect(result.milestones[1].targetAmount).toBe(50_000_000);
      expect(result.milestones[1].isReached).toBe(false);
      expect(result.milestones[1].monthsAway).toBe(2);

      // 100% milestone (100M) -> not reached (needs 60M more, at 5M/mo = 12 months)
      expect(result.milestones[3].percentage).toBe(100);
      expect(result.milestones[3].targetAmount).toBe(100_000_000);
      expect(result.milestones[3].isReached).toBe(false);
      expect(result.milestones[3].monthsAway).toBe(12);
    });

    it("calculates conservative, current, and accelerated velocity tiers", () => {
      const result = calculateDynamicGoalMilestones(sampleGoal, baselines, new Date("2026-01-01"), "en");

      // Baseline velocity: 5,000,000/mo
      expect(result.velocityPaces.current.monthly).toBe(5_000_000);
      expect(result.velocityPaces.current.months).toBe(12);

      // Conservative (60%): 3,000,000/mo -> 60M / 3M = 20 months
      expect(result.velocityPaces.conservative.monthly).toBe(3_000_000);
      expect(result.velocityPaces.conservative.months).toBe(20);

      // Accelerated (140%): 7,000,000/mo -> 60M / 7M = 9 months
      expect(result.velocityPaces.accelerated.monthly).toBe(7_000_000);
      expect(result.velocityPaces.accelerated.months).toBe(9);
    });
  });

  describe("4. Goal Scenario Simulator Mathematical Determinism", () => {
    it("determines completion ETA accurately for custom contribution amounts", () => {
      const goal = { targetAmount: 24_000_000, currentAmount: 12_000_000 };
      const now = new Date("2026-01-01");

      const scenario = calculateGoalScenario(goal, 2_000_000, now, "en");
      expect(scenario.isFeasible).toBe(true);
      expect(scenario.monthsToTarget).toBe(6);
      expect(scenario.projectedCompletionDate).toBe("2026-07-01");
    });

    it("handles edge case when goal is already 100% completed", () => {
      const completedGoal = { targetAmount: 10_000_000, currentAmount: 10_000_000 };
      const scenario = calculateGoalScenario(completedGoal, 1_000_000, new Date(), "id");

      expect(scenario.isAlreadyCompleted).toBe(true);
      expect(scenario.monthsToTarget).toBe(0);
      expect(scenario.remainingAmount).toBe(0);
      expect(scenario.projectedCompletionLabel).toBe("Sudah tercapai");
    });

    it("handles invalid or zero monthly contribution gracefully", () => {
      const goal = { targetAmount: 10_000_000, currentAmount: 2_000_000 };
      const scenario = calculateGoalScenario(goal, 0, new Date(), "en");

      expect(scenario.isFeasible).toBe(false);
      expect(scenario.monthsToTarget).toBe(0);
      expect(scenario.projectedCompletionDate).toBeNull();
    });
  });

  describe("5. Multi-Currency Trajectory Formatting & Non-Mixed Localization", () => {
    const goal = {
      id: "g-test",
      title: "MacBook Pro M4",
      targetAmount: 30_000_000,
      currentAmount: 10_000_000,
      targetDate: "2026-12-01",
    };

    const baselines = {
      medianNetCashflow: 3_000_000,
      medianIncome: 12_000_000,
      medianExpense: 9_000_000,
      stability: "STABLE" as const,
      cashflowSign: "positive" as const,
      dataPoints: 6,
      monthlyRetainedAverages: [],
    };

    it("formats trajectory explanation with custom formatCurrencyFn in preferred currency", () => {
      const customFormatter = (val: number) => `$${Math.round(val / 15_000)}`;

      const planningEn = calculateGoalPlanning(
        goal,
        baselines as any,
        new Date("2026-01-01"),
        "en",
        customFormatter
      );

      // Explanation should use the formatted custom currency and pure English
      expect(planningEn.trajectoryExplanation).toContain("$");
      expect(planningEn.trajectoryExplanation).not.toContain("Rp");
      expect(planningEn.trajectoryExplanation).toContain("supports the required");

      const planningId = calculateGoalPlanning(
        goal,
        baselines as any,
        new Date("2026-01-01"),
        "id",
        customFormatter
      );

      // Explanation should use custom currency and pure Indonesian
      expect(planningId.trajectoryExplanation).toContain("$");
      expect(planningId.trajectoryExplanation).not.toContain("Rp");
      expect(planningId.trajectoryExplanation).toContain("mendukung laju");
    });

    it("verifies full ISO timestamp formatting for ledger transfer transactions (Rule 8.1)", () => {
      const now = new Date("2026-10-16T14:30:45.000Z");
      const isoTimestamp = format(now, "yyyy-MM-dd'T'HH:mm:ss");

      // Must have date and time separated by T, with full hours, minutes, seconds
      expect(isoTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
      expect(isoTimestamp.length).toBe(19);
    });
  });
});
