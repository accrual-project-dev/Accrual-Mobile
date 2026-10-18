import { describe, it, expect } from "vitest";
import { parseDelimitedText } from "../src/lib/csvParser";
import {
  parseStatementText,
  sanitizeNote,
  sanitizeTransferArrowText,
} from "../src/lib/statementParser";
import { resolveCategoryVectorIcon } from "../src/lib/iconRegistry";
import type { Wallet, Category, Transaction } from "../src/lib/types";
import * as fs from "fs";
import * as path from "path";

describe("Audit #38: Bank & Credit Card Statement Ingestion, Multi-Format Parser & Reconciliation Workstation", () => {
  const mockWallets: Wallet[] = [
    { id: "w-bca", user_id: "u1", name: "BCA", icon: "Landmark", created_at: "2026-01-01", balance: 5000000, classification: "liquid" },
    { id: "w-mandiri", user_id: "u1", name: "Mandiri", icon: "Landmark", created_at: "2026-01-01", balance: 2500000, classification: "liquid" },
    { id: "w-cash", user_id: "u1", name: "Cash", icon: "Coins", created_at: "2026-01-01", balance: 350000, classification: "liquid" },
    { id: "w-blu", user_id: "u1", name: "Blu", icon: "Smartphone", created_at: "2026-01-01", balance: 1200000, classification: "liquid" },
  ];

  const mockCategories: Category[] = [
    { id: "c-food", user_id: "u1", name: "Makanan & Minuman", emoji: "Utensils", type: "expense" },
    { id: "c-salary", user_id: "u1", name: "Gaji & Upah", emoji: "Briefcase", type: "income" },
  ];

  describe("1. Header Row Auto-Discovery in CSV (Rule 8.1)", () => {
    it("auto-discovers header row when preceded by bank statement preamble and metadata lines", () => {
      const csvWithPreamble = [
        "PT BANK CENTRAL ASIA TBK",
        "Nomor Rekening: 1234567890",
        "Periode Transaksi: 01/01/2026 - 31/01/2026",
        "Mata Uang: IDR",
        "",
        "Tanggal,Keterangan,Nominal,Tipe",
        "2026-01-02,Transfer ke Tokopedia,150000,DB",
        "2026-01-03,Gaji Bulanan,15000000,CR",
      ].join("\n");

      const parsed = parseDelimitedText(csvWithPreamble);
      expect(parsed.headers).toEqual(["Tanggal", "Keterangan", "Nominal", "Tipe"]);
      expect(parsed.rows.length).toBe(2);
      expect(parsed.rows[0]).toEqual(["2026-01-02", "Transfer ke Tokopedia", "150000", "DB"]);
      expect(parsed.rows[1]).toEqual(["2026-01-03", "Gaji Bulanan", "15000000", "CR"]);
    });

    it("parses correctly when header is at row 0 (standard CSV)", () => {
      const standardCsv = [
        "Tanggal,Keterangan,Nominal,Tipe",
        "2026-01-02,Makan Siang,45000,Pengeluaran",
      ].join("\n");

      const parsed = parseDelimitedText(standardCsv);
      expect(parsed.headers).toEqual(["Tanggal", "Keterangan", "Nominal", "Tipe"]);
      expect(parsed.rows.length).toBe(1);
    });

    it("auto-discovers headers with semicolon delimiter and preamble", () => {
      const semicolonCsv = [
        "LAPORAN TRANSAKSI MANDIRI",
        "Cabang: Jakarta Pusat",
        "Date;Description;Amount;Type",
        "2026-01-05;Tagihan Wifi;350000;Debit",
      ].join("\n");

      const parsed = parseDelimitedText(semicolonCsv);
      expect(parsed.headers).toEqual(["Date", "Description", "Amount", "Type"]);
      expect(parsed.rows.length).toBe(1);
      expect(parsed.rows[0]).toEqual(["2026-01-05", "Tagihan Wifi", "350000", "Debit"]);
    });
  });

  describe("2. Arrow Transfer Splitting & Detection (Rule 8.1)", () => {
    it("splits transfer arrows 'A → B', '->', and 'ke' in transaction descriptions", () => {
      const csv = [
        "Tanggal,Keterangan,Nominal,Tipe",
        "2026-01-10,BCA → Mandiri,500000,Transfer",
        "2026-01-11,Cash -> Blu,200000,Transfer",
        "2026-01-12,Mandiri ke BCA,100000,Transfer",
      ].join("\n");

      const result = parseStatementText(csv, [], mockCategories, undefined, mockWallets);
      expect(result.items.length).toBe(3);

      // Item 0: BCA → Mandiri
      expect(result.items[0].type).toBe("transfer");
      expect(result.items[0].walletId).toBe("w-bca");
      expect(result.items[0].destinationWalletId).toBe("w-mandiri");

      // Item 1: Cash -> Blu
      expect(result.items[1].type).toBe("transfer");
      expect(result.items[1].walletId).toBe("w-cash");
      expect(result.items[1].destinationWalletId).toBe("w-blu");

      // Item 2: Mandiri ke BCA
      expect(result.items[2].type).toBe("transfer");
      expect(result.items[2].walletId).toBe("w-mandiri");
      expect(result.items[2].destinationWalletId).toBe("w-bca");
    });

    it("sanitizes transfer arrows with various unicode or ascii representations", () => {
      expect(sanitizeTransferArrowText("BCA â†’ Mandiri")).toBe("BCA → Mandiri");
      expect(sanitizeTransferArrowText("BCA -> Mandiri")).toBe("BCA → Mandiri");
      expect(sanitizeTransferArrowText("BCA --> Mandiri")).toBe("BCA → Mandiri");
      expect(sanitizeTransferArrowText("BCA => Mandiri")).toBe("BCA → Mandiri");
      expect(sanitizeTransferArrowText("BCA ke Mandiri")).toBe("BCA → Mandiri");
      expect(sanitizeTransferArrowText("BCA to Mandiri")).toBe("BCA → Mandiri");
    });
  });

  describe("3. Full ISO Timestamp Preservation & Inline Time (Rule 8.1)", () => {
    it("extracts inline time from ISO date or datetime strings", () => {
      const csv = [
        "Tanggal,Keterangan,Nominal,Tipe",
        "2026-01-15T10:45:30,Kopi Espresso,30000,Pengeluaran",
        "2026-01-15 18:20:00,Makan Malam,65000,Pengeluaran",
      ].join("\n");

      const result = parseStatementText(csv, [], mockCategories, undefined, mockWallets);
      expect(result.items.length).toBe(2);

      expect(result.items[0].date).toBe("2026-01-15");
      expect(result.items[0].time).toBe("10:45:30");

      expect(result.items[1].date).toBe("2026-01-15");
      expect(result.items[1].time).toBe("18:20:00");
    });
  });

  describe("4. Placeholder Note Sanitization (Rule 8.1)", () => {
    it("converts placeholder characters to clean empty strings", () => {
      expect(sanitizeNote("-")).toBe("");
      expect(sanitizeNote("--")).toBe("");
      expect(sanitizeNote("---")).toBe("");
      expect(sanitizeNote("   -   ")).toBe("");
      expect(sanitizeNote("—")).toBe("");
      expect(sanitizeNote("–")).toBe("");
      expect(sanitizeNote("n/a")).toBe("");
      expect(sanitizeNote("none")).toBe("");
      expect(sanitizeNote("null")).toBe("");
      expect(sanitizeNote(".")).toBe("");

      // Genuine notes remain untouched
      expect(sanitizeNote("Pembelian Buku")).toBe("Pembelian Buku");
      expect(sanitizeNote("TRF-987234")).toBe("TRF-987234");
    });
  });

  describe("5. Category Synthesis & Vector Icon Assignment (Rule 1 & Rule 8.1)", () => {
    it("resolves semantic monochrome vector icons for newly synthesized categories", () => {
      const foodIcon = resolveCategoryVectorIcon("Makanan & Minuman");
      expect(foodIcon).toBe("Utensils");

      const salaryIcon = resolveCategoryVectorIcon("Gaji & Upah");
      expect(salaryIcon).toBe("Banknote");

      const freelanceIcon = resolveCategoryVectorIcon("Freelance & Proyek");
      expect(freelanceIcon).toBe("Briefcase");

      const coffeeIcon = resolveCategoryVectorIcon("Kopi Kenangan");
      expect(coffeeIcon).toBe("Coffee");

      const transportIcon = resolveCategoryVectorIcon("Bensin Pertamina");
      expect(transportIcon).toBe("Fuel");

      // Verify returned icons are valid strings without emoji characters
      expect(foodIcon).not.toMatch(/\p{Emoji}/u);
      expect(salaryIcon).not.toMatch(/\p{Emoji}/u);
      expect(coffeeIcon).not.toMatch(/\p{Emoji}/u);
      expect(transportIcon).not.toMatch(/\p{Emoji}/u);
    });
  });

  describe("6. Modal Ergonomics, Safe-Area Insets & Accessibility (Rule 5 & Rule 1)", () => {
    it("verifies StatementImportModal source code enforces standard safe-area paddingBottom across all containers and drawers", () => {
      const modalPath = path.resolve(__dirname, "../src/components/transactions/StatementImportModal.tsx");
      const content = fs.readFileSync(modalPath, "utf-8");

      // Match all occurrences of paddingBottom
      const matches = content.match(/paddingBottom:\s*["'][^"']+["']/g) || [];
      expect(matches.length).toBeGreaterThanOrEqual(6);

      for (const m of matches) {
        expect(m).toContain("max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)");
      }
    });

    it("verifies close button in StatementImportModal has title and aria-label", () => {
      const modalPath = path.resolve(__dirname, "../src/components/transactions/StatementImportModal.tsx");
      const content = fs.readFileSync(modalPath, "utf-8");

      expect(content).toContain('title={isIndonesian ? "Tutup" : "Close"}');
      expect(content).toContain('aria-label={isIndonesian ? "Tutup" : "Close"}');
    });

    it("verifies no prohibited hardcoded system emoji icons are used in StatementImportModal", () => {
      const modalPath = path.resolve(__dirname, "../src/components/transactions/StatementImportModal.tsx");
      const content = fs.readFileSync(modalPath, "utf-8");

      // Test that native system emojis are not hardcoded as buttons or headers
      const prohibitedEmojis = ["📊", "⚡", "🗓️", "🎯", "🔔", "⏱️", "🥧", "📈", "👥", "📱"];
      for (const emoji of prohibitedEmojis) {
        expect(content).not.toContain(emoji);
      }
    });
  });
});
