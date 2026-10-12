// ======================================================================
// TROUVAILLE REACT HOOK: USE DEBT & RECEIVABLES
// Connects UI with smart debt/receivable engine, manages automatic wallet
// mutation reconciliation, and schedules due-date notifications.
// Strictly compliant with GEMINI.md:
// - Rule 1: No native emojis
// - Rule 2: Monochrome Apple luxury styling
// - Rule 6: Strictly non-mixed localization (100% pure ID / pure EN)
// ======================================================================

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import type {
  DebtReceivableRecord,
  DebtType,
  DebtReceivableSummary,
} from "../types/debt";
import {
  getDebtReceivables,
  addDebtReceivableRecord,
  updateDebtReceivableRecord,
  deleteDebtReceivableRecord,
  addDebtRepayment,
  deleteDebtRepayment,
  calculateDebtReceivableSummary,
  generateUUID,
} from "../lib/debtReceivableEngine";
import { useAddTransaction, useDeleteTransaction } from "./useTransactions";
import { syncDebtReceivableNotifications } from "../lib/notifications";

export function useDebtReceivables() {
  const { user } = useAuth();
  const userId = user?.id || null;
  const { isIndonesian } = useLanguage();

  const addTxMutation = useAddTransaction();
  const deleteTxMutation = useDeleteTransaction();

  const [records, setRecords] = useState<DebtReceivableRecord[]>(() =>
    getDebtReceivables(userId),
  );

  const reloadRecords = useCallback(() => {
    const fresh = getDebtReceivables(userId);
    setRecords(fresh);
    syncDebtReceivableNotifications(fresh, isIndonesian);
  }, [userId, isIndonesian]);

  // Synchronize on mount, user change, or external event
  useEffect(() => {
    reloadRecords();

    const handleUpdate = () => {
      reloadRecords();
    };

    window.addEventListener("trouvaille:debt_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("trouvaille:debt_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [reloadRecords]);

  const summary: DebtReceivableSummary = useMemo(() => {
    return calculateDebtReceivableSummary(records);
  }, [records]);

  /**
   * Create a new Debt or Receivable record.
   * If isAdministrativeOnly is false and walletId is provided,
   * creates the corresponding initial cashflow transaction.
   */
  const createRecord = useCallback(
    async (input: {
      type: DebtType;
      personName: string;
      totalAmount: number;
      dueDate?: string | null;
      createdDate?: string | null;
      note?: string | null;
      walletId?: string | null;
      walletName?: string | null;
      isAdministrativeOnly?: boolean;
    }) => {
      let linkedTxId: string | null = null;
      const effectiveCreatedDate = input.createdDate || new Date().toISOString().split("T")[0];

      // Auto-reconciliation: Create initial disbursement or receipt mutation
      if (!input.isAdministrativeOnly && input.walletId && input.totalAmount > 0) {
        try {
          const generatedTxId = generateUUID();
          linkedTxId = generatedTxId;
          const isReceivable = input.type === "receivable";

          await addTxMutation.mutateAsync({
            id: generatedTxId,
            type: isReceivable ? "expense" : "income",
            amount: input.totalAmount,
            wallet_id: input.walletId,
            category_id: null,
            note: isReceivable
              ? isIndonesian
                ? `Pinjaman diberikan ke ${input.personName}`
                : `Loan given to ${input.personName}`
              : isIndonesian
                ? `Pinjaman diterima dari ${input.personName}`
                : `Loan received from ${input.personName}`,
            occurred_on: effectiveCreatedDate,
          });
        } catch (err) {
          console.warn("[useDebtReceivables] Failed to auto-create wallet mutation:", err);
        }
      }

      const created = addDebtReceivableRecord(
        {
          ...input,
          createdDate: effectiveCreatedDate,
          disbursementTxId: linkedTxId,
        },
        userId,
      );

      reloadRecords();
      return created;
    },
    [userId, isIndonesian, addTxMutation, reloadRecords],
  );

  /**
   * Update an existing record.
   */
  const updateRecord = useCallback(
    (
      id: string,
      updates: Partial<Omit<DebtReceivableRecord, "id" | "repayments" | "createdAt">>,
    ) => {
      const updated = updateDebtReceivableRecord(id, updates, userId);
      reloadRecords();
      return updated;
    },
    [userId, reloadRecords],
  );

  /**
   * Delete a record, with optional cleanup of linked wallet transactions.
   */
  const deleteRecord = useCallback(
    async (id: string, options?: { cleanLinkedTransactions?: boolean }) => {
      const target = records.find((r) => r.id === id);
      if (target && options?.cleanLinkedTransactions) {
        if (target.disbursementTxId) {
          try {
            await deleteTxMutation.mutateAsync(target.disbursementTxId);
          } catch {}
        }
        for (const rep of target.repayments) {
          if (rep.txId) {
            try {
              await deleteTxMutation.mutateAsync(rep.txId);
            } catch {}
          }
        }
      }
      const success = deleteDebtReceivableRecord(id, userId);
      reloadRecords();
      return success;
    },
    [records, userId, deleteTxMutation, reloadRecords],
  );

  /**
   * Record partial or full repayment.
   * If isAdministrativeOnly is false and walletId is provided,
   * creates the corresponding installment cashflow transaction.
   */
  const recordRepayment = useCallback(
    async (
      recordId: string,
      repaymentInput: {
        amount: number;
        date?: string | null;
        walletId?: string | null;
        walletName?: string | null;
        note?: string | null;
        isAdministrativeOnly?: boolean;
      },
    ) => {
      const target = records.find((r) => r.id === recordId);
      if (!target) throw new Error("Record not found");

      let linkedTxId: string | null = null;
      const effectiveDate = repaymentInput.date || new Date().toISOString().split("T")[0];
      const safeAmount = Math.min(
        Math.max(0, Number(repaymentInput.amount) || 0),
        target.remainingAmount,
      );

      if (!repaymentInput.isAdministrativeOnly && repaymentInput.walletId && safeAmount > 0) {
        try {
          const generatedTxId = generateUUID();
          linkedTxId = generatedTxId;
          const isReceivable = target.type === "receivable";

          await addTxMutation.mutateAsync({
            id: generatedTxId,
            type: isReceivable ? "income" : "expense",
            amount: safeAmount,
            wallet_id: repaymentInput.walletId,
            category_id: null,
            note: isReceivable
              ? isIndonesian
                ? `Pelunasan piutang dari ${target.personName}`
                : `Receivable repayment from ${target.personName}`
              : isIndonesian
                ? `Pembayaran utang ke ${target.personName}`
                : `Debt repayment to ${target.personName}`,
            occurred_on: effectiveDate,
          });
        } catch (err) {
          console.warn("[useDebtReceivables] Failed to auto-create repayment transaction:", err);
        }
      }

      const res = addDebtRepayment(
        recordId,
        {
          amount: safeAmount,
          date: effectiveDate,
          walletId: repaymentInput.walletId,
          walletName: repaymentInput.walletName,
          txId: linkedTxId,
          note: repaymentInput.note,
        },
        userId,
      );

      reloadRecords();
      return res;
    },
    [records, userId, isIndonesian, addTxMutation, reloadRecords],
  );

  /**
   * Remove a specific repayment entry, with optional linked transaction cleanup.
   */
  const removeRepayment = useCallback(
    async (
      recordId: string,
      repaymentId: string,
      options?: { cleanLinkedTransactions?: boolean },
    ) => {
      const target = records.find((r) => r.id === recordId);
      const rep = target?.repayments.find((r) => r.id === repaymentId);

      if (rep?.txId && options?.cleanLinkedTransactions) {
        try {
          await deleteTxMutation.mutateAsync(rep.txId);
        } catch {}
      }

      const updated = deleteDebtRepayment(recordId, repaymentId, userId);
      reloadRecords();
      return updated;
    },
    [records, userId, deleteTxMutation, reloadRecords],
  );

  return {
    records,
    summary,
    createRecord,
    updateRecord,
    deleteRecord,
    recordRepayment,
    removeRepayment,
    reloadRecords,
  };
}
