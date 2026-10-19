import { describe, it, expect } from "vitest";
import { formatLiveAmountInput } from "../src/lib/utils";
import * as fs from "fs";
import * as path from "path";

// Helper for parsing clean amount as implemented in DebtReceivablesSheet and BillManagementSheets
function parseCleanAmount(str: string, isIndo: boolean): number {
  if (!str) return 0;
  const thousandSep = isIndo ? "." : ",";
  const decimalSep = isIndo ? "," : ".";
  const clean = str.split(thousandSep).join("").replace(decimalSep, ".");
  return parseFloat(clean) || 0;
}

describe("Input Separators & Modal Viewport Hardening Suite", () => {
  describe("Live Amount Separators & Clean Parsing Logic", () => {
    it("formats integer amounts in IDR with period thousands separators", () => {
      expect(formatLiveAmountInput("150000", true).display).toBe("150.000");
      expect(formatLiveAmountInput("10000000", true).display).toBe("10.000.000");
      expect(formatLiveAmountInput("500", true).display).toBe("500");
    });

    it("formats amounts in English/US locale with comma thousands separators", () => {
      expect(formatLiveAmountInput("150000", false).display).toBe("150,000");
      expect(formatLiveAmountInput("1000000", false).display).toBe("1,000,000");
    });

    it("parses clean amount correctly for IDR strings with period separators", () => {
      expect(parseCleanAmount("150.000", true)).toBe(150000);
      expect(parseCleanAmount("10.000.000", true)).toBe(10000000);
      expect(parseCleanAmount("2.706.071", true)).toBe(2706071);
      expect(parseCleanAmount("", true)).toBe(0);
      expect(parseCleanAmount("  ", true)).toBe(0);
    });

    it("parses clean amount correctly for decimal amounts across locales", () => {
      expect(parseCleanAmount("150,50", true)).toBe(150.5);
      expect(parseCleanAmount("1,500.50", false)).toBe(1500.5);
    });
  });

  describe("BatchTransactionReviewSheet Ergonomics", () => {
    const filePath = path.resolve(__dirname, "../src/components/transactions/BatchTransactionReviewSheet.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    it("does not have restrictive max-h-[75vh] in category and wallet popovers", () => {
      expect(content).not.toContain("max-h-[75vh]");
    });

    it("uses unconstrained luxury viewport max-h-[88dvh] sm:max-h-[80vh]", () => {
      expect(content).toContain("max-h-[88dvh] sm:max-h-[80vh]");
    });

    it("maintains min-h-0 and overflow-y-auto on inner popover scroll containers", () => {
      expect(content).toContain("flex-1 overflow-y-auto space-y-1 no-scrollbar min-h-0");
    });
  });

  describe("StatementImportModal Viewport & Safe-Area Padding", () => {
    const filePath = path.resolve(__dirname, "../src/components/transactions/StatementImportModal.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    it("uses max-h-[95dvh] for the full modal viewport", () => {
      expect(content).toContain("max-h-[95dvh]");
    });

    it("enforces dynamic safe-area bottom inset padding", () => {
      expect(content).toContain("max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)");
    });

    it("ensures step containers have min-h-0 for smooth deceleration scrolling", () => {
      expect(content).toContain("flex-1 min-h-0 overflow-y-auto");
    });
  });

  describe("DebtReceivablesSheet Live Separators Verification", () => {
    const filePath = path.resolve(__dirname, "../src/components/debt/DebtReceivablesSheet.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    it("imports and binds formatLiveAmountInput", () => {
      expect(content).toContain("formatLiveAmountInput");
    });

    it("uses parseCleanAmount for safe mathematical parsing", () => {
      expect(content).toContain("parseCleanAmount");
      expect(content).toContain("parseCleanAmount(formAmountStr, isIndonesian)");
      expect(content).toContain("parseCleanAmount(repayAmountStr, isIndonesian)");
    });
  });

  describe("BillManagementSheets Live Separators Verification", () => {
    const filePath = path.resolve(__dirname, "../src/components/settings/BillManagementSheets.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    it("imports and binds formatLiveAmountInput", () => {
      expect(content).toContain("formatLiveAmountInput");
    });

    it("uses parseCleanAmount to compute bill amount", () => {
      expect(content).toContain("parseCleanAmount");
      expect(content).toContain("parseCleanAmount(billAmount, isIndonesian)");
    });
  });

  describe("WhatIfSimulatorSheet Live Separators Verification", () => {
    const filePath = path.resolve(__dirname, "../src/components/home/WhatIfSimulatorSheet.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    it("imports and binds formatLiveAmountInput", () => {
      expect(content).toContain("formatLiveAmountInput");
    });

    it("uses clean separator splitting on customInput in effectiveValue", () => {
      expect(content).toContain("customInput");
      expect(content).toContain("split(thousandSep)");
    });
  });

  describe("NfcCardReaderModal Viewport Ergonomics", () => {
    const filePath = path.resolve(__dirname, "../src/components/nfc/NfcCardReaderModal.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    it("enforces safe-area bottom padding and 92dvh max height", () => {
      expect(content).toContain("pb-[max(calc(env(safe-area-inset-bottom,0px)+20px),28px)]");
      expect(content).toContain("max-h-[92dvh]");
    });
  });
});
