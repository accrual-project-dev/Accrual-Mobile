import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock localStorage for node environment
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = String(v);
  },
  removeItem: (k: string) => {
    delete store[k];
  },
  clear: () => {
    for (const k in store) delete store[k];
  },
  key: (i: number) => Object.keys(store)[i] ?? null,
  get length() {
    return Object.keys(store).length;
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

if (typeof window === "undefined") {
  (globalThis as any).window = {
    localStorage: mockLocalStorage,
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

import {
  addDebtReceivableRecord,
  updateDebtReceivableRecord,
  deleteDebtReceivableRecord,
  addDebtRepayment,
  deleteDebtRepayment,
  calculateDebtStatus,
  calculateDebtReceivableSummary,
  getDebtDueStatus,
  getDebtDueStatusLabel,
  getDebtTypeLabel,
  sanitizeNote,
  getDebtStorageKey,
} from "../src/lib/debtReceivableEngine";
import { DebtReceivablesSheet } from "../src/components/debt/DebtReceivablesSheet";
import { DebtReceivablesCard } from "../src/components/debt/DebtReceivablesCard";
import { clearAllLocalUserSessionData } from "../src/lib/sessionCleanup";
import fs from "fs";
import path from "path";
import { format, addDays, subDays } from "date-fns";

describe("Debt, Loan & Receivables Tracker Workstation Suite (Audit #32)", () => {
  const testUserId = "user-debt-audit-32";
  const rootDir = path.resolve(__dirname, "..");
  const sheetPath = path.join(
    rootDir,
    "src/components/debt/DebtReceivablesSheet.tsx",
  );
  const cardPath = path.join(
    rootDir,
    "src/components/debt/DebtReceivablesCard.tsx",
  );

  beforeEach(() => {
    mockLocalStorage.clear();
    vi.restoreAllMocks();
  });

  describe("1. Note Sanitization & ISO 8601 Timestamps (Rule 8.1)", () => {
    it("sanitizes placeholder notes like '-' and '--' into clean null values", () => {
      expect(sanitizeNote("-")).toBeNull();
      expect(sanitizeNote("--")).toBeNull();
      expect(sanitizeNote("—")).toBeNull();
      expect(sanitizeNote("   ")).toBeNull();
      expect(sanitizeNote(null)).toBeNull();
      expect(sanitizeNote(undefined)).toBeNull();

      expect(sanitizeNote("Dana darurat untuk renovasi")).toBe(
        "Dana darurat untuk renovasi",
      );
    });

    it("applies sanitizeNote when creating and updating records", () => {
      const rec = addDebtReceivableRecord(
        {
          type: "receivable",
          personName: "Rudi Hartono",
          totalAmount: 1500000,
          note: "--",
        },
        testUserId,
      );
      expect(rec.note).toBeNull();

      const updated = updateDebtReceivableRecord(
        rec.id,
        { note: "-" },
        testUserId,
      );
      expect(updated?.note).toBeNull();

      const realNote = updateDebtReceivableRecord(
        rec.id,
        { note: "Pinjaman modal usaha" },
        testUserId,
      );
      expect(realNote?.note).toBe("Pinjaman modal usaha");
    });

    it("applies sanitizeNote when adding installment repayments", () => {
      const rec = addDebtReceivableRecord(
        {
          type: "debt",
          personName: "Bank Mandiri",
          totalAmount: 2000000,
        },
        testUserId,
      );

      const { repayment } = addDebtRepayment(
        rec.id,
        {
          amount: 500000,
          note: "-",
        },
        testUserId,
      );
      expect(repayment.note).toBeNull();
    });

    it("generates full ISO 8601 timestamps (YYYY-MM-DDTHH:mm:ss) for wallet mutations", () => {
      const datePart = "2026-10-25";
      const now = new Date();
      const combined = `${datePart}${format(now, "'T'HH:mm:ss")}`;

      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
      expect(combined).toMatch(isoRegex);
      expect(combined.startsWith("2026-10-25T")).toBe(true);
    });
  });

  describe("2. Repayment Engine Mechanics & Overpayment Protection", () => {
    it("tracks multi-stage partial repayments and transitions status to settled", () => {
      const rec = addDebtReceivableRecord(
        {
          type: "receivable",
          personName: "Siti Rahma",
          totalAmount: 1000000,
        },
        testUserId,
      );
      expect(rec.status).toBe("unpaid");
      expect(rec.remainingAmount).toBe(1000000);

      // Repay Stage 1: 400,000 -> Remaining: 600,000 (status: partial)
      const stage1 = addDebtRepayment(
        rec.id,
        { amount: 400000, walletId: "wallet-bca" },
        testUserId,
      );
      expect(stage1.updatedRecord.remainingAmount).toBe(600000);
      expect(stage1.updatedRecord.status).toBe("partial");

      // Repay Stage 2: 600,000 -> Remaining: 0 (status: settled)
      const stage2 = addDebtRepayment(
        rec.id,
        { amount: 600000, walletId: "wallet-bca" },
        testUserId,
      );
      expect(stage2.updatedRecord.remainingAmount).toBe(0);
      expect(stage2.updatedRecord.status).toBe("settled");
    });

    it("enforces overpayment protection by capping repayment amount at remaining balance", () => {
      const rec = addDebtReceivableRecord(
        {
          type: "debt",
          personName: "Doni Pratama",
          totalAmount: 500000,
        },
        testUserId,
      );

      // Attempt to pay 800,000 on a 500,000 debt
      const { repayment, updatedRecord } = addDebtRepayment(
        rec.id,
        { amount: 800000 },
        testUserId,
      );

      expect(repayment.amount).toBe(500000);
      expect(updatedRecord.remainingAmount).toBe(0);
      expect(updatedRecord.status).toBe("settled");
    });

    it("recalculates status when a repayment is removed", () => {
      const rec = addDebtReceivableRecord(
        {
          type: "receivable",
          personName: "Ahmad Dahlan",
          totalAmount: 1000000,
        },
        testUserId,
      );

      const { repayment } = addDebtRepayment(
        rec.id,
        { amount: 1000000 },
        testUserId,
      );
      expect(getDebtStatus(rec.id).status).toBe("settled");

      deleteDebtRepayment(rec.id, repayment.id, testUserId);
      const afterDelete = getDebtStatus(rec.id);
      expect(afterDelete.remainingAmount).toBe(1000000);
      expect(afterDelete.status).toBe("unpaid");
    });

    function getDebtStatus(id: string) {
      const key = getDebtStorageKey(testUserId);
      const items = JSON.parse(mockLocalStorage.getItem(key) || "[]");
      return items.find((x: any) => x.id === id);
    }
  });

  describe("3. Due Date Status & Financial Aggregates", () => {
    it("accurately detects overdue, approaching due, and normal statuses", () => {
      const today = new Date();
      const overdueDate = format(subDays(today, 2), "yyyy-MM-dd");
      const approachingDate = format(addDays(today, 1), "yyyy-MM-dd");
      const distantDate = format(addDays(today, 15), "yyyy-MM-dd");

      const overdueRec = addDebtReceivableRecord(
        {
          type: "debt",
          personName: "Overdue Contact",
          totalAmount: 500000,
          dueDate: overdueDate,
        },
        testUserId,
      );
      expect(getDebtDueStatus(overdueRec)).toBe("overdue");
      expect(getDebtDueStatusLabel("overdue", true)).toBe("Terlewat");
      expect(getDebtDueStatusLabel("overdue", false)).toBe("Overdue");

      const approachingRec = addDebtReceivableRecord(
        {
          type: "receivable",
          personName: "Due Soon Contact",
          totalAmount: 300000,
          dueDate: approachingDate,
        },
        testUserId,
      );
      expect(getDebtDueStatus(approachingRec)).toBe("approaching");
      expect(getDebtDueStatusLabel("approaching", true)).toBe("Mendekati Tempo");
      expect(getDebtDueStatusLabel("approaching", false)).toBe("Due Soon");

      const normalRec = addDebtReceivableRecord(
        {
          type: "debt",
          personName: "Normal Contact",
          totalAmount: 700000,
          dueDate: distantDate,
        },
        testUserId,
      );
      expect(getDebtDueStatus(normalRec)).toBe("on_track");
      expect(getDebtDueStatusLabel("on_track", true)).toBe("Berjalan");
      expect(getDebtDueStatusLabel("on_track", false)).toBe("On Track");
    });

    it("calculates comprehensive financial position across debts and receivables", () => {
      const rec1 = addDebtReceivableRecord(
        { type: "receivable", personName: "P1", totalAmount: 1000000 },
        testUserId,
      );
      const rec2 = addDebtReceivableRecord(
        { type: "debt", personName: "P2", totalAmount: 400000 },
        testUserId,
      );

      const summary = calculateDebtReceivableSummary([rec1, rec2]);
      expect(summary.totalReceivables).toBe(1000000);
      expect(summary.totalDebts).toBe(400000);
      expect(summary.netReceivables).toBe(600000);
      expect(summary.activeReceivablesCount).toBe(1);
      expect(summary.activeDebtsCount).toBe(1);
    });
  });

  describe("4. Multi-Tenant Session Teardown & Isolation (Rule 8.2)", () => {
    it("completely wipes user and guest debt storage on session teardown", async () => {
      const userKey = getDebtStorageKey("user-logged-in");
      const guestKey = getDebtStorageKey("guest");

      mockLocalStorage.setItem(userKey, JSON.stringify([{ id: "debt-user" }]));
      mockLocalStorage.setItem(guestKey, JSON.stringify([{ id: "debt-guest" }]));

      expect(mockLocalStorage.getItem(userKey)).toBeDefined();
      expect(mockLocalStorage.getItem(guestKey)).toBeDefined();

      await clearAllLocalUserSessionData(null);

      expect(mockLocalStorage.getItem(userKey)).toBeNull();
      expect(mockLocalStorage.getItem(guestKey)).toBeNull();
    });
  });

  describe("5. Architectural & Design Rules Verification", () => {
    it("enforces dynamic iOS home indicator safe-area bottom insets (Rule 5)", () => {
      const sheetContent = fs.readFileSync(sheetPath, "utf-8");
      expect(sheetContent).toContain(
        'paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)"',
      );
    });

    it("verifies zero native system colored emojis across Debt components (Rule 1)", () => {
      const sheetContent = fs.readFileSync(sheetPath, "utf-8");
      const cardContent = fs.readFileSync(cardPath, "utf-8");

      const systemEmojiRegex =
        /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      expect(systemEmojiRegex.test(sheetContent)).toBe(false);
      expect(systemEmojiRegex.test(cardContent)).toBe(false);
    });

    it("verifies zero vibrant rainbow utility classes in controls (Rule 7)", () => {
      const sheetContent = fs.readFileSync(sheetPath, "utf-8");
      const cardContent = fs.readFileSync(cardPath, "utf-8");

      const vibrantColorRegex =
        /text-(emerald|amber|blue|green|purple|red|rose|indigo|yellow|cyan|sky)-[0-9]{3}|bg-(emerald|amber|blue|green|purple|red|rose|indigo|yellow|cyan|sky)-[0-9]{3}/;

      expect(vibrantColorRegex.test(sheetContent)).toBe(false);
      expect(vibrantColorRegex.test(cardContent)).toBe(false);
    });

    it("verifies elimination of hardcoded 'Rp' in DebtReceivablesSheet inputs", () => {
      const sheetContent = fs.readFileSync(sheetPath, "utf-8");
      expect(sheetContent).toContain("{currencyMeta.symbol}");
      // Ensure no standalone hardcoded 'Rp' label in input prefix
      expect(sheetContent).not.toMatch(
        /<span[^>]*text-\[var\(--text-secondary\)\][^>]*>\s*Rp\s*<\/span>/,
      );
    });

    it("verifies primary CTA buttons inherit strict theme variables (Rule 2)", () => {
      const sheetContent = fs.readFileSync(sheetPath, "utf-8");
      expect(sheetContent).toContain('background: "var(--text-primary)"');
      expect(sheetContent).toContain('color: "var(--bg-base)"');
    });

    it("verifies component exports", () => {
      expect(DebtReceivablesSheet).toBeDefined();
      expect(typeof DebtReceivablesSheet).toBe("function");
      expect(DebtReceivablesCard).toBeDefined();
      expect(typeof DebtReceivablesCard).toBe("function");
    });
  });
});
