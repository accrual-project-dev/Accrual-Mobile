import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseExcelFile } from "../src/lib/excelParser";
import {
  parseStatementText,
  sanitizeNote,
  sanitizeTransferArrowText,
  normalizeDateString,
  normalizeTimeString,
} from "../src/lib/statementParser";
import type { Transaction, Category, Wallet } from "../src/lib/types";

describe("Statement Import Ecosystem Integrity & Rule 8.1 Hardening Suite", () => {
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

  describe("1. Excel Fractional Datetime Serials (Rule 8.1)", () => {
    it("preserves hours, minutes, and seconds from Excel fractional datetime serials", async () => {
      // 45678 = 2025-01-21
      // 0.605555555555555 = ~14:32:00
      const combinedSerial = 45678 + (14 * 3600 + 32 * 60) / 86400;

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ["Tanggal", "Keterangan", "Nominal"],
        [combinedSerial, "Makan Siang", 55000],
        [45678, "Makan Malam", 75000], // pure date serial
      ]);
      XLSX.utils.book_append_sheet(wb, ws, "Mutasi");
      const excelBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });

      const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const file = new File([blob], "mutasi.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

      const parsed = await parseExcelFile(file);
      expect(parsed.rows.length).toBe(2);

      // Row 1 with fractional serial must include ISO timestamp T14:32:00
      const row1Date = parsed.rows[0][0];
      expect(row1Date).toMatch(/^2025-01-21T14:32:00/);

      // Row 2 with pure date serial must be date only
      const row2Date = parsed.rows[1][0];
      expect(row2Date).toBe("2025-01-21");
    });
  });

  describe("2. Inline Time Extraction from Date Column", () => {
    it("extracts time when date column contains combined date and time without separate time column", () => {
      const csvData = [
        "Tanggal,Keterangan,Nominal,Tipe",
        "2025-01-21T14:30:00,Kopi Kenangan,35000,Pengeluaran",
        "2025-01-21 09:15:20,Sarapan Bubur,20000,Pengeluaran",
      ].join("\n");

      const result = parseStatementText(csvData, [], mockCategories, undefined, mockWallets);
      expect(result.items.length).toBe(2);

      expect(result.items[0].date).toBe("2025-01-21");
      expect(result.items[0].time).toBe("14:30:00");

      expect(result.items[1].date).toBe("2025-01-21");
      expect(result.items[1].time).toBe("09:15:20");
    });
  });

  describe("3. Duplicate Detection with ISO Timestamps & 48-Hour Tolerance (Rule 8.1)", () => {
    it("correctly matches duplicate against existing transactions that have full ISO occurred_on timestamps", () => {
      const existingTxs: Transaction[] = [
        {
          id: "tx-existing-1",
          user_id: "u1",
          amount: 50000,
          type: "expense",
          occurred_on: "2025-01-21T14:30:00", // Full ISO timestamp!
          note: "Kopi Kenangan",
          created_at: "2025-01-21T14:30:00Z",
        },
      ];

      const csvData = [
        "Tanggal,Keterangan,Nominal,Tipe",
        "2025-01-21,Kopi Kenangan,50000,Pengeluaran", // Same day, exact duplicate
        "2025-01-21,Beli Buku,120000,Pengeluaran", // New transaction
      ].join("\n");

      const result = parseStatementText(csvData, existingTxs, mockCategories, undefined, mockWallets);
      expect(result.items.length).toBe(2);

      // Item 0 is an exact duplicate
      expect(result.items[0].isDuplicate).toBe(true);
      expect(result.items[0].selected).toBe(false);
      expect(result.items[0].duplicateReason).toContain("Sama dengan transaksi");

      // Item 1 is not duplicate
      expect(result.items[1].isDuplicate).toBe(false);
      expect(result.items[1].selected).toBe(true);
    });

    it("flags 48-hour adjacent day transactions as needsReview duplicates without unchecking by default", () => {
      const existingTxs: Transaction[] = [
        {
          id: "tx-existing-2",
          user_id: "u1",
          amount: 250000,
          type: "expense",
          occurred_on: "2025-01-21T23:55:00", // Logged late on 21st
          note: "Listrik PLN",
          created_at: "2025-01-21T23:55:00Z",
        },
      ];

      // Bank processed it on the next day (2025-01-22)
      const csvData = [
        "Tanggal,Keterangan,Nominal,Tipe",
        "2025-01-22,Listrik PLN,250000,Pengeluaran",
      ].join("\n");

      const result = parseStatementText(csvData, existingTxs, mockCategories, undefined, mockWallets);
      expect(result.items.length).toBe(1);

      // Should be flagged for review under 48-hour tolerance rule
      expect(result.items[0].isDuplicate).toBe(true);
      expect(result.items[0].needsReview).toBe(true);
      expect(result.items[0].selected).toBe(true); // Kept checked for user verification
      expect(result.items[0].duplicateReason).toContain("toleransi 48 jam");
    });
  });

  describe("4. Arrow Transfer Splitting from Description", () => {
    it("automatically detects transfer and resolves source and destination wallets from description text", () => {
      const csvData = [
        "Tanggal,Keterangan,Nominal,Tipe",
        "2025-01-21,BCA → Mandiri,500000,Pengeluaran",
        "2025-01-21,ShopeePay -> Cash,150000,Pengeluaran",
      ].join("\n");

      const result = parseStatementText(csvData, [], mockCategories, undefined, mockWallets);
      expect(result.items.length).toBe(2);

      // Item 1: BCA → Mandiri
      expect(result.items[0].type).toBe("transfer");
      expect(result.items[0].walletId).toBe("w-bca");
      expect(result.items[0].walletName).toBe("BCA");
      expect(result.items[0].destinationWalletId).toBe("w-mandiri");
      expect(result.items[0].destinationWalletName).toBe("Mandiri");

      // Item 2: ShopeePay -> Cash
      expect(result.items[1].type).toBe("transfer");
      expect(result.items[1].walletName).toBe("ShopeePay"); // Auto-detected new wallet name
      expect(result.items[1].destinationWalletId).toBe("w-cash");
      expect(result.items[1].destinationWalletName).toBe("Cash");
    });
  });

  describe("5. Placeholder Note Sanitization (Rule 8.1)", () => {
    it("sanitizes dashes, hyphens, and n/a placeholders to clean empty strings", () => {
      expect(sanitizeNote("-")).toBe("");
      expect(sanitizeNote("--")).toBe("");
      expect(sanitizeNote("   -   ")).toBe("");
      expect(sanitizeNote("—")).toBe(""); // em dash
      expect(sanitizeNote("–")).toBe(""); // en dash
      expect(sanitizeNote("n/a")).toBe("");
      expect(sanitizeNote("none")).toBe("");
      expect(sanitizeNote("null")).toBe("");
      expect(sanitizeNote(".")).toBe("");

      // Genuine notes must be preserved intact
      expect(sanitizeNote("Beli kopi pagi")).toBe("Beli kopi pagi");
      expect(sanitizeNote("TRSF-12345")).toBe("TRSF-12345");
    });
  });

  describe("6. Arrow Mojibake & Artifact Sanitization", () => {
    it("normalizes corrupted unicode artifacts, prepositions, and ASCII arrows to standard '→'", () => {
      expect(sanitizeTransferArrowText("BCA â†’ Mandiri")).toBe("BCA → Mandiri");
      expect(sanitizeTransferArrowText("BCA -> Mandiri")).toBe("BCA → Mandiri");
      expect(sanitizeTransferArrowText("BCA --> Mandiri")).toBe("BCA → Mandiri");
      expect(sanitizeTransferArrowText("BCA => Mandiri")).toBe("BCA → Mandiri");
      expect(sanitizeTransferArrowText("BCA ke Mandiri")).toBe("BCA → Mandiri");
      expect(sanitizeTransferArrowText("BCA to Mandiri")).toBe("BCA → Mandiri");
    });
  });
});
