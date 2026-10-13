import { describe, it, expect, beforeEach, vi } from "vitest";

// Polyfill localStorage in node test environment
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
};

Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

// Also define window if not present
if (typeof window === "undefined") {
  (globalThis as any).window = {
    localStorage: mockLocalStorage,
    dispatchEvent: () => true,
  };
}

import {
  getDebtStorageKey,
  getDebtReceivables,
  saveDebtReceivables,
  addDebtReceivableRecord,
  updateDebtReceivableRecord,
  deleteDebtReceivableRecord,
  addDebtRepayment,
  deleteDebtRepayment,
  calculateDebtStatus,
  getDebtDueStatus,
  calculateDebtReceivableSummary,
  getDebtDueStatusLabel,
  getDebtTypeLabel,
  getDebtStatusLabel,
} from "../src/lib/debtReceivableEngine";
import type { DebtReceivableRecord, DebtRepayment } from "../src/types/debt";
import fs from "fs";
import path from "path";

describe("Smart Debt & Receivables Hub Engine Suite", () => {
  const testUserId = "user-test-uuid-123";

  beforeEach(() => {
    mockLocalStorage.clear();
    vi.restoreAllMocks();
  });

  describe("Storage Keys & Scoping", () => {
    it("generates correct user-scoped and guest storage keys", () => {
      expect(getDebtStorageKey(testUserId)).toBe(
        `trouvaille_debt_receivables_${testUserId}_v1`,
      );
      expect(getDebtStorageKey(null)).toBe(
        "trouvaille_debt_receivables_guest_v1",
      );
      expect(getDebtStorageKey("")).toBe(
        "trouvaille_debt_receivables_guest_v1",
      );
    });

    it("saves and retrieves records cleanly from localStorage", () => {
      const records: DebtReceivableRecord[] = [
        {
          id: "rec-1",
          userId: testUserId,
          type: "receivable",
          personName: "Budi",
          totalAmount: 1000000,
          remainingAmount: 1000000,
          createdDate: "2026-10-12",
          status: "unpaid",
          isAdministrativeOnly: true,
          repayments: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      saveDebtReceivables(records, testUserId);
      const retrieved = getDebtReceivables(testUserId);
      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].personName).toBe("Budi");
      expect(retrieved[0].totalAmount).toBe(1000000);
    });
  });

  describe("CRUD Operations & Record Lifecycle", () => {
    it("creates a new receivable record with unpaid status and full remaining balance", () => {
      const record = addDebtReceivableRecord(
        {
          type: "receivable",
          personName: "Andi Wijaya",
          totalAmount: 5000000,
          dueDate: "2026-11-01",
          isAdministrativeOnly: true,
          note: "Pinjaman modal usaha",
        },
        testUserId,
      );

      expect(record.id).toBeDefined();
      expect(record.personName).toBe("Andi Wijaya");
      expect(record.totalAmount).toBe(5000000);
      expect(record.remainingAmount).toBe(5000000);
      expect(record.status).toBe("unpaid");
      expect(record.repayments).toHaveLength(0);

      const stored = getDebtReceivables(testUserId);
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe(record.id);
    });

    it("creates a debt record correctly", () => {
      const record = addDebtReceivableRecord(
        {
          type: "debt",
          personName: "Bank BCA",
          totalAmount: 10000000,
          isAdministrativeOnly: false,
        },
        testUserId,
      );

      expect(record.type).toBe("debt");
      expect(record.status).toBe("unpaid");
      expect(record.remainingAmount).toBe(10000000);
    });

    it("updates existing record total amount and recalculates remaining balance", () => {
      const record = addDebtReceivableRecord(
        {
          type: "receivable",
          personName: "Citra",
          totalAmount: 2000000,
        },
        testUserId,
      );

      const updated = updateDebtReceivableRecord(
        record.id,
        { totalAmount: 2500000, personName: "Citra Lestari" },
        testUserId,
      );

      expect(updated).not.toBeNull();
      expect(updated?.personName).toBe("Citra Lestari");
      expect(updated?.totalAmount).toBe(2500000);
      expect(updated?.remainingAmount).toBe(2500000);
    });

    it("deletes record cleanly by id", () => {
      const record = addDebtReceivableRecord(
        {
          type: "debt",
          personName: "Doni",
          totalAmount: 500000,
        },
        testUserId,
      );

      expect(getDebtReceivables(testUserId)).toHaveLength(1);
      const deleted = deleteDebtReceivableRecord(record.id, testUserId);
      expect(deleted).toBe(true);
      expect(getDebtReceivables(testUserId)).toHaveLength(0);
    });
  });

  describe("Repayment Engine & Overpayment Guard", () => {
    it("records partial repayment and transitions status to 'partial'", () => {
      const record = addDebtReceivableRecord(
        {
          type: "receivable",
          personName: "Eko",
          totalAmount: 1000000,
        },
        testUserId,
      );

      const { updatedRecord, repayment } = addDebtRepayment(
        record.id,
        {
          amount: 400000,
          date: "2026-10-15",
          note: "Cicilan 1",
        },
        testUserId,
      );

      expect(repayment.amount).toBe(400000);
      expect(updatedRecord.remainingAmount).toBe(600000);
      expect(updatedRecord.status).toBe("partial");
      expect(updatedRecord.repayments).toHaveLength(1);
    });

    it("records second repayment and transitions status to 'settled' when fully paid", () => {
      const record = addDebtReceivableRecord(
        {
          type: "receivable",
          personName: "Fani",
          totalAmount: 1000000,
        },
        testUserId,
      );

      addDebtRepayment(record.id, { amount: 600000 }, testUserId);
      const { updatedRecord } = addDebtRepayment(
        record.id,
        { amount: 400000 },
        testUserId,
      );

      expect(updatedRecord.remainingAmount).toBe(0);
      expect(updatedRecord.status).toBe("settled");
      expect(updatedRecord.repayments).toHaveLength(2);
    });

    it("enforces overpayment guard by capping payment to remaining amount", () => {
      const record = addDebtReceivableRecord(
        {
          type: "debt",
          personName: "Gita",
          totalAmount: 500000,
        },
        testUserId,
      );

      // Attempt to pay 800,000 on a 500,000 debt
      const { updatedRecord, repayment } = addDebtRepayment(
        record.id,
        { amount: 800000 },
        testUserId,
      );

      expect(repayment.amount).toBe(500000); // Capped
      expect(updatedRecord.remainingAmount).toBe(0);
      expect(updatedRecord.status).toBe("settled");
    });

    it("throws when repayment amount is zero or negative", () => {
      const record = addDebtReceivableRecord(
        {
          type: "receivable",
          personName: "Hadi",
          totalAmount: 1000000,
        },
        testUserId,
      );

      expect(() =>
        addDebtRepayment(record.id, { amount: 0 }, testUserId),
      ).toThrow("Repayment amount must be greater than zero");

      expect(() =>
        addDebtRepayment(record.id, { amount: -50000 }, testUserId),
      ).toThrow("Repayment amount must be greater than zero");
    });

    it("deletes a repayment and restores remaining balance accurately", () => {
      const record = addDebtReceivableRecord(
        {
          type: "receivable",
          personName: "Indra",
          totalAmount: 1000000,
        },
        testUserId,
      );

      const { repayment } = addDebtRepayment(
        record.id,
        { amount: 1000000 },
        testUserId,
      );
      expect(getDebtReceivables(testUserId)[0].status).toBe("settled");

      const reverted = deleteDebtRepayment(record.id, repayment.id, testUserId);
      expect(reverted).not.toBeNull();
      expect(reverted?.remainingAmount).toBe(1000000);
      expect(reverted?.status).toBe("unpaid");
      expect(reverted?.repayments).toHaveLength(0);
    });
  });

  describe("Due Date Classification & Telemetry", () => {
    const today = "2026-10-12";

    it("identifies settled debt as 'settled'", () => {
      const record: DebtReceivableRecord = {
        id: "1",
        type: "receivable",
        personName: "Joko",
        totalAmount: 1000,
        remainingAmount: 0,
        status: "settled",
        dueDate: "2026-10-01",
        createdDate: "2026-09-01",
        isAdministrativeOnly: true,
        repayments: [],
        createdAt: "",
        updatedAt: "",
      };
      expect(getDebtDueStatus(record, today)).toBe("settled");
    });

    it("identifies debt without due date as 'no_due_date'", () => {
      const record: DebtReceivableRecord = {
        id: "1",
        type: "debt",
        personName: "Kiki",
        totalAmount: 1000,
        remainingAmount: 1000,
        status: "unpaid",
        dueDate: null,
        createdDate: "2026-10-01",
        isAdministrativeOnly: true,
        repayments: [],
        createdAt: "",
        updatedAt: "",
      };
      expect(getDebtDueStatus(record, today)).toBe("no_due_date");
    });

    it("identifies overdue debt when due date was in the past", () => {
      const record: DebtReceivableRecord = {
        id: "1",
        type: "receivable",
        personName: "Lia",
        totalAmount: 1000,
        remainingAmount: 1000,
        status: "unpaid",
        dueDate: "2026-10-10", // 2 days ago
        createdDate: "2026-10-01",
        isAdministrativeOnly: true,
        repayments: [],
        createdAt: "",
        updatedAt: "",
      };
      expect(getDebtDueStatus(record, today)).toBe("overdue");
    });

    it("identifies due today debt", () => {
      const record: DebtReceivableRecord = {
        id: "1",
        type: "receivable",
        personName: "Mira",
        totalAmount: 1000,
        remainingAmount: 1000,
        status: "unpaid",
        dueDate: "2026-10-12",
        createdDate: "2026-10-01",
        isAdministrativeOnly: true,
        repayments: [],
        createdAt: "",
        updatedAt: "",
      };
      expect(getDebtDueStatus(record, today)).toBe("due_today");
    });

    it("identifies approaching debt within 3 days", () => {
      const record: DebtReceivableRecord = {
        id: "1",
        type: "debt",
        personName: "Niko",
        totalAmount: 1000,
        remainingAmount: 1000,
        status: "unpaid",
        dueDate: "2026-10-14", // 2 days in future
        createdDate: "2026-10-01",
        isAdministrativeOnly: true,
        repayments: [],
        createdAt: "",
        updatedAt: "",
      };
      expect(getDebtDueStatus(record, today)).toBe("approaching");
    });

    it("identifies on-track debt when due date is far away", () => {
      const record: DebtReceivableRecord = {
        id: "1",
        type: "receivable",
        personName: "Oscar",
        totalAmount: 1000,
        remainingAmount: 1000,
        status: "unpaid",
        dueDate: "2026-11-12", // 1 month in future
        createdDate: "2026-10-01",
        isAdministrativeOnly: true,
        repayments: [],
        createdAt: "",
        updatedAt: "",
      };
      expect(getDebtDueStatus(record, today)).toBe("on_track");
    });
  });

  describe("Financial Aggregates & Summary", () => {
    it("computes accurate summary metrics across multiple debts and receivables", () => {
      const records: DebtReceivableRecord[] = [
        // Active receivable: 2,000,000
        {
          id: "1",
          type: "receivable",
          personName: "A",
          totalAmount: 2000000,
          remainingAmount: 2000000,
          status: "unpaid",
          dueDate: "2026-10-10", // Overdue
          createdDate: "2026-10-01",
          isAdministrativeOnly: true,
          repayments: [],
          createdAt: "",
          updatedAt: "",
        },
        // Active receivable: 1,500,000 (remaining of 3,000,000)
        {
          id: "2",
          type: "receivable",
          personName: "B",
          totalAmount: 3000000,
          remainingAmount: 1500000,
          status: "partial",
          dueDate: "2026-10-13", // Approaching
          createdDate: "2026-10-01",
          isAdministrativeOnly: true,
          repayments: [],
          createdAt: "",
          updatedAt: "",
        },
        // Settled receivable: 0
        {
          id: "3",
          type: "receivable",
          personName: "C",
          totalAmount: 1000000,
          remainingAmount: 0,
          status: "settled",
          createdDate: "2026-09-01",
          isAdministrativeOnly: true,
          repayments: [],
          createdAt: "",
          updatedAt: "",
        },
        // Active debt: 1,000,000
        {
          id: "4",
          type: "debt",
          personName: "D",
          totalAmount: 1000000,
          remainingAmount: 1000000,
          status: "unpaid",
          dueDate: "2026-11-01", // On track
          createdDate: "2026-10-01",
          isAdministrativeOnly: true,
          repayments: [],
          createdAt: "",
          updatedAt: "",
        },
      ];

      const summary = calculateDebtReceivableSummary(records, "2026-10-12");

      expect(summary.totalReceivables).toBe(3500000); // 2,000,000 + 1,500,000
      expect(summary.totalDebts).toBe(1000000);
      expect(summary.netReceivables).toBe(2500000); // 3,500,000 - 1,000,000
      expect(summary.activeReceivablesCount).toBe(2);
      expect(summary.activeDebtsCount).toBe(1);
      expect(summary.settledReceivablesCount).toBe(1);
      expect(summary.settledDebtsCount).toBe(0);
      expect(summary.overdueCount).toBe(1);
      expect(summary.approachingDueCount).toBe(1);
    });
  });

  describe("Strict Localization Compliance (Rule 6)", () => {
    it("returns pure Indonesian status labels when isIndonesian is true", () => {
      expect(getDebtDueStatusLabel("settled", true)).toBe("Lunas");
      expect(getDebtDueStatusLabel("overdue", true)).toBe("Terlewat");
      expect(getDebtDueStatusLabel("due_today", true)).toBe(
        "Jatuh Tempo Hari Ini",
      );
      expect(getDebtDueStatusLabel("approaching", true)).toBe(
        "Mendekati Tempo",
      );
      expect(getDebtDueStatusLabel("on_track", true)).toBe("Berjalan");
      expect(getDebtDueStatusLabel("no_due_date", true)).toBe("Tanpa Tempo");

      expect(getDebtTypeLabel("receivable", true)).toBe("Piutang");
      expect(getDebtTypeLabel("debt", true)).toBe("Utang");

      expect(getDebtStatusLabel("unpaid", true)).toBe("Belum Dibayar");
      expect(getDebtStatusLabel("partial", true)).toBe("Dicicil Sebagian");
      expect(getDebtStatusLabel("settled", true)).toBe("Lunas");
    });

    it("returns pure English status labels when isIndonesian is false", () => {
      expect(getDebtDueStatusLabel("settled", false)).toBe("Settled");
      expect(getDebtDueStatusLabel("overdue", false)).toBe("Overdue");
      expect(getDebtDueStatusLabel("due_today", false)).toBe("Due Today");
      expect(getDebtDueStatusLabel("approaching", false)).toBe("Due Soon");
      expect(getDebtDueStatusLabel("on_track", false)).toBe("On Track");
      expect(getDebtDueStatusLabel("no_due_date", false)).toBe("No Due Date");

      expect(getDebtTypeLabel("receivable", false)).toBe("Receivable");
      expect(getDebtTypeLabel("debt", false)).toBe("Debt");

      expect(getDebtStatusLabel("unpaid", false)).toBe("Unpaid");
      expect(getDebtStatusLabel("partial", false)).toBe("Partially Paid");
      expect(getDebtStatusLabel("settled", false)).toBe("Settled");
    });
  });

  describe("Architecture & Integration File Invariants", () => {
    it("DebtReceivablesSheet and DebtReceivablesCard files exist", () => {
      const sheetPath = path.resolve(
        __dirname,
        "../src/components/debt/DebtReceivablesSheet.tsx",
      );
      const cardPath = path.resolve(
        __dirname,
        "../src/components/debt/DebtReceivablesCard.tsx",
      );

      expect(fs.existsSync(sheetPath)).toBe(true);
      expect(fs.existsSync(cardPath)).toBe(true);
    });

    it("AssetsPage does not mount DebtReceivablesCard (isolated to HomePage only)", () => {
      const assetsPath = path.resolve(__dirname, "../src/pages/AssetsPage.tsx");
      const content = fs.readFileSync(assetsPath, "utf-8");

      expect(content).not.toContain("DebtReceivablesCard");
      expect(content).not.toContain("DebtReceivablesSheet");
    });

    it("SettingsPage mounts Debt & Receivables hub under Account Management", () => {
      const settingsPath = path.resolve(
        __dirname,
        "../src/pages/SettingsPage.tsx",
      );
      const content = fs.readFileSync(settingsPath, "utf-8");

      expect(content).toContain("DebtReceivablesSheet");
      expect(content).toContain("showDebtReceivables");
      expect(content).toContain("Buku Utang & Piutang");
      expect(content).toContain("Debt & Receivables Hub");
      expect(content).toContain("debtReceivablesOpen");
    });

    it("HomePage mounts DebtReceivablesSheet and integrates with HomeWidgetRenderer", () => {
      const homePath = path.resolve(__dirname, "../src/pages/HomePage.tsx");
      const content = fs.readFileSync(homePath, "utf-8");

      expect(content).toContain("DebtReceivablesSheet");
      expect(content).toContain("debtSheetOpen");
      expect(content).toContain("onOpenDebtReceivables");
      expect(content).toContain("debtSummary");
    });
  });
});
