import { useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Bill, RepeatRule } from "../lib/types";
import {
  format,
  parseISO,
  isValid,
  addDays,
  addWeeks,
  addMonths,
  addYears,
} from "date-fns";
import { syncBillNotifications } from "../lib/notifications";
import { useAuth } from "../contexts/AuthContext";
import { useAddTransaction } from "./useTransactions";

interface BillInput {
  title: string;
  amount?: number | null;
  due_date: string;
  repeat_rule: RepeatRule;
  is_paid?: boolean;
  note?: string | null;
  wallet_id?: string | null;
  category_id?: string | null;
}


function sortBills(bills: Bill[]) {
  return [...bills].sort((a, b) => a.due_date.localeCompare(b.due_date));
}

function patchBillCaches(
  qc: ReturnType<typeof useQueryClient>,
  userId: string | undefined,
  updater: (old: Bill[]) => Bill[],
) {
  if (!userId) return;
  qc.setQueryData<Bill[]>(["bills", userId], (old) => {
    if (!old || !Array.isArray(old)) return old;
    return sortBills(updater(old));
  });
}

function getRolledForwardBillIfNeeded(bill: Bill, now = new Date()): Bill {
  if (bill.repeat_rule === "none" || !bill.is_paid) return bill;

  const todayKey = format(now, "yyyy-MM-dd");
  let nextDueDate = bill.due_date;
  let cursor = bill;

  while (nextDueDate < todayKey) {
    const candidate = getNextDueDate({ ...cursor, due_date: nextDueDate });
    if (!candidate || candidate === nextDueDate) break;
    nextDueDate = candidate;
    cursor = { ...cursor, due_date: candidate };
  }

  if (nextDueDate === bill.due_date) return bill;
  return {
    ...bill,
    due_date: nextDueDate,
    is_paid: false,
  };
}

export function useBills() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  const rolloverSignatureRef = useRef("");

  const query = useQuery({
    queryKey: ["bills", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("bills")
        .select("*")
        .eq("user_id", userId)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return sortBills((data as Bill[]) || []);
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  });

  const normalizedBills = useMemo(
    () => (query.data ?? []).map((bill) => getRolledForwardBillIfNeeded(bill)),
    [query.data],
  );

  const rolloverCandidates = useMemo(
    () =>
      normalizedBills.filter((bill, index) => {
        const original = query.data?.[index];
        return (
          !!original &&
          (bill.due_date !== original.due_date ||
            bill.is_paid !== original.is_paid)
        );
      }),
    [normalizedBills, query.data],
  );

  useEffect(() => {
    if (!userId || rolloverCandidates.length === 0) return;

    const signature = rolloverCandidates
      .map((bill) => `${bill.id}:${bill.due_date}:${bill.is_paid}`)
      .join("|");
    if (!signature || rolloverSignatureRef.current === signature) return;
    rolloverSignatureRef.current = signature;

    patchBillCaches(qc, userId, (old) =>
      old.map((bill) => {
        const updated = rolloverCandidates.find(
          (candidate) => candidate.id === bill.id,
        );
        return updated || bill;
      }),
    );

    void Promise.all(
      rolloverCandidates.map((bill) =>
        supabase
          .from("bills")
          .update({ due_date: bill.due_date, is_paid: bill.is_paid })
          .eq("id", bill.id),
      ),
    )
      .then(() => qc.invalidateQueries({ queryKey: ["bills", userId] }))
      .catch((error) => {
        rolloverSignatureRef.current = "";
        console.warn("Failed to roll recurring bills forward:", error);
        void qc.invalidateQueries({ queryKey: ["bills", userId] });
      });
  }, [qc, rolloverCandidates, userId]);

  useEffect(() => {
    if (!normalizedBills.length) return;
    const timer = setTimeout(() => {
      syncBillNotifications(normalizedBills).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [normalizedBills]);

  return {
    ...query,
    data: normalizedBills,
  };
}

export function useUpcomingBills() {
  const { data: bills } = useBills();
  if (!bills) return [];
  const today = new Date();
  const cutoff = addDays(today, 90);
  return bills
    .filter((b) => {
      if (b.is_paid) return false;
      const due = parseISO(b.due_date);
      return due <= cutoff;
    })
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
}

export function usePaidBills() {
  const { data: bills } = useBills();
  return (bills ?? []).filter((b) => b.is_paid);
}

export function useBillsDueOn(date: string) {
  const { data: bills } = useBills();
  return (bills ?? []).filter((b) => b.due_date === date && !b.is_paid);
}

export function getDaysUntilDue(dueDate: string): number {
  if (!dueDate) return 0;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = parseISO(dueDate);
    if (!isValid(due)) return 0;
    return Math.ceil((due.getTime() - today.getTime()) / 86400000);
  } catch {
    return 0;
  }
}

export function getBillDueStatusLabel(dueDate: string, isIndonesian?: boolean): string {
  const days = getDaysUntilDue(dueDate);
  if (days < 0) {
    const abs = Math.abs(days);
    return isIndonesian
      ? `Terlambat ${abs} hari`
      : `Overdue by ${abs} day${abs === 1 ? "" : "s"}`;
  }
  if (days === 0) return isIndonesian ? "Jatuh tempo hari ini" : "Due today";
  return isIndonesian
    ? `${days} hari lagi`
    : `Due in ${days} day${days === 1 ? "" : "s"}`;
}

export function getNextDueDate(bill: Bill): string | null {
  if (bill.repeat_rule === "none" || !bill.due_date) return null;
  try {
    const due = parseISO(bill.due_date);
    if (!isValid(due)) return null;
    let next: Date;
    switch (bill.repeat_rule) {
      case "weekly":
        next = addWeeks(due, 1);
        break;
      case "monthly":
        next = addMonths(due, 1);
        break;
      case "yearly":
        next = addYears(due, 1);
        break;
      default:
        return null;
    }
    return format(next, "yyyy-MM-dd");
  } catch {
    return null;
  }
}

export function useAddBill() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  return useMutation({
    mutationFn: async (input: BillInput) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("bills")
        .insert({ ...input, user_id: user.id })
        .select()
        .single();
      if (error) {
        if (
          error.message?.includes("wallet_id") ||
          error.message?.includes("category_id")
        ) {
          const fallbackInput = { ...input };
          delete fallbackInput.wallet_id;
          delete fallbackInput.category_id;
          const { data: retryData, error: retryError } = await supabase
            .from("bills")
            .insert({ ...fallbackInput, user_id: user.id })
            .select()
            .single();
          if (retryError) throw retryError;
          return {
            ...retryData,
            wallet_id: input.wallet_id,
            category_id: input.category_id,
          } as Bill;
        }
        throw error;
      }
      return data as Bill;
    },
    onSuccess: (newBill) => {
      patchBillCaches(qc, userId, (old) => [
        ...old.filter((b) => b.id !== newBill.id),
        newBill,
      ]);
      if (userId) {
        qc.invalidateQueries({ queryKey: ["bills", userId] });
      }
    },
  });
}

export function useUpdateBill() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  return useMutation({
    mutationFn: async ({ id, ...input }: BillInput & { id: string }) => {
      const { data, error } = await supabase
        .from("bills")
        .update(input)
        .eq("id", id)
        .select()
        .single();
      if (error) {
        if (
          error.message?.includes("wallet_id") ||
          error.message?.includes("category_id")
        ) {
          const fallbackInput = { ...input };
          delete fallbackInput.wallet_id;
          delete fallbackInput.category_id;
          const { data: retryData, error: retryError } = await supabase
            .from("bills")
            .update(fallbackInput)
            .eq("id", id)
            .select()
            .single();
          if (retryError) throw retryError;
          return {
            ...retryData,
            wallet_id: input.wallet_id,
            category_id: input.category_id,
          } as Bill;
        }
        throw error;
      }
      return data as Bill;
    },
    onSuccess: (updated) => {
      patchBillCaches(qc, userId, (old) =>
        old.map((b) => (b.id === updated.id ? updated : b)),
      );
      if (userId) {
        qc.invalidateQueries({ queryKey: ["bills", userId] });
      }
    },
  });
}

export function useDeleteBill() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bills").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (deletedId) => {
      patchBillCaches(qc, userId, (old) =>
        old.filter((b) => b.id !== deletedId),
      );
      if (userId) {
        qc.invalidateQueries({ queryKey: ["bills", userId] });
      }
    },
  });
}

export function useMarkBillPaid() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  const addTransaction = useAddTransaction();

  return useMutation({
    mutationFn: async ({
      bill,
      paid,
      recordTransaction = true,
      walletId,
      note,
      isIndonesian = true,
      occurredOn,
    }: {
      bill: Bill;
      paid: boolean;
      recordTransaction?: boolean;
      walletId?: string;
      note?: string;
      isIndonesian?: boolean;
      occurredOn?: string;
    }) => {
      const updateData: Partial<Bill> = { is_paid: paid };
      const { data, error } = await supabase
        .from("bills")
        .update(updateData)
        .eq("id", bill.id)
        .select()
        .single();
      if (error) throw error;

      // Auto-record expense transaction in ledger when marking bill as paid
      if (paid && recordTransaction && Number(bill.amount) > 0) {
        try {
          const txNote =
            note ||
            (isIndonesian
              ? `Pembayaran tagihan: ${bill.title}`
              : `Bill payment: ${bill.title}`);

          await addTransaction.mutateAsync({
            amount: Number(bill.amount),
            type: "expense",
            category_id: bill.category_id || null,
            wallet_id: walletId || bill.wallet_id || null,
            occurred_on: occurredOn || format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
            note: txNote,
          });
        } catch (err) {
          console.warn("[useMarkBillPaid] Auto-record ledger transaction warning:", err);
        }
      }

      return data as Bill;
    },
    onMutate: async ({ bill, paid }) => {
      if (userId) {
        await qc.cancelQueries({ queryKey: ["bills", userId] });
      }
      const previous = userId
        ? qc.getQueryData<Bill[]>(["bills", userId])
        : undefined;
      patchBillCaches(qc, userId, (old) =>
        old.map((item) =>
          item.id === bill.id ? { ...item, is_paid: paid } : item,
        ),
      );
      return { previous };
    },
    onSuccess: (updated) => {
      patchBillCaches(qc, userId, (old) =>
        old.map((b) => (b.id === updated.id ? updated : b)),
      );
    },
    onError: (_error, _vars, context) => {
      if (userId) {
        qc.setQueryData(["bills", userId], context?.previous);
      }
    },
    onSettled: () => {
      if (userId) {
        qc.invalidateQueries({ queryKey: ["bills", userId] });
      }
    },
  });
}
