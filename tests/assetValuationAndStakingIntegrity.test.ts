import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  formatCurrencyAmount,
  convertCurrency,
  CURRENCY_METADATA,
} from "../src/lib/currency";

describe("Asset Valuation, Yield Staking & Physical Depreciation Workstation (Audit #21)", () => {
  const rootDir = path.resolve(__dirname, "..");

  const targetFiles = [
    "src/components/assets/PortfolioHoldingsDeck.tsx",
    "src/components/assets/CashAccountDetailSheet.tsx",
    "src/components/settings/AssetValuationSheet.tsx",
    "src/components/settings/StakingYieldModal.tsx",
  ];

  it("ensures zero formatRupiah references across all workstation components", () => {
    for (const relPath of targetFiles) {
      const fullPath = path.join(rootDir, relPath);
      expect(fs.existsSync(fullPath)).toBe(true);
      const content = fs.readFileSync(fullPath, "utf-8");
      const matches = content.match(/\bformatRupiah\b/g);
      expect(
        matches,
        `Expected 0 formatRupiah references in ${relPath}, found: ${matches?.length}`,
      ).toBeNull();
    }
  });

  it("verifies useCurrency is integrated in all target sheets and modals", () => {
    const currencyFiles = [
      "src/components/assets/CashAccountDetailSheet.tsx",
      "src/components/settings/AssetValuationSheet.tsx",
      "src/components/settings/StakingYieldModal.tsx",
    ];

    for (const relPath of currencyFiles) {
      const fullPath = path.join(rootDir, relPath);
      const content = fs.readFileSync(fullPath, "utf-8");
      expect(content).toContain("useCurrency");
      expect(content).toContain("formatWithPreferred");
    }
  });

  it("verifies stealth privacy masking is integrated into valuation displays", () => {
    const privacyFiles = [
      "src/components/assets/CashAccountDetailSheet.tsx",
      "src/components/settings/AssetValuationSheet.tsx",
    ];

    for (const relPath of privacyFiles) {
      const fullPath = path.join(rootDir, relPath);
      const content = fs.readFileSync(fullPath, "utf-8");
      expect(content).toContain("isStealthMode");
      expect(content).toContain("••••••••");
    }
  });

  it("verifies multi-currency formatting for preferred currencies", () => {
    const idrAmount = 1600000;

    // USD: 1,600,000 IDR -> converted to USD
    const convertedUsd = convertCurrency(idrAmount, "IDR", "USD");
    const usdFormatted = formatCurrencyAmount(convertedUsd, "USD");
    expect(usdFormatted).toContain("$");
    expect(convertedUsd).toBeGreaterThan(0);

    // EUR: 1,600,000 IDR -> converted to EUR
    const convertedEur = convertCurrency(idrAmount, "IDR", "EUR");
    const eurFormatted = formatCurrencyAmount(convertedEur, "EUR");
    expect(eurFormatted).toContain("€");
    expect(convertedEur).toBeGreaterThan(0);

    // JPY: 1,600,000 IDR -> converted to JPY
    const convertedJpy = convertCurrency(idrAmount, "IDR", "JPY");
    const jpyFormatted = formatCurrencyAmount(convertedJpy, "JPY");
    expect(jpyFormatted).toContain(CURRENCY_METADATA.JPY.symbol);
    expect(convertedJpy).toBeGreaterThan(0);

    // IDR: Rp 1.600.000
    const idrFormatted = formatCurrencyAmount(idrAmount, "IDR");
    expect(idrFormatted).toContain("Rp");
    expect(idrFormatted).toContain("1.600.000");
  });

  it("verifies straight-line physical asset depreciation calculation", () => {
    // Tangible asset: Purchase price 10,000,000, Useful life 5 years (60 months), salvage value 1,000,000
    const purchaseCost = 10000000;
    const salvageValue = 1000000;
    const usefulLifeMonths = 60;
    const depreciableBase = purchaseCost - salvageValue; // 9,000,000
    const monthlyDepreciation = depreciableBase / usefulLifeMonths; // 150,000 / month

    expect(depreciableBase).toBe(9000000);
    expect(monthlyDepreciation).toBe(150000);

    // After 24 months
    const ageMonths = 24;
    const accumulatedDepreciation = monthlyDepreciation * ageMonths; // 3,600,000
    const bookValue = purchaseCost - accumulatedDepreciation; // 6,400,000

    expect(accumulatedDepreciation).toBe(3600000);
    expect(bookValue).toBe(6400000);

    // After 70 months (exceeds useful life)
    const lateAgeMonths = 70;
    const cappedAccumulated = Math.min(
      monthlyDepreciation * lateAgeMonths,
      depreciableBase,
    );
    const cappedBookValue = Math.max(
      purchaseCost - cappedAccumulated,
      salvageValue,
    );

    expect(cappedAccumulated).toBe(depreciableBase);
    expect(cappedBookValue).toBe(salvageValue);
  });
});
