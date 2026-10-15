import { describe, it, expect } from "vitest";
import {
  computeMonthAggregates,
  computeSpendingPace,
  computeBudgetRisk,
  computeCategoryMoMChanges,
  calculateAssetTrend,
  calculateWhatIfScenario,
  calculateGoalScenario,
  calculateExpenseVolatility,
  calculateDynamicGoalMilestones,
  calculateDebtPayoffSchedule,
  getBudgetPeriodInterval,
  filterTransactionsByBudgetPeriod,
  generateActionCenterInsight,
  type DebtItem,
} from "../src/lib/financialMath";
import {
  convertCurrency,
  formatCurrencyAmount,
  DEFAULT_RATES,
} from "../src/lib/currency";
import type { Transaction, Category } from "../src/lib/types";

describe("Financial Math & Analytics Test Suite", () => {
  it("computes month aggregates accurately", () => {
    const txs: Transaction[] = [
      {
        id: "1",
        user_id: "u",
        amount: 500000,
        type: "income",
        wallet_id: null,
        to_wallet_id: null,
        category_id: null,
        note: "Freelance",
        occurred_on: "2026-08-10",
        created_at: "",
      },
      {
        id: "2",
        user_id: "u",
        amount: 100000,
        type: "expense",
        wallet_id: null,
        to_wallet_id: null,
        category_id: "c-food",
        note: "Meal",
        occurred_on: "2026-08-11",
        created_at: "",
      },
      {
        id: "3",
        user_id: "u",
        amount: 50000,
        type: "expense",
        wallet_id: null,
        to_wallet_id: null,
        category_id: "c-food",
        note: "Coffee",
        occurred_on: "2026-08-12",
        created_at: "",
      },
    ];

    const agg = computeMonthAggregates(txs, 2026, 8);
    expect(agg.totalIncome).toBe(500000);
    expect(agg.totalExpense).toBe(150000);
    expect(agg.netCashflow).toBe(350000);
    expect(agg.savingsRate).toBe(70);
    expect(agg.txCount).toBe(2);
    expect(agg.avgExpense).toBe(75000);
    expect(agg.categoryTotals["c-food"].total).toBe(150000);
    expect(agg.categoryTotals["c-food"].count).toBe(2);
  });

  it("computes spending pace and projections deterministically", () => {
    const pace = computeSpendingPace(1000000, 3000000, 10, 30);
    expect(pace.expectedPace).toBe(1000000);
    expect(pace.paceDiff).toBe(0);
    expect(pace.isAheadOfPace).toBe(false);
    expect(pace.dailyAvg).toBe(100000);
    expect(pace.projectedMonthEnd).toBe(3000000);
    expect(pace.consumedPct).toBeCloseTo(33.33, 1);
    expect(pace.timePct).toBeCloseTo(33.33, 1);
  });

  it("computes budget risk levels correctly (SAFE, WATCH, AT RISK)", () => {
    const safeRisk = computeBudgetRisk(30, 35, 5000000);
    expect(safeRisk.riskLevel).toBe("SAFE");

    const watchRisk = computeBudgetRisk(45, 35, 5000000);
    expect(watchRisk.riskLevel).toBe("WATCH");

    const criticalRisk = computeBudgetRisk(70, 40, 5000000);
    expect(criticalRisk.riskLevel).toBe("AT RISK");
  });

  it("computes category month-over-month shifts with contributors", () => {
    const currentTxs: Transaction[] = [
      {
        id: "1",
        user_id: "u",
        amount: 600000,
        type: "expense",
        wallet_id: null,
        to_wallet_id: null,
        category_id: "c-food",
        note: "Groceries",
        occurred_on: "2026-08-05",
        created_at: "",
      },
    ];
    const prevTxs: Transaction[] = [
      {
        id: "2",
        user_id: "u",
        amount: 400000,
        type: "expense",
        wallet_id: null,
        to_wallet_id: null,
        category_id: "c-food",
        note: "Groceries",
        occurred_on: "2026-07-05",
        created_at: "",
      },
    ];
    const categories: Category[] = [
      {
        id: "c-food",
        user_id: "u",
        name: "Makanan",
        emoji: "/icons/makanan.png",
        type: "expense",
        is_default: true,
        created_at: "",
      },
    ];

    const shifts = computeCategoryMoMChanges(currentTxs, prevTxs, categories);
    expect(shifts.length).toBe(1);
    expect(shifts[0].name).toBe("Makanan");
    expect(shifts[0].deltaAmount).toBe(200000);
    expect(shifts[0].pctChange).toBe(50);
    expect(shifts[0].isIncrease).toBe(true);
  });

  it("calculates asset trend across timeframes without floating point errors", () => {
    const txs: Transaction[] = [
      {
        id: "1",
        user_id: "u",
        amount: 1000000,
        type: "income",
        wallet_id: null,
        to_wallet_id: null,
        category_id: null,
        note: null,
        occurred_on: "2026-08-20",
        created_at: "",
      },
      {
        id: "2",
        user_id: "u",
        amount: 200000,
        type: "expense",
        wallet_id: null,
        to_wallet_id: null,
        category_id: null,
        note: null,
        occurred_on: "2026-08-21",
        created_at: "",
      },
    ];

    const trend = calculateAssetTrend(
      txs,
      800000,
      "1W",
      new Date("2026-08-22T12:00:00Z"),
    );
    expect(trend.currentBalance).toBe(800000);
    expect(trend.chartData.length).toBe(7);
  });

  it("keeps YTD, 1Y, and ALL portfolio charts anchored to real balances instead of zero-based flow", () => {
    const txs: Transaction[] = [
      {
        id: "1",
        user_id: "u",
        amount: 5000000,
        type: "income",
        wallet_id: null,
        to_wallet_id: null,
        category_id: null,
        note: "Salary",
        occurred_on: "2026-01-05",
        created_at: "",
      },
      {
        id: "2",
        user_id: "u",
        amount: 1000000,
        type: "expense",
        wallet_id: null,
        to_wallet_id: null,
        category_id: null,
        note: "Rent",
        occurred_on: "2026-02-10",
        created_at: "",
      },
      {
        id: "3",
        user_id: "u",
        amount: 2000000,
        type: "income",
        wallet_id: null,
        to_wallet_id: null,
        category_id: null,
        note: "Bonus",
        occurred_on: "2026-08-15",
        created_at: "",
      },
    ];

    const ytd = calculateAssetTrend(
      txs,
      24000000,
      "YTD",
      new Date("2026-09-01T12:00:00Z"),
    );
    const oneYear = calculateAssetTrend(
      txs,
      24000000,
      "1Y",
      new Date("2026-09-01T12:00:00Z"),
    );
    const allTime = calculateAssetTrend(
      txs,
      24000000,
      "ALL",
      new Date("2026-09-01T12:00:00Z"),
    );

    expect(ytd.diff).toBe(6000000);
    expect(oneYear.diff).toBe(6000000);
    expect(allTime.diff).toBe(6000000);
    expect(ytd.lowBalance).toBeGreaterThan(17000000);
    expect(oneYear.lowBalance).toBeGreaterThan(17000000);
    expect(allTime.lowBalance).toBeGreaterThan(17000000);
    expect(allTime.chartData.length).toBeGreaterThanOrEqual(9);
  });

  it("treats opening balance imports as all-time portfolio anchors instead of negative operating flow", () => {
    const txs: Transaction[] = [
      {
        id: "open-1",
        user_id: "u",
        amount: 7291226,
        type: "expense",
        wallet_id: "w1",
        to_wallet_id: null,
        category_id: null,
        note: "Penyesuaian Saldo Awal - Krom Bank",
        occurred_on: "2025-01-01",
        created_at: "",
      },
      {
        id: "open-2",
        user_id: "u",
        amount: 917254,
        type: "income",
        wallet_id: "w2",
        to_wallet_id: null,
        category_id: null,
        note: "Penyesuaian Saldo Awal - BNI",
        occurred_on: "2025-01-01",
        created_at: "",
      },
      {
        id: "tx-1",
        user_id: "u",
        amount: 3000000,
        type: "income",
        wallet_id: "w2",
        to_wallet_id: null,
        category_id: null,
        note: "Salary",
        occurred_on: "2025-01-10",
        created_at: "",
      },
      {
        id: "tx-2",
        user_id: "u",
        amount: 1250000,
        type: "expense",
        wallet_id: "w2",
        to_wallet_id: null,
        category_id: null,
        note: "Living cost",
        occurred_on: "2025-01-14",
        created_at: "",
      },
    ];

    const trend = calculateAssetTrend(
      txs,
      9958480,
      "ALL",
      new Date("2025-02-01T12:00:00Z"),
    );

    expect(trend.lowBalance).toBeGreaterThan(0);
    expect(trend.chartData[0].balance).toBeGreaterThan(6000000);
  });

  it("computes deterministic what-if scenarios", () => {
    const result = calculateWhatIfScenario({
      monthlyIncome: 5000000,
      monthlyExpense: 3000000,
      type: "expense_cut",
      value: 500000,
    });

    expect(result.currentAnnualRetainedCash).toBe(24000000);
    expect(result.adjustedAnnualRetainedCash).toBe(30000000);
    expect(result.annualDifference).toBe(6000000);
    expect(result.isOvercommitted).toBe(false);
  });

  it("projects goal completion from monthly scenario amounts", () => {
    const scenario = calculateGoalScenario(
      {
        targetAmount: 50000000,
        currentAmount: 18000000,
      },
      2000000,
      new Date("2026-08-01T12:00:00Z"),
    );

    expect(scenario.remainingAmount).toBe(32000000);
    expect(scenario.monthsToTarget).toBe(16);
    expect(scenario.projectedCompletionLabel).toBe("December 2027");
  });

  it("handles empty transactions dataset cleanly (0 records)", () => {
    const agg = computeMonthAggregates([], 2026, 8);
    expect(agg.totalIncome).toBe(0);
    expect(agg.totalExpense).toBe(0);
    expect(agg.netCashflow).toBe(0);
    expect(agg.savingsRate).toBe(0);
    expect(agg.txCount).toBe(0);
  });

  describe("calculateExpenseVolatility", () => {
    it("returns insufficient status when fewer than 3 days or no expense", () => {
      const now = new Date("2026-08-02T10:00:00Z"); // Day 2
      const result = calculateExpenseVolatility([], now);
      expect(result.status).toBe("insufficient");
      expect(result.stability).toBe("STABLE");
      expect(result.score).toBe(100);
    });

    it("identifies STABLE spending when daily expense is uniform", () => {
      const now = new Date("2026-08-10T12:00:00Z"); // Day 10
      const txs: Transaction[] = [];
      for (let day = 1; day <= 10; day++) {
        txs.push({
          id: `tx-${day}`,
          user_id: "u1",
          amount: 100000,
          type: "expense",
          wallet_id: null,
          to_wallet_id: null,
          category_id: null,
          note: `Day ${day} expense`,
          occurred_on: `2026-08-${String(day).padStart(2, "0")}`,
          created_at: "",
        });
      }

      const result = calculateExpenseVolatility(txs, now);
      expect(result.status).toBe("sufficient");
      expect(result.stability).toBe("STABLE");
      expect(result.coefficientOfVariation).toBe(0);
      expect(result.score).toBe(100);
      expect(result.meanDailyExpense).toBe(100000);
      expect(result.totalExpense).toBe(1000000);
    });

    it("identifies VOLATILE spending when a large outlier spike occurs", () => {
      const now = new Date("2026-08-10T12:00:00Z"); // Day 10
      const txs: Transaction[] = [
        // 9 days of minimal 20,000 spend
        ...Array.from({ length: 9 }, (_, i) => ({
          id: `tx-${i + 1}`,
          user_id: "u1",
          amount: 20000,
          type: "expense" as const,
          wallet_id: null,
          to_wallet_id: null,
          category_id: null,
          note: "Small snack",
          occurred_on: `2026-08-${String(i + 1).padStart(2, "0")}`,
          created_at: "",
        })),
        // 1 day of massive 3,000,000 spend
        {
          id: "tx-spike",
          user_id: "u1",
          amount: 3000000,
          type: "expense",
          wallet_id: null,
          to_wallet_id: null,
          category_id: null,
          note: "Laptop purchase",
          occurred_on: "2026-08-10",
          created_at: "",
        },
      ];

      const result = calculateExpenseVolatility(txs, now);
      expect(result.status).toBe("sufficient");
      expect(result.stability).toBe("VOLATILE");
      expect(result.coefficientOfVariation).toBeGreaterThan(1.6);
      expect(result.peakDailyExpense).toBe(3000000);
      expect(result.peakDate).toBe("2026-08-10");
      expect(result.reason).toContain("fluctuated");
    });
  });

  describe("Dynamic Goal Milestones & Savings Velocity (Innovation 10)", () => {
    it("calculates 4-stage milestones and projected calendar completion dates", () => {
      const now = new Date("2026-09-01T00:00:00Z");
      const goal = {
        id: "goal-emergency",
        title: "Dana Darurat",
        targetAmount: 10000000, // 10 Million
        currentAmount: 3000000,  // 3 Million (30% progress)
      };
      const baselines = {
        medianNetCashflow: 1000000, // 1 Million / month velocity
      };

      const result = calculateDynamicGoalMilestones(goal, baselines, now);

      expect(result.currentProgressPct).toBe(30);
      expect(result.remainingAmount).toBe(7000000);
      expect(result.isAlreadyCompleted).toBe(false);

      // Milestone 1 (25% = 2.5M) -> Already reached!
      expect(result.milestones[0].percentage).toBe(25);
      expect(result.milestones[0].isReached).toBe(true);
      expect(result.milestones[0].projectedDate).toBe("Reached");

      // Milestone 2 (50% = 5M) -> Needs 2M more -> 2 months -> Nov 2026
      expect(result.milestones[1].percentage).toBe(50);
      expect(result.milestones[1].isReached).toBe(false);
      expect(result.milestones[1].monthsAway).toBe(2);
      expect(result.milestones[1].projectedDate).toBe("Nov 2026");

      // Milestone 4 (100% = 10M) -> Needs 7M more -> 7 months -> Apr 2027
      expect(result.milestones[3].percentage).toBe(100);
      expect(result.milestones[3].isReached).toBe(false);
      expect(result.milestones[3].monthsAway).toBe(7);
      expect(result.milestones[3].projectedDate).toBe("Apr 2027");

      // Velocity paces: current, conservative, accelerated
      expect(result.velocityPaces.current.monthly).toBe(1000000);
      expect(result.velocityPaces.current.months).toBe(7);
      expect(result.velocityPaces.current.projectedCompletion).toBe("Apr 2027");
      expect(result.velocityPaces.conservative.monthly).toBe(600000);
      expect(result.velocityPaces.accelerated.monthly).toBe(1400000);
    });
  });

  describe("Debt Payoff Simulator (Snowball vs Avalanche)", () => {
    const sampleDebts: DebtItem[] = [
      {
        id: "d1",
        name: "Credit Card A",
        balance: 10000000,
        minPayment: 500000,
        interestRate: 24, // High APR
      },
      {
        id: "d2",
        name: "PayLater B",
        balance: 2000000,
        minPayment: 200000,
        interestRate: 15, // Low balance
      },
      {
        id: "d3",
        name: "Personal Loan C",
        balance: 15000000,
        minPayment: 800000,
        interestRate: 10, // Moderate APR, large balance
      },
    ];

    it("handles empty debts safely", () => {
      const result = calculateDebtPayoffSchedule([], 0);
      expect(result.totalInitialDebt).toBe(0);
      expect(result.snowball.totalMonths).toBe(0);
      expect(result.avalanche.totalMonths).toBe(0);
      expect(result.interestSaved).toBe(0);
    });

    it("simulates snowball (smallest balance first) and avalanche (highest APR first)", () => {
      const result = calculateDebtPayoffSchedule(sampleDebts, 1000000); // +1M extra payment
      expect(result.totalInitialDebt).toBe(27000000);
      expect(result.totalMinPayment).toBe(1500000);

      // Both should eventually clear
      expect(result.snowball.totalMonths).toBeGreaterThan(0);
      expect(result.avalanche.totalMonths).toBeGreaterThan(0);
      expect(result.snowball.totalPaid).toBeGreaterThan(result.totalInitialDebt);
      expect(result.avalanche.totalPaid).toBeGreaterThan(result.totalInitialDebt);

      // Snowball clears smallest balance (PayLater B) first
      expect(result.snowball.debtPayoffOrder[0].name).toBe("PayLater B");

      // Avalanche clears highest APR (Credit Card A) first
      expect(result.avalanche.debtPayoffOrder[0].name).toBe("Credit Card A");

      // Avalanche should save interest compared to Snowball (or be equal)
      expect(result.avalanche.totalInterest).toBeLessThanOrEqual(result.snowball.totalInterest);
      expect(result.interestSaved).toBeGreaterThanOrEqual(0);
    });

    it("faster payoff with larger extra monthly payment", () => {
      const slow = calculateDebtPayoffSchedule(sampleDebts, 0);
      const fast = calculateDebtPayoffSchedule(sampleDebts, 2000000);
      expect(fast.snowball.totalMonths).toBeLessThan(slow.snowball.totalMonths);
      expect(fast.snowball.totalInterest).toBeLessThan(slow.snowball.totalInterest);
    });
  });

  describe("Multi-Currency Ledger Engine", () => {
    it("converts currency accurately using exchange rates", () => {
      // 15,850 IDR to USD
      const usdAmount = convertCurrency(15850, "IDR", "USD", DEFAULT_RATES);
      expect(usdAmount).toBeCloseTo(1.0, 2);

      // 100 USD to IDR
      const idrAmount = convertCurrency(100, "USD", "IDR", DEFAULT_RATES);
      expect(idrAmount).toBeCloseTo(1585000, -2);

      // Same currency conversion returns exact amount
      expect(convertCurrency(500000, "IDR", "IDR")).toBe(500000);
      expect(convertCurrency(0, "USD", "IDR")).toBe(0);
    });

    it("formats currency strings cleanly for IDR, USD, EUR, SGD, JPY", () => {
      expect(formatCurrencyAmount(1500000, "IDR")).toBe("Rp 1.500.000");
      expect(formatCurrencyAmount(125.5, "USD")).toBe("$125.50");
      expect(formatCurrencyAmount(99.9, "EUR", { showCode: true })).toBe("€99.90 EUR");
      expect(formatCurrencyAmount(5000, "JPY")).toBe("¥5,000");
    });
  });

  describe("Custom Budget Period (Payday Rhythm)", () => {
    it("handles Day 1 calendar month cycle", () => {
      const date = new Date(2026, 8, 15); // Sept 15, 2026
      const interval = getBudgetPeriodInterval(date, 1);
      expect(interval.startDay).toBe(1);
      expect(interval.startDate.getDate()).toBe(1);
      expect(interval.startDate.getMonth()).toBe(8); // Sept
      expect(interval.endDate.getDate()).toBe(30); // Sept has 30 days
      expect(interval.endDate.getMonth()).toBe(8);
      expect(interval.totalDays).toBe(30);
    });

    it("handles custom payday cycle when before payday (e.g. Sept 19 with payday 25)", () => {
      const date = new Date(2026, 8, 19); // Sept 19, 2026
      const interval = getBudgetPeriodInterval(date, 25);
      expect(interval.startDay).toBe(25);
      // Started Aug 25
      expect(interval.startDate.getMonth()).toBe(7); // Aug
      expect(interval.startDate.getDate()).toBe(25);
      // Ends Sept 24
      expect(interval.endDate.getMonth()).toBe(8); // Sept
      expect(interval.endDate.getDate()).toBe(24);
      expect(interval.label).toContain("25 Aug");
      expect(interval.label).toContain("24 Sep");
    });

    it("handles custom payday cycle when on or after payday (e.g. Sept 26 with payday 25)", () => {
      const date = new Date(2026, 8, 26); // Sept 26, 2026
      const interval = getBudgetPeriodInterval(date, 25);
      expect(interval.startDay).toBe(25);
      // Started Sept 25
      expect(interval.startDate.getMonth()).toBe(8); // Sept
      expect(interval.startDate.getDate()).toBe(25);
      // Ends Oct 24
      expect(interval.endDate.getMonth()).toBe(9); // Oct
      expect(interval.endDate.getDate()).toBe(24);
      expect(interval.label).toContain("25 Sep");
      expect(interval.label).toContain("24 Oct");
    });
  });

  describe("Action Center Insight & Fiduciary Intelligence", () => {
    it("returns adaptive 'AWAL SIKLUS' baseline when totalExpense is zero", () => {
      const insight = generateActionCenterInsight({
        totalExpense: 0,
        budget: 5000000,
        projectedMonthEnd: 0,
        projectedVariance: 0,
        budgetRisk: "SAFE",
        isAheadOfPace: false,
        paceDiff: 0,
        consumedPct: 0,
        timePct: 35,
        categoryShifts: [],
        safeToSpend: 10000000,
        unpaidBillsCount: 0,
        language: "id",
      });

      expect(insight.badge).toBe("AWAL SIKLUS");
      expect(insight.actionType).toBe("transactions");
      expect(insight.title).toContain("siap dicatat");
      expect(insight.title).not.toMatch(/\bAI\b/i);
    });

    it("returns English 'NEW CYCLE' baseline when totalExpense is zero with language 'en'", () => {
      const insight = generateActionCenterInsight({
        totalExpense: 0,
        budget: 0,
        projectedMonthEnd: 0,
        projectedVariance: 0,
        budgetRisk: "SAFE",
        isAheadOfPace: false,
        paceDiff: 0,
        consumedPct: 0,
        timePct: 10,
        categoryShifts: [],
        safeToSpend: 5000000,
        unpaidBillsCount: 0,
        language: "en",
      });

      expect(insight.badge).toBe("NEW CYCLE");
      expect(insight.actionType).toBe("transactions");
      expect(insight.title).toBe("Expense cycle ready for recording");
    });

    it("returns 'PANDUAN ANGGARAN' when user has spending but no budget ceiling configured", () => {
      const insight = generateActionCenterInsight({
        totalExpense: 750000,
        budget: 0,
        projectedMonthEnd: 2500000,
        projectedVariance: 0,
        budgetRisk: "SAFE",
        isAheadOfPace: false,
        paceDiff: 0,
        consumedPct: 0,
        timePct: 25,
        categoryShifts: [],
        safeToSpend: 4000000,
        unpaidBillsCount: 0,
        language: "id",
      });

      expect(insight.badge).toBe("PANDUAN ANGGARAN");
      expect(insight.actionType).toBe("budget");
      expect(insight.title).toContain("belum memiliki pagu anggaran");
    });

    it("prioritizes budget overrun risk when budget is set and risk is AT RISK", () => {
      const insight = generateActionCenterInsight({
        totalExpense: 4800000,
        budget: 5000000,
        projectedMonthEnd: 6200000,
        projectedVariance: 1200000,
        budgetRisk: "AT RISK",
        isAheadOfPace: true,
        paceDiff: 800000,
        consumedPct: 96,
        timePct: 50,
        categoryShifts: [],
        safeToSpend: 1500000,
        unpaidBillsCount: 1,
        language: "id",
      });

      expect(insight.type).toBe("projected_overrun");
      expect(insight.badge).toBe("RISIKO ANGGARAN");
      expect(insight.actionType).toBe("budget");
    });

    it("strictly ensures zero occurrences of 'AI' in any copy", () => {
      const insight = generateActionCenterInsight({
        totalExpense: 1000000,
        budget: 5000000,
        projectedMonthEnd: 4000000,
        projectedVariance: -1000000,
        budgetRisk: "SAFE",
        isAheadOfPace: false,
        paceDiff: -500000,
        consumedPct: 20,
        timePct: 40,
        categoryShifts: [],
        safeToSpend: 8000000,
        unpaidBillsCount: 0,
        language: "id",
      });

      const fullText = JSON.stringify(insight);
      expect(fullText).not.toMatch(/"[^"]*\bAI\b[^"]*"/);
    });
  });
});



