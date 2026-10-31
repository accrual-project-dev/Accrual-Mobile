import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  parseBankNotification,
  isPromotionalOrSpamNotification,
} from "../bankNotificationParser";
import { parseDeepLink } from "../deepLinkHandler";
import {
  saveDraftBatch,
  getAllDraftItems,
  removeDraftItems,
  clearAllDrafts,
} from "../draftTransactionService";
import { isValidICloudLink } from "../shortcutsConfig";
import type { Category, Wallet } from "../types";

const mockCategories: Category[] = [
  { id: "cat-food", name: "Makanan & Minuman", emoji: "Utensils", type: "expense", is_default: true, created_at: "", user_id: "u1" },
  { id: "cat-transport", name: "Transportasi", emoji: "Car", type: "expense", is_default: false, created_at: "", user_id: "u1" },
  { id: "cat-shopping", name: "Belanja", emoji: "ShoppingBag", type: "expense", is_default: false, created_at: "", user_id: "u1" },
  { id: "cat-income", name: "Gaji", emoji: "Wallet", type: "income", is_default: false, created_at: "", user_id: "u1" },
];

const mockWallets: Wallet[] = [
  { id: "wal-bca", name: "BCA", balance: 5000000, icon: "Landmark", created_at: "", user_id: "u1" },
  { id: "wal-gopay", name: "GoPay", balance: 500000, icon: "Wallet", created_at: "", user_id: "u1" },
  { id: "wal-spay", name: "ShopeePay", balance: 300000, icon: "Wallet", created_at: "", user_id: "u1" },
];

describe("Shortcuts & Automation Reform Suite", () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", { dispatchEvent: () => true });
    vi.stubGlobal("CustomEvent", class {});
    vi.stubGlobal("localStorage", { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value), removeItem: (key: string) => store.delete(key) });
    clearAllDrafts();
    localStorage.setItem("trouvaille_active_space_id", "space-business");
  });

  describe("1. Smart Notification Parser (3-Layer Promo, Voucher, Cashback & OTP Shield)", () => {
    it("blocks promotional notifications containing diskon, cashback, voucher, promo, reward, or kupon", () => {
      expect(
        isPromotionalOrSpamNotification(
          "Spesial Payday! Klaim Voucher Cashback Rp 50.000 untuk pembayaran QRIS di ShopeePay!",
          "ShopeePay Promo",
        ),
      ).toBe(true);

      const parsed = parseBankNotification(
        "Dapatkan diskon hingga Rp 100.000 pakai GoPay di merchant favoritmu!",
        mockCategories,
        mockWallets,
        { sourceApp: "GoPay" },
      );
      expect(parsed).toBeNull();
    });

    it("blocks OTP, login alerts, and failed transaction notifications", () => {
      expect(
        isPromotionalOrSpamNotification(
          "Jangan berikan kode OTP BCA: 492811 untuk transaksi Rp 250.000",
          "BCA mobile",
        ),
      ).toBe(true);

      expect(
        isPromotionalOrSpamNotification(
          "Pembayaran QRIS sebesar Rp 45.000 di Kopi Kenangan GAGAL karena saldo tidak mencukupi.",
          "GoPay",
        ),
      ).toBe(true);
    });

    it("accurately parses real transaction notifications and maps sourceApp metadata when body lacks bank name", () => {
      const parsed = parseBankNotification(
        "Pembayaran QRIS sebesar Rp 38.500 di Kopi Kenangan berhasil.",
        mockCategories,
        mockWallets,
        {
          title: "Transaksi Berhasil",
          subtitle: "QRIS",
          sourceApp: "GoPay",
          receivedAt: "2026-10-30T10:15:00",
        },
      );
      expect(parsed).not.toBeNull();
      expect(parsed!.amount).toBe(38500);
      expect(parsed!.suggestedWalletId).toBe("wal-gopay");
      expect(parsed!.suggestedCategoryId).toBe("cat-food");
      expect(parsed!.merchantOrNote).toBe("Kopi Kenangan");
    });

    it("extracts main payment amount accurately even when real receipt mentions secondary 'Hemat Rp 5.000'", () => {
      const parsed = parseBankNotification(
        "Pembayaran berhasil Rp 55.000 di Mie Gacoan (Kamu hemat Rp 5.000).",
        mockCategories,
        mockWallets,
        { sourceApp: "ShopeePay" },
      );
      expect(parsed).not.toBeNull();
      expect(parsed!.amount).toBe(55000);
      expect(parsed!.suggestedWalletId).toBe("wal-spay");
    });
  });

  describe("2. Deep Link Handler & Active Space Draft Routing", () => {
    it("flags promotional notification deep links with isIgnoredPromo: true", () => {
      const res = parseDeepLink(
        "accrual://notify?text=Promo%20Cashback%20Rp%2050.000%20di%20GoPay&title=Promo%20Spesial&app=GoPay",
        mockCategories,
        mockWallets,
        [],
        "space-business",
      );
      expect(res.action).toBe("none");
      expect(res.isIgnoredPromo).toBe(true);
    });

    it("routes Glass Dialog URL scheme to Active Space with full date, time, category, account, and note", () => {
      const res = parseDeepLink(
        "accrual://glass-dialog?amount=75.000&category=Makanan%20&%20Minuman&wallet=BCA&datetime=2026-10-30%2014:45&note=Makan%20Siang%20Tim&draft=true",
        mockCategories,
        mockWallets,
        [],
        "space-business",
      );
      expect(res.action).toBe("transaction");
      expect(res.fromShortcut).toBe(true);
      expect(res.sourceChannel).toBe("glass_dialog");
      expect(res.spaceId).toBe("space-business");
      expect(res.prefilledValues?.amount).toBe(75000);
      expect(res.prefilledValues?.category_id).toBe("cat-food");
      expect(res.prefilledValues?.wallet_id).toBe("wal-bca");
      expect(res.prefilledValues?.time).toBe("14:45");
      expect(res.prefilledValues?.note).toBe("Makan Siang Tim");
    });

    it("decomposes Smart Text multi-expense string into batch_review items bound to Active Space", () => {
      const res = parseDeepLink(
        "accrual://smart-text?text=Kopi%2025rb%20dan%20bensin%2050rb%20pakai%20BCA&draft=true",
        mockCategories,
        mockWallets,
        [],
        "space-business",
      );
      expect(res.action).toBe("batch_review");
      expect(res.sourceChannel).toBe("smart_text");
      expect(res.spaceId).toBe("space-business");
      expect(res.batchItems).toBeDefined();
      expect(res.batchItems!.length).toBe(2);
      expect(res.batchItems![0].spaceId).toBe("space-business");
    });
  });

  describe("3. Draft Inbox Active Space Isolation & Approval Cleanup", () => {
    it("scopes drafts to Active Space and removes approved items cleanly via removeDraftItems", () => {
      saveDraftBatch(
        [
          {
            id: "draft-item-1",
            date: "2026-10-30",
            time: "09:30",
            description: "Kopi Pagi",
            cleanDescription: "Kopi Pagi",
            amount: 25000,
            type: "expense",
            walletId: "wal-bca",
            walletName: "BCA",
            suggestedCategoryId: "cat-food",
            suggestedCategoryName: "Makanan & Minuman",
            suggestedCategoryEmoji: "Utensils",
            isDuplicate: false,
            selected: true,
            raw: "Kopi Pagi 25000",
          },
          {
            id: "draft-item-2",
            date: "2026-10-30",
            time: "12:15",
            description: "Makan Siang",
            cleanDescription: "Makan Siang",
            amount: 55000,
            type: "expense",
            walletId: "wal-bca",
            walletName: "BCA",
            suggestedCategoryId: "cat-food",
            suggestedCategoryName: "Makanan & Minuman",
            suggestedCategoryEmoji: "Utensils",
            isDuplicate: false,
            selected: true,
            raw: "Makan Siang 55000",
          },
        ],
        "Dialog Kaca",
        "glass_dialog",
        "space-business",
      );

      expect(getAllDraftItems("space-business").length).toBe(2);
      expect(getAllDraftItems("personal").length).toBe(0);

      // Approve item 1
      removeDraftItems(["draft-item-1"]);
      const remaining = getAllDraftItems("space-business");
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe("draft-item-2");

      // Approve item 2
      removeDraftItems(["draft-item-2"]);
      expect(getAllDraftItems("space-business").length).toBe(0);
    });
  });

  describe("4. iCloud Shortcut Link Validation (Fake Placeholder Rejection)", () => {
    it("rejects known synthetic placeholder hex strings while accepting real 32-hex iCloud links", () => {
      expect(
        isValidICloudLink("https://www.icloud.com/shortcuts/b01a608a4e0d4207970945a8f8c45f3f"),
      ).toBe(false);
      expect(
        isValidICloudLink("https://www.icloud.com/shortcuts/c01a608a4e0d4207970945a8f8c45f3f"),
      ).toBe(false);
      expect(
        isValidICloudLink("https://www.icloud.com/shortcuts/94f82c11a8b44903bc129876543210ab"),
      ).toBe(true);
    });
  });
});
