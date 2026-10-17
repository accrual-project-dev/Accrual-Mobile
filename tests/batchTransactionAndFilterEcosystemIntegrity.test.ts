import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { format } from "date-fns";

describe("Batch Transaction Review, Filter Ribbon & Bulk Operation Ecosystem Integrity (Audit #28)", () => {
  const rootDir = path.resolve(__dirname, "..");

  const targetComponents = [
    "src/components/transactions/BatchTransactionReviewSheet.tsx",
    "src/components/transactions/TransactionBatchActionBar.tsx",
    "src/components/transactions/TransactionFilterBar.tsx",
    "src/components/transactions/CategorySelectorRibbon.tsx",
    "src/components/transactions/WalletSelectorRibbon.tsx",
    "src/components/transactions/TransactionHorizonBarChart.tsx",
  ];

  describe("1. TransactionBatchActionBar Layout & Localization", () => {
    const barPath = path.join(rootDir, "src/components/transactions/TransactionBatchActionBar.tsx");
    const barCode = fs.readFileSync(barPath, "utf-8");

    it("enforces dynamic safe area bottom inset above mobile navigation bar", () => {
      expect(barCode).toContain("bottom-[max(calc(env(safe-area-inset-bottom,0px)+80px),92px)]");
      expect(barCode).not.toContain("bottom-[calc(78px+env(safe-area-inset-bottom,16px))]");
    });

    it("enforces pure localization for delete count button without hardcoded English", () => {
      expect(barCode).toContain("isIndonesian ? `Hapus (${selectedCount})` : `Delete (${selectedCount})`");
      expect(barCode).not.toContain("<span>Delete ({selectedCount})</span>");
    });

    it("enforces luxury monochrome action styling on Done button", () => {
      expect(barCode).toContain('background: "var(--text-primary)"');
      expect(barCode).toContain('color: "var(--bg-base)"');
      expect(barCode).not.toContain('background: "var(--accent)"');
    });
  });

  describe("2. BatchTransactionReviewSheet Architecture & Integrity", () => {
    const sheetPath = path.join(rootDir, "src/components/transactions/BatchTransactionReviewSheet.tsx");
    const sheetCode = fs.readFileSync(sheetPath, "utf-8");

    it("uses pure Indonesian 'Simpan Draf' without bilingual English mixing", () => {
      expect(sheetCode).toContain('isIndonesian ? "Simpan Draf" : "Save Draft"');
      expect(sheetCode).not.toContain('isIndonesian ? "Simpan ke Draft" : "Save Draft"');
    });

    it("enforces dynamic safe-area bottom inset and no artificial height cap in main container", () => {
      expect(sheetCode).toContain("pb-[max(calc(env(safe-area-inset-bottom,0px)+16px),24px)]");
      expect(sheetCode).not.toMatch(/<BottomSheet[^>]*>\s*<div[^>]*max-h-\[(5[0-9]vh|60vh)\]/);
    });

    it("integrates merchant memory persistence upon user category correction", () => {
      expect(sheetCode).toContain("saveMerchantMemory(targetItem.cleanDescription, cat.id, cat.name)");
    });
  });

  describe("3. TransactionFilterBar Localization & Title Attributes", () => {
    const filterPath = path.join(rootDir, "src/components/transactions/TransactionFilterBar.tsx");
    const filterCode = fs.readFileSync(filterPath, "utf-8");

    it("branches filter button title dynamically by language", () => {
      expect(filterCode).toContain('title={isIndonesian ? "Filter Lanjutan" : "Advanced Filters"}');
      expect(filterCode).not.toContain('title="Advanced Filters"');
    });

    it("branches select mode toggle title dynamically by language", () => {
      expect(filterCode).toContain('isIndonesian ? "Keluar Mode Pilihan" : "Exit Select Mode"');
      expect(filterCode).toContain('isIndonesian ? "Pilih Transaksi" : "Select Transactions"');
    });

    it("localizes category chip fallback cleanly", () => {
      expect(filterCode).toContain('isIndonesian ? "Kategori" : "Category"');
    });
  });

  describe("4. TransactionHorizonBarChart Stealth & Draft Banner", () => {
    const chartPath = path.join(rootDir, "src/components/transactions/TransactionHorizonBarChart.tsx");
    const chartCode = fs.readFileSync(chartPath, "utf-8");

    it("localizes data points subtitle cleanly", () => {
      expect(chartCode).toContain('isIndonesian ? "titik data" : "data points"');
    });

    it("localizes stealth toggle button tooltip", () => {
      expect(chartCode).toContain('isIndonesian ? "Nonaktifkan Mode Samaran" : "Disable Stealth Mode"');
      expect(chartCode).toContain('isIndonesian ? "Aktifkan Mode Samaran" : "Enable Stealth Mode"');
      expect(chartCode).not.toContain('title={isStealthMode ? "Disable Stealth Mode" : "Enable Stealth Mode"}');
    });

    it("uses standard Indonesian 'draf' in draft review banner and dismissal tooltip", () => {
      expect(chartCode).toContain('Tersimpan di draf · Saldo belum terpotong');
      expect(chartCode).toContain('isIndonesian ? "Draf Transaksi" : "Draft Inbox"');
      expect(chartCode).toContain('isIndonesian ? "Buang Semua Draf" : "Dismiss All Drafts"');
    });
  });

  describe("5. Timestamp & Full ISO Invariant Checks", () => {
    const txPagePath = path.join(rootDir, "src/pages/TransactionsPage.tsx");
    const txPageCode = fs.readFileSync(txPagePath, "utf-8");

    it("ensures duplicate transaction generates full ISO timestamp with time component (Rule 8.1)", () => {
      expect(txPageCode).toContain('occurred_on: format(new Date(), "yyyy-MM-dd\'T\'HH:mm:ss")');
      expect(txPageCode).not.toContain('occurred_on: format(new Date(), "yyyy-MM-dd"),');
    });
  });

  describe("6. Architectural Invariant Checks (Icons & Color Rules)", () => {
    const emojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/u;
    const vibrantColorRegex = /text-(emerald|blue|purple|orange|yellow|rose|cyan|indigo)-\d{3}|bg-(emerald|blue|purple|orange|yellow|rose|cyan|indigo)-\d{3}/;

    it("enforces zero native colored emojis across batch review and filter components", () => {
      targetComponents.forEach((rel) => {
        const fullPath = path.join(rootDir, rel);
        const code = fs.readFileSync(fullPath, "utf-8");
        expect(code, `Native emoji found in ${rel}`).not.toMatch(emojiRegex);
      });
    });

    it("enforces zero vibrant rainbow utility color classes in UI controls", () => {
      targetComponents.forEach((rel) => {
        const fullPath = path.join(rootDir, rel);
        const code = fs.readFileSync(fullPath, "utf-8");
        expect(code, `Vibrant utility color class found in ${rel}`).not.toMatch(vibrantColorRegex);
      });
    });
  });
});
