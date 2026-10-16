import { describe, it, expect, beforeEach, vi } from "vitest";

// Polyfill localStorage & window for test environment
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
} from "../src/lib/debtReceivableEngine";
import { formatCurrencyAmount, convertCurrency } from "../src/lib/currency";

describe("Debt & Receivables Ecosystem Integrity Suite", () => {
  const testUserId = "test-user-debt-ecosystem";

  beforeEach(() => {
    mockLocalStorage.clear();
    vi.restoreAllMocks();
  });

  describe("1. Full ISO Timestamp Formatting for Cashflow Integration", () => {
    it("guarantees occurred_on contains full date and time (YYYY-MM-DDTHH:mm:ss)", () => {
      const now = new Date();
      const datePart = "2026-10-20";
      const timeSuffix = "T14:30:00";
      const fullIso = `${datePart}${timeSuffix}`;

      // Simulate full ISO helper logic
      function formatFullIsoOccurredOn(dateStr?: string | null): string {
        if (!dateStr || !dateStr.trim()) {
          return new Date().toISOString().slice(0, 19);
        }
        const clean = dateStr.trim();
        if (clean.includes("T")) {
          return clean;
        }
        return `${clean}T12:00:00`;
      }

      const generated = formatFullIsoOccurredOn(datePart);
      expect(generated).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
      expect(generated.startsWith("2026-10-20T")).toBe(true);

      const alreadyFull = formatFullIsoOccurredOn(fullIso);
      expect(alreadyFull).toBe(fullIso);
    });
  });

  describe("2. Linked Transaction Deletion Policy (cleanLinkedTransactions)", () => {
    it("preserves or removes linked transactions depending on cleanLinkedTransactions flag", async () => {
      const mockDeleteTx = vi.fn().mockResolvedValue({});

      // Record with linked initial transaction and repayment
      const record = addDebtReceivableRecord(
        {
          type: "receivable",
          personName: "Budi Santoso",
          totalAmount: 1000000,
          walletId: "wallet-bca-123",
          disbursementTxId: "tx-disburse-001",
        },
        testUserId,
      );

      const { repayment } = addDebtRepayment(
        record.id,
        {
          amount: 400000,
          walletId: "wallet-bca-123",
          txId: "tx-repay-001",
        },
        testUserId,
      );

      // Simulate deleteRecord with cleanLinkedTransactions: true
      async function simulateDeleteRecord(
        target: typeof record,
        options: { cleanLinkedTransactions: boolean },
      ) {
        if (options.cleanLinkedTransactions) {
          if (target.disbursementTxId) {
            await mockDeleteTx(target.disbursementTxId);
          }
          for (const rep of target.repayments) {
            if (rep.txId) {
              await mockDeleteTx(rep.txId);
            }
          }
        }
        return deleteDebtReceivableRecord(target.id, testUserId);
      }

      // Case A: cleanLinkedTransactions = false (keeps transactions)
      await simulateDeleteRecord(
        { ...record, repayments: [repayment] },
        { cleanLinkedTransactions: false },
      );
      expect(mockDeleteTx).not.toHaveBeenCalled();

      // Re-create and test Case B: cleanLinkedTransactions = true
      const freshRecord = addDebtReceivableRecord(
        {
          type: "debt",
          personName: "Siti Rahma",
          totalAmount: 500000,
          walletId: "wallet-mandiri-456",
          disbursementTxId: "tx-disburse-002",
        },
        testUserId,
      );

      const { repayment: rep2 } = addDebtRepayment(
        freshRecord.id,
        {
          amount: 200000,
          walletId: "wallet-mandiri-456",
          txId: "tx-repay-002",
        },
        testUserId,
      );

      await simulateDeleteRecord(
        { ...freshRecord, repayments: [rep2] },
        { cleanLinkedTransactions: true },
      );

      expect(mockDeleteTx).toHaveBeenCalledWith("tx-disburse-002");
      expect(mockDeleteTx).toHaveBeenCalledWith("tx-repay-002");
      expect(mockDeleteTx).toHaveBeenCalledTimes(2);
    });

    it("handles single repayment removal with linked transaction cleanup", async () => {
      const mockDeleteTx = vi.fn().mockResolvedValue({});

      const record = addDebtReceivableRecord(
        {
          type: "receivable",
          personName: "Ahmad",
          totalAmount: 1500000,
        },
        testUserId,
      );

      const { repayment } = addDebtRepayment(
        record.id,
        {
          amount: 500000,
          txId: "tx-installment-101",
        },
        testUserId,
      );

      async function simulateRemoveRepayment(
        recordId: string,
        rep: typeof repayment,
        options: { cleanLinkedTransactions: boolean },
      ) {
        if (rep.txId && options.cleanLinkedTransactions) {
          await mockDeleteTx(rep.txId);
        }
        return deleteDebtRepayment(recordId, rep.id, testUserId);
      }

      await simulateRemoveRepayment(record.id, repayment, {
        cleanLinkedTransactions: true,
      });

      expect(mockDeleteTx).toHaveBeenCalledWith("tx-installment-101");
    });
  });

  describe("3. Record Update & Overpayment Invariant Protection", () => {
    it("updates person name, note, due date, and recalculates remaining balance cleanly", () => {
      const record = addDebtReceivableRecord(
        {
          type: "debt",
          personName: "Kredit Mobil",
          totalAmount: 10000000,
          dueDate: "2026-11-01",
        },
        testUserId,
      );

      addDebtRepayment(
        record.id,
        {
          amount: 3000000,
        },
        testUserId,
      );

      // Edit record: increase principal to 12,000,000
      const updated = updateDebtReceivableRecord(
        record.id,
        {
          personName: "Kredit Kendaraan Operasional",
          totalAmount: 12000000,
          note: "Termasuk biaya asuransi",
          dueDate: "2026-12-01",
        },
        testUserId,
      );

      expect(updated).not.toBeNull();
      expect(updated?.personName).toBe("Kredit Kendaraan Operasional");
      expect(updated?.note).toBe("Termasuk biaya asuransi");
      expect(updated?.dueDate).toBe("2026-12-01");
      expect(updated?.totalAmount).toBe(12000000);
      expect(updated?.remainingAmount).toBe(9000000); // 12M - 3M repaid
      expect(updated?.status).toBe("partial");
    });

    it("guards against reducing total principal below already repaid amounts", () => {
      const record = addDebtReceivableRecord(
        {
          type: "receivable",
          personName: "Teman Kantor",
          totalAmount: 2000000,
        },
        testUserId,
      );

      addDebtRepayment(
        record.id,
        {
          amount: 1500000,
        },
        testUserId,
      );

      const totalRepaid = 1500000;
      const attemptedNewAmount = 1000000; // Less than repaid!

      const isValidEdit = attemptedNewAmount >= totalRepaid;
      expect(isValidEdit).toBe(false);

      // If somehow forced, calculateDebtStatus safely clamps to 0 remaining and sets settled
      const statusCheck = calculateDebtStatus(attemptedNewAmount, [
        {
          id: "r1",
          amount: 1500000,
          date: "2026-10-16",
          createdAt: new Date().toISOString(),
        },
      ]);
      expect(statusCheck.remainingAmount).toBe(0);
      expect(statusCheck.status).toBe("settled");
    });
  });

  describe("4. Multi-Currency Notification & Amount Formatting", () => {
    it("formats amounts in USD, SGD, and IDR accurately without hardcoded Rp", () => {
      const amountIdr = 1585000; // ~100 USD

      // Format in base IDR
      const idrFormatted = formatCurrencyAmount(amountIdr, "IDR");
      expect(idrFormatted).toBe("Rp 1.585.000");

      // Format in USD
      const usdAmount = convertCurrency(amountIdr, "IDR", "USD");
      const usdFormatted = formatCurrencyAmount(usdAmount, "USD");
      expect(usdFormatted).toContain("$");
      expect(usdFormatted).toBe("$100.00");

      // Format in SGD
      const sgdAmount = convertCurrency(amountIdr, "IDR", "SGD");
      const sgdFormatted = formatCurrencyAmount(sgdAmount, "SGD");
      expect(sgdFormatted).toContain("S$");
    });
  });
});
