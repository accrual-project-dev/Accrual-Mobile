// ======================================================================
// TROUVAILLE SMART DEBT & RECEIVABLES ENGINE
// Handles offline-first persistence, repayment tracking, due status logic,
// and financial aggregates for debts and receivables.
// Strictly compliant with GEMINI.md:
// - Rule 1: No native emojis
// - Rule 2: Monochrome Apple luxury styling
// - Rule 6: Strictly non-mixed localization (100% pure ID / pure EN)
// ======================================================================

import type {
  DebtReceivableRecord,
  DebtRepayment,
  DebtType,
  DebtStatus,
  DebtDueStatus,
  DebtReceivableSummary,
} from "../types/debt";
import { parseISO, startOfDay, differenceInCalendarDays, isValid } from "date-fns";

export const DEBT_STORAGE_PREFIX = "trouvaille_debt_receivables_";
export const DEBT_STORAGE_SUFFIX = "_v1";

export function getDebtStorageKey(userId?: string | null): string {
  const effectiveId = userId && userId.trim() ? userId.trim() : "guest";
  return `${DEBT_STORAGE_PREFIX}${effectiveId}${DEBT_STORAGE_SUFFIX}`;
}

export function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Loads all debt and receivable records for the given user from localStorage.
 */
export function getDebtReceivables(userId?: string | null): DebtReceivableRecord[] {
  const storage =
    typeof localStorage !== "undefined"
      ? localStorage
      : typeof window !== "undefined"
        ? window.localStorage
        : null;
  if (!storage) return [];
  const key = getDebtStorageKey(userId);
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    console.warn("[debtReceivableEngine] Failed to read debt storage:", err);
    return [];
  }
}

/**
 * Persists all debt and receivable records to localStorage and notifies listeners.
 */
export function saveDebtReceivables(
  records: DebtReceivableRecord[],
  userId?: string | null,
): void {
  const storage =
    typeof localStorage !== "undefined"
      ? localStorage
      : typeof window !== "undefined"
        ? window.localStorage
        : null;
  if (!storage) return;
  const key = getDebtStorageKey(userId);
  try {
    storage.setItem(key, JSON.stringify(records));
    if (typeof window !== "undefined" && typeof CustomEvent !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("trouvaille:debt_updated", {
          detail: { key, count: records.length },
        }),
      );
    }
  } catch (err) {
    console.warn("[debtReceivableEngine] Failed to save debt storage:", err);
  }
}

/**
 * Computes remaining balance and status based on repayments.
 */
export function calculateDebtStatus(
  totalAmount: number,
  repayments: DebtRepayment[],
): { remainingAmount: number; status: DebtStatus } {
  const safeTotal = Math.max(0, Number(totalAmount) || 0);
  const totalRepaid = repayments.reduce(
    (acc, r) => acc + Math.max(0, Number(r.amount) || 0),
    0,
  );
  const remaining = Math.max(0, safeTotal - totalRepaid);

  if (remaining <= 0) {
    return { remainingAmount: 0, status: "settled" };
  }
  if (totalRepaid > 0) {
    return { remainingAmount: remaining, status: "partial" };
  }
  return { remainingAmount: safeTotal, status: "unpaid" };
}

/**
 * Creates and saves a new debt or receivable record.
 */
export function addDebtReceivableRecord(
  input: {
    type: DebtType;
    personName: string;
    totalAmount: number;
    dueDate?: string | null;
    createdDate?: string | null;
    note?: string | null;
    walletId?: string | null;
    walletName?: string | null;
    disbursementTxId?: string | null;
    isAdministrativeOnly?: boolean;
    id?: string;
  },
  userId?: string | null,
): DebtReceivableRecord {
  const records = getDebtReceivables(userId);
  const nowIso = new Date().toISOString();
  const safeTotal = Math.max(0, Number(input.totalAmount) || 0);
  const createdDate = input.createdDate || nowIso.split("T")[0];

  const newRecord: DebtReceivableRecord = {
    id: input.id || generateUUID(),
    userId: userId || null,
    type: input.type,
    personName: input.personName.trim(),
    totalAmount: safeTotal,
    remainingAmount: safeTotal,
    dueDate: input.dueDate || null,
    createdDate,
    note: input.note ? input.note.trim() : null,
    status: safeTotal === 0 ? "settled" : "unpaid",
    walletId: input.walletId || null,
    walletName: input.walletName || null,
    disbursementTxId: input.disbursementTxId || null,
    isAdministrativeOnly: Boolean(input.isAdministrativeOnly),
    repayments: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const updatedRecords = [newRecord, ...records];
  saveDebtReceivables(updatedRecords, userId);
  return newRecord;
}

/**
 * Updates an existing debt or receivable record.
 */
export function updateDebtReceivableRecord(
  id: string,
  updates: Partial<Omit<DebtReceivableRecord, "id" | "repayments" | "createdAt">>,
  userId?: string | null,
): DebtReceivableRecord | null {
  const records = getDebtReceivables(userId);
  const index = records.findIndex((r) => r.id === id);
  if (index === -1) return null;

  const current = records[index];
  const newTotal = updates.totalAmount !== undefined ? updates.totalAmount : current.totalAmount;
  const { remainingAmount, status } = calculateDebtStatus(newTotal, current.repayments);

  const updatedRecord: DebtReceivableRecord = {
    ...current,
    ...updates,
    totalAmount: newTotal,
    remainingAmount,
    status,
    updatedAt: new Date().toISOString(),
  };

  records[index] = updatedRecord;
  saveDebtReceivables(records, userId);
  return updatedRecord;
}

/**
 * Deletes a debt or receivable record by id.
 */
export function deleteDebtReceivableRecord(
  id: string,
  userId?: string | null,
): boolean {
  const records = getDebtReceivables(userId);
  const filtered = records.filter((r) => r.id !== id);
  if (filtered.length === records.length) return false;
  saveDebtReceivables(filtered, userId);
  return true;
}

/**
 * Records an installment repayment on an active debt or receivable.
 * Enforces overpayment protection: repayment cannot exceed the remaining balance.
 */
export function addDebtRepayment(
  recordId: string,
  repaymentInput: {
    amount: number;
    date?: string | null;
    walletId?: string | null;
    walletName?: string | null;
    txId?: string | null;
    note?: string | null;
    id?: string;
  },
  userId?: string | null,
): { updatedRecord: DebtReceivableRecord; repayment: DebtRepayment } {
  const records = getDebtReceivables(userId);
  const target = records.find((r) => r.id === recordId);
  if (!target) {
    throw new Error(`Debt record with ID "${recordId}" not found`);
  }

  const requestedAmount = Math.max(0, Number(repaymentInput.amount) || 0);
  if (requestedAmount <= 0) {
    throw new Error("Repayment amount must be greater than zero");
  }

  // Cap at remaining amount to prevent negative debt balance
  const cappedAmount = Math.min(requestedAmount, target.remainingAmount);

  const nowIso = new Date().toISOString();
  const repaymentDate = repaymentInput.date || nowIso.split("T")[0];

  const newRepayment: DebtRepayment = {
    id: repaymentInput.id || generateUUID(),
    amount: cappedAmount,
    date: repaymentDate,
    walletId: repaymentInput.walletId || null,
    walletName: repaymentInput.walletName || null,
    txId: repaymentInput.txId || null,
    note: repaymentInput.note ? repaymentInput.note.trim() : null,
    createdAt: nowIso,
  };

  const updatedRepayments = [newRepayment, ...target.repayments];
  const { remainingAmount, status } = calculateDebtStatus(
    target.totalAmount,
    updatedRepayments,
  );

  const updatedRecord: DebtReceivableRecord = {
    ...target,
    repayments: updatedRepayments,
    remainingAmount,
    status,
    updatedAt: nowIso,
  };

  const updatedRecords = records.map((r) => (r.id === recordId ? updatedRecord : r));
  saveDebtReceivables(updatedRecords, userId);
  return { updatedRecord, repayment: newRepayment };
}

/**
 * Deletes a repayment entry from a debt or receivable record.
 */
export function deleteDebtRepayment(
  recordId: string,
  repaymentId: string,
  userId?: string | null,
): DebtReceivableRecord | null {
  const records = getDebtReceivables(userId);
  const target = records.find((r) => r.id === recordId);
  if (!target) return null;

  const filteredRepayments = target.repayments.filter((rep) => rep.id !== repaymentId);
  if (filteredRepayments.length === target.repayments.length) return null;

  const { remainingAmount, status } = calculateDebtStatus(
    target.totalAmount,
    filteredRepayments,
  );

  const updatedRecord: DebtReceivableRecord = {
    ...target,
    repayments: filteredRepayments,
    remainingAmount,
    status,
    updatedAt: new Date().toISOString(),
  };

  const updatedRecords = records.map((r) => (r.id === recordId ? updatedRecord : r));
  saveDebtReceivables(updatedRecords, userId);
  return updatedRecord;
}

/**
 * Determines due status for a debt or receivable.
 */
export function getDebtDueStatus(
  record: DebtReceivableRecord,
  referenceDate: Date | string = new Date(),
): DebtDueStatus {
  if (record.status === "settled") return "settled";
  if (!record.dueDate || !record.dueDate.trim()) return "no_due_date";

  const due = parseISO(record.dueDate);
  if (!isValid(due)) return "no_due_date";

  const ref = typeof referenceDate === "string" ? parseISO(referenceDate) : referenceDate;
  const startDue = startOfDay(due);
  const startRef = startOfDay(ref);

  const diffDays = differenceInCalendarDays(startDue, startRef);

  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "due_today";
  if (diffDays <= 3) return "approaching";
  return "on_track";
}

/**
 * Computes top-level financial summary and health metrics for debts & receivables.
 */
export function calculateDebtReceivableSummary(
  records: DebtReceivableRecord[],
  referenceDate: Date | string = new Date(),
): DebtReceivableSummary {
  let totalReceivables = 0;
  let totalDebts = 0;
  let activeReceivablesCount = 0;
  let activeDebtsCount = 0;
  let settledReceivablesCount = 0;
  let settledDebtsCount = 0;
  let overdueCount = 0;
  let approachingDueCount = 0;

  for (const r of records) {
    if (r.type === "receivable") {
      if (r.status === "settled") {
        settledReceivablesCount++;
      } else {
        totalReceivables += r.remainingAmount;
        activeReceivablesCount++;
      }
    } else {
      if (r.status === "settled") {
        settledDebtsCount++;
      } else {
        totalDebts += r.remainingAmount;
        activeDebtsCount++;
      }
    }

    if (r.status !== "settled") {
      const dueStatus = getDebtDueStatus(r, referenceDate);
      if (dueStatus === "overdue") overdueCount++;
      if (dueStatus === "approaching" || dueStatus === "due_today") {
        approachingDueCount++;
      }
    }
  }

  return {
    totalReceivables,
    totalDebts,
    netReceivables: totalReceivables - totalDebts,
    activeReceivablesCount,
    activeDebtsCount,
    settledReceivablesCount,
    settledDebtsCount,
    overdueCount,
    approachingDueCount,
  };
}

/**
 * Pure localization labels (Zero bilingual mixing - Rule 6).
 */
export function getDebtDueStatusLabel(
  status: DebtDueStatus,
  isIndonesian: boolean,
): string {
  if (isIndonesian) {
    switch (status) {
      case "settled":
        return "Lunas";
      case "overdue":
        return "Terlewat";
      case "due_today":
        return "Jatuh Tempo Hari Ini";
      case "approaching":
        return "Mendekati Tempo";
      case "on_track":
        return "Berjalan";
      case "no_due_date":
        return "Tanpa Tempo";
    }
  }
  switch (status) {
    case "settled":
      return "Settled";
    case "overdue":
      return "Overdue";
    case "due_today":
      return "Due Today";
    case "approaching":
      return "Due Soon";
    case "on_track":
      return "On Track";
    case "no_due_date":
      return "No Due Date";
  }
}

export function getDebtTypeLabel(type: DebtType, isIndonesian: boolean): string {
  if (isIndonesian) {
    return type === "receivable" ? "Piutang" : "Utang";
  }
  return type === "receivable" ? "Receivable" : "Debt";
}

export function getDebtStatusLabel(
  status: DebtStatus,
  isIndonesian: boolean,
): string {
  if (isIndonesian) {
    switch (status) {
      case "unpaid":
        return "Belum Dibayar";
      case "partial":
        return "Dicicil Sebagian";
      case "settled":
        return "Lunas";
    }
  }
  switch (status) {
    case "unpaid":
      return "Unpaid";
    case "partial":
      return "Partially Paid";
    case "settled":
      return "Settled";
  }
}
