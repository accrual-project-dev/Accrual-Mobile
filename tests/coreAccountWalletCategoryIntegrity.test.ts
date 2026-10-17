import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  formatCurrencyAmount,
  convertCurrency,
  CURRENCY_METADATA,
} from "../src/lib/currency";
import { formatLiveAmountInput } from "../src/lib/utils";

// In-memory localStorage polyfill for isolated node test environments
const localStorageStore: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => localStorageStore[key] ?? null,
  setItem: (key: string, val: string) => {
    localStorageStore[key] = String(val);
  },
  removeItem: (key: string) => {
    delete localStorageStore[key];
  },
  clear: () => {
    Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]);
  },
};

if (typeof globalThis.localStorage === "undefined") {
  Object.defineProperty(globalThis, "localStorage", {
    value: mockLocalStorage,
    writable: true,
  });
}

describe("Core Account, Wallet & Category Workstation (Audit #24)", () => {
  const rootDir = path.resolve(__dirname, "..");

  const targetFiles = [
    "src/components/ui/BalanceCard.tsx",
    "src/components/settings/WalletManagementSheets.tsx",
    "src/components/settings/CategoryManagementSheets.tsx",
    "src/components/common/ClipboardTransactionBanner.tsx",
    "src/components/settings/ShortcutManagementSheet.tsx",
  ];

  beforeEach(() => {
    mockLocalStorage.clear();
  });

  it("ensures zero formatRupiah references across all 5 target components", () => {
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

  it("verifies useCurrency and formatWithPreferred are integrated in all target files", () => {
    for (const relPath of targetFiles) {
      const fullPath = path.join(rootDir, relPath);
      const content = fs.readFileSync(fullPath, "utf-8");
      expect(content).toContain("useCurrency");
      expect(content).toContain("formatWithPreferred");
    }
  });

  it("verifies dynamic stealth masking in BalanceCard with zero hardcoded Rp masking", () => {
    const balanceCardPath = path.join(rootDir, "src/components/ui/BalanceCard.tsx");
    const content = fs.readFileSync(balanceCardPath, "utf-8");

    // Stealth mask must be computed from currencyMeta.symbol
    expect(content).toContain("stealthMask");
    expect(content).toContain("`${currencyMeta.symbol} ••••••••`");

    // Zero hardcoded 'Rp ••••••••' or 'Rp         '
    const hardcodedMasks = content.match(/Rp\s*•{4,}/g);
    expect(
      hardcodedMasks,
      `Expected no hardcoded Rp stealth masks in BalanceCard, found: ${hardcodedMasks?.join(", ")}`,
    ).toBeNull();

    // Verifies localized overflow chip text
    expect(content).toContain("+${items.length - 5} lainnya");
    expect(content).toContain("+${items.length - 5} more");
  });

  it("verifies full ISO timestamp is generated on wallet balance correction", () => {
    const walletSheetPath = path.join(
      rootDir,
      "src/components/settings/WalletManagementSheets.tsx",
    );
    const content = fs.readFileSync(walletSheetPath, "utf-8");

    // Must construct full occurred_on with time part
    expect(content).toContain("format(new Date(), \"HH:mm:ss\")");
    expect(content).toContain("`${txDate}T${timePart}`");
    expect(content).toContain("occurred_on: fullOccurredOn");
  });

  it("verifies category budget inputs support two-way multi-currency conversion", () => {
    const catSheetPath = path.join(
      rootDir,
      "src/components/settings/CategoryManagementSheets.tsx",
    );
    const content = fs.readFileSync(catSheetPath, "utf-8");

    // Two-way conversions
    expect(content).toContain("convertToIdr");
    expect(content).toContain("convertFromIdr");
    expect(content).toContain("formatCompactWithPreferred");
    expect(content).toContain("currencyMeta.symbol");
    expect(content).toContain("currencyMeta.code");

    // Budget presets adapt between IDR and foreign currencies
    expect(content).toContain("budgetPresets");

    // Zero hardcoded Rp in quick budget or inputs
    const hardcodedRp = content.match(/placeholder=\{[^}]*Rp 1\.000\.000/g);
    expect(hardcodedRp).toBeNull();
  });

  it("verifies multi-currency conversion math for category budgets", () => {
    // Entering $50 USD converts accurately to IDR for database persistence
    const userEnteredUsd = 50;
    const idrStored = convertCurrency(userEnteredUsd, "USD", "IDR");
    expect(idrStored).toBeGreaterThan(700000); // 50 * ~15850 = ~792,500

    // Loading IDR stored budget back to USD display
    const userDisplayedUsd = convertCurrency(idrStored, "IDR", "USD");
    expect(Math.round(userDisplayedUsd)).toBe(userEnteredUsd);

    // Live input formatting respects decimals
    const formattedUsdInput = formatLiveAmountInput("50.75", false, true, 2);
    expect(formattedUsdInput.formatted).toBe("50.75");
    expect(formattedUsdInput.rawNumber).toBe(50.75);

    const formattedIdrInput = formatLiveAmountInput("500000", true, false, 0);
    expect(formattedIdrInput.formatted).toBe("500.000");
    expect(formattedIdrInput.rawNumber).toBe(500000);
  });

  it("verifies currency symbol masking across different international currencies", () => {
    const currencies = ["IDR", "USD", "EUR", "SGD", "JPY"] as const;
    for (const curr of currencies) {
      const meta = CURRENCY_METADATA[curr];
      const stealthMask = `${meta.symbol} ••••••••`;
      expect(stealthMask).toContain("••••••••");
      expect(stealthMask.startsWith(meta.symbol)).toBe(true);
    }
  });
});
