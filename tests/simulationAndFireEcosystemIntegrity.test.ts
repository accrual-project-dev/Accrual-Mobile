import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  calculateWhatIfScenario,
  type WhatIfScenarioType,
} from "../src/lib/financialMath";
import {
  runMonteCarloSimulation,
  calculateTimelineYears,
  calculateCashBufferRecommendation,
  calculateSavingsAccelerationLevers,
} from "../src/lib/monteCarloEngine";

describe("Simulation & FIRE Retirement Ecosystem Integrity Suite (Audit #27)", () => {
  const rootDir = path.resolve(__dirname, "..");

  describe("1. What-If Financial Scenario Engine", () => {
    it("accurately computes expense_cut scenario", () => {
      const result = calculateWhatIfScenario({
        monthlyIncome: 15000000,
        monthlyExpense: 10000000,
        type: "expense_cut",
        value: 2000000,
      });

      expect(result.adjustedMonthlyIncome).toBe(15000000);
      expect(result.adjustedMonthlyExpense).toBe(8000000);
      expect(result.monthlyDifference).toBe(2000000);
      expect(result.annualDifference).toBe(24000000);
      expect(result.remainingFreeCashAfterSavings).toBe(7000000);
      expect(result.isOvercommitted).toBe(false);
    });

    it("accurately computes income_boost scenario", () => {
      const result = calculateWhatIfScenario({
        monthlyIncome: 12000000,
        monthlyExpense: 8000000,
        type: "income_boost",
        value: 3000000,
      });

      expect(result.adjustedMonthlyIncome).toBe(15000000);
      expect(result.adjustedMonthlyExpense).toBe(8000000);
      expect(result.monthlyDifference).toBe(3000000);
      expect(result.annualDifference).toBe(36000000);
      expect(result.remainingFreeCashAfterSavings).toBe(7000000);
      expect(result.isOvercommitted).toBe(false);
    });

    it("accurately computes expense_change_pct inflation and deflation shocks", () => {
      // 20% lifestyle inflation shock
      const shockUp = calculateWhatIfScenario({
        monthlyIncome: 10000000,
        monthlyExpense: 8000000,
        type: "expense_change_pct",
        value: 20,
      });

      expect(shockUp.adjustedMonthlyExpense).toBe(9600000);
      expect(shockUp.monthlyDifference).toBe(-1600000);
      expect(shockUp.annualDifference).toBe(-19200000);
      expect(shockUp.remainingFreeCashAfterSavings).toBe(400000);
      expect(shockUp.isOvercommitted).toBe(false);

      // Deficit overcommitment test (>100% expense surge)
      const shockExtreme = calculateWhatIfScenario({
        monthlyIncome: 10000000,
        monthlyExpense: 8000000,
        type: "expense_change_pct",
        value: 50,
      });

      expect(shockExtreme.adjustedMonthlyExpense).toBe(12000000);
      expect(shockExtreme.remainingFreeCashAfterSavings).toBe(-2000000);
      expect(shockExtreme.isOvercommitted).toBe(true);
    });

    it("accurately computes saving_plan commitment scenario", () => {
      const plan = calculateWhatIfScenario({
        monthlyIncome: 15000000,
        monthlyExpense: 9000000,
        type: "saving_plan",
        value: 4000000,
      });

      expect(plan.suggestedMonthlySavings).toBe(4000000);
      expect(plan.remainingFreeCashAfterSavings).toBe(2000000);
      expect(plan.isOvercommitted).toBe(false);

      // Overcommitted savings plan exceeding retained cash
      const excessivePlan = calculateWhatIfScenario({
        monthlyIncome: 15000000,
        monthlyExpense: 9000000,
        type: "saving_plan",
        value: 8000000,
      });

      expect(excessivePlan.remainingFreeCashAfterSavings).toBe(-2000000);
      expect(excessivePlan.isOvercommitted).toBe(true);
    });
  });

  describe("2. Monte Carlo & FIRE Stochastic Engine", () => {
    it("ensures monotonic percentile ordering P10 <= P25 <= P50 <= P75 <= P90 across simulation", () => {
      const sim = runMonteCarloSimulation({
        initialNetWorth: 100000000,
        monthlyContribution: 5000000,
        annualExpenses: 60000000,
        years: 10,
        iterations: 300,
        language: "id",
      });

      expect(sim.yearlyTrajectory.length).toBe(11);
      sim.yearlyTrajectory.forEach((pt) => {
        expect(pt.p10).toBeLessThanOrEqual(pt.p25);
        expect(pt.p25).toBeLessThanOrEqual(pt.p50);
        expect(pt.p50).toBeLessThanOrEqual(pt.p75);
        expect(pt.p75).toBeLessThanOrEqual(pt.p90);
      });
      expect(sim.terminalValues.p10).toBeLessThanOrEqual(sim.terminalValues.p50);
      expect(sim.terminalValues.p50).toBeLessThanOrEqual(sim.terminalValues.p90);
    });

    it("computes accurate FIRE target milestones (Standard 25x, Lean 70%, Fat 140%, Coast)", () => {
      const annualBurn = 120000000; // 10M/month -> Standard FIRE = 120M / 0.04 = 3B
      const sim = runMonteCarloSimulation({
        initialNetWorth: 500000000,
        monthlyContribution: 10000000,
        annualExpenses: annualBurn,
        safeWithdrawalRate: 0.04,
        years: 15,
        iterations: 150,
      });

      const standardTarget = 3000000000;
      expect(sim.fireMilestones.standard.targetAmount).toBe(standardTarget);
      expect(sim.fireMilestones.lean.targetAmount).toBe(Math.round(standardTarget * 0.7));
      expect(sim.fireMilestones.fat.targetAmount).toBe(Math.round(standardTarget * 1.4));
      expect(sim.fireMilestones.coast.targetAmount).toBeGreaterThan(0);
      expect(sim.fireMilestones.coast.targetAmount).toBeLessThan(standardTarget);
    });

    it("evaluates Sequence of Returns Risk shock differential", () => {
      const baseConfig = {
        initialNetWorth: 200000000,
        monthlyContribution: 8000000,
        annualExpenses: 72000000,
        years: 10,
        iterations: 500,
      };

      const shockedSim = runMonteCarloSimulation({
        ...baseConfig,
        earlyShock: true,
      });

      expect(shockedSim.sequenceOfReturnsImpact).not.toBeNull();
      if (shockedSim.sequenceOfReturnsImpact) {
        expect(shockedSim.sequenceOfReturnsImpact.terminalDifference).toBeGreaterThanOrEqual(0);
        expect(shockedSim.sequenceOfReturnsImpact.terminalPercentageLoss).toBeGreaterThanOrEqual(0);
      }
    });

    it("correctly generates 100% pure Indonesian and English insights without mixed terminology", () => {
      const simId = runMonteCarloSimulation({
        initialNetWorth: 100000000,
        monthlyContribution: 5000000,
        annualExpenses: 60000000,
        years: 10,
        iterations: 150,
        language: "id",
      });

      const simEn = runMonteCarloSimulation({
        initialNetWorth: 100000000,
        monthlyContribution: 5000000,
        annualExpenses: 60000000,
        years: 10,
        iterations: 150,
        language: "en",
      });

      expect(simId.insights.length).toBeGreaterThan(0);
      expect(simEn.insights.length).toBeGreaterThan(0);

      // Verify no untranslated english parentheticals inside Indonesian insights
      simId.insights.forEach((txt) => {
        expect(txt).not.toContain("(SORR)");
        expect(txt).not.toContain("(Cash Cushion)");
      });

      // Verify milestone descriptions
      expect(simId.fireMilestones.fat.description).not.toContain("buffer");
      expect(simId.cashBufferRecommendation.recommendationText).not.toContain("(SORR)");
    });
  });

  describe("3. Liquid Cash Buffer & Acceleration Levers Engine", () => {
    it("computes 18-24 months liquid cash buffer adequacy", () => {
      const annualBurn = 120000000; // 10M/month -> 18 months = 180M, 24 months = 240M

      const optimal = calculateCashBufferRecommendation({
        annualExpenses: annualBurn,
        currentNetWorth: 300000000, // 30 months
        language: "id",
      });
      expect(optimal.amountMin).toBe(180000000);
      expect(optimal.amountMax).toBe(240000000);
      expect(optimal.adequacyStatus).toBe("Optimal");
      expect(optimal.currentCoverageMonths).toBe(30);

      const adequate = calculateCashBufferRecommendation({
        annualExpenses: annualBurn,
        currentNetWorth: 150000000, // 15 months
        language: "id",
      });
      expect(adequate.adequacyStatus).toBe("Adequate");

      const deficit = calculateCashBufferRecommendation({
        annualExpenses: annualBurn,
        currentNetWorth: 50000000, // 5 months
        language: "id",
      });
      expect(deficit.adequacyStatus).toBe("Deficit");
    });

    it("evaluates savings acceleration levers (+15%, +30%, -10% burn cut)", () => {
      const levers = calculateSavingsAccelerationLevers({
        initialNetWorth: 50000000,
        annualExpenses: 60000000,
        monthlyContribution: 4000000,
        safeWithdrawalRate: 0.04,
        netRealReturn: 0.06,
      });

      expect(levers.tier15Pct.adjustedMonthlySavings).toBe(4600000);
      expect(levers.tier30Pct.adjustedMonthlySavings).toBe(5200000);
      expect(levers.expenseCut10Pct.reducedMonthlyBurn).toBe(4500000);
      expect(levers.expenseCut10Pct.fireTargetReduction).toBe(150000000); // 1.5B down to 1.35B
    });

    it("evaluates calculateTimelineYears compound projection", () => {
      // Starting from 0 to 100M with 2M monthly savings at 6% return
      const years = calculateTimelineYears(0, 100000000, 2000000, 0.06);
      expect(years).toBeGreaterThan(0);
      expect(years).toBeLessThan(10);

      // Already achieved
      const zeroYears = calculateTimelineYears(100000000, 100000000, 2000000, 0.06);
      expect(zeroYears).toBe(0);
    });
  });

  describe("4. Component Architectural & Styling Invariant Checks", () => {
    const files = [
      "src/components/home/WhatIfSimulatorSheet.tsx",
      "src/components/home/WhatIfSimulatorCard.tsx",
      "src/components/statistics/MonteCarloSimulatorSheet.tsx",
      "src/components/statistics/MonteCarloCard.tsx",
      "src/components/statistics/FirePlannerSheet.tsx",
      "src/components/statistics/FirePlannerCard.tsx",
    ];

    it("enforces zero native system colored emojis across all simulation components", () => {
      const emojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/u;

      files.forEach((rel) => {
        const fullPath = path.join(rootDir, rel);
        const code = fs.readFileSync(fullPath, "utf-8");
        expect(code, `Emoji found in ${rel}`).not.toMatch(emojiRegex);
      });
    });

    it("enforces zero vibrant utility color classes in UI controls and modals", () => {
      const vibrantColorRegex = /text-(emerald|amber|blue|purple|orange|yellow|rose|cyan|indigo)-\d{3}|bg-(emerald|amber|blue|purple|orange|yellow|rose|cyan|indigo)-\d{3}/;

      files.forEach((rel) => {
        const fullPath = path.join(rootDir, rel);
        const code = fs.readFileSync(fullPath, "utf-8");
        expect(code, `Vibrant color found in ${rel}`).not.toMatch(vibrantColorRegex);
      });
    });

    it("enforces no artificial height caps (max-h-[55vh], etc.) inside bottom sheets", () => {
      const sheetFiles = [
        "src/components/home/WhatIfSimulatorSheet.tsx",
        "src/components/statistics/MonteCarloSimulatorSheet.tsx",
        "src/components/statistics/FirePlannerSheet.tsx",
      ];

      const artificialCapRegex = /max-h-\[(5[0-9]vh|60vh|3[0-9]{2}px)\]/;

      sheetFiles.forEach((rel) => {
        const fullPath = path.join(rootDir, rel);
        const code = fs.readFileSync(fullPath, "utf-8");
        expect(code, `Artificial max-h cap found in ${rel}`).not.toMatch(artificialCapRegex);
      });
    });

    it("enforces dynamic iOS home indicator safe area inset across all simulation bottom sheets", () => {
      const sheetFiles = [
        "src/components/home/WhatIfSimulatorSheet.tsx",
        "src/components/statistics/MonteCarloSimulatorSheet.tsx",
        "src/components/statistics/FirePlannerSheet.tsx",
      ];

      sheetFiles.forEach((rel) => {
        const fullPath = path.join(rootDir, rel);
        const code = fs.readFileSync(fullPath, "utf-8");
        expect(
          code.includes("env(safe-area-inset-bottom") || code.includes("safe-area-bottom"),
          `Missing safe area inset in ${rel}`
        ).toBe(true);
      });
    });
  });
});
