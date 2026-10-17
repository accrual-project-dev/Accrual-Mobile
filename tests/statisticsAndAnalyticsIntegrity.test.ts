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

describe("Statistics & Financial Analytics Ecosystem Integrity Suite (Audit #19)", () => {
  const rootDir = path.resolve(__dirname, "..");

  describe("1. Static Architectural Invariant: Elimination of Hardcoded formatRupiah Leaks", () => {
    const filesToCheck = [
      "src/components/statistics/CategoryDrillDownSheet.tsx",
      "src/components/statistics/FinancialWrappedModal.tsx",
      "src/components/statistics/MonteCarloSimulatorSheet.tsx",
      "src/components/transactions/BatchTransactionReviewSheet.tsx",
      "src/components/transactions/DynamicIslandHUD.tsx",
      "src/pages/StatisticsPage.tsx",
    ];

    filesToCheck.forEach((relPath) => {
      it(`ensures ${relPath} contains zero occurrences of formatRupiah`, () => {
        const fullPath = path.join(rootDir, relPath);
        expect(fs.existsSync(fullPath)).toBe(true);
        const content = fs.readFileSync(fullPath, "utf-8");
        expect(content).not.toMatch(/\bformatRupiah\b/);
      });
    });

    it("ensures CategoryDrillDownSheet uses canonical /history?category= navigation route", () => {
      const fullPath = path.join(rootDir, "src/components/statistics/CategoryDrillDownSheet.tsx");
      const content = fs.readFileSync(fullPath, "utf-8");
      expect(content).toContain("/history?category=");
      expect(content).not.toContain("/transactions?category=");
    });

    it("ensures MonteCarloSimulatorSheet uses dynamic formatCompactWithPreferred bounds", () => {
      const fullPath = path.join(rootDir, "src/components/statistics/MonteCarloSimulatorSheet.tsx");
      const content = fs.readFileSync(fullPath, "utf-8");
      expect(content).toContain("formatCompactWithPreferred(500000)");
      expect(content).toContain("formatCompactWithPreferred(12500000)");
      expect(content).toContain("formatCompactWithPreferred(25000000)");
      expect(content).not.toMatch(/"Rp 500 Rb"/);
      expect(content).not.toMatch(/"Rp 25 Jt"/);
    });
  });

  describe("2. Dynamic Multi-Currency Formatting & Currency Switcher Invariants", () => {
    const sampleAmountIdr = 15000000; // 15,000,000 IDR

    it("formats amounts correctly across all supported currencies", () => {
      const currencies: SupportedCurrency[] = ["IDR", "USD", "EUR", "SGD", "GBP", "JPY"];

      currencies.forEach((curr) => {
        const converted = convertCurrency(sampleAmountIdr, "IDR", curr, DEFAULT_RATES);
        const formatted = formatCurrencyAmount(converted, curr);
        const meta = CURRENCY_METADATA[curr];

        expect(formatted).toContain(meta.symbol);
        if (curr !== "IDR") {
          expect(formatted).not.toContain("Rp");
        }
      });
    });

    it("dynamically formats Monte Carlo slider bounds according to preferred currency", () => {
      // IDR baseline
      const idrMin = formatCompactCurrency(500000, "IDR", DEFAULT_RATES);
      const idrMid = formatCompactCurrency(12500000, "IDR", DEFAULT_RATES);
      const idrMax = formatCompactCurrency(25000000, "IDR", DEFAULT_RATES);

      expect(idrMin).toBe("Rp 500k");
      expect(idrMid).toBe("Rp 12.5M");
      expect(idrMax).toBe("Rp 25M");

      // USD scaling (exchange rate 16,000)
      const usdMin = formatCompactCurrency(500000, "USD", DEFAULT_RATES);
      const usdMid = formatCompactCurrency(12500000, "USD", DEFAULT_RATES);
      const usdMax = formatCompactCurrency(25000000, "USD", DEFAULT_RATES);

      expect(usdMin).toContain("$");
      expect(usdMin).not.toContain("Rp");
      expect(usdMid).toContain("$");
      expect(usdMax).toContain("$");

      // EUR scaling
      const eurMax = formatCompactCurrency(25000000, "EUR", DEFAULT_RATES);
      expect(eurMax).toContain("€");
      expect(eurMax).not.toContain("Rp");
    });
  });

  describe("3. Stealth Mode Privacy Masking Invariant in Statistics & Wrapped", () => {
    it("masks amounts in FinancialWrappedModal when stealth mode is active", () => {
      const currencies: SupportedCurrency[] = ["IDR", "USD", "EUR", "SGD"];
      const amount = 8500000;

      currencies.forEach((curr) => {
        const meta = CURRENCY_METADATA[curr];
        const isStealthMode = true;

        const formatMoney = (val: number) => {
          return isStealthMode
            ? `${meta?.symbol || "Rp"} ••••••••`
            : formatCurrencyAmount(convertCurrency(val, "IDR", curr, DEFAULT_RATES), curr);
        };

        const masked = formatMoney(amount);
        expect(masked).toBe(`${meta.symbol} ••••••••`);
        expect(masked).not.toContain("8.500.000");
        expect(masked).not.toContain("8500");
      });
    });

    it("reveals full amount when stealth mode is disabled in FinancialWrappedModal", () => {
      const isStealthMode = false;
      const meta = CURRENCY_METADATA.USD;
      const amount = 16000000; // 1,000 USD at 16,000 rate

      const formatMoney = (val: number) => {
        return isStealthMode
          ? `${meta?.symbol || "Rp"} ••••••••`
          : formatCurrencyAmount(convertCurrency(val, "IDR", "USD", DEFAULT_RATES), "USD");
      };

      const unmasked = formatMoney(amount);
      expect(unmasked).toContain("$");
      expect(unmasked).toMatch(/\$1,\d{3}/);
      expect(unmasked).not.toContain("••••••••");
    });

    it("masks category shift amounts in CategoryDrillDownSheet when stealth mode is active", () => {
      const isStealthMode = true;
      const deltaAmount = 450000;

      const formatDrillDown = (val: number, stealth: boolean) => {
        return stealth ? "••••••••" : formatCurrencyAmount(val, "IDR");
      };

      expect(formatDrillDown(deltaAmount, isStealthMode)).toBe("••••••••");
      expect(formatDrillDown(deltaAmount, false)).toContain("Rp");
      expect(formatDrillDown(deltaAmount, false)).toContain("450.000");
    });
  });

  describe("4. Batch Review & Dynamic Island HUD Multi-Currency Invariants", () => {
    it("formats batch total selected amount and individual items dynamically", () => {
      const items = [
        { id: "1", amount: 150000 },
        { id: "2", amount: 350000 },
        { id: "3", amount: 500000 },
      ];
      const totalSelected = items.reduce((acc, it) => acc + it.amount, 0); // 1,000,000 IDR

      // In USD
      const usdTotal = formatCurrencyAmount(
        convertCurrency(totalSelected, "IDR", "USD", DEFAULT_RATES),
        "USD"
      );
      expect(usdTotal).toContain("$");
      expect(usdTotal).not.toContain("Rp");

      // In SGD
      const sgdTotal = formatCurrencyAmount(
        convertCurrency(totalSelected, "IDR", "SGD", DEFAULT_RATES),
        "SGD"
      );
      expect(sgdTotal).toContain("S$");
      expect(sgdTotal).not.toContain("Rp");
    });

    it("formats Dynamic Island HUD amounts dynamically without hardcoding Rp", () => {
      const hudData = { amount: 250000 };

      // Preferred EUR
      const eurHud = formatCurrencyAmount(
        convertCurrency(hudData.amount, "IDR", "EUR", DEFAULT_RATES),
        "EUR"
      );
      expect(eurHud).toContain("€");
      expect(eurHud).not.toContain("Rp");
    });
  });
});
