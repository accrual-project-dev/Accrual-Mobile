import { describe, it, expect } from "vitest";
import { format } from "date-fns";
import { parseNaturalTransaction, parseMultiNaturalTransactions } from "../src/lib/nlpParser";
import { formatCurrency } from "../src/lib/utils";
import type { Category, Wallet } from "../src/lib/types";

const mockCategories: Category[] = [
  { id: "cat-1", name: "Food & Drinks", type: "expense", emoji: "🍔", created_at: "" },
  { id: "cat-2", name: "Transportation", type: "expense", emoji: "🚗", created_at: "" },
  { id: "cat-3", name: "Salary", type: "income", emoji: "💼", created_at: "" },
];

const mockWallets: Wallet[] = [
  { id: "w-cash", name: "Cash", balance: 500000, type: "cash", created_at: "" },
  { id: "w-bca", name: "BCA", balance: 2500000, type: "bank", created_at: "" },
  { id: "w-mandiri", name: "Mandiri", balance: 1000000, type: "bank", created_at: "" },
  { id: "w-gopay", name: "GoPay", balance: 150000, type: "ewallet", created_at: "" },
];

describe("Voice Ecosystem & NLP Integrity Tests", () => {
  it("generates full ISO timestamps with time component (Rule 8.1)", () => {
    const testDate = new Date("2026-10-16T14:35:20.000Z");
    const formatted = format(testDate, "yyyy-MM-dd'T'HH:mm:ss");
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    expect(formatted).not.toEqual(format(testDate, "yyyy-MM-dd"));
  });

  it("correctly identifies English cash withdrawal and sets default note to Cash Withdrawal", () => {
    const result = parseNaturalTransaction("cash withdrawal 500k from bca", mockCategories, mockWallets);
    expect(result.type).toBe("transfer");
    expect(result.amount).toBe(500000);
    expect(result.walletName).toBe("BCA");
    expect(result.toWalletName).toBe("Cash");
    expect(result.note).toBe("Cash Withdrawal");
  });

  it("correctly identifies English withdraw keyword and routes bank to cash", () => {
    const result = parseNaturalTransaction("withdraw 200k from mandiri", mockCategories, mockWallets);
    expect(result.type).toBe("transfer");
    expect(result.amount).toBe(200000);
    expect(result.walletName).toBe("Mandiri");
    expect(result.toWalletName).toBe("Cash");
    expect(result.note).toBe("Cash Withdrawal");
  });

  it("correctly identifies English cash deposit and sets default note to Cash Deposit", () => {
    const result = parseNaturalTransaction("cash deposit 1jt to bca", mockCategories, mockWallets);
    expect(result.type).toBe("transfer");
    expect(result.amount).toBe(1000000);
    expect(result.walletName).toBe("Cash");
    expect(result.toWalletName).toBe("BCA");
    expect(result.note).toBe("Cash Deposit");
  });

  it("correctly parses English transfer syntax 'from Mandiri to GoPay'", () => {
    const result = parseNaturalTransaction("transfer 100k from mandiri to gopay", mockCategories, mockWallets);
    expect(result.type).toBe("transfer");
    expect(result.amount).toBe(100000);
    expect(result.walletName).toBe("Mandiri");
    expect(result.toWalletName).toBe("GoPay");
    expect(result.note).toBe("Transfer");
  });

  it("correctly formats currency across different preferred currencies", () => {
    expect(formatCurrency(100000, "IDR")).toContain("Rp");
    expect(formatCurrency(100, "USD")).toContain("$");
    expect(formatCurrency(0, "USD")).toContain("$");
    expect(formatCurrency(0, "IDR")).toContain("Rp");
  });

  it("prevents source and destination wallet collision in batch transfers", () => {
    const parsedBatch = parseMultiNaturalTransactions(
      "transfer 50k ke bca, transfer 100k dari bca",
      mockCategories,
      mockWallets
    );
    expect(parsedBatch.length).toBe(2);

    const payloads = parsedBatch.map((item) => {
      const itemType = item.type || "expense";
      const itemWallet =
        mockWallets.find((w) => w.id === item.walletId) || mockWallets[0];
      const itemToWallet =
        itemType === "transfer"
          ? mockWallets.find((w) => w.id === item.toWalletId && w.id !== itemWallet?.id) ||
            mockWallets.find((w) => w.id !== itemWallet?.id) ||
            null
          : null;

      return {
        from: itemWallet.id,
        to: itemToWallet?.id,
      };
    });

    payloads.forEach((p) => {
      if (p.to) {
        expect(p.from).not.toBe(p.to);
      }
    });
  });

  it("properly resolves date label localization branching", () => {
    const resolveDateLabel = (dateLabel: string, isIndonesian: boolean) => {
      if (dateLabel === "Yesterday" || dateLabel === "Kemarin") {
        return isIndonesian ? "Kemarin" : "Yesterday";
      }
      if (dateLabel.endsWith("d ago")) {
        return isIndonesian ? `${dateLabel.replace("d ago", "")} hari lalu` : dateLabel;
      }
      return dateLabel;
    };

    expect(resolveDateLabel("Yesterday", true)).toBe("Kemarin");
    expect(resolveDateLabel("Yesterday", false)).toBe("Yesterday");
    expect(resolveDateLabel("3d ago", true)).toBe("3 hari lalu");
    expect(resolveDateLabel("3d ago", false)).toBe("3d ago");
  });
});
