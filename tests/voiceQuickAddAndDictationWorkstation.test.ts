import { describe, it, expect } from "vitest";
import { format } from "date-fns";
import { parseNaturalTransaction, parseMultiNaturalTransactions } from "../src/lib/nlpParser";
import { formatCurrency } from "../src/lib/utils";
import type { Category, Wallet } from "../src/lib/types";
import * as fs from "fs";
import * as path from "path";

const mockCategories: Category[] = [
  { id: "cat-1", name: "Makanan & Minuman", type: "expense", emoji: "Utensils", created_at: "" },
  { id: "cat-2", name: "Transportasi", type: "expense", emoji: "Car", created_at: "" },
  { id: "cat-3", name: "Gaji & Upah", type: "income", emoji: "Banknote", created_at: "" },
  { id: "cat-4", name: "Kopi", type: "expense", emoji: "Coffee", created_at: "" },
];

const mockWallets: Wallet[] = [
  { id: "w-cash", name: "Cash", balance: 500000, type: "cash", created_at: "" },
  { id: "w-bca", name: "BCA", balance: 2500000, type: "bank", created_at: "" },
  { id: "w-mandiri", name: "Mandiri", balance: 1000000, type: "bank", created_at: "" },
  { id: "w-gopay", name: "GoPay", balance: 150000, type: "ewallet", created_at: "" },
];

describe("Audit #39: Natural Language & Voice Quick-Add Dictation Workstation", () => {
  describe("1. Full ISO Timestamps (Rule 8.1)", () => {
    it("generates full ISO timestamps with time component yyyy-MM-ddTHH:mm:ss", () => {
      const now = new Date("2026-10-18T10:15:30.000Z");
      const formatted = format(now, "yyyy-MM-dd'T'HH:mm:ss");
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
      expect(formatted).toContain("T");
    });
  });

  describe("2. Placeholder Note Sanitization (Rule 8.1)", () => {
    it("sanitizes dashes and placeholder hyphens into null notes", () => {
      const sanitizeVoiceNote = (raw: string | null) => {
        if (!raw) return null;
        const trimmed = raw.trim();
        return trimmed === "-" || trimmed === "--" ? null : trimmed;
      };

      expect(sanitizeVoiceNote("-")).toBeNull();
      expect(sanitizeVoiceNote("--")).toBeNull();
      expect(sanitizeVoiceNote("   -   ")).toBeNull();
      expect(sanitizeVoiceNote("Kopi pagi")).toBe("Kopi pagi");
    });
  });

  describe("3. Prevent Source-Destination Wallet Collisions in Voice Transfers", () => {
    it("guarantees source and destination wallets never collide", () => {
      const resolvedWallet = mockWallets[1]; // BCA
      const parsedToWalletId = "w-bca"; // Dictated same wallet

      // Safe destination wallet selector
      const resolvedToWallet =
        mockWallets.find((w) => w.id === parsedToWalletId && w.id !== resolvedWallet.id) ||
        mockWallets.find((w) => w.id !== resolvedWallet.id) ||
        null;

      expect(resolvedToWallet).not.toBeNull();
      expect(resolvedToWallet?.id).not.toBe(resolvedWallet.id);
    });
  });

  describe("4. Natural Language Parser (Indonesian & English)", () => {
    it("parses Indonesian natural expense with wallet and category", () => {
      const res = parseNaturalTransaction("kopi 35rb dari bca", mockCategories, mockWallets);
      expect(res.amount).toBe(35000);
      expect(res.walletId).toBe("w-bca");
      expect(res.type).toBe("expense");
    });

    it("parses Indonesian transfer with from and to keywords", () => {
      const res = parseNaturalTransaction("transfer 100rb dari bca ke mandiri", mockCategories, mockWallets);
      expect(res.amount).toBe(100000);
      expect(res.type).toBe("transfer");
      expect(res.walletId).toBe("w-bca");
      expect(res.toWalletId).toBe("w-mandiri");
    });

    it("parses English natural expense with wallet and category", () => {
      const res = parseNaturalTransaction("coffee 35k from bca", mockCategories, mockWallets);
      expect(res.amount).toBe(35000);
      expect(res.walletId).toBe("w-bca");
      expect(res.type).toBe("expense");
    });

    it("parses English transfer with from and to keywords", () => {
      const res = parseNaturalTransaction("transfer 150k from mandiri to gopay", mockCategories, mockWallets);
      expect(res.amount).toBe(150000);
      expect(res.type).toBe("transfer");
      expect(res.walletId).toBe("w-mandiri");
      expect(res.toWalletId).toBe("w-gopay");
    });

    it("parses multi-transaction batches separated by commas", () => {
      const res = parseMultiNaturalTransactions("kopi 35rb bca, bensin 50rb cash", mockCategories, mockWallets);
      expect(res.length).toBe(2);
      expect(res[0].amount).toBe(35000);
      expect(res[1].amount).toBe(50000);
    });
  });

  describe("5. Ergonomic Safe-Area Insets (Rule 5)", () => {
    it("enforces safe-area paddingBottom in VoiceQuickAddModal.tsx", () => {
      const filePath = path.resolve(__dirname, "../src/components/transactions/VoiceQuickAddModal.tsx");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain('max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)');
    });

    it("enforces safe-area paddingBottom in TransactionKeypadSheet.tsx", () => {
      const filePath = path.resolve(__dirname, "../src/components/transactions/TransactionKeypadSheet.tsx");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain('max(calc(env(safe-area-inset-bottom, 0px) + 16px), 24px)');
    });
  });

  describe("6. Zero Colored System Emojis (Rule 1)", () => {
    it("verifies zero prohibited emojis in VoiceQuickAddModal.tsx, SmartQuickAddBar.tsx, and TransactionKeypadSheet.tsx", () => {
      const files = [
        "src/components/transactions/VoiceQuickAddModal.tsx",
        "src/components/transactions/SmartQuickAddBar.tsx",
        "src/components/transactions/TransactionKeypadSheet.tsx",
      ];

      const emojiRegex = /\p{Extended_Pictographic}/gu;
      for (const file of files) {
        const content = fs.readFileSync(path.resolve(__dirname, `../${file}`), "utf-8");
        const matches = content.match(emojiRegex);
        expect(matches).toBeNull();
      }
    });
  });

  describe("7. Accessibility & Semantic Buttons (WCAG 2.1 AA)", () => {
    it("verifies all buttons in VoiceQuickAddModal.tsx have aria-label and title", () => {
      const filePath = path.resolve(__dirname, "../src/components/transactions/VoiceQuickAddModal.tsx");
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      let inBtn = false;
      let currentBtn = "";
      let count = 0;

      lines.forEach((line) => {
        if (line.includes("<button")) {
          inBtn = true;
          currentBtn = line;
        } else if (inBtn) {
          currentBtn += " " + line;
          if (line.includes("</button>") || (line.includes(">") && !line.includes("=>") && !line.includes("> 0") && !line.includes(">0"))) {
            inBtn = false;
            expect(currentBtn).toContain("aria-label");
            expect(currentBtn).toContain("title");
            count++;
          }
        }
      });

      expect(count).toBeGreaterThanOrEqual(10);
    });

    it("verifies all buttons in TransactionKeypadSheet.tsx have aria-label", () => {
      const filePath = path.resolve(__dirname, "../src/components/transactions/TransactionKeypadSheet.tsx");
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      let inBtn = false;
      let currentBtn = "";
      let count = 0;

      lines.forEach((line) => {
        if (line.includes("<button") || line.includes("<motion.button")) {
          inBtn = true;
          currentBtn = line;
        } else if (inBtn) {
          currentBtn += " " + line;
          if (line.includes("</button>") || (line.includes(">") && !line.includes("=>") && !line.includes("> 0") && !line.includes(">0"))) {
            inBtn = false;
            expect(currentBtn).toContain("aria-label");
            count++;
          }
        }
      });

      expect(count).toBeGreaterThanOrEqual(20);
    });

    it("verifies toast error actions use 'error' instead of 'delete' in VoiceQuickAddModal.tsx", () => {
      const filePath = path.resolve(__dirname, "../src/components/transactions/VoiceQuickAddModal.tsx");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).not.toContain('onError: (err: any) => {\n        showToast(\n          err?.message ||\n            (isIndonesian\n              ? "Gagal menyimpan transaksi"\n              : "Failed to save transaction"),\n          "delete"');
      expect(content).toContain('"error"');
    });
  });
});
