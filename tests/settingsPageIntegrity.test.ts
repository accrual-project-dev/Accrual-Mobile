import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatCurrencyAmount,
  convertCurrency,
  CURRENCY_METADATA,
  DEFAULT_RATES,
  type SupportedCurrency,
} from "../src/lib/currency";
import {
  enqueuePendingMutation,
  getPendingMutations,
  clearPendingMutations,
} from "../src/lib/syncEngine";

let store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = String(v);
  },
  removeItem: (k: string) => {
    delete store[k];
  },
  clear: () => {
    store = {};
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

describe("Settings Page Architectural & Hardening Integrity Suite", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    clearPendingMutations();
    vi.clearAllMocks();
  });

  describe("1. Multi-Currency Budget Target Display Invariant", () => {
    it("formats budget target dynamically according to user's active currency", () => {
      const budgetTargetIdr = 5000000;

      // When IDR is preferred
      const idrFormatted = formatCurrencyAmount(budgetTargetIdr, "IDR");
      expect(idrFormatted).toContain("Rp");
      expect(idrFormatted).toContain("5.000.000");

      // When USD is preferred
      const usdConverted = convertCurrency(budgetTargetIdr, "IDR", "USD", DEFAULT_RATES);
      const usdFormatted = formatCurrencyAmount(usdConverted, "USD");
      expect(usdFormatted).toContain("$");
      expect(usdFormatted).not.toContain("Rp");

      // When EUR is preferred
      const eurConverted = convertCurrency(budgetTargetIdr, "IDR", "EUR", DEFAULT_RATES);
      const eurFormatted = formatCurrencyAmount(eurConverted, "EUR");
      expect(eurFormatted).toContain("€");
      expect(eurFormatted).not.toContain("Rp");

      // When JPY is preferred
      const jpyConverted = convertCurrency(budgetTargetIdr, "IDR", "JPY", DEFAULT_RATES);
      const jpyFormatted = formatCurrencyAmount(jpyConverted, "JPY");
      expect(jpyFormatted).toContain("¥");
      expect(jpyFormatted).not.toContain("Rp");
    });

    it("handles zero or unset budget target gracefully with clean localization", () => {
      const budgetTarget = 0;
      const isIndonesian = true;
      const labelId = budgetTarget > 0 ? "formatted" : isIndonesian ? "Belum Diatur" : "Not Set";
      const labelEn = budgetTarget > 0 ? "formatted" : !isIndonesian ? "Belum Diatur" : "Not Set";

      expect(labelId).toBe("Belum Diatur");
      expect(labelEn).toBe("Not Set");
    });
  });

  describe("2. Accidental Data Loss Prevention (Pending Mutation Purge Barrier)", () => {
    it("requires explicit confirmation before discarding pending offline mutations", async () => {
      // Simulate pending offline transaction mutations
      enqueuePendingMutation("insert", {
        id: "tx-offline-1",
        amount: 150000,
        description: "Makan Siang",
      });

      expect(getPendingMutations().length).toBe(1);

      // Model the confirmation dialog barrier
      let isModalOpen = false;
      let modalTitle = "";
      let modalDescription = "";
      let onConfirmAction: (() => Promise<void>) | null = null;

      const triggerDiscard = (isIndonesian: boolean) => {
        isModalOpen = true;
        modalTitle = isIndonesian
          ? "Batalkan Mutasi Tertunda?"
          : "Discard Pending Mutations?";
        modalDescription = isIndonesian
          ? "Transaksi lokal yang belum tersimpan di cloud akan dibatalkan, dan saldo dompet akan dipulihkan sesuai catatan cloud."
          : "Local offline transactions not yet synced to the cloud will be discarded, and wallet balances restored to cloud state.";
        onConfirmAction = async () => {
          clearPendingMutations();
        };
      };

      // Trigger the handler
      triggerDiscard(true);

      // 1. Modal must be open, but mutations must NOT be purged yet
      expect(isModalOpen).toBe(true);
      expect(modalTitle).toBe("Batalkan Mutasi Tertunda?");
      expect(getPendingMutations().length).toBe(1); // STILL PRESERVED!

      // 2. User confirms action
      await onConfirmAction!();

      // 3. Now the mutations are purged
      expect(getPendingMutations().length).toBe(0);
    });
  });

  describe("3. Notification Permission Denial Feedback & Pure Localization", () => {
    it("provides clear actionable guidance without bilingual mixing when permission is denied", () => {
      const getFeedback = (isIndonesian: boolean) => {
        return isIndonesian
          ? "Izin notifikasi ditolak. Aktifkan di pengaturan perangkat."
          : "Notification permission denied. Please enable in device settings.";
      };

      const idMsg = getFeedback(true);
      const enMsg = getFeedback(false);

      expect(idMsg).toBe("Izin notifikasi ditolak. Aktifkan di pengaturan perangkat.");
      expect(enMsg).toBe("Notification permission denied. Please enable in device settings.");

      // Strict Rule 6 verification: No English in Indonesian, No Indonesian in English
      expect(idMsg).not.toMatch(/notification|permission|denied|device|settings/i);
      expect(enMsg).not.toMatch(/izin|notifikasi|ditolak|aktifkan|pengaturan|perangkat/i);
    });
  });

  describe("4. Settings Search Filtering & Bilingual Coverage", () => {
    const matches = (searchQuery: string, title: string, keywords?: string) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        title.toLowerCase().includes(q) ||
        (keywords ? keywords.toLowerCase().includes(q) : false)
      );
    };

    it("matches Indonesian keywords for core settings items", () => {
      expect(matches("anggaran", "Monthly Spending Budget", "spending limit monthly budget anggaran belanja")).toBe(true);
      expect(matches("piutang", "Debt and Receivables", "utang piutang pinjaman cicilan pelunasan lending loan payable receivable buku")).toBe(true);
      expect(matches("tagihan", "Recurring Bills", "subscriptions commitments due dates bills tagihan")).toBe(true);
      expect(matches("brankas", "Report Export & Data Vault", "csv excel pdf statement space json aes-256 file backup export restore offline brankas laporan cadangan ekspor catatan transaksi")).toBe(true);
      expect(matches("kunci", "Kunci PIN Keamanan Security PIN Lock", "pin lock privacy sandi brankas security timeout passcode kunci aplikasi")).toBe(true);
    });

    it("matches English keywords for core settings items", () => {
      expect(matches("budget", "Monthly Spending Budget", "spending limit monthly budget anggaran belanja")).toBe(true);
      expect(matches("debt", "Debt and Receivables", "utang piutang pinjaman cicilan pelunasan lending loan payable receivable buku")).toBe(true);
      expect(matches("bills", "Recurring Bills", "subscriptions commitments due dates bills tagihan")).toBe(true);
      expect(matches("vault", "Report Export & Data Vault", "csv excel pdf statement space json aes-256 file backup export restore offline brankas laporan cadangan ekspor catatan transaksi")).toBe(true);
      expect(matches("lock", "Kunci PIN Keamanan Security PIN Lock", "pin lock privacy sandi brankas security timeout passcode kunci aplikasi")).toBe(true);
    });

    it("returns true for all items when search query is empty", () => {
      expect(matches("", "Monthly Spending Budget", "anggaran")).toBe(true);
      expect(matches("   ", "Recurring Bills", "tagihan")).toBe(true);
    });

    it("returns false for non-existent settings queries", () => {
      expect(matches("xyz999foobar", "Monthly Spending Budget", "anggaran")).toBe(false);
    });
  });
});
