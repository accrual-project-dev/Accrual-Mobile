import { describe, it, expect } from "vitest";
import {
  calculateEmergencyFundCushion,
  calculateDtiRatio,
  calculateAssetDiversification,
  calculateFinancialHealthDiagnostic,
} from "../src/lib/financialMath";

describe("Audit #41: Financial Health Diagnostic & Wealth Milestones Workstation Suite", () => {
  describe("1. Emergency Fund Cushion (calculateEmergencyFundCushion)", () => {
    it("classifies >= 6.0 months as FORTRESS buffer with pure Indonesian localization", () => {
      const res = calculateEmergencyFundCushion(120_000_000, 15_000_000, true);
      expect(res.months).toBe(8.0);
      expect(res.tier).toBe("FORTRESS");
      expect(res.badgeLabel).toBe("BENTENG MODAL (≥6 BLN)");
      expect(res.verdict).toContain("sangat kokoh");
      expect(res.verdict).not.toMatch(/buffer|runway|months/i);
    });

    it("classifies >= 6.0 months as FORTRESS buffer with pure English localization", () => {
      const res = calculateEmergencyFundCushion(60_000_000, 10_000_000, false);
      expect(res.months).toBe(6.0);
      expect(res.tier).toBe("FORTRESS");
      expect(res.badgeLabel).toBe("FORTRESS BUFFER (≥6 MO)");
      expect(res.verdict).toContain("exceptionally resilient");
    });

    it("classifies 3.0 to 5.9 months as HEALTHY buffer", () => {
      const resId = calculateEmergencyFundCushion(45_000_000, 10_000_000, true);
      expect(resId.months).toBe(4.5);
      expect(resId.tier).toBe("HEALTHY");
      expect(resId.badgeLabel).toBe("BANTALAN SEHAT (3–6 BLN)");

      const resEn = calculateEmergencyFundCushion(35_000_000, 10_000_000, false);
      expect(resEn.months).toBe(3.5);
      expect(resEn.tier).toBe("HEALTHY");
      expect(resEn.badgeLabel).toBe("HEALTHY BUFFER (3–6 MO)");
    });

    it("classifies 1.0 to 2.9 months as MODERATE buffer", () => {
      const res = calculateEmergencyFundCushion(20_000_000, 10_000_000, true);
      expect(res.months).toBe(2.0);
      expect(res.tier).toBe("MODERATE");
      expect(res.badgeLabel).toBe("BANTALAN CUKUP (1–3 BLN)");
    });

    it("classifies < 1.0 month as CRITICAL buffer", () => {
      const res = calculateEmergencyFundCushion(4_000_000, 10_000_000, true);
      expect(res.months).toBe(0.4);
      expect(res.tier).toBe("CRITICAL");
      expect(res.badgeLabel).toBe("BANTALAN KRITAS (<1 BLN)".replace("KRITAS", "KRITIS"));
    });

    it("handles zero burn rate and negative liquid assets gracefully without crashing", () => {
      const zeroBurn = calculateEmergencyFundCushion(50_000_000, 0, true);
      expect(zeroBurn.months).toBeGreaterThan(0);
      expect(isFinite(zeroBurn.months)).toBe(true);

      const negLiquid = calculateEmergencyFundCushion(-10_000_000, 10_000_000, true);
      expect(negLiquid.months).toBe(0);
      expect(negLiquid.tier).toBe("CRITICAL");
    });
  });

  describe("2. Debt-to-Income (DTI) Ratio (calculateDtiRatio)", () => {
    it("returns DEBT_FREE when monthly debt service is zero", () => {
      const resId = calculateDtiRatio(0, 25_000_000, true);
      expect(resId.ratioPct).toBe(0);
      expect(resId.tier).toBe("DEBT_FREE");
      expect(resId.badgeLabel).toBe("BEBAS UTANG (0%)");
      expect(resId.verdict).toContain("100% bebas dari beban cicilan");

      const resEn = calculateDtiRatio(0, 25_000_000, false);
      expect(resEn.ratioPct).toBe(0);
      expect(resEn.tier).toBe("DEBT_FREE");
      expect(resEn.badgeLabel).toBe("DEBT FREE (0%)");
      expect(resEn.verdict).toContain("100% unencumbered");
    });

    it("evaluates conservative leverage (<= 20%)", () => {
      const res = calculateDtiRatio(3_000_000, 20_000_000, true);
      expect(res.ratioPct).toBe(15.0);
      expect(res.tier).toBe("CONSERVATIVE");
      expect(res.badgeLabel).toBe("KONSERVATIF (≤20%)");
    });

    it("evaluates manageable leverage (21% to 36%)", () => {
      const res = calculateDtiRatio(6_000_000, 20_000_000, true);
      expect(res.ratioPct).toBe(30.0);
      expect(res.tier).toBe("MANAGEABLE");
      expect(res.badgeLabel).toBe("TERKENDALI (20–36%)");
    });

    it("evaluates elevated leverage (37% to 50%)", () => {
      const res = calculateDtiRatio(8_000_000, 20_000_000, true);
      expect(res.ratioPct).toBe(40.0);
      expect(res.tier).toBe("ELEVATED");
      expect(res.badgeLabel).toBe("BEBAN TINGGI (36–50%)");
    });

    it("evaluates critical debt burden (> 50%)", () => {
      const res = calculateDtiRatio(12_000_000, 20_000_000, true);
      expect(res.ratioPct).toBe(60.0);
      expect(res.tier).toBe("CRITICAL");
      expect(res.badgeLabel).toBe("BEBAN KRITIS (>50%)");
    });

    it("handles zero income with outstanding debt as critical", () => {
      const res = calculateDtiRatio(2_500_000, 0, true);
      expect(res.ratioPct).toBe(100);
      expect(res.tier).toBe("CRITICAL");
    });
  });

  describe("3. Capital Diversification & HHI Metric (calculateAssetDiversification)", () => {
    it("recognizes single depository concentration (< 35 score)", () => {
      const res = calculateAssetDiversification([100_000_000], true);
      expect(res.score).toBeLessThanOrEqual(25);
      expect(res.tier).toBe("CONCENTRATED");
      expect(res.badgeLabel).toBe("TERKONSENTRASI (<35)");
    });

    it("recognizes moderate diversification across 2 balanced accounts", () => {
      const res = calculateAssetDiversification([50_000_000, 50_000_000], true);
      expect(res.score).toBe(50);
      expect(res.tier).toBe("MODERATE");
      expect(res.badgeLabel).toBe("MODERAT (35–64)");
    });

    it("recognizes optimal diversification across 4 balanced accounts (score >= 65)", () => {
      const resId = calculateAssetDiversification([25_000_000, 25_000_000, 25_000_000, 25_000_000], true);
      expect(resId.score).toBe(75);
      expect(resId.tier).toBe("OPTIMAL");
      expect(resId.badgeLabel).toBe("TERDIVERSIFIKASI (≥65)");

      const resEn = calculateAssetDiversification([25_000_000, 25_000_000, 25_000_000, 25_000_000], false);
      expect(resEn.score).toBe(75);
      expect(resEn.tier).toBe("OPTIMAL");
      expect(resEn.badgeLabel).toBe("OPTIMAL SPREAD (≥65)");
    });

    it("handles zero or negative balances safely", () => {
      const res = calculateAssetDiversification([0, -500_000], true);
      expect(res.score).toBe(0);
      expect(res.tier).toBe("CONCENTRATED");
    });
  });

  describe("4. Comprehensive Financial Health Diagnostic (calculateFinancialHealthDiagnostic)", () => {
    it("handles zero-data foundation calibration mode properly", () => {
      const diag = calculateFinancialHealthDiagnostic({
        healthScore: 75,
        savingsRate: 0,
        totalIncome: 0,
        totalExpense: 0,
        isIndonesian: true,
      });

      expect(diag.isZeroData).toBe(true);
      expect(diag.rating).toBe("—");
      expect(diag.statusTitle).toBe("Kalibrasi Metrik Modal");
      expect(diag.operatingMarginText).toBe("0.0%");
    });

    it("assigns AAA rating for elite savings rate and health score", () => {
      const diag = calculateFinancialHealthDiagnostic({
        healthScore: 92,
        savingsRate: 42,
        totalIncome: 50_000_000,
        totalExpense: 20_000_000,
        liquidAssets: 150_000_000,
        monthlyDebtService: 0,
        walletBalances: [50_000_000, 50_000_000, 50_000_000],
        isIndonesian: true,
      });

      expect(diag.isZeroData).toBe(false);
      expect(diag.rating).toBe("AAA");
      expect(diag.statusTitle).toBe("Retensi Modal Luar Biasa");
      expect(diag.emergencyCushion.tier).toBe("FORTRESS");
      expect(diag.dti.tier).toBe("DEBT_FREE");
      expect(diag.diversification.tier).toBe("OPTIMAL");
      expect(diag.strategicDirectives.length).toBeGreaterThanOrEqual(3);
    });

    it("dynamically recommends emergency cushion growth when runway is < 3 months", () => {
      const diag = calculateFinancialHealthDiagnostic({
        healthScore: 65,
        savingsRate: 15,
        totalIncome: 20_000_000,
        totalExpense: 17_000_000,
        liquidAssets: 20_000_000, // ~1.2 months
        monthlyDebtService: 0,
        isIndonesian: true,
      });

      const bufferDirective = diag.strategicDirectives.find((d) =>
        d.title.includes("Dana Darurat") || d.title.includes("Emergency")
      );
      expect(bufferDirective).toBeDefined();
    });

    it("dynamically recommends debt reduction when DTI is elevated (> 36%)", () => {
      const diag = calculateFinancialHealthDiagnostic({
        healthScore: 50,
        savingsRate: 10,
        totalIncome: 20_000_000,
        totalExpense: 18_000_000,
        liquidAssets: 80_000_000, // Cushion is high, but DTI is high
        monthlyDebtService: 8_500_000, // DTI 42.5%
        isIndonesian: true,
      });

      const debtDirective = diag.strategicDirectives.find((d) =>
        d.title.includes("Utang") || d.title.includes("Debt")
      );
      expect(debtDirective).toBeDefined();
      expect(debtDirective?.body).toContain("Snowball");
    });

    it("maintains strict non-mixed localization across English and Indonesian", () => {
      const diagId = calculateFinancialHealthDiagnostic({
        healthScore: 80,
        savingsRate: 25,
        totalIncome: 30_000_000,
        totalExpense: 22_500_000,
        isIndonesian: true,
      });

      expect(diagId.statusTitle).not.toMatch(/stable|flow|operating/i);
      expect(diagId.statusVerdict).not.toMatch(/cashflow|margin|buffer/i);

      const diagEn = calculateFinancialHealthDiagnostic({
        healthScore: 80,
        savingsRate: 25,
        totalIncome: 30_000_000,
        totalExpense: 22_500_000,
        isIndonesian: false,
      });

      expect(diagEn.statusTitle).not.toMatch(/arus|operasional|stabil/i);
      expect(diagEn.statusVerdict).not.toMatch(/pemasukan|pengeluaran|cadangan/i);
    });
  });
});
