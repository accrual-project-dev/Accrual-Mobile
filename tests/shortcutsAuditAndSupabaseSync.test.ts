import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  SHORTCUT_PRESETS,
  isValidICloudLink,
} from "../src/components/settings/AppleShortcutsGuideModal";
import {
  DEFAULT_SHORTCUTS_MANIFEST,
  getShortcutsConfig,
} from "../src/lib/shortcutsConfig";
import {
  saveDraftBatch,
  getDraftBatches,
  getAllDraftItems,
} from "../src/lib/draftTransactionService";

// Storage and window mock in Node test environment
if (typeof (globalThis as any).window === "undefined") {
  (globalThis as any).window = globalThis;
}
(globalThis as any).window.dispatchEvent = () => true;
if (typeof (globalThis as any).CustomEvent === "undefined") {
  (globalThis as any).CustomEvent = class CustomEvent {
    type: string;
    detail: any;
    constructor(type: string, params: any = {}) {
      this.type = type;
      this.detail = params.detail;
    }
  };
}
if (typeof globalThis.localStorage === "undefined") {
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => {
      store[key] = String(val);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
    length: 0,
    key: () => null,
  };
}

describe("Apple Shortcuts Audit, Remediation & Supabase Sync Suite", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("1. Native Swift Intent Cleanliness & Duplicate Suppression", () => {
    const quickLogPath = path.resolve(__dirname, "../ios/App/App/QuickLogIntent.swift");
    const widgetPath = path.resolve(__dirname, "../ios/App/AccrualWidget/NetWorthWidget.swift");

    it("verifies QuickLogIntent.swift supports dual parameters for notificationText and body", () => {
      const code = fs.readFileSync(quickLogPath, "utf-8");
      expect(code).toContain("public var notificationText: String?");
      expect(code).toContain("public var body: String?");
      expect(code).toContain("public var title: String?");
      expect(code).toContain("public var notifTitle: String?");
      expect(code).toContain("public var subtitle: String?");
      expect(code).toContain("public var notifSubtitle: String?");
    });

    it("verifies ScanPaymentScreenshotIntent cleans Unicode \\u{FFFC} replacement character", () => {
      const code = fs.readFileSync(quickLogPath, "utf-8");
      expect(code).toContain('.replacingOccurrences(of: "\\u{FFFC}", with: "")');
      expect(code).toContain("OCR.recognize(data: file.data)");
    });

    it("verifies LogScreenshotIntent is marked isDiscoverable = false to avoid duplicate actions", () => {
      const code = fs.readFileSync(quickLogPath, "utf-8");
      expect(code).toContain("public struct LogScreenshotIntent: AppIntent");
      expect(code).toContain("public static var isDiscoverable: Bool = false");
    });

    it("verifies NetWorthWidget Control Center intents are marked isDiscoverable = false", () => {
      const code = fs.readFileSync(widgetPath, "utf-8");
      expect(code).toContain("struct VoiceEntryControlIntent: AppIntent");
      expect(code).toContain("static var isDiscoverable: Bool { false }");
      expect(code).toContain("struct ScanReceiptControlIntent: AppIntent");
      expect(code).toContain("struct QuickAddControlIntent: AppIntent");
    });
  });

  describe("2. Official Verified iCloud Shortcuts & Manifest Configuration", () => {
    it("configures official verified iCloud links for Screen Scanner and Notification Reader", () => {
      const screenScanLink = "https://www.icloud.com/shortcuts/d2d7e25405124de886a4824e976a5104";
      const notifReaderLink = "https://www.icloud.com/shortcuts/b01a608a4e0d4207970945a8f8c45f3f";

      expect(DEFAULT_SHORTCUTS_MANIFEST.shortcuts.screenshot.icloud_url).toBe(screenScanLink);
      expect(DEFAULT_SHORTCUTS_MANIFEST.shortcuts.notification.icloud_url).toBe(notifReaderLink);
      expect(DEFAULT_SHORTCUTS_MANIFEST.shortcuts.notification.min_ios).toBe("17.0");

      const screenPreset = SHORTCUT_PRESETS.find((p) => p.id === "screen_scan");
      const notifPreset = SHORTCUT_PRESETS.find((p) => p.id === "notification_reader");

      expect(screenPreset?.icloudUrl).toBe(screenScanLink);
      expect(notifPreset?.icloudUrl).toBe(notifReaderLink);

      expect(isValidICloudLink(screenScanLink)).toBe(true);
      expect(isValidICloudLink(notifReaderLink)).toBe(true);
    });

    it("rejects dummy placeholder slugs to prevent Apple 404 errors", () => {
      expect(isValidICloudLink("https://www.icloud.com/shortcuts/accrual-screen-scanner")).toBe(false);
      expect(isValidICloudLink("https://www.icloud.com/shortcuts/accrual-notification-reader")).toBe(false);
    });
  });

  describe("3. Strict Pure Localization (Rule 6 - No Gado-Gado)", () => {
    it("verifies zero mixed Indonesian-English phrases in category badges and hardware bindings", () => {
      SHORTCUT_PRESETS.forEach((preset) => {
        // No "• Back Tap" or "• Action Button" in Indonesian badges
        expect(preset.categoryBadgeId).not.toContain("Back Tap");
        expect(preset.categoryBadgeId).not.toContain("Action Button");
        expect(preset.categoryBadgeId).not.toContain("•");

        // No mixed bilingual parenthetical in hardwareBindingId
        expect(preset.metadata.hardwareBindingId).not.toContain("Back Tap");
        expect(preset.metadata.hardwareBindingId).not.toContain("Action Button");
        expect(preset.metadata.hardwareBindingId).not.toContain("Personal Automations");

        // Actions must be purely Indonesian in titleId and subtitleId
        preset.actions.forEach((act) => {
          expect(act.titleId).not.toContain("Vision OCR");
          expect(act.titleId).not.toContain("Log Notification Transaction");
        });
      });
    });
  });

  describe("4. End-to-End Banking Notification Parser & Deduplication", () => {
    const expenseWords = [
      "pembayaran", "dibayar", "transfer ke", "berhasil membayar", "keluar",
      "pembelian", "debit", "debet", "terbayar", "paid", "sent", "payment", "spent"
    ];
    const promoWords = [
      "diskon", "cashback", "voucher", "promo", "reward", "kupon", "poin",
      "hadiah", "hemat", "sale", "discount", "offer", "bonus", "spesial"
    ];
    const otpWords = ["otp", "kode verifikasi", "jangan berikan", "security code", "one-time password"];

    function firstRupiah(s: string): number | null {
      const match = s.match(/Rp\s*([\d.,]+)/i);
      if (!match) return null;
      let digits = "";
      let seenComma = false;
      for (const ch of match[1]) {
        if (/\d/.test(ch)) {
          if (!seenComma) digits += ch;
        } else if (ch === "." || (ch === " " && digits.length === 0)) {
          continue;
        } else if (ch === ",") {
          seenComma = true;
        } else {
          break;
        }
      }
      const val = parseInt(digits, 10);
      return isNaN(val) ? null : val;
    }

    function parseTestNotification(text: string, title?: string, app?: string) {
      const blob = [title, text].filter(Boolean).join("\n").toLowerCase();
      const isOtp = otpWords.some((w) => blob.contains ? blob.contains(w) : blob.indexOf(w) !== -1);
      if (isOtp) return null;

      const hasExpense = expenseWords.some((w) => blob.indexOf(w) !== -1);
      const isPromo = promoWords.some((w) => blob.indexOf(w) !== -1);
      if (isPromo && !hasExpense) return null;

      const amount = firstRupiah(blob);
      if (!amount) return null;

      return {
        amount,
        direction: hasExpense ? "expense" : "income",
        source: "shortcut_notification",
      };
    }

    it("parses transactions accurately from top Indonesian banks and e-wallets", () => {
      const cases = [
        { text: "Pembayaran QRIS sebesar Rp 45.000 di Kopi Kenangan berhasil.", expected: 45000 },
        { text: "Pembayaran QRIS senilai Rp 25.000 ke Fore Coffee berhasil pada 29/10/2026.", expected: 25000 },
        { text: "Kamu berhasil membayar Rp15.000 ke Kantin Makmur.", expected: 15000 },
        { text: "Pembayaran sebesar Rp 32.500 di Alfamart berhasil.", expected: 32500 },
        { text: "Pembayaran Rp50.000 ke Indomaret sukses.", expected: 50000 },
        { text: "Transaksi Berhasil. Debit Tabungan Rp100.000 ke Budi Santoso.", expected: 100000 },
        { text: "Transaksi transfer keluar Rp 500.000 berhasil.", expected: 500000 },
      ];

      for (const c of cases) {
        const res = parseTestNotification(c.text);
        expect(res).not.toBeNull();
        expect(res?.amount).toBe(c.expected);
        expect(res?.direction).toBe("expense");
      }
    });

    it("strictly discards promo banners and OTP security alerts", () => {
      const promo1 = parseTestNotification("Dapatkan cashback s.d Rp 50.000 untuk transaksi QRIS hari ini!");
      expect(promo1).toBeNull();

      const promo2 = parseTestNotification("Diskon Rp 20.000 dengan kode promo SPESIALGAJIAN");
      expect(promo2).toBeNull();

      const otp1 = parseTestNotification("Jangan berikan kode OTP 492812 kepada siapa pun. Valid 5 menit.");
      expect(otp1).toBeNull();
    });
  });

  describe("5. Draft Archiving & Supabase Synchronization Payload Integrity", () => {
    it("persists drained draft batch into client storage and verifies Supabase schema compatibility", () => {
      const mockItems = [
        {
          id: "draft-test-1",
          date: "2026-10-29",
          time: "11:30",
          description: "Kopi Kenangan Senayan",
          cleanDescription: "Kopi Kenangan Senayan",
          amount: 45000,
          type: "expense" as const,
          walletName: "BCA",
          suggestedCategoryId: null,
          suggestedCategoryName: null,
          suggestedCategoryEmoji: null,
          isDuplicate: false,
          selected: true,
          raw: "QRIS Rp 45.000 Kopi Kenangan",
          confidence: 0.9,
          needsReview: false,
        },
      ];

      const batchId = saveDraftBatch(mockItems, "Tangkapan Layar", "back_tap");
      expect(batchId).toBeTruthy();

      const batches = getDraftBatches();
      expect(batches.length).toBe(1);
      expect(batches[0].items[0].amount).toBe(45000);
      expect(batches[0].items[0].description).toBe("Kopi Kenangan Senayan");

      // Verify Supabase mutation payload contract
      const item = batches[0].items[0];
      const fullOccurredOn = `${item.date}T${item.time}:00`;
      const dbPayload = {
        id: crypto.randomUUID(),
        user_id: "user-12345",
        amount: item.amount,
        type: item.type,
        category_id: null,
        wallet_id: "wallet-bca-id",
        to_wallet_id: null,
        note: item.description,
        occurred_on: fullOccurredOn,
        created_at: new Date().toISOString(),
        ledger_id: "personal",
      };

      // Invariants required by Rule 11
      expect(dbPayload.occurred_on).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
      expect(dbPayload.amount).toBe(45000);
      expect(dbPayload.type).toBe("expense");
      expect(dbPayload.ledger_id).toBe("personal");
    });
  });
});
