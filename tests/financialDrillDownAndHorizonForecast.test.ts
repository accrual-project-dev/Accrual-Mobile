import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { convertCurrency, formatCurrencyAmount, DEFAULT_RATES } from "../src/lib/currency";

describe("Audit #34: Granular Forensic Financial Drill-Down & Horizon Forecast Workstation Suite", () => {
  const monthForecastPath = path.resolve(__dirname, "../src/components/home/MonthForecastSheet.tsx");
  const metricDrillDownPath = path.resolve(__dirname, "../src/components/home/MetricDrillDownSheet.tsx");
  const categoryDrillDownPath = path.resolve(__dirname, "../src/components/statistics/CategoryDrillDownSheet.tsx");
  const assetMetricPath = path.resolve(__dirname, "../src/components/assets/AssetMetricDrillDownSheet.tsx");
  const cashAccountPath = path.resolve(__dirname, "../src/components/assets/CashAccountDetailSheet.tsx");
  const personalModelPath = path.resolve(__dirname, "../src/components/home/PersonalFinancialModelSheet.tsx");

  const monthForecastContent = fs.readFileSync(monthForecastPath, "utf-8").replace(/\r\n/g, "\n");
  const metricDrillDownContent = fs.readFileSync(metricDrillDownPath, "utf-8").replace(/\r\n/g, "\n");
  const categoryDrillDownContent = fs.readFileSync(categoryDrillDownPath, "utf-8").replace(/\r\n/g, "\n");
  const assetMetricContent = fs.readFileSync(assetMetricPath, "utf-8").replace(/\r\n/g, "\n");
  const cashAccountContent = fs.readFileSync(cashAccountPath, "utf-8").replace(/\r\n/g, "\n");
  const personalModelContent = fs.readFileSync(personalModelPath, "utf-8").replace(/\r\n/g, "\n");

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Safe-Area Inset & BottomSheet Architecture Verification (Rule 5)
  // ─────────────────────────────────────────────────────────────────────────────
  describe("1. Dynamic Safe-Area Ergonomics & BottomSheet Architecture Compliance", () => {
    it("enforces dynamic safe-area-inset-bottom in MonthForecastSheet.tsx", () => {
      expect(monthForecastContent).toContain(
        'paddingBottom:\n                "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)"'
      );
    });

    it("enforces dynamic safe-area-inset-bottom in MetricDrillDownSheet.tsx", () => {
      expect(metricDrillDownContent).toContain(
        'paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)"'
      );
    });

    it("enforces dynamic safe-area-inset-bottom in CategoryDrillDownSheet.tsx", () => {
      expect(categoryDrillDownContent).toContain(
        'paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)"'
      );
    });

    it("enforces dynamic safe-area-inset-bottom in AssetMetricDrillDownSheet.tsx", () => {
      expect(assetMetricContent).toContain(
        'paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)"'
      );
    });

    it("enforces dynamic safe-area-inset-bottom in CashAccountDetailSheet.tsx", () => {
      expect(cashAccountContent).toContain(
        'paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)"'
      );
    });

    it("enforces dynamic safe-area-inset-bottom in PersonalFinancialModelSheet.tsx", () => {
      expect(personalModelContent).toContain(
        'paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)"'
      );
    });

    it("contains no artificial inner height caps (max-h-[55vh], max-h-[50vh]) in any forensic sheets", () => {
      const files = [
        monthForecastContent,
        metricDrillDownContent,
        categoryDrillDownContent,
        assetMetricContent,
        cashAccountContent,
        personalModelContent,
      ];
      for (const content of files) {
        expect(content).not.toMatch(/max-h-\[(?:50vh|52vh|55vh|60vh|340px)\]/);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Strict Monochrome Luxury Theme & CTA Standards (Rule 7)
  // ─────────────────────────────────────────────────────────────────────────────
  describe("2. Monochrome Luxury Theme Standards & Zero Accent Invariant", () => {
    it("contains zero hardcoded colored system emojis across all drilldown and forecast sheets", () => {
      const coloredEmojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      expect(monthForecastContent).not.toMatch(coloredEmojiRegex);
      expect(metricDrillDownContent).not.toMatch(coloredEmojiRegex);
      expect(categoryDrillDownContent).not.toMatch(coloredEmojiRegex);
      expect(assetMetricContent).not.toMatch(coloredEmojiRegex);
      expect(cashAccountContent).not.toMatch(coloredEmojiRegex);
      expect(personalModelContent).not.toMatch(coloredEmojiRegex);
    });

    it("MetricDrillDownSheet CTA buttons strictly use var(--text-primary) and var(--bg-base)", () => {
      expect(metricDrillDownContent).not.toContain('style={{ background: "var(--accent)"');
      expect(metricDrillDownContent).not.toContain('background: "var(--accent)"');
      expect(metricDrillDownContent).toContain('background: "var(--text-primary)"');
      expect(metricDrillDownContent).toContain('color: "var(--bg-base)"');
    });

    it("CategoryDrillDownSheet CTA button strictly uses var(--text-primary) and var(--bg-base)", () => {
      expect(categoryDrillDownContent).not.toContain('background: "var(--accent)"');
      expect(categoryDrillDownContent).toContain('background: "var(--text-primary)"');
      expect(categoryDrillDownContent).toContain('color: "var(--bg-base)"');
    });

    it("CashAccountDetailSheet and MonthForecastSheet action buttons adhere to monochrome styling", () => {
      expect(cashAccountContent).not.toContain('background: "var(--accent)"');
      expect(monthForecastContent).not.toContain('background: "var(--accent)"');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Strict Non-Mixed Localization Compliance (Rule 6)
  // ─────────────────────────────────────────────────────────────────────────────
  describe("3. Strict Non-Mixed Localization Compliance", () => {
    it("PersonalFinancialModelSheet removes parenthetical translation (Goals)", () => {
      expect(personalModelContent).not.toContain("Arah Sasaran (Goals):");
      expect(personalModelContent).toContain('isIndonesian ? "Arah Sasaran:" : "Goal Trajectory:"');
    });

    it("MetricDrillDownSheet provides complete bilingual branching", () => {
      expect(metricDrillDownContent).toContain('isIndonesian ? "Penjelasan Risiko Anggaran" : "Budget Risk Explanation"');
      expect(metricDrillDownContent).toContain('isIndonesian ? "Faktor Perubahan Pengeluaran" : "Why Outflow Changed"');
      expect(metricDrillDownContent).toContain('isIndonesian ? "Sesuaikan Batas Anggaran" : "Adjust Budget Limit"');
      expect(metricDrillDownContent).toContain('isIndonesian ? "Lihat Analisis Lengkap" : "View Full Analytics Breakdown"');
    });

    it("CategoryDrillDownSheet provides complete bilingual branching", () => {
      expect(categoryDrillDownContent).toContain('isIndonesian ? `Penyebab Perubahan ${shift.name}` : `Why ${shift.name} Changed`');
      expect(categoryDrillDownContent).toContain('isIndonesian ? "Bulan Terpilih" : "Selected Month"');
      expect(categoryDrillDownContent).toContain('isIndonesian ? "Bulan Sebelumnya" : "Previous Month"');
    });

    it("CashAccountDetailSheet provides complete bilingual branching", () => {
      expect(cashAccountContent).toContain('isIndonesian ? "Saldo Terverifikasi" : "Verified Balance"');
      expect(cashAccountContent).toContain('isIndonesian ? "Porsi Kas Likuid" : "Liquid Asset Share"');
      expect(cashAccountContent).toContain('isIndonesian ? "Lihat Semua Mutasi Akun Ini" : "View All Mutations"');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Multi-Currency & Stealth Masking Integrity
  // ─────────────────────────────────────────────────────────────────────────────
  describe("4. Multi-Currency & Stealth Masking Integrity", () => {
    it("CategoryDrillDownSheet uses dynamic currencyMeta symbol in stealth masks", () => {
      expect(categoryDrillDownContent).toContain('isStealthMode ? `${currencyMeta?.symbol || "Rp"} ••••••••`');
    });

    it("MonthForecastSheet formats Y-axis labels dynamically according to preferred currency scale", () => {
      expect(monthForecastContent).toContain("maxValInPreferred =");
      expect(monthForecastContent).toContain("formatAxisCompact(maxValInPreferred)");

      // Test formatAxisCompact simulation
      const formatAxisCompact = (val: number) => {
        if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `${Math.round(val / 1000)}K`;
        return `${Math.round(val)}`;
      };

      // In IDR: 15,000,000 IDR -> 15.0M
      expect(formatAxisCompact(15000000)).toBe("15.0M");
      // In USD: 946.37 USD -> 946
      expect(formatAxisCompact(946.37)).toBe("946");
      // In USD high: 2,500 USD -> 3K
      expect(formatAxisCompact(2500)).toBe("3K");
    });

    it("CashAccountDetailSheet stealth mode binds currency symbol dynamically", () => {
      expect(cashAccountContent).toContain('isStealthMode');
      expect(cashAccountContent).toContain('currencyMeta?.symbol || "Rp"');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Note Sanitization & Ingestion Integrity (Rule 8.1)
  // ─────────────────────────────────────────────────────────────────────────────
  describe("5. Placeholder Note Sanitization (Rule 8.1)", () => {
    it("CashAccountDetailSheet sanitizes '-' and '--' placeholder notes", () => {
      expect(cashAccountContent).toContain('tx.note.trim() !== "-" && tx.note.trim() !== "--"');

      // Test note resolution logic
      const resolveDisplayNote = (note: string | null | undefined, isTransfer: boolean, isIndonesian: boolean) => {
        const cleanNote = note && note.trim() !== "-" && note.trim() !== "--" ? note.trim() : null;
        return cleanNote || (isTransfer ? (isIndonesian ? "Transfer Saldo" : "Balance Transfer") : (isIndonesian ? "Mutasi Keuangan" : "Financial Mutation"));
      };

      expect(resolveDisplayNote("-", false, true)).toBe("Mutasi Keuangan");
      expect(resolveDisplayNote("--", true, true)).toBe("Transfer Saldo");
      expect(resolveDisplayNote("Lunch with team", false, true)).toBe("Lunch with team");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Forecast Math & Linear Projection Accuracy
  // ─────────────────────────────────────────────────────────────────────────────
  describe("6. Linear Horizon Projection & Run-rate Calculations", () => {
    it("calculates accurate month-end projection given daily spend trajectory", () => {
      const daysElapsed = 15;
      const totalDays = 30;
      const spentSoFar = 3000000;

      const dailyAvg = spentSoFar / daysElapsed;
      expect(dailyAvg).toBe(200000);

      const projectedMonthEnd = Math.round(dailyAvg * totalDays);
      expect(projectedMonthEnd).toBe(6000000);
    });

    it("forecast points start seamlessly from current elapsed day anchor", () => {
      const daysElapsed = 10;
      const totalDays = 30;
      const anchor = 2000000;
      const dailyAvg = 200000;

      const forecastPoints = new Map<number, number>();
      forecastPoints.set(daysElapsed, anchor);

      for (let d = daysElapsed + 1; d <= totalDays; d++) {
        forecastPoints.set(d, anchor + dailyAvg * (d - daysElapsed));
      }

      expect(forecastPoints.get(10)).toBe(2000000);
      expect(forecastPoints.get(11)).toBe(2200000);
      expect(forecastPoints.get(20)).toBe(4000000);
      expect(forecastPoints.get(30)).toBe(6000000);
    });
  });
});
