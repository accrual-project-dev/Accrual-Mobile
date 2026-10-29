import { useMemo, useRef } from "react";
import { assertCaptureSession } from "../features/inbox/captureOwner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Transaction, TransactionType, Category } from "../lib/types";
import { format } from "date-fns";
import {
  enqueuePendingMutation,
  removePendingMutation,
  clearPendingMutations,
  getPendingMutations,
  flushPendingMutations,
} from "../lib/syncEngine";
import { categoryKeys } from "./useCategories";
import { deductGoalFromStorage, addGoalToStorage } from "./useGoals";

export function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // RFC4122 v4 compliant fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isUUID(val?: string | null): boolean {
  return Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
}

export interface TransactionInput {
  expectedUserId?: string;
  type: TransactionType;
  amount: number;
  category_id: string | null;
  wallet_id?: string | null;
  to_wallet_id?: string | null;
  note?: string | null;
  occurred_on: string;
  created_at?: string;
  space_id?: string | null;
  ledger_id?: string | null;
  created_by_name?: string | null;
  created_by_user_id?: string | null;
}

export interface TransactionFilters {
  categoryId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  userId?: string;
  ledgerId?: string;
  filterByUserIdOnly?: boolean;
  skipPendingOverlay?: boolean;
  showVisualIndicator?: boolean;
}

interface TransactionQueryOptions {
  enabled?: boolean;
}

export const transactionKeys = {
  all: (userId?: string, filters?: TransactionFilters) =>
    ["transactions", "all", userId ?? null, filters ?? null] as const,
  month: (userId: string | undefined, year: number, month: number) =>
    ["transactions", "month", userId ?? null, year, month] as const,
  day: (userId: string | undefined, date: string) =>
    ["transactions", "day", userId ?? null, date] as const,
  recent: (userId: string | undefined, limit: number) =>
    ["transactions", "recent", userId ?? null, limit] as const,
};

function sortTransactionsDesc(transactions: Transaction[]) {
  return [...transactions].sort((a, b) => {
    const occurred = (b.occurred_on || "").localeCompare(a.occurred_on || "");
    if (occurred !== 0) return occurred;
    const created = (b.created_at || "").localeCompare(a.created_at || "");
    if (created !== 0) return created;
    return (b.id || "").localeCompare(a.id || "");
  });
}

function isTransactionList(data: unknown): data is Transaction[] {
  return (
    Array.isArray(data) &&
    (data.length === 0 ||
      (typeof data[0] === "object" &&
        data[0] !== null &&
        "id" in data[0] &&
        "type" in data[0]))
  );
}

function matchesTransactionFilters(
  tx: Transaction,
  filters?: TransactionFilters | null,
) {
  if (!filters) return true;
  if (filters.ledgerId && filters.ledgerId !== "all") {
    const txLedger = tx.ledger_id || tx.space_id || "personal";
    if (txLedger !== filters.ledgerId) return false;
  } else if (filters.filterByUserIdOnly && filters.userId && tx.user_id !== filters.userId) {
    return false;
  }
  if (filters.categoryId && tx.category_id !== filters.categoryId) return false;
  if (filters.startDate && tx.occurred_on.slice(0, 10) < filters.startDate.slice(0, 10)) return false;
  if (filters.endDate && tx.occurred_on.slice(0, 10) > filters.endDate.slice(0, 10)) return false;
  if (filters.search) {
    const search = filters.search.toLowerCase();
    if (!tx.note?.toLowerCase().includes(search)) return false;
  }
  return true;
}

function snapshotTransactionQueries(qc: ReturnType<typeof useQueryClient>) {
  return qc
    .getQueriesData<Transaction[]>({ queryKey: ["transactions"] })
    .filter(([, data]) => isTransactionList(data));
}

function restoreTransactionQueries(
  qc: ReturnType<typeof useQueryClient>,
  snapshots: Array<[readonly unknown[], Transaction[] | undefined]>,
) {
  snapshots.forEach(([key, data]) => {
    qc.setQueryData(key, data);
  });
}

export function batchUpsertTransactionsAcrossCaches(
  qc: ReturnType<typeof useQueryClient>,
  txs: Transaction[],
) {
  if (!txs || txs.length === 0) return;
  const newMap = new Map<string, Transaction>();
  txs.forEach((t) => newMap.set(t.id, t));

  // 1. Immediately update in-memory snapshot and offline vault backup in a single batch
  try {
    const current = inMemoryTransactionsSnapshot || [];
    const kept = current.filter((item) => !newMap.has(item.id));
    inMemoryTransactionsSnapshot = sortTransactionsDesc([...txs, ...kept]);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(TX_BACKUP_STORAGE_KEY, JSON.stringify(inMemoryTransactionsSnapshot));
      } catch {}
      setVaultItem(TX_BACKUP_STORAGE_KEY, inMemoryTransactionsSnapshot).catch(() => {});
    }
  } catch {}

  // 2. Update active React Query caches
  const queries = qc.getQueryCache().findAll({ queryKey: ["transactions"] });
  queries.forEach((query) => {
    const data = query.state.data;
    if (!isTransactionList(data)) return;

    const key = query.queryKey as unknown as any[];
    const mode = key[1];
    const kept = data.filter((item) => !newMap.has(item.id));

    if (mode === "all") {
      const filters = (key[3] ?? null) as TransactionFilters | null;
      const matched = txs.filter((t) => matchesTransactionFilters(t, filters));
      qc.setQueryData(query.queryKey, sortTransactionsDesc([...matched, ...kept]));
      return;
    }

    if (mode === "month") {
      const year = Number(key[3]);
      const month = Number(key[4]);
      const monthKey = `${year}-${String(month).padStart(2, "0")}`;
      const matched = txs.filter((t) => t.occurred_on?.startsWith(monthKey));
      qc.setQueryData(query.queryKey, sortTransactionsDesc([...matched, ...kept]));
      return;
    }

    if (mode === "day") {
      const date = String(key[3] ?? "").slice(0, 10);
      const matched = txs.filter((t) => (t.occurred_on || "").slice(0, 10) === date);
      qc.setQueryData(query.queryKey, sortTransactionsDesc([...matched, ...kept]));
      return;
    }

    if (mode === "recent") {
      const limit = Number(key[3]) || 10;
      qc.setQueryData(
        query.queryKey,
        sortTransactionsDesc([...txs, ...kept]).slice(0, limit),
      );
    }
  });
}

export function batchRemoveTransactionsFromCaches(
  qc: ReturnType<typeof useQueryClient>,
  ids: string[],
) {
  if (!ids || ids.length === 0) return;
  const idSet = new Set(ids);

  // 1. Single-pass in-memory snapshot and offline vault backup update
  try {
    if (inMemoryTransactionsSnapshot) {
      inMemoryTransactionsSnapshot = inMemoryTransactionsSnapshot.filter((item) => !idSet.has(item.id));
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(TX_BACKUP_STORAGE_KEY, JSON.stringify(inMemoryTransactionsSnapshot));
        } catch {}
        setVaultItem(TX_BACKUP_STORAGE_KEY, inMemoryTransactionsSnapshot).catch(() => {});
      }
    }
  } catch {}

  // 2. Single-pass React Query cache update
  const queries = qc.getQueryCache().findAll({ queryKey: ["transactions"] });
  queries.forEach((query) => {
    const data = query.state.data;
    if (!isTransactionList(data)) return;
    qc.setQueryData(
      query.queryKey,
      data.filter((item) => !idSet.has(item.id)),
    );
  });
}

export function upsertTransactionAcrossCaches(
  qc: ReturnType<typeof useQueryClient>,
  tx: Transaction,
) {
  // 1. Immediately update in-memory snapshot and offline vault backup so fresh queries always see the item
  let mergedForMem: Transaction = tx;
  try {
    const current = inMemoryTransactionsSnapshot || [];
    const existingInMem = current.find((item) => item.id === tx.id);
    if (existingInMem) {
      mergedForMem = { ...existingInMem, ...tx };
    }
    const withoutTx = current.filter((item) => item.id !== tx.id);
    inMemoryTransactionsSnapshot = sortTransactionsDesc([mergedForMem, ...withoutTx]);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(TX_BACKUP_STORAGE_KEY, JSON.stringify(inMemoryTransactionsSnapshot));
      } catch {}
      setVaultItem(TX_BACKUP_STORAGE_KEY, inMemoryTransactionsSnapshot).catch(() => {});
    }
  } catch {}

  // 2. Update active React Query caches
  const queries = qc.getQueryCache().findAll({ queryKey: ["transactions"] });
  queries.forEach((query) => {
    const data = query.state.data;
    if (!isTransactionList(data)) return;

    const key = query.queryKey as unknown as any[];
    const mode = key[1];
    const existingInQuery = data.find((item) => item.id === tx.id);
    const mergedTx = existingInQuery ? { ...existingInQuery, ...tx } : mergedForMem;
    const withoutTx = data.filter((item) => item.id !== tx.id);

    if (mode === "all") {
      const filters = (key[3] ?? null) as TransactionFilters | null;
      const next = matchesTransactionFilters(mergedTx, filters)
        ? sortTransactionsDesc([mergedTx, ...withoutTx])
        : sortTransactionsDesc(withoutTx);
      qc.setQueryData(query.queryKey, next);
      return;
    }

    if (mode === "month") {
      const year = Number(key[3]);
      const month = Number(key[4]);
      const monthKey = `${year}-${String(month).padStart(2, "0")}`;
      const next = mergedTx.occurred_on?.startsWith(monthKey)
        ? sortTransactionsDesc([mergedTx, ...withoutTx])
        : sortTransactionsDesc(withoutTx);
      qc.setQueryData(query.queryKey, next);
      return;
    }

    if (mode === "day") {
      const date = String(key[3] ?? "").slice(0, 10);
      const next =
        (mergedTx.occurred_on || "").slice(0, 10) === date
          ? sortTransactionsDesc([mergedTx, ...withoutTx])
          : sortTransactionsDesc(withoutTx);
      qc.setQueryData(query.queryKey, next);
      return;
    }

    if (mode === "recent") {
      const limit = Number(key[3]) || 10;
      qc.setQueryData(
        query.queryKey,
        sortTransactionsDesc([mergedTx, ...withoutTx]).slice(0, limit),
      );
    }
  });
}

export function removeTransactionFromCaches(
  qc: ReturnType<typeof useQueryClient>,
  id: string,
) {
  // Update in-memory snapshot and offline vault backup
  try {
    if (inMemoryTransactionsSnapshot) {
      inMemoryTransactionsSnapshot = inMemoryTransactionsSnapshot.filter((item) => item.id !== id);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(TX_BACKUP_STORAGE_KEY, JSON.stringify(inMemoryTransactionsSnapshot));
        } catch {}
        setVaultItem(TX_BACKUP_STORAGE_KEY, inMemoryTransactionsSnapshot).catch(() => {});
      }
    }
  } catch {}

  const queries = qc.getQueryCache().findAll({ queryKey: ["transactions"] });
  queries.forEach((query) => {
    const data = query.state.data;
    if (!isTransactionList(data)) return;
    qc.setQueryData(
      query.queryKey,
      data.filter((item) => item.id !== id),
    );
  });
}

export function findTransactionInCache(
  qc: ReturnType<typeof useQueryClient>,
  id: string,
): Transaction | null {
  const queries = qc.getQueryCache().findAll({ queryKey: ["transactions"] });
  for (const query of queries) {
    const data = query.state.data;
    if (isTransactionList(data)) {
      const found = data.find((t) => t.id === id);
      if (found) return found;
    }
  }
  const allTxs = qc.getQueryCache().findAll({ queryKey: ["all_transactions"] });
  for (const query of allTxs) {
    const data = query.state.data;
    if (Array.isArray(data)) {
      const found = data.find((t: any) => t?.id === id);
      if (found) return found;
    }
  }
  return null;
}

export function checkAndDeductGoalFromTx(tx: Transaction) {
  if (!tx || !tx.note) return;
  const match = tx.note.match(/#goal_([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    deductGoalFromStorage(match[1], Number(tx.amount || 0));
  } else if (tx.note.includes("Alokasi Tabungan:")) {
    const titleMatch = tx.note
      .replace("Alokasi Tabungan:", "")
      .split("#")[0]
      .trim();
    if (titleMatch) {
      deductGoalFromStorage(titleMatch, Number(tx.amount || 0));
    }
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: PromiseLike<T>, ms = 15000): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Supabase request timed out after ${ms}ms`)), ms),
    ),
  ]);
}

export const TX_BACKUP_STORAGE_KEY = "TROUVAILLE_TX_BACKUP_V1";

export const TRANSACTION_SELECT_COLUMNS =
  "id, user_id, amount, type, category_id, wallet_id, to_wallet_id, note, occurred_on, created_at, ledger_id, created_by_name, created_by_user_id, categories(id, name, emoji, type)";

export const TRANSACTION_FALLBACK_COLUMNS =
  "id, user_id, amount, type, category_id, wallet_id, to_wallet_id, note, occurred_on, created_at, ledger_id, created_by_name, created_by_user_id";

import { useAuth } from "../contexts/AuthContext";
import { emitSyncStatus } from "../components/ui/SyncStatusPill";
import { getVaultItem, setVaultItem, removeVaultItem } from "../lib/indexedDbStorage";

let inMemoryTransactionsSnapshot: Transaction[] | null = null;

export async function clearLocalTransactionsCache(): Promise<void> {
  inMemoryTransactionsSnapshot = null;
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(TX_BACKUP_STORAGE_KEY);
    } catch {}
    try {
      await removeVaultItem(TX_BACKUP_STORAGE_KEY);
    } catch {}
  }
}

export async function purgePendingMutationsAndSync(userId?: string): Promise<Transaction[]> {
  clearPendingMutations();
  await clearLocalTransactionsCache();
  const cleanRecords = await fetchAllTransactionsFromSupabase({
    userId,
    skipPendingOverlay: true,
  });
  return cleanRecords;
}

// Synchronously prime from localStorage for 0ms initial render
try {
  const cached = typeof window !== "undefined" ? localStorage.getItem(TX_BACKUP_STORAGE_KEY) : null;
  if (cached) inMemoryTransactionsSnapshot = JSON.parse(cached);
} catch {}

// Asynchronously load 100% full dataset from off-main-thread IndexedDB
if (typeof window !== "undefined") {
  getVaultItem<Transaction[]>(TX_BACKUP_STORAGE_KEY).then((data) => {
    if (data && Array.isArray(data) && data.length > 0) {
      inMemoryTransactionsSnapshot = data;
    }
  }).catch(() => {});
}

/**
 * Retrieve cached local transactions snapshot for instantaneous 0ms cold-start rendering.
 * Serves from preloaded in-memory cache or local storage fallback.
 */
export function getStoredTransactionsSnapshot(userId?: string): Transaction[] | undefined {
  if (inMemoryTransactionsSnapshot && inMemoryTransactionsSnapshot.length > 0) {
    if (userId && userId !== "guest_local_user") {
      const filtered = inMemoryTransactionsSnapshot.filter((t: Transaction) => !t.user_id || t.user_id === userId);
      return filtered.length > 0 ? filtered : inMemoryTransactionsSnapshot;
    }
    return inMemoryTransactionsSnapshot;
  }
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(TX_BACKUP_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      inMemoryTransactionsSnapshot = parsed;
      if (userId && userId !== "guest_local_user") {
        const filtered = parsed.filter((t: Transaction) => !t.user_id || t.user_id === userId);
        return filtered.length > 0 ? filtered : parsed;
      }
      return parsed;
    }
  } catch {}
  return undefined;
}

/**
 * Helper to fetch a single transaction slice with 3-attempt exponential backoff retry.
 * Uses selective column projection to reduce bandwidth consumption.
 */
async function fetchTransactionChunk(
  from: number,
  to: number,
  filters?: TransactionFilters,
): Promise<Transaction[]> {
  const queryEndDate = filters?.endDate
    ? filters.endDate.length === 10
      ? `${filters.endDate}T23:59:59.999Z`
      : filters.endDate
    : undefined;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      let query = supabase
        .from("transactions")
        .select(TRANSACTION_SELECT_COLUMNS)
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to);

      if (filters?.ledgerId && filters.ledgerId !== "all") {
        query = query.eq("ledger_id", filters.ledgerId);
      } else if (filters?.filterByUserIdOnly && filters?.userId) {
        query = query.eq("user_id", filters.userId);
      }
      if (filters?.categoryId) query = query.eq("category_id", filters.categoryId);
      if (filters?.startDate) query = query.gte("occurred_on", filters.startDate);
      if (queryEndDate) query = query.lte("occurred_on", queryEndDate);

      let { data, error } = await withTimeout(query, 15000);
      if (error) {
        let fallbackQuery = supabase
          .from("transactions")
          .select(TRANSACTION_FALLBACK_COLUMNS)
          .order("occurred_on", { ascending: false })
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to);

        if (filters?.ledgerId && filters.ledgerId !== "all") {
          fallbackQuery = fallbackQuery.eq("ledger_id", filters.ledgerId);
        } else if (filters?.filterByUserIdOnly && filters?.userId) {
          fallbackQuery = fallbackQuery.eq("user_id", filters.userId);
        }
        if (filters?.categoryId) fallbackQuery = fallbackQuery.eq("category_id", filters.categoryId);
        if (filters?.startDate) fallbackQuery = fallbackQuery.gte("occurred_on", filters.startDate);
        if (queryEndDate) fallbackQuery = fallbackQuery.lte("occurred_on", queryEndDate);

        const fallbackRes = await withTimeout(fallbackQuery, 15000);
        if (fallbackRes.error) {
          let starQuery = supabase
            .from("transactions")
            .select("*")
            .order("occurred_on", { ascending: false })
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(from, to);

          if (filters?.ledgerId && filters.ledgerId !== "all") {
            starQuery = starQuery.eq("ledger_id", filters.ledgerId);
          } else if (filters?.filterByUserIdOnly && filters?.userId) {
            starQuery = starQuery.eq("user_id", filters.userId);
          }
          if (filters?.categoryId) starQuery = starQuery.eq("category_id", filters.categoryId);
          if (filters?.startDate) starQuery = starQuery.gte("occurred_on", filters.startDate);
          if (queryEndDate) starQuery = starQuery.lte("occurred_on", queryEndDate);

          const starRes = await withTimeout(starQuery, 15000);
          if (starRes.error) throw starRes.error;
          return (starRes.data as unknown as Transaction[]) || [];
        }
        return (fallbackRes.data as unknown as Transaction[]) || [];
      }
      return (data as unknown as Transaction[]) || [];
    } catch (err) {
      if (attempt === 3) throw err;
      await delay(250 * attempt);
    }
  }
  return [];
}

/**
 * High-performance progressive parallel chunked pagination fetcher for Supabase transactions.
 * Guarantees 100% retrieval across arbitrarily large datasets without PostgREST row limits.
 * Uses exact count on the first slice to download remaining chunks in parallel via Promise.all.
 * Resilient against network timeouts, flakiness, and offline cold starts with local backup snapshots.
 */
export async function fetchAllTransactionsFromSupabase(
  filters?: TransactionFilters,
  onPageFetched?: (currentCount: number, totalCount: number | null) => void,
): Promise<Transaction[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  const effectiveUserId = filters?.userId || user?.id;

  const pageSize = 500;
  const allRecords: Transaction[] = [];

  // Offline / Guest Local Mode: Fast path
  if (effectiveUserId === "guest_local_user" || localStorage.getItem("trouvaille_guest_mode") === "true") {
    const pendingMutations = getPendingMutations();
    const pendingDeletes = new Set<string>();
    const pendingUpserts = new Map<string, Transaction>();
    for (const m of pendingMutations) {
      if (m.type === "delete") {
        const id = m.payload?.id || m.payload;
        if (id) pendingDeletes.add(id);
      } else if ((m.type === "insert" || m.type === "update") && m.payload?.id) {
        pendingUpserts.set(m.payload.id, m.payload as Transaction);
      }
    }
    let restored: Transaction[] = [];
    try {
      const cached = localStorage.getItem(TX_BACKUP_STORAGE_KEY);
      if (cached) {
        restored = JSON.parse(cached);
      }
    } catch {}
    const map = new Map<string, Transaction>();
    for (const item of restored) {
      if (!pendingDeletes.has(item.id)) map.set(item.id, item);
    }
    for (const [id, tx] of pendingUpserts) {
      if (!pendingDeletes.has(id)) map.set(id, tx);
    }
    const all = sortTransactionsDesc(Array.from(map.values()));
    return all.filter((t) => matchesTransactionFilters(t, filters));
  }

  // Cloud Mode: Notify floating pill of sync start ONLY if visually requested
  if (filters?.showVisualIndicator) {
    emitSyncStatus({ status: "syncing" });
  }

  let totalCount: number | null = null;
  let fetchError: unknown = null;

  // Stage 1: Fetch initial page with exact count header
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      let query = supabase
        .from("transactions")
        .select(TRANSACTION_SELECT_COLUMNS, { count: "exact" })
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(0, pageSize - 1);

      if (filters?.ledgerId && filters.ledgerId !== "all") {
        query = query.eq("ledger_id", filters.ledgerId);
      } else if (filters?.filterByUserIdOnly && filters?.userId) {
        query = query.eq("user_id", filters.userId);
      }
      const queryEndDate = filters?.endDate
        ? filters.endDate.length === 10
          ? `${filters.endDate}T23:59:59.999Z`
          : filters.endDate
        : undefined;

      if (filters?.categoryId) query = query.eq("category_id", filters.categoryId);
      if (filters?.startDate) query = query.gte("occurred_on", filters.startDate);
      if (queryEndDate) query = query.lte("occurred_on", queryEndDate);

      let { data, error, count } = await withTimeout(query, 15000);
      if (error) {
        // Fallback to flat query without join for speed and resilience
        let fallbackQuery = supabase
          .from("transactions")
          .select(TRANSACTION_FALLBACK_COLUMNS, { count: "exact" })
          .order("occurred_on", { ascending: false })
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(0, pageSize - 1);

        if (filters?.ledgerId && filters.ledgerId !== "all") {
          fallbackQuery = fallbackQuery.eq("ledger_id", filters.ledgerId);
        } else if (filters?.filterByUserIdOnly && filters?.userId) {
          fallbackQuery = fallbackQuery.eq("user_id", filters.userId);
        }
        if (filters?.categoryId) fallbackQuery = fallbackQuery.eq("category_id", filters.categoryId);
        if (filters?.startDate) fallbackQuery = fallbackQuery.gte("occurred_on", filters.startDate);
        if (queryEndDate) fallbackQuery = fallbackQuery.lte("occurred_on", queryEndDate);

        const fallbackRes = await withTimeout(fallbackQuery, 15000);
        if (fallbackRes.error) {
          let starQuery = supabase
            .from("transactions")
            .select("*", { count: "exact" })
            .order("occurred_on", { ascending: false })
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(0, pageSize - 1);

          if (filters?.ledgerId && filters.ledgerId !== "all") {
            starQuery = starQuery.eq("ledger_id", filters.ledgerId);
          } else if (filters?.filterByUserIdOnly && filters?.userId) {
            starQuery = starQuery.eq("user_id", filters.userId);
          }
          if (filters?.categoryId) starQuery = starQuery.eq("category_id", filters.categoryId);
          if (filters?.startDate) starQuery = starQuery.gte("occurred_on", filters.startDate);
          if (queryEndDate) starQuery = starQuery.lte("occurred_on", queryEndDate);

          const starRes = await withTimeout(starQuery, 15000);
          if (starRes.error) throw starRes.error;
          if (starRes.data && Array.isArray(starRes.data)) {
            allRecords.push(...(starRes.data as unknown as Transaction[]));
          }
          totalCount = typeof starRes.count === "number" ? starRes.count : null;
        } else if (fallbackRes.data && Array.isArray(fallbackRes.data)) {
          allRecords.push(...(fallbackRes.data as unknown as Transaction[]));
          totalCount = typeof fallbackRes.count === "number" ? fallbackRes.count : null;
        }
      } else if (data && Array.isArray(data)) {
        allRecords.push(...(data as unknown as Transaction[]));
        totalCount = typeof count === "number" ? count : null;
      }
      fetchError = null;
      break;
    } catch (err) {
      fetchError = err;
      if (attempt < 3) {
        await delay(300 * attempt);
      }
    }
  }

  // Network Failure Recovery
  if (fetchError && allRecords.length === 0) {
    try {
      const rawBackup = localStorage.getItem(TX_BACKUP_STORAGE_KEY);
      if (rawBackup) {
        const parsed = JSON.parse(rawBackup);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.warn(
            "[fetchAllTransactionsFromSupabase] Network unreachable, successfully recovered from local snapshot:",
            fetchError,
          );
          let restored = parsed as Transaction[];
          if (filters?.categoryId) {
            restored = restored.filter((t) => t.category_id === filters.categoryId);
          }
          if (filters?.startDate) {
            const startDay = filters.startDate.slice(0, 10);
            restored = restored.filter((t) => t.occurred_on.slice(0, 10) >= startDay);
          }
          if (filters?.endDate) {
            const endDay = filters.endDate.slice(0, 10);
            restored = restored.filter((t) => t.occurred_on.slice(0, 10) <= endDay);
          }
          if (filters?.search) {
            const s = filters.search.toLowerCase();
            restored = restored.filter(
              (t) =>
                t.categories?.name.toLowerCase().includes(s) ||
                t.note?.toLowerCase().includes(s),
            );
          }
          // Overlay pending mutations onto restored backup
          const pendingMutations = getPendingMutations();
          const pendingDeletes = new Set<string>();
          const pendingUpserts = new Map<string, Transaction>();
          for (const m of pendingMutations) {
            if (m.type === "delete") {
              const id = m.payload?.id || m.payload;
              if (id) pendingDeletes.add(id);
            } else if ((m.type === "insert" || m.type === "update") && m.payload?.id) {
              pendingUpserts.set(m.payload.id, m.payload as Transaction);
            }
          }
          const map = new Map<string, Transaction>();
          for (const item of restored) {
            if (!pendingDeletes.has(item.id)) map.set(item.id, item);
          }
          for (const [id, tx] of pendingUpserts) {
            if (!pendingDeletes.has(id)) map.set(id, tx);
          }
          if (filters?.showVisualIndicator) {
            emitSyncStatus({ status: "error", message: "Bekerja secara offline" });
          }
          return sortTransactionsDesc(Array.from(map.values()));
        }
      }
    } catch (backupErr) {
      console.warn("[fetchAllTransactionsFromSupabase] Backup read failed:", backupErr);
    }

    if (filters?.showVisualIndicator) {
      emitSyncStatus({ status: "error", message: "Network unavailable" });
    }
    throw fetchError;
  }

  if (onPageFetched) {
    onPageFetched(allRecords.length, totalCount);
  }

  // Stage 2: Parallel chunk fetching if dataset exceeds 1 page
  if (totalCount !== null && totalCount > pageSize) {
    const chunkPromises: Promise<Transaction[]>[] = [];
    for (let offset = pageSize; offset < totalCount; offset += pageSize) {
      const to = Math.min(offset + pageSize - 1, totalCount - 1);
      chunkPromises.push(fetchTransactionChunk(offset, to, filters));
    }

    try {
      const remainingChunks = await Promise.all(chunkPromises);
      for (const chunk of remainingChunks) {
        allRecords.push(...chunk);
        if (onPageFetched) {
          onPageFetched(allRecords.length, totalCount);
        }
      }
    } catch (stage2Err) {
      console.warn("[fetchAllTransactionsFromSupabase] Parallel fetch warning, falling back to sequential retry:", stage2Err);
      let from = allRecords.length;
      while (from < totalCount) {
        const to = Math.min(from + pageSize - 1, totalCount - 1);
        const chunk = await fetchTransactionChunk(from, to, filters);
        if (chunk.length === 0) break;
        allRecords.push(...chunk);
        if (onPageFetched) {
          onPageFetched(allRecords.length, totalCount);
        }
        from += pageSize;
      }
    }
  } else if (totalCount === null && allRecords.length === pageSize) {
    // Fallback: Sequential loop if count header was not returned
    let from = pageSize;
    let hasMore = true;
    while (hasMore) {
      const chunk = await fetchTransactionChunk(from, from + pageSize - 1, filters);
      if (chunk.length === 0) {
        hasMore = false;
        break;
      }
      allRecords.push(...chunk);
      if (onPageFetched) {
        onPageFetched(allRecords.length, null);
      }
      if (chunk.length < pageSize) {
        hasMore = false;
      } else {
        from += pageSize;
      }
    }
  }

  let uniqueRecords: Transaction[];

  if (filters?.skipPendingOverlay) {
    uniqueRecords = sortTransactionsDesc(allRecords);
  } else {
    // Deduplicate and overlay local pending mutations
    const pendingMutations = getPendingMutations();
    const pendingDeletes = new Set<string>();
    const pendingUpserts = new Map<string, Transaction>();

    for (const m of pendingMutations) {
      if (m.type === "delete") {
        const id = m.payload?.id || m.payload;
        if (id) pendingDeletes.add(id);
      } else if ((m.type === "insert" || m.type === "update") && m.payload?.id) {
        pendingUpserts.set(m.payload.id, m.payload as Transaction);
      }
    }

    const recordMap = new Map<string, Transaction>();
    for (const item of allRecords) {
      if (!pendingDeletes.has(item.id)) {
        recordMap.set(item.id, item);
      }
    }

    // Preserve and overlay all local pending inserts/updates
    for (const [id, pendingTx] of pendingUpserts) {
      if (!pendingDeletes.has(id)) {
        recordMap.set(id, pendingTx);
      }
    }

    uniqueRecords = sortTransactionsDesc(Array.from(recordMap.values()));
  }

  if (filters?.search) {
    const s = filters.search.toLowerCase();
    uniqueRecords = uniqueRecords.filter((t) =>
      t.note?.toLowerCase().includes(s),
    );
  }

  // Dataset Integrity Guard: Only flag truncated fetch if we received substantially fewer records than expected
  const isTruncatedFetch =
    totalCount !== null &&
    totalCount > 10 &&
    !filters?.categoryId &&
    !filters?.startDate &&
    !filters?.endDate &&
    !filters?.search &&
    allRecords.length < totalCount * 0.8 &&
    (typeof navigator !== "undefined" ? !navigator.onLine : false);

  if (isTruncatedFetch) {
    console.warn(`[fetchAllTransactionsFromSupabase] Incomplete sync detected: ${uniqueRecords.length}/${totalCount} records.`);
    if (inMemoryTransactionsSnapshot && inMemoryTransactionsSnapshot.length > uniqueRecords.length) {
      console.warn(`[fetchAllTransactionsFromSupabase] Preserving healthier local snapshot of ${inMemoryTransactionsSnapshot.length} records.`);
      if (filters?.showVisualIndicator) {
        emitSyncStatus({ status: "error", message: "Sinkronisasi belum lengkap" });
      }
      return inMemoryTransactionsSnapshot;
    }
  }

  // Persist full 100% dataset (all 2,534+ transactions) to IndexedDB off-main-thread!
  if (
    !filters?.categoryId &&
    !filters?.startDate &&
    !filters?.endDate &&
    !filters?.search &&
    uniqueRecords.length > 0 &&
    !isTruncatedFetch
  ) {
    inMemoryTransactionsSnapshot = uniqueRecords;
    setVaultItem(TX_BACKUP_STORAGE_KEY, uniqueRecords).catch((e) =>
      console.warn("[fetchAllTransactionsFromSupabase] IndexedDB write warning:", e),
    );

    // Keep full synchronous backup in localStorage, slicing ONLY if QuotaExceeded
    try {
      localStorage.setItem(
        TX_BACKUP_STORAGE_KEY,
        JSON.stringify(uniqueRecords),
      );
    } catch {
      try {
        localStorage.setItem(
          TX_BACKUP_STORAGE_KEY,
          JSON.stringify(uniqueRecords.slice(0, 1000)),
        );
      } catch (e) {
        console.warn("[fetchAllTransactionsFromSupabase] Failed to write backup snapshot:", e);
      }
    }
  }

  // Inform status pill that sync has completed ONLY if visually requested
  if (filters?.showVisualIndicator) {
    if (!isTruncatedFetch) {
      emitSyncStatus({ status: "synced", count: uniqueRecords.length });
    } else {
      emitSyncStatus({ status: "error", message: "Sinkronisasi belum lengkap" });
    }
  }

  return uniqueRecords;
}

export function useRecentTransactions(limit = 10) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: transactionKeys.recent(userId, limit),
    queryFn: async () => {
      if (!userId) return [];
      if (userId === "guest_local_user" || localStorage.getItem("trouvaille_guest_mode") === "true") {
        try {
          const cached = localStorage.getItem(TX_BACKUP_STORAGE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached) as Transaction[];
            if (Array.isArray(parsed)) return parsed.slice(0, limit);
          }
        } catch {}
        return [];
      }
      const { data, error } = await supabase
        .from("transactions")
        .select(TRANSACTION_SELECT_COLUMNS)
        .eq("user_id", userId)
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit);
      if (error) {
        const { data: fallback, error: fbErr } = await supabase
          .from("transactions")
          .select(TRANSACTION_FALLBACK_COLUMNS)
          .eq("user_id", userId)
          .order("occurred_on", { ascending: false })
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(limit);
        if (fbErr) {
          const { data: starData, error: starErr } = await supabase
            .from("transactions")
            .select("*")
            .eq("user_id", userId)
            .order("occurred_on", { ascending: false })
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .limit(limit);
          if (starErr) throw starErr;
          return ((starData || []) as unknown) as Transaction[];
        }
        return ((fallback || []) as unknown) as Transaction[];
      }
      return ((data || []) as unknown) as Transaction[];
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
    placeholderData: (previousData) => {
      if (previousData) return previousData;
      const snapshot = getStoredTransactionsSnapshot(userId);
      return snapshot ? snapshot.slice(0, limit) : undefined;
    },
  });
}

export function useMonthTransactions(year: number, month: number) {
  const { user } = useAuth();
  const userId = user?.id;
  const start = format(new Date(year, month - 1, 1), "yyyy-MM-dd");
  const end = format(new Date(year, month, 0), "yyyy-MM-dd");

  return useQuery({
    queryKey: transactionKeys.month(userId, year, month),
    queryFn: () =>
      fetchAllTransactionsFromSupabase({
        startDate: start,
        endDate: end,
        userId,
      }),
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
}

export function useAllTransactions(
  filters?: TransactionFilters,
  options?: TransactionQueryOptions,
) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: transactionKeys.all(userId, filters),
    queryFn: () => fetchAllTransactionsFromSupabase({ ...filters, userId }),
    enabled: (options?.enabled ?? true) && !!userId,
    staleTime: 60 * 1000,
    placeholderData: (previousData) => {
      if (previousData) return previousData;
      if (!filters || (!filters.categoryId && !filters.startDate && !filters.endDate && !filters.search)) {
        return getStoredTransactionsSnapshot(userId);
      }
      return undefined;
    },
  });
}

export function useDayTransactions(date: string) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: transactionKeys.day(userId, date),
    queryFn: async () => {
      if (!userId) return [];
      const dayPrefix = date.slice(0, 10);
      const dayEnd = `${dayPrefix}T23:59:59.999Z`;
      const { data, error } = await supabase
        .from("transactions")
        .select(TRANSACTION_SELECT_COLUMNS)
        .eq("user_id", userId)
        .gte("occurred_on", dayPrefix)
        .lte("occurred_on", dayEnd)
        .order("created_at", { ascending: false });
      if (error) {
        const { data: fb, error: fbErr } = await supabase
          .from("transactions")
          .select(TRANSACTION_FALLBACK_COLUMNS)
          .eq("user_id", userId)
          .gte("occurred_on", dayPrefix)
          .lte("occurred_on", dayEnd)
          .order("created_at", { ascending: false });
        if (fbErr) {
          const { data: starData, error: starErr } = await supabase
            .from("transactions")
            .select("*")
            .eq("user_id", userId)
            .gte("occurred_on", dayPrefix)
            .lte("occurred_on", dayEnd)
            .order("created_at", { ascending: false });
          if (starErr) throw starErr;
          return ((starData || []) as unknown) as Transaction[];
        }
        return ((fb || []) as unknown) as Transaction[];
      }
      return ((data || []) as unknown) as Transaction[];
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
}

import {
  computeMonthAggregates,
  isCorrectionTx,
  isOpeningBalanceTx,
} from "../lib/financialMath";

export function useMonthSummary(year: number, month: number) {
  const { data: monthTxs = [] } = useMonthTransactions(year, month);
  return useMemo(() => {
    const agg = computeMonthAggregates(monthTxs, year, month);
    return {
      totalIncome: agg.totalIncome,
      totalExpense: agg.totalExpense,
      balance: agg.netCashflow,
      savingsRate: agg.savingsRate,
      txCount: agg.txCount,
      avgExpense: agg.avgExpense,
    };
  }, [monthTxs, year, month]);
}

export function useAddTransaction() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  const currentUserId = useRef(userId);
  currentUserId.current = userId;
  const captureSessionIsCurrent = async (expectedUserId?: string) => {
    if (!expectedUserId) return true;
    const { data: { session } } = await supabase.auth.getSession();
    const actualUserId = session?.user?.id || (currentUserId.current === "guest_local_user" ? currentUserId.current : undefined);
    return currentUserId.current === expectedUserId && actualUserId === expectedUserId;
  };

  return useMutation({
    mutationFn: async (input: TransactionInput & { id?: string }) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      assertCaptureSession(input.expectedUserId, session?.user?.id || (userId === "guest_local_user" ? userId : undefined));
      const currentUser = session?.user || (userId ? { id: userId } : null);

      const effectiveId = input.id || generateUUID();
      input.id = effectiveId;

      const allCategories = qc.getQueryData<Category[]>(
        categoryKeys.all(currentUser?.id || userId),
      );
      const categoryObj =
        allCategories?.find((c) => c.id === input.category_id) || null;

      const assignedLedger = input.ledger_id || input.space_id || "personal";
      const cleanCatId = input.type === "transfer" ? null : (input.category_id && isUUID(input.category_id) ? input.category_id : null);
      const cleanWalletId = input.wallet_id && isUUID(input.wallet_id) ? input.wallet_id : null;
      const cleanToWalletId = input.type === "transfer" && input.to_wallet_id && isUUID(input.to_wallet_id) ? input.to_wallet_id : null;

      const createdByName =
        input.created_by_name ||
        (session?.user?.user_metadata?.full_name as string) ||
        session?.user?.email?.split("@")[0] ||
        null;

      // Sanitize occurred_on: must be YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss with year between 2000 and 2100
      let cleanOccurredOn = input.occurred_on;
      if (!cleanOccurredOn || !/^(?:20\d{2}|2100)-\d{2}-\d{2}($|[T ]\d{2}:\d{2}(:\d{2})?)/.test(cleanOccurredOn)) {
        cleanOccurredOn = format(new Date(), "yyyy-MM-dd");
      } else {
        cleanOccurredOn = cleanOccurredOn.replace(" ", "T");
      }
      let cleanCreatedAt = input.created_at;
      if (cleanCreatedAt) {
        const parsedCreated = new Date(cleanCreatedAt);
        if (isNaN(parsedCreated.getTime()) || parsedCreated.getFullYear() < 2000 || parsedCreated.getFullYear() > 2100) {
          cleanCreatedAt = new Date().toISOString();
        }
      } else {
        cleanCreatedAt = new Date().toISOString();
      }

      const fullTx: Transaction = {
        id: effectiveId,
        user_id: currentUser?.id || userId || "",
        amount: Number(input.amount),
        type: input.type,
        category_id: cleanCatId,
        wallet_id: cleanWalletId,
        to_wallet_id: cleanToWalletId,
        note: input.note || null,
        occurred_on: cleanOccurredOn,
        created_at: cleanCreatedAt,
        categories: input.type === "transfer" ? null : categoryObj,
        ledger_id: assignedLedger,
        space_id: assignedLedger,
        created_by_name: createdByName,
        created_by_user_id: currentUser?.id || userId || null,
      };

      // Always save to persistent pending mutations queue first
      const mutation = enqueuePendingMutation("insert", fullTx);

      if (!currentUser?.id) {
        return fullTx;
      }

      // Attempt immediate sync to Supabase with quick timeout/retry
      try {
        // Exclude virtual/local-only client properties (space_id, created_by_*) so Supabase insert succeeds unconditionally
        const dbPayload: any = {
          id: effectiveId,
          user_id: currentUser.id,
          amount: Number(input.amount),
          type: input.type,
          category_id: cleanCatId,
          wallet_id: cleanWalletId,
          to_wallet_id: cleanToWalletId,
          note: input.note || null,
          occurred_on: cleanOccurredOn,
          created_at: cleanCreatedAt,
          ledger_id: assignedLedger,
        };

        let query = supabase
          .from("transactions")
          .upsert(dbPayload)
          .select("*, categories(*)");

        let res = await withTimeout(query, 7000);
        if (res.error) {
          // Graceful fallback: If ledger_id column does not exist yet in Supabase, retry without it
          const { ledger_id: _lid, ...fallbackPayload } = dbPayload;
          res = await withTimeout(
            supabase
              .from("transactions")
              .upsert(fallbackPayload)
              .select("*"),
            7000,
          );
        }

        if (!res.error && res.data && res.data[0]) {
          removePendingMutation(mutation.id);
          const serverTx = res.data[0] as Transaction;
          return {
            ...serverTx,
            categories: serverTx.categories || categoryObj,
          };
        }
      } catch (networkErr) {
        console.warn(
          "[useAddTransaction] Network slow/unreachable. Preserved in pending queue:",
          networkErr,
        );
      }

      // Return fullTx safely so UI stays intact and transaction is never dropped
      return fullTx;
    },
    onMutate: async (newTx: any) => {
      if (newTx.expectedUserId) {
        const { data: { session } } = await supabase.auth.getSession();
        assertCaptureSession(newTx.expectedUserId, session?.user?.id || (userId === "guest_local_user" ? userId : undefined));
      }
      await qc.cancelQueries({ queryKey: ["transactions"] });
      const snapshots = snapshotTransactionQueries(qc);

      // Pre-assign ID if not set so mutationFn uses the exact same ID
      const effectiveId = newTx.id || generateUUID();
      newTx.id = effectiveId;

      const allCategories = qc.getQueryData<Category[]>(categoryKeys.all(userId));
      const categoryObj =
        allCategories?.find((c) => c.id === newTx.category_id) || null;

      const cleanCatId = newTx.type === "transfer" ? null : (newTx.category_id && isUUID(newTx.category_id) ? newTx.category_id : null);
      const cleanWalletId = newTx.wallet_id && isUUID(newTx.wallet_id) ? newTx.wallet_id : null;
      const cleanToWalletId = newTx.type === "transfer" && newTx.to_wallet_id && isUUID(newTx.to_wallet_id) ? newTx.to_wallet_id : null;
      const assignedLedger = newTx.ledger_id || newTx.space_id || "personal";

      // Sanitize occurred_on: must be YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss with year between 2000 and 2100
      let cleanOccurredOn = newTx.occurred_on;
      if (!cleanOccurredOn || !/^(?:20\d{2}|2100)-\d{2}-\d{2}($|[T ]\d{2}:\d{2}(:\d{2})?)/.test(cleanOccurredOn)) {
        cleanOccurredOn = format(new Date(), "yyyy-MM-dd");
      } else {
        cleanOccurredOn = cleanOccurredOn.replace(" ", "T");
      }
      let cleanCreatedAt = newTx.created_at;
      if (cleanCreatedAt) {
        const parsedCreated = new Date(cleanCreatedAt);
        if (isNaN(parsedCreated.getTime()) || parsedCreated.getFullYear() < 2000 || parsedCreated.getFullYear() > 2100) {
          cleanCreatedAt = new Date().toISOString();
        }
      } else {
        cleanCreatedAt = new Date().toISOString();
      }

      const optimisticItem: Transaction = {
        id: effectiveId,
        user_id: userId || "",
        amount: Number(newTx.amount),
        type: newTx.type,
        category_id: cleanCatId,
        wallet_id: cleanWalletId,
        to_wallet_id: cleanToWalletId,
        note: newTx.note || null,
        occurred_on: cleanOccurredOn,
        created_at: cleanCreatedAt,
        categories: newTx.type === "transfer" ? null : categoryObj,
        ledger_id: assignedLedger,
        space_id: assignedLedger,
      };

      // Captures become visible only after their durable queue write succeeds.
      // A failed enqueue must not look processed to the next inbox drain.
      if (!newTx.expectedUserId) upsertTransactionAcrossCaches(qc, optimisticItem);
      return { snapshots, optimisticItem };
    },
    onSuccess: async (savedTx, vars, context) => {
      if (!(await captureSessionIsCurrent(vars.expectedUserId))) return;
      // Orphan cleanup: if optimistic item ID differed from savedTx ID, remove the old one
      if (context?.optimisticItem && context.optimisticItem.id !== savedTx.id) {
        removeTransactionFromCaches(qc, context.optimisticItem.id);
      }
      const enriched: Transaction = {
        ...savedTx,
        categories: savedTx.categories || context?.optimisticItem?.categories || null,
      };
      upsertTransactionAcrossCaches(qc, enriched);
    },
    onError: (_err, newTx, context) => {
      // Capture failures have no optimistic entry: retain their raw inbox record.
      if (newTx.expectedUserId) return;
      // Do NOT rollback if transaction was enqueued
      if (context?.optimisticItem) {
        upsertTransactionAcrossCaches(qc, context.optimisticItem);
      }
    },
    onSettled: async (_data, _error, vars) => {
      if (!(await captureSessionIsCurrent(vars.expectedUserId))) return;
      qc.invalidateQueries({ queryKey: ["wallets"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      flushPendingMutations().catch(() => {});
    },
  });
}

export function useBatchAddTransactions() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: async (inputs: Array<TransactionInput & { id?: string }>) => {
      if (!inputs || inputs.length === 0) return [];

      const {
        data: { session },
      } = await supabase.auth.getSession();
      inputs.forEach(input => assertCaptureSession(input.expectedUserId, session?.user?.id || (userId === "guest_local_user" ? userId : undefined)));
      const currentUser = session?.user || (userId ? { id: userId } : null);

      const allCategories = qc.getQueryData<Category[]>(
        categoryKeys.all(currentUser?.id || userId),
      );

      const prepared: Array<{
        fullTx: Transaction;
        dbPayload: any;
        mutationId: string;
        categoryObj: Category | null;
      }> = [];

      for (const input of inputs) {
        const effectiveId = input.id || generateUUID();
        input.id = effectiveId;

        const categoryObj =
          allCategories?.find((c) => c.id === input.category_id) || null;

        const assignedLedger = input.ledger_id || input.space_id || "personal";

        const cleanCatId = input.type === "transfer" ? null : (input.category_id && isUUID(input.category_id) ? input.category_id : null);
        const cleanWalletId = input.wallet_id && isUUID(input.wallet_id) ? input.wallet_id : null;
        const cleanToWalletId = input.type === "transfer" && input.to_wallet_id && isUUID(input.to_wallet_id) ? input.to_wallet_id : null;

        const fullTx: Transaction = {
          id: effectiveId,
          user_id: currentUser?.id || userId || "",
          amount: Number(input.amount),
          type: input.type,
          category_id: cleanCatId,
          wallet_id: cleanWalletId,
          to_wallet_id: cleanToWalletId,
          note: input.note || null,
          occurred_on: input.occurred_on,
          created_at: input.created_at || new Date().toISOString(),
          categories: input.type === "transfer" ? null : categoryObj,
          ledger_id: assignedLedger,
          space_id: assignedLedger,
          created_by_name: input.created_by_name || null,
          created_by_user_id: currentUser?.id || userId || null,
        };

        const mutation = enqueuePendingMutation("insert", fullTx);

        const dbPayload: any = {
          id: effectiveId,
          user_id: currentUser?.id || userId || "",
          amount: Number(input.amount),
          type: input.type,
          category_id: cleanCatId,
          wallet_id: cleanWalletId,
          to_wallet_id: cleanToWalletId,
          note: input.note || null,
          occurred_on: input.occurred_on,
          created_at: input.created_at || new Date().toISOString(),
          ledger_id: assignedLedger,
        };

        prepared.push({
          fullTx,
          dbPayload,
          mutationId: mutation.id,
          categoryObj: input.type === "transfer" ? null : categoryObj,
        });
      }

      const createdList: Transaction[] = [];

      if (currentUser?.id) {
        const chunkSize = 50;
        for (let i = 0; i < prepared.length; i += chunkSize) {
          const chunk = prepared.slice(i, i + chunkSize);
          const chunkPayloads = chunk.map((c) => c.dbPayload);
          try {
            let res = await withTimeout(
              supabase
                .from("transactions")
                .upsert(chunkPayloads)
                .select("*, categories(*)"),
              10000,
            );
            if (res.error) {
              const fallbackPayloads = chunkPayloads.map(({ ledger_id: _lid, ...fb }) => fb);
              res = await withTimeout(
                supabase
                  .from("transactions")
                  .upsert(fallbackPayloads)
                  .select("*"),
                10000,
              );
            }

            if (!res.error && res.data && Array.isArray(res.data)) {
              const returnedMap = new Map<string, Transaction>();
              (res.data as Transaction[]).forEach((sTx) => returnedMap.set(sTx.id, sTx));

              chunk.forEach((c) => {
                removePendingMutation(c.mutationId);
                const serverTx = returnedMap.get(c.fullTx.id);
                if (serverTx) {
                  createdList.push({
                    ...serverTx,
                    categories: serverTx.categories || c.categoryObj,
                  });
                } else {
                  createdList.push(c.fullTx);
                }
              });
              continue;
            }
          } catch (networkErr) {
            console.warn(
              "[useBatchAddTransactions] Network slow/unreachable. Preserved in pending queue:",
              networkErr,
            );
          }
          // If chunk failed or network dropped, preserve local fullTx and retain in pending queue
          chunk.forEach((c) => createdList.push(c.fullTx));
        }
      } else {
        prepared.forEach((c) => createdList.push(c.fullTx));
      }

      return createdList;
    },
    onMutate: async (newTxs: Array<any>) => {
      await qc.cancelQueries({ queryKey: ["transactions"] });
      const snapshots = snapshotTransactionQueries(qc);

      const allCategories = qc.getQueryData<Category[]>(categoryKeys.all(userId));
      const optimisticItems: Transaction[] = [];

      for (const newTx of newTxs) {
        const effectiveId = newTx.id || generateUUID();
        newTx.id = effectiveId;

        const categoryObj =
          allCategories?.find((c) => c.id === newTx.category_id) || null;

        const assignedLedger = newTx.ledger_id || newTx.space_id || "personal";

        const optimisticItem: Transaction = {
          id: effectiveId,
          user_id: userId || "",
          amount: Number(newTx.amount),
          type: newTx.type,
          category_id: newTx.type === "transfer" ? null : newTx.category_id,
          wallet_id: newTx.wallet_id || null,
          to_wallet_id: newTx.to_wallet_id || null,
          note: newTx.note || null,
          occurred_on: newTx.occurred_on,
          created_at: newTx.created_at || new Date().toISOString(),
          categories: newTx.type === "transfer" ? null : categoryObj,
          ledger_id: assignedLedger,
          space_id: assignedLedger,
        };

        optimisticItems.push(optimisticItem);
      }

      batchUpsertTransactionsAcrossCaches(qc, optimisticItems);

      return { snapshots, optimisticItems };
    },
    onSuccess: (savedList, _vars, context) => {
      const enrichedList: Transaction[] = savedList.map((savedTx) => {
        const matchedOptimistic = context?.optimisticItems.find(
          (o) => o.id === savedTx.id,
        );
        return {
          ...savedTx,
          categories: savedTx.categories || matchedOptimistic?.categories || null,
        };
      });
      batchUpsertTransactionsAcrossCaches(qc, enrichedList);
    },
    onError: (_err, _newTxs, context) => {
      if (context?.optimisticItems) {
        batchUpsertTransactionsAcrossCaches(qc, context.optimisticItems);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["wallets"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      flushPendingMutations().catch(() => {});
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: async ({ id, ...input }: TransactionInput & { id: string }) => {
      let cleanCatId = input.category_id !== undefined ? (input.category_id && isUUID(input.category_id) ? input.category_id : null) : undefined;
      if (input.type === "transfer") {
        cleanCatId = null;
      }
      const cleanWalletId = input.wallet_id !== undefined ? (input.wallet_id && isUUID(input.wallet_id) ? input.wallet_id : null) : undefined;
      let cleanToWalletId = input.to_wallet_id !== undefined ? (input.to_wallet_id && isUUID(input.to_wallet_id) ? input.to_wallet_id : null) : undefined;
      if (input.type && input.type !== "transfer") {
        cleanToWalletId = null;
      }

      const cleanUpdate: any = {};
      if (input.type) cleanUpdate.type = input.type;
      if (input.amount !== undefined) cleanUpdate.amount = Number(input.amount);
      if (input.occurred_on) cleanUpdate.occurred_on = input.occurred_on;
      if (input.created_at) cleanUpdate.created_at = input.created_at;
      if (input.note !== undefined) cleanUpdate.note = input.note ?? null;
      if (cleanCatId !== undefined) cleanUpdate.category_id = cleanCatId;
      if (cleanWalletId !== undefined) cleanUpdate.wallet_id = cleanWalletId;
      if (cleanToWalletId !== undefined) cleanUpdate.to_wallet_id = cleanToWalletId;
      if (input.ledger_id !== undefined) {
        cleanUpdate.ledger_id = input.ledger_id ?? "personal";
      } else if (input.space_id !== undefined) {
        cleanUpdate.ledger_id = input.space_id ?? "personal";
      }

      // DO NOT include id or user_id or space_id in cleanUpdate payload sent to supabase.update()!
      const mutation = enqueuePendingMutation("update", { id, ...cleanUpdate, space_id: cleanUpdate.ledger_id });

      try {
        let query = supabase
          .from("transactions")
          .update(cleanUpdate)
          .eq("id", id)
          .select("*, categories(*)");

        let res = await withTimeout(query, 7000);
        if (res.error) {
          // Graceful fallback: retry without ledger_id if column doesn't exist yet
          const {
            ledger_id: _ledger_id,
            ...fallbackPayload
          } = cleanUpdate;
          res = await withTimeout(
            supabase
              .from("transactions")
              .update(fallbackPayload)
              .eq("id", id)
              .select("*"),
            7000,
          );
        }

        if (!res.error && res.data && res.data[0]) {
          removePendingMutation(mutation.id);
          return res.data[0] as Transaction;
        }
      } catch (err) {
        console.warn("[useUpdateTransaction] Update queued locally:", err);
      }

      return { id, ...cleanUpdate } as Transaction;
    },
    onMutate: async ({ id, ...updated }) => {
      await qc.cancelQueries({ queryKey: ["transactions"] });
      const snapshots = snapshotTransactionQueries(qc);
      const existing = snapshots
        .flatMap(([, data]) => data ?? [])
        .find((item) => item.id === id);

      const allCategories = qc.getQueryData<Category[]>(categoryKeys.all(userId));
      const nextCatId =
        updated.type === "transfer" ? null : (updated.category_id !== undefined ? updated.category_id : existing?.category_id);
      const categoryObj =
        updated.type === "transfer" ? null : (allCategories?.find((c) => c.id === nextCatId) || existing?.categories || null);

      if (existing) {
        const assignedLedger =
          updated.ledger_id || updated.space_id || existing.ledger_id || existing.space_id || "personal";
        const effectiveType = updated.type || existing.type;
        upsertTransactionAcrossCaches(qc, {
          ...existing,
          ...updated,
          id,
          category_id: effectiveType === "transfer" ? null : (updated.category_id !== undefined ? updated.category_id : existing.category_id),
          to_wallet_id: effectiveType === "transfer" ? (updated.to_wallet_id !== undefined ? updated.to_wallet_id : existing.to_wallet_id) : null,
          ledger_id: assignedLedger,
          space_id: assignedLedger,
          categories: categoryObj,
        } as Transaction);
      }

      return { snapshots, existingCategory: categoryObj };
    },
    onSuccess: (updatedTx, _vars, context) => {
      const enriched: Transaction = {
        ...updatedTx,
        categories: updatedTx.categories || context?.existingCategory || null,
      };
      upsertTransactionAcrossCaches(qc, enriched);
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshots) {
        restoreTransactionQueries(qc, context.snapshots);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["wallets"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      flushPendingMutations().catch(() => {});
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const mutation = enqueuePendingMutation("delete", { id });
      try {
        const q = supabase.from("transactions").delete().eq("id", id);
        const { error } = await q;
        if (!error) {
          removePendingMutation(mutation.id);
        }
      } catch (err) {
        console.warn("[useDeleteTransaction] Delete queued locally:", err);
      }
      return id;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["transactions"] });
      const snapshots = snapshotTransactionQueries(qc);
      const targetTx = findTransactionInCache(qc, id);
      if (targetTx) {
        checkAndDeductGoalFromTx(targetTx);
      }
      removeTransactionFromCaches(qc, id);
      return { snapshots, targetTx };
    },
    onSuccess: (deletedId) => {
      removeTransactionFromCaches(qc, deletedId);
    },
    onError: (_err, _id, context) => {
      if (context?.snapshots) {
        restoreTransactionQueries(qc, context.snapshots);
      }
      if (context?.targetTx?.note) {
        const match = context.targetTx.note.match(/#goal_([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          addGoalToStorage(match[1], Number(context.targetTx.amount || 0));
        }
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["wallets"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      flushPendingMutations().catch(() => {});
    },
  });
}

export function useBatchDeleteTransactions() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids || ids.length === 0) return ids;
      const mutationIds = ids.map((id) => {
        const m = enqueuePendingMutation("delete", { id });
        return { id, mutationId: m.id };
      });

      try {
        let q = supabase.from("transactions").delete().in("id", ids);
        if (userId && userId !== "guest_local_user") {
          q = q.eq("user_id", userId);
        }
        const { error } = await q;
        if (error) throw error;
        mutationIds.forEach(({ mutationId }) => removePendingMutation(mutationId));
      } catch (err) {
        console.warn("[useBatchDeleteTransactions] Error batch deleting, preserved in pending mutations:", err);
      }
      return ids;
    },
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: ["transactions"] });
      const snapshots = snapshotTransactionQueries(qc);
      const targetTxs: Transaction[] = [];
      ids.forEach((id) => {
        const targetTx = findTransactionInCache(qc, id);
        if (targetTx) {
          targetTxs.push(targetTx);
          checkAndDeductGoalFromTx(targetTx);
        }
      });
      batchRemoveTransactionsFromCaches(qc, ids);
      return { snapshots, targetTxs };
    },
    onSuccess: (deletedIds) => {
      batchRemoveTransactionsFromCaches(qc, deletedIds);
    },
    onError: (_err, _ids, context) => {
      if (context?.snapshots) {
        restoreTransactionQueries(qc, context.snapshots);
      }
      if (context?.targetTxs) {
        context.targetTxs.forEach((tx) => {
          if (tx.note) {
            const match = tx.note.match(/#goal_([a-zA-Z0-9_-]+)/);
            if (match && match[1]) {
              addGoalToStorage(match[1], Number(tx.amount || 0));
            }
          }
        });
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["all_transactions"] });
      qc.invalidateQueries({ queryKey: ["wallets"] });
      flushPendingMutations().catch(() => {});
    },
  });
}

export function useSixMonthTrend() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ["transactions", "trend", userId],
    enabled: !!userId,
    queryFn: async () => {
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        months.push({
          year: y,
          month: m,
          start: format(new Date(y, m - 1, 1), "yyyy-MM-dd"),
          end: format(new Date(y, m, 0), "yyyy-MM-dd"),
          label: format(new Date(y, m - 1, 1), "MMM"),
        });
      }
      return Promise.all(
        months.map(async (m) => {
          let query = supabase
            .from("transactions")
            .select("type,amount,note")
            .gte("occurred_on", m.start)
            .lte("occurred_on", `${m.end}T23:59:59.999Z`);

          if (userId && userId !== "guest_local_user") {
            query = query.eq("user_id", userId);
          }

          const { data } = await query;
          const validData = data?.filter(
            (t: any) => !isCorrectionTx(t) && !isOpeningBalanceTx(t),
          );
          const income =
            validData
              ?.filter((t) => t.type === "income")
              .reduce((s, t) => s + Number(t.amount), 0) ?? 0;
          const expense =
            validData
              ?.filter((t) => t.type === "expense")
              .reduce((s, t) => s + Number(t.amount), 0) ?? 0;
          return { ...m, income, expense };
        }),
      );
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCategoryStats(
  year: number,
  month: number,
  type: "income" | "expense" = "expense",
) {
  const { data, isLoading } = useMonthTransactions(year, month);
  if (!data) return { data: [], isLoading };
  const filteredData = data.filter((t) => t.type === type);
  const grouped: Record<
    string,
    {
      category_id: string;
      name: string;
      emoji: string;
      total: number;
      count: number;
    }
  > = {};
  filteredData.forEach((t) => {
    const key = t.category_id ?? "other";
    const cat = t.categories;
    if (!grouped[key]) {
      grouped[key] = {
        category_id: key,
        name: cat?.name ?? "Lainnya",
        emoji: cat?.emoji ?? "??",
        total: 0,
        count: 0,
      };
    }
    grouped[key].total += Number(t.amount);
    grouped[key].count += 1;
  });
  return {
    data: Object.values(grouped).sort((a, b) => b.total - a.total),
    isLoading,
  };
}

export function useSevenDayTrend() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ["transactions", "7day", userId],
    enabled: !!userId,
    queryFn: async () => {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = format(d, "yyyy-MM-dd");
        const label = format(d, "EEE");
        days.push({ dateStr, label });
      }
      const start = days[0].dateStr;
      const end = days[days.length - 1].dateStr;
      let query = supabase
        .from("transactions")
        .select("type,amount,occurred_on,note")
        .gte("occurred_on", start)
        .lte("occurred_on", `${end}T23:59:59.999Z`);

      if (userId && userId !== "guest_local_user") {
        query = query.eq("user_id", userId);
      }

      const { data } = await query;
      return days.map(({ dateStr, label }) => {
        const dayTxs =
          data?.filter(
            (t: any) =>
              (t.occurred_on || "").slice(0, 10) === dateStr &&
              !isCorrectionTx(t) &&
              !isOpeningBalanceTx(t),
          ) ?? [];
        const expense = dayTxs
          .filter((t) => t.type === "expense")
          .reduce((s, t) => s + Number(t.amount), 0);
        const income = dayTxs
          .filter((t) => t.type === "income")
          .reduce((s, t) => s + Number(t.amount), 0);
        return { dateStr, label, expense, income };
      });
    },
    staleTime: 5 * 60 * 1000,
  });
}
