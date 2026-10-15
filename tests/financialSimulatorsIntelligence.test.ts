import { describe, it, expect } from "vitest";
import {
  runMonteCarloSimulation,
  calculateTimelineYears,
  calculateCashBufferRecommendation,
  calculateSavingsAccelerationLevers,
} from "../src/lib/monteCarloEngine";

describe("Financial Simulators Intelligence & SORR Playbook Suite", () => {
  describe("calculateTimelineYears", () => {
    it("returns 0 if capital already exceeds target", () => {
      expect(calculateTimelineYears(1000000000, 500000000, 5000000, 0.06)).toBe(0);
      expect(calculateTimelineYears(500000000, 500000000, 5000000, 0.06)).toBe(0);
    });

    it("returns accurate projection year with positive compound growth", () => {
      // 0 capital, 10m/mo savings (120m/yr), 6% real return, 1.25B target
      // Yr 1: (120) * 1.06 = 127.2m
      // ... reaches 1.25B in ~7-8 years
      const years = calculateTimelineYears(0, 1250000000, 10000000, 0.06);
      expect(years).toBeGreaterThan(5);
      expect(years).toBeLessThan(10);
    });

    it("returns null if savings are zero and return is zero or negative without reaching target", () => {
      expect(calculateTimelineYears(1000, 500000000, 0, 0)).toBeNull();
      expect(calculateTimelineYears(1000, 500000000, 0, -0.05)).toBeNull();
    });

    it("returns null if target is unreachable within 40 years horizon", () => {
      expect(calculateTimelineYears(1000, 1000000000000, 1000, 0.01)).toBeNull();
    });
  });

  describe("calculateCashBufferRecommendation", () => {
    it("calculates 18-24 months of cash cushion correctly", () => {
      const annualExpenses = 120000000; // 10m/mo
      const netWorth = 250000000;
      const buffer = calculateCashBufferRecommendation({
        annualExpenses,
        currentNetWorth: netWorth,
        language: "id",
      });

      expect(buffer.monthsMin).toBe(18);
      expect(buffer.monthsMax).toBe(24);
      expect(buffer.amountMin).toBe(180000000); // 10m * 18
      expect(buffer.amountMax).toBe(240000000); // 10m * 24
      expect(buffer.currentCoverageMonths).toBe(25); // 250m / 10m
      expect(buffer.adequacyStatus).toBe("Optimal");
      expect(buffer.recommendationText).toContain("Dana penyangga");
    });

    it("detects deficit when capital covers less than 12 months", () => {
      const buffer = calculateCashBufferRecommendation({
        annualExpenses: 120000000, // 10m/mo
        currentNetWorth: 50000000, // 5 months
        language: "en",
      });

      expect(buffer.adequacyStatus).toBe("Deficit");
      expect(buffer.currentCoverageMonths).toBe(5);
      expect(buffer.recommendationText).toContain("Buffer deficit");
    });
  });

  describe("calculateSavingsAccelerationLevers", () => {
    it("calculates +15%, +30% savings and -10% expenses acceleration levers", () => {
      const initialNetWorth = 50000000;
      const annualExpenses = 60000000; // 5m/mo
      const monthlyContribution = 5000000;
      const safeWithdrawalRate = 0.04;
      const netRealReturn = 0.06;

      const levers = calculateSavingsAccelerationLevers({
        initialNetWorth,
        annualExpenses,
        monthlyContribution,
        safeWithdrawalRate,
        netRealReturn,
      });

      // Standard target = 60m / 0.04 = 1.5B
      // Tier 15%
      expect(levers.tier15Pct.adjustedMonthlySavings).toBe(5750000);
      expect(levers.tier15Pct.monthlySavingsDiff).toBe(750000);
      expect(levers.tier15Pct.adjustedTimelineYears).toBeLessThanOrEqual(
        levers.baseTimelineYears ?? 40
      );

      // Tier 30%
      expect(levers.tier30Pct.adjustedMonthlySavings).toBe(6500000);
      expect(levers.tier30Pct.monthlySavingsDiff).toBe(1500000);
      expect(levers.tier30Pct.yearsSaved).toBeGreaterThanOrEqual(
        levers.tier15Pct.yearsSaved
      );

      // Expense Cut 10%
      expect(levers.expenseCut10Pct.reducedMonthlyBurn).toBe(4500000);
      expect(levers.expenseCut10Pct.fireTargetReduction).toBe(150000000); // 1.5B - 1.35B = 150m
      expect(levers.expenseCut10Pct.newFireTarget).toBe(1350000000);
      expect(levers.expenseCut10Pct.adjustedMonthlySavings).toBe(5500000); // 5m + 500k
    });
  });

  describe("runMonteCarloSimulation integration with SORR and Levers", () => {
    it("includes cashBufferRecommendation and savingsAccelerationLevers in result", () => {
      const result = runMonteCarloSimulation({
        initialNetWorth: 100000000,
        monthlyContribution: 5000000,
        annualExpenses: 60000000,
        years: 15,
        language: "id",
      });

      expect(result.cashBufferRecommendation).toBeDefined();
      expect(result.cashBufferRecommendation.monthsMin).toBe(18);
      expect(result.cashBufferRecommendation.monthsMax).toBe(24);
      expect(result.savingsAccelerationLevers).toBeDefined();
      expect(result.savingsAccelerationLevers.tier15Pct.yearsSaved).toBeGreaterThanOrEqual(0);
      expect(result.insights.length).toBeGreaterThan(0);
    });

    it("evaluates early market shock (-25% Year 1) impact on SORR", () => {
      const unshocked = runMonteCarloSimulation({
        initialNetWorth: 200000000,
        monthlyContribution: 10000000,
        annualExpenses: 80000000,
        years: 15,
        earlyShock: false,
      });

      const shocked = runMonteCarloSimulation({
        initialNetWorth: 200000000,
        monthlyContribution: 10000000,
        annualExpenses: 80000000,
        years: 15,
        earlyShock: true,
      });

      expect(shocked.sequenceOfReturnsImpact).not.toBeNull();
      if (shocked.sequenceOfReturnsImpact) {
        expect(shocked.sequenceOfReturnsImpact.terminalPercentageLoss).toBeGreaterThan(0);
      }
    });
  });
});
