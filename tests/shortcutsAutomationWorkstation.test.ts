import { describe, it, expect } from "vitest";
import {
  parseDeepLink,
  parseStructuredShortcutText,
  sanitizeDeepLinkNote,
  parseIndonesianDate,
  parseCurrencyAmount,
  extractTimeComponents,
} from "../src/lib/deepLinkHandler";
import type { Category, Wallet } from "../src/lib/types";

const mockCategories: Category[] = [
  {
    id: "c-food",
    user_id: "u1",
    name: "Makanan",
    emoji: "🍜",
    type: "expense",
    is_default: false,
    created_at: new Date().toISOString(),
  },
  {
    id: "c-transport",
    user_id: "u1",
    name: "Transport",
    emoji: "🚗",
    type: "expense",
    is_default: false,
    created_at: new Date().toISOString(),
  },
  {
    id: "c-salary",
    user_id: "u1",
    name: "Gaji",
    emoji: "💰",
    type: "income",
    is_default: false,
    created_at: new Date().toISOString(),
  },
];

const mockWallets: Wallet[] = [
  {
    id: "w-bca",
    user_id: "u1",
    name: "BCA",
    icon: "bca",
    created_at: new Date().toISOString(),
  },
  {
    id: "w-mandiri",
    user_id: "u1",
    name: "Mandiri",
    icon: "mandiri",
    created_at: new Date().toISOString(),
  },
  {
    id: "w-gopay",
    user_id: "u1",
    name: "GoPay",
    icon: "gopay",
    created_at: new Date().toISOString(),
  },
];

describe("Apple Shortcuts & iOS/Android Automation Workstation (Audit #35)", () => {
  describe("1. Note Sanitization (Rule 8.1)", () => {
    it("converts placeholder dashes and hyphens to empty strings", () => {
      expect(sanitizeDeepLinkNote("-")).toBe("");
      expect(sanitizeDeepLinkNote("--")).toBe("");
      expect(sanitizeDeepLinkNote(" - ")).toBe("");
      expect(sanitizeDeepLinkNote("   ")).toBe("");
      expect(sanitizeDeepLinkNote(null)).toBe("");
      expect(sanitizeDeepLinkNote(undefined)).toBe("");
    });

    it("preserves genuine note content", () => {
      expect(sanitizeDeepLinkNote("Lunch with client")).toBe("Lunch with client");
      expect(sanitizeDeepLinkNote("Kopi Susu")).toBe("Kopi Susu");
      expect(sanitizeDeepLinkNote("  Starbucks Reserve  ")).toBe("Starbucks Reserve");
    });
  });

  describe("2. Currency Amount Parser", () => {
    it("parses diverse Indonesian and international currency formats", () => {
      expect(parseCurrencyAmount("50.000")).toBe(50000);
      expect(parseCurrencyAmount("Rp 150.000")).toBe(150000);
      expect(parseCurrencyAmount("Rp1.500.000,50")).toBe(1500000.5);
      expect(parseCurrencyAmount("25,000")).toBe(25000);
      expect(parseCurrencyAmount("125000")).toBe(125000);
      expect(parseCurrencyAmount("0")).toBe(0);
      expect(parseCurrencyAmount("invalid")).toBe(0);
    });
  });

  describe("3. Indonesian and International Date & Time Parsing", () => {
    it("safely extracts hours and minutes", () => {
      expect(extractTimeComponents("14:30")).toEqual({ hours: 14, minutes: 30 });
      expect(extractTimeComponents("09.45")).toEqual({ hours: 9, minutes: 45 });
      expect(extractTimeComponents("5:15 PM")).toEqual({ hours: 17, minutes: 15 });
      expect(extractTimeComponents("12:00 AM")).toEqual({ hours: 0, minutes: 0 });
      expect(extractTimeComponents("at 20:00")).toEqual({ hours: 20, minutes: 0 });
      expect(extractTimeComponents("invalid")).toBeNull();
    });

    it("parses dates without single-number year 0028 regression", () => {
      const parsedDay = parseIndonesianDate("15");
      expect(parsedDay).toBeDefined();
      expect(parsedDay!.getFullYear()).toBeGreaterThanOrEqual(2024);
      expect(parsedDay!.getDate()).toBe(15);
    });

    it("parses DD/MM/YYYY and Indonesian month names", () => {
      const d1 = parseIndonesianDate("25/12/2026");
      expect(d1?.getFullYear()).toBe(2026);
      expect(d1?.getMonth()).toBe(11);
      expect(d1?.getDate()).toBe(25);

      const d2 = parseIndonesianDate("17 Agustus 2026 10:00");
      expect(d2?.getFullYear()).toBe(2026);
      expect(d2?.getMonth()).toBe(7); // August
      expect(d2?.getDate()).toBe(17);
      expect(d2?.getHours()).toBe(10);
    });
  });

  describe("4. Navigation Routes & Modal Schemes", () => {
    it("routes accrual:// and legacy trouvaille:// schemes correctly", () => {
      expect(parseDeepLink("accrual://calendar").action).toBe("navigate");
      expect(parseDeepLink("accrual://calendar").path).toBe("/calendar");

      expect(parseDeepLink("accrual://bills").action).toBe("navigate");
      expect(parseDeepLink("accrual://bills").path).toBe("/bills");

      expect(parseDeepLink("accrual://tagihan").action).toBe("navigate");
      expect(parseDeepLink("accrual://tagihan").path).toBe("/bills");

      expect(parseDeepLink("accrual://settings").action).toBe("navigate");
      expect(parseDeepLink("accrual://settings").path).toBe("/settings");

      expect(parseDeepLink("accrual://reports").action).toBe("navigate");
      expect(parseDeepLink("accrual://reports").path).toBe("/transactions?open=export");

      expect(parseDeepLink("accrual://voice").action).toBe("voice");
      expect(parseDeepLink("accrual://scan").action).toBe("scan");
      expect(parseDeepLink("accrual://import").action).toBe("import");
      expect(parseDeepLink("accrual://restore-balance").action).toBe("restore_balance");
    });
  });

  describe("5. Direct Query Parameter Parsing", () => {
    it("parses English direct query parameters with autoSave", () => {
      const url = "accrual://add?amount=75000&category=Makanan&wallet=BCA&note=Lunch&autosave=true";
      const result = parseDeepLink(url, mockCategories, mockWallets);

      expect(result.action).toBe("transaction");
      expect(result.autoSave).toBe(true);
      expect(result.prefilledValues?.amount).toBe(75000);
      expect(result.prefilledValues?.note).toBe("Lunch");
      expect(result.prefilledValues?.categoryId).toBe("c-food");
      expect(result.prefilledValues?.walletId).toBe("w-bca");
    });

    it("parses Indonesian direct query parameters with otomatis=ya", () => {
      const url = "accrual://add?nominal=120000&kategori=Transport&dompet=Mandiri&catatan=Tol&otomatis=ya";
      const result = parseDeepLink(url, mockCategories, mockWallets);

      expect(result.action).toBe("transaction");
      expect(result.autoSave).toBe(true);
      expect(result.prefilledValues?.amount).toBe(120000);
      expect(result.prefilledValues?.note).toBe("Tol");
      expect(result.prefilledValues?.categoryId).toBe("c-transport");
      expect(result.prefilledValues?.walletId).toBe("w-mandiri");
    });

    it("sanitizes placeholder notes in direct query scheme", () => {
      const url = "accrual://add?nominal=50000&kategori=Makanan&dompet=BCA&catatan=-";
      const result = parseDeepLink(url, mockCategories, mockWallets);

      expect(result.action).toBe("transaction");
      expect(result.prefilledValues?.amount).toBe(50000);
      expect(result.prefilledValues?.note).toBe("");
    });
  });

  describe("6. Structured Multi-Line Text Parsing (iOS Shortcuts Dialog)", () => {
    it("parses standard Indonesian 5-line template with placeholder note sanitized", () => {
      const template = "Nominal: 45.000\nKategori: Makanan\nAkun: BCA\nTanggal: 2026-10-18\nCatatan: -";
      const result = parseStructuredShortcutText(template, mockCategories, mockWallets);

      expect(result).not.toBeNull();
      expect(result?.action).toBe("transaction");
      expect(result?.prefilledValues?.amount).toBe(45000);
      expect(result?.prefilledValues?.categoryId).toBe("c-food");
      expect(result?.prefilledValues?.walletId).toBe("w-bca");
      expect(result?.prefilledValues?.note).toBe("");
    });

    it("parses standard English 5-line template with notes", () => {
      const template = "Amount: 185000\nCategory: Transport\nAccount: Mandiri\nDate: 2026-10-18\nNotes: Taxi to airport";
      const result = parseStructuredShortcutText(template, mockCategories, mockWallets);

      expect(result).not.toBeNull();
      expect(result?.action).toBe("transaction");
      expect(result?.prefilledValues?.amount).toBe(185000);
      expect(result?.prefilledValues?.categoryId).toBe("c-transport");
      expect(result?.prefilledValues?.walletId).toBe("w-mandiri");
      expect(result?.prefilledValues?.note).toBe("Taxi to airport");
    });

    it("handles income transaction type in structured text", () => {
      const template = "Nominal: 10.000.000\nKategori: Gaji\nAkun: BCA\nTipe: Pemasukan\nCatatan: Bonus Tahunan";
      const result = parseStructuredShortcutText(template, mockCategories, mockWallets);

      expect(result?.prefilledValues?.amount).toBe(10000000);
      expect(result?.prefilledValues?.type).toBe("income");
      expect(result?.prefilledValues?.categoryId).toBe("c-salary");
    });
  });

  describe("7. Transfer Wallet Collision Prevention", () => {
    it("prevents source and destination wallets from colliding to the same wallet", () => {
      const template = "Nominal: 500.000\nTipe: Transfer\nAkun: BCA\nKe: BCA\nCatatan: Tabungan";
      const result = parseStructuredShortcutText(template, mockCategories, mockWallets);

      expect(result?.prefilledValues?.type).toBe("transfer");
      expect(result?.prefilledValues?.walletId).toBe("w-bca");
      // Destination wallet must NOT be BCA
      expect(result?.prefilledValues?.toWalletId).toBeDefined();
      expect(result?.prefilledValues?.toWalletId).not.toBe("w-bca");
    });

    it("prevents transfer collision in direct query parameters", () => {
      const url = "accrual://add?amount=250000&type=transfer&wallet=Mandiri&to_wallet=Mandiri";
      const result = parseDeepLink(url, mockCategories, mockWallets);

      expect(result.prefilledValues?.type).toBe("transfer");
      expect(result.prefilledValues?.walletId).toBe("w-mandiri");
      expect(result.prefilledValues?.toWalletId).toBeDefined();
      expect(result.prefilledValues?.toWalletId).not.toBe("w-mandiri");
    });
  });
});
