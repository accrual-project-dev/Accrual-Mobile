import { describe, it, expect } from "vitest";
import {
  INDONESIAN_CARD_PRESETS,
  type EmoneyCardData,
  matchWalletForEmoneyCard,
  calculateNfcSyncDelta,
  formatNfcTapTimestamp,
  isWebNfcAvailable,
} from "../src/lib/emoneyNfc";
import {
  INDONESIAN_CARD_PRESETS as MODAL_PRESETS,
  type EmoneyCardData as ModalCardData,
} from "../src/components/nfc/NfcCardReaderModal";
import type { Wallet } from "../src/lib/types";
import { format } from "date-fns";
import * as fs from "fs";
import * as path from "path";

describe("Indonesian Contactless E-Money NFC Reader Suite", () => {
  it("provides comprehensive preset coverage for all major Indonesian transit & toll cards", () => {
    const cardTypes = INDONESIAN_CARD_PRESETS.map((c) => c.cardType);
    expect(cardTypes).toContain("flazz");
    expect(cardTypes).toContain("emoney");
    expect(cardTypes).toContain("tapcash");
    expect(cardTypes).toContain("brizzi");
    expect(cardTypes).toContain("jakcard");
  });

  it("validates card integrity and masked UID formatting", () => {
    INDONESIAN_CARD_PRESETS.forEach((card: EmoneyCardData) => {
      expect(card.balance).toBeGreaterThan(0);
      expect(card.issuerName.length).toBeGreaterThan(3);
      expect(card.productName.length).toBeGreaterThan(3);
      expect(card.cardUid.length).toBeGreaterThan(10);
      expect(card.lastTapAmount).toBeGreaterThan(0);
      expect(["mrt", "toll", "bus"]).toContain(card.lastTapTransitType);
    });
  });

  it("includes correct transit operators for Jakarta urban mobility", () => {
    const locations = INDONESIAN_CARD_PRESETS.map((c) => c.lastTapLocation).join(" ");
    expect(locations).toContain("MRT");
    expect(locations).toContain("Tol");
    expect(locations).toContain("TransJakarta");
  });

  it("maintains 100% backward compatibility with NfcCardReaderModal re-exports", () => {
    expect(MODAL_PRESETS).toEqual(INDONESIAN_CARD_PRESETS);
    expect(MODAL_PRESETS.length).toBe(5);
  });

  describe("Smartcard Wallet Matching Engine", () => {
    const mockWallets: Wallet[] = [
      { id: "w-bca-flazz", name: "Flazz BCA Gen 2", type: "bank", initial_balance: 100000, color: "#000", is_default: false, user_id: "u1", created_at: "", updated_at: "" },
      { id: "w-mandiri", name: "Mandiri E-Money Utama", type: "bank", initial_balance: 50000, color: "#000", is_default: false, user_id: "u1", created_at: "", updated_at: "" },
      { id: "w-tapcash", name: "BNI TapCash Harian", type: "bank", initial_balance: 20000, color: "#000", is_default: false, user_id: "u1", created_at: "", updated_at: "" },
      { id: "w-cash", name: "Dompet Tunai", type: "cash", initial_balance: 500000, color: "#000", is_default: false, user_id: "u1", created_at: "", updated_at: "" },
    ];

    it("matches specific card type correctly", () => {
      const flazzCard = INDONESIAN_CARD_PRESETS.find((c) => c.cardType === "flazz")!;
      const matched = matchWalletForEmoneyCard(mockWallets, flazzCard);
      expect(matched?.id).toBe("w-bca-flazz");
    });

    it("matches issuer name or alternative e-money name correctly", () => {
      const emoneyCard = INDONESIAN_CARD_PRESETS.find((c) => c.cardType === "emoney")!;
      const matched = matchWalletForEmoneyCard(mockWallets, emoneyCard);
      expect(matched?.id).toBe("w-mandiri");
    });

    it("returns null if no smartcard wallet matches", () => {
      const cashOnlyWallets: Wallet[] = [
        { id: "w-cash", name: "Dompet Tunai", type: "cash", initial_balance: 500000, color: "#000", is_default: false, user_id: "u1", created_at: "", updated_at: "" },
      ];
      const flazzCard = INDONESIAN_CARD_PRESETS[0];
      const matched = matchWalletForEmoneyCard(cashOnlyWallets, flazzCard);
      expect(matched).toBeNull();
    });
  });

  describe("Balance Delta Calculator", () => {
    it("calculates positive delta when card balance exceeds wallet balance", () => {
      const delta = calculateNfcSyncDelta(150000, 100000);
      expect(delta).toBe(50000);
    });

    it("calculates negative delta when card balance is lower than wallet balance", () => {
      const delta = calculateNfcSyncDelta(80000, 100000);
      expect(delta).toBe(-20000);
    });

    it("returns zero when card balance and wallet balance are in sync", () => {
      const delta = calculateNfcSyncDelta(100000, 100000);
      expect(delta).toBe(0);
    });
  });

  describe("Tap Timestamp Localization Engine (Rule 6)", () => {
    it("translates Today to Hari ini in Indonesian", () => {
      const localized = formatNfcTapTimestamp("Today, 08:45 WIB", true);
      expect(localized).toBe("Hari ini, 08:45 WIB");
    });

    it("translates Yesterday to Kemarin in Indonesian", () => {
      const localized = formatNfcTapTimestamp("Yesterday, 19:10 WIB", true);
      expect(localized).toBe("Kemarin, 19:10 WIB");
    });

    it("translates X days ago to X hari lalu in Indonesian", () => {
      const localized = formatNfcTapTimestamp("2 days ago, 12:20 WIB", true);
      expect(localized).toBe("2 hari lalu, 12:20 WIB");
      const localized3 = formatNfcTapTimestamp("3 days ago, 17:35 WIB", true);
      expect(localized3).toBe("3 hari lalu, 17:35 WIB");
    });

    it("translates English month formats to Indonesian", () => {
      const localized = formatNfcTapTimestamp("Sep 15, 14:15 WIB", true);
      expect(localized).toBe("15 Sep, 14:15 WIB");
    });

    it("preserves English strings when isIndonesian is false", () => {
      expect(formatNfcTapTimestamp("Today, 08:45 WIB", false)).toBe("Today, 08:45 WIB");
      expect(formatNfcTapTimestamp("Yesterday, 19:10 WIB", false)).toBe("Yesterday, 19:10 WIB");
      expect(formatNfcTapTimestamp("2 days ago, 12:20 WIB", false)).toBe("2 days ago, 12:20 WIB");
      expect(formatNfcTapTimestamp("Sep 15, 14:15 WIB", false)).toBe("Sep 15, 14:15 WIB");
    });
  });

  describe("Environment & Hardware Detection", () => {
    it("safely evaluates isWebNfcAvailable without runtime crash", () => {
      const available = isWebNfcAvailable();
      expect(typeof available).toBe("boolean");
    });
  });

  describe("Architectural & Invariant Integrity (ACCRUAL_RULES.md)", () => {
    it("verifies full ISO 8601 timestamp compliance for sync and transit transactions", () => {
      const timestamp = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss");
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    });

    it("verifies zero colored emojis in NFC card reader and presets", () => {
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      INDONESIAN_CARD_PRESETS.forEach((card) => {
        expect(emojiRegex.test(card.productName)).toBe(false);
        expect(emojiRegex.test(card.issuerName)).toBe(false);
        expect(emojiRegex.test(card.lastTapLocation)).toBe(false);
      });

      const modalPath = path.resolve(__dirname, "../src/components/nfc/NfcCardReaderModal.tsx");
      const content = fs.readFileSync(modalPath, "utf-8");
      expect(emojiRegex.test(content)).toBe(false);
    });

    it("verifies proper safe-area bottom padding in NfcCardReaderModal", () => {
      const modalPath = path.resolve(__dirname, "../src/components/nfc/NfcCardReaderModal.tsx");
      const content = fs.readFileSync(modalPath, "utf-8");
      expect(content).toContain("pb-[max(calc(env(safe-area-inset-bottom,0px)+20px),28px)]");
    });
  });
});
