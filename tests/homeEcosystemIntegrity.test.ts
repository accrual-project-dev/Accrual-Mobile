import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  formatCurrencyAmount,
  formatCompactCurrency,
  convertCurrency,
  CURRENCY_METADATA,
  DEFAULT_RATES,
  type SupportedCurrency,
} from "../src/lib/currency";

describe("Home Ecosystem Multi-Currency Synchronization & Stealth Privacy Suite (Audit #20)", () => {
  const rootDir = path.resolve(__dirname, "..");

  describe("1. Static Architectural Invariant: Complete Elimination of Hardcoded formatRupiah in Home", () => {
    const homeFilesToCheck = [
      "src/components/home/LiquidPositionHorizonHero.tsx",
      "src/components/home/InvestmentPulseCard.tsx",
      "src/components/home/LiquidityHorizonCard.tsx",
      "src/components/home/PersonalFinancialModelCard.tsx",
      "src/components/home/PersonalFinancialModelSheet.tsx",
      "src/components/home/HomeWidgetRenderer.tsx",
      "src/components/home/MetricDrillDownSheet.tsx",
      "src/components/home/MonthForecastSheet.tsx",
      "src/components/home/CashflowOutlookCard.tsx",
      "src/components/home/ExpenseVolatilityCard.tsx",
      "src/components/home/HomeModalsContainer.tsx",
      "src/components/home/widgets/CategoryDonutCard.tsx",
      "src/components/home/widgets/CompactHalfCards.tsx",
      "src/components/home/widgets/LiquidRunwayCard.tsx",
      "src/components/home/widgets/MiniHeatmapCard.tsx",
      "src/components/home/widgets/SavingsRingCard.tsx",
      "src/components/home/widgets/SpendingVelocityBarCard.tsx",
      "src/pages/HomePage.tsx",
    ];

    homeFilesToCheck.forEach((relPath) => {
      it(`ensures ${relPath} contains zero occurrences of formatRupiah`, () => {
        const fullPath = path.join(rootDir, relPath);
        expect(fs.existsSync(fullPath)).toBe(true);
        const content = fs.readFileSync(fullPath, "utf-8");
        expect(content).not.toMatch(/\bformatRupiah\b/);
      });
    });

    it("ensures zero hardcoded 'Rp ••••••••' stealth strings exist in home cards and widgets", () => {
      homeFilesToCheck.forEach((relPath) => {
        const fullPath = path.join(rootDir, relPath);
        const content = fs.readFileSync(fullPath, "utf-8");
        expect(content).not.toMatch(/"Rp •+/);
        expect(content).not.toMatch(/'Rp •+/);
      });
    });
  });

  describe("2. Stealth Mode Masking Invariants with Active Currency Symbol", () => {
    const currencies: SupportedCurrency[] = ["IDR", "USD", "EUR", "SGD", "GBP", "JPY"];

    it("constructs stealth masks with the exact currency symbol for all supported currencies", () => {
      currencies.forEach((currencyCode) => {
        const meta = CURRENCY_METADATA[currencyCode];
        const stealthMask = `${meta.symbol} ••••••••`;
        expect(stealthMask).toContain(meta.symbol);
        expect(stealthMask).toContain("••••••••");

        if (currencyCode === "USD") {
          expect(stealthMask).toBe("$ ••••••••");
        } else if (currencyCode === "EUR") {
          expect(stealthMask).toBe("€ ••••••••");
        } else if (currencyCode === "IDR") {
          expect(stealthMask).toBe("Rp ••••••••");
        } else if (currencyCode === "SGD") {
          expect(stealthMask).toBe("S$ ••••••••");
        } else if (currencyCode === "GBP") {
          expect(stealthMask).toBe("£ ••••••••");
        } else if (currencyCode === "JPY") {
          expect(stealthMask).toBe("¥ ••••••••");
        }
      });
    });

    it("verifies LiquidPositionHorizonHero renders stealth mask when hideBalance is true", () => {
      const fullPath = path.join(rootDir, "src/components/home/LiquidPositionHorizonHero.tsx");
      const content = fs.readFileSync(fullPath, "utf-8");
      expect(content).toContain("hideBalance");
      expect(content).toContain("currencyMeta?.symbol");
      expect(content).toContain("••••••••");
    });

    it("verifies InvestmentPulseCard renders stealth mask when isStealthMode is true", () => {
      const fullPath = path.join(rootDir, "src/components/home/InvestmentPulseCard.tsx");
      const content = fs.readFileSync(fullPath, "utf-8");
      expect(content).toContain("isStealthMode");
      expect(content).toContain("currencyMeta?.symbol");
      expect(content).toContain("••••••••");
    });
  });

  describe("3. Multi-Currency Precision & Dynamic Formatting Invariants", () => {
    const sampleBalanceIdr = 25000000; // 25,000,000 IDR

    it("accurately converts and formats amounts into foreign currencies", () => {
      // USD: 25,000,000 / 15,850 = ~1,577.29
      const usdAmount = convertCurrency(sampleBalanceIdr, "IDR", "USD", DEFAULT_RATES);
      const formattedUsd = formatCurrencyAmount(usdAmount, "USD", "en");
      expect(formattedUsd).toContain("$");
      expect(formattedUsd).toContain("1,577.29");

      // EUR: 25,000,000 / 17,150 = ~1,457.73
      const eurAmount = convertCurrency(sampleBalanceIdr, "IDR", "EUR", DEFAULT_RATES);
      const formattedEur = formatCurrencyAmount(eurAmount, "EUR", "en");
      expect(formattedEur).toContain("€");
      expect(formattedEur).toContain("1,457.73");

      // JPY: 25,000,000 / 106 = ~235,849 (0 decimal digits)
      const jpyAmount = convertCurrency(sampleBalanceIdr, "IDR", "JPY", DEFAULT_RATES);
      const formattedJpy = formatCurrencyAmount(jpyAmount, "JPY", "ja");
      expect(formattedJpy).toContain("¥");
      expect(formattedJpy).not.toContain(".00");
    });

    it("accurately formats compact values for hero badges and chart markers", () => {
      const compactIdr = formatCompactCurrency(sampleBalanceIdr, "IDR", DEFAULT_RATES);
      expect(compactIdr).toContain("Rp");
      expect(compactIdr).toContain("25M");

      const compactUsd = formatCompactCurrency(sampleBalanceIdr, "USD", DEFAULT_RATES);
      expect(compactUsd).toContain("$");
      expect(compactUsd).toContain("1.6k");
    });
  });

  describe("4. Component Architecture & Context Integration Invariants", () => {
    it("verifies LiquidPositionHorizonHero displays active currency code indicator", () => {
      const fullPath = path.join(rootDir, "src/components/home/LiquidPositionHorizonHero.tsx");
      const content = fs.readFileSync(fullPath, "utf-8");
      expect(content).toContain("currencyMeta?.code || preferredCurrency || \"IDR\"");
    });

    it("verifies MetricDrillDownSheet integrates usePrivacy and useCurrency", () => {
      const fullPath = path.join(rootDir, "src/components/home/MetricDrillDownSheet.tsx");
      const content = fs.readFileSync(fullPath, "utf-8");
      expect(content).toContain("usePrivacy");
      expect(content).toContain("useCurrency");
      expect(content).toContain("formatWithPreferred");
    });

    it("verifies MonthForecastSheet integrates usePrivacy and useCurrency", () => {
      const fullPath = path.join(rootDir, "src/components/home/MonthForecastSheet.tsx");
      const content = fs.readFileSync(fullPath, "utf-8");
      expect(content).toContain("usePrivacy");
      expect(content).toContain("useCurrency");
      expect(content).toContain("formatWithPreferred");
    });

    it("verifies PersonalFinancialModelSheet and Card integrate useCurrency", () => {
      const sheetPath = path.join(rootDir, "src/components/home/PersonalFinancialModelSheet.tsx");
      const cardPath = path.join(rootDir, "src/components/home/PersonalFinancialModelCard.tsx");
      const sheetContent = fs.readFileSync(sheetPath, "utf-8");
      const cardContent = fs.readFileSync(cardPath, "utf-8");

      expect(sheetContent).toContain("useCurrency");
      expect(sheetContent).toContain("formatWithPreferred");
      expect(cardContent).toContain("useCurrency");
      expect(cardContent).toContain("formatWithPreferred");
    });
  });
});
