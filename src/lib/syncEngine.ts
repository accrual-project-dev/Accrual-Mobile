import { supabase } from "./supabase";
import type { Transaction } from "./types";

export interface PendingMutation {
  id: string;
  type: "insert" | "update" | "delete";
  entity: "transaction";
  payload: any;
  timestamp: string;
  retryCount: number;
}

const PENDING_STORAGE_KEY = "TROUVAILLE_PENDING_MUTATIONS_V2";

export function getPendingMutations(): PendingMutation[] {
  try {
    const raw = localStorage.getItem(PENDING_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("[syncEngine] Failed to read pending mutations:", err);
    return [];
  }
}

export function savePendingMutations(mutations: PendingMutation[]): void {
  try {
    localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(mutations));
  } catch (err) {
    console.error("[syncEngine] Failed to persist pending mutations:", err);
  }
}

export function enqueuePendingMutation(
  type: "insert" | "update" | "delete",
  payload: any,
): PendingMutation {
  const mutations = getPendingMutations();
  const newMutation: PendingMutation = {
    id: `mut-${Date.now()}-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 8)}`,
    type,
    entity: "transaction",
    payload,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  };

  const txId = payload.id;
  let nextMutations = mutations;

  if (txId) {
    if (type === "delete") {
      nextMutations = mutations.filter((m) => m.payload?.id !== txId);
      nextMutations.push(newMutation);
    } else if (type === "update") {
      const existingIdx = mutations.findIndex((m) => m.payload?.id === txId);
      if (existingIdx >= 0) {
        nextMutations[existingIdx] = {
          ...nextMutations[existingIdx],
          payload: { ...nextMutations[existingIdx].payload, ...payload },
          timestamp: new Date().toISOString(),
        };
        savePendingMutations(nextMutations);
        return nextMutations[existingIdx];
      } else {
        nextMutations.push(newMutation);
      }
    } else {
      nextMutations.push(newMutation);
    }
  } else {
    nextMutations.push(newMutation);
  }

  savePendingMutations(nextMutations);
  return newMutation;
}

export function removePendingMutation(id: string): void {
  const mutations = getPendingMutations();
  const filtered = mutations.filter((m) => m.id !== id);
  savePendingMutations(filtered);
}

export function clearPendingMutations(): void {
  try {
    localStorage.removeItem(PENDING_STORAGE_KEY);
  } catch (err) {
    console.error("[syncEngine] Failed to clear pending mutations:", err);
  }
}

export function getPendingTransactions(): Transaction[] {
  const mutations = getPendingMutations();
  const txs: Transaction[] = [];

  for (const m of mutations) {
    if (m.type === "insert" || m.type === "update") {
      if (m.payload && m.payload.id) {
        txs.push(m.payload as Transaction);
      }
    }
  }
  return txs;
}

let isFlushing = false;

/**
 * Executes all pending local mutations against Supabase with resilient retry.
 * Preserves mutations in local storage if network is unreachable.
 */
export async function flushPendingMutations(): Promise<{
  flushedCount: number;
  remainingCount: number;
  errors: unknown[];
}> {
  if (isFlushing) {
    return {
      flushedCount: 0,
      remainingCount: getPendingMutations().length,
      errors: [],
    };
  }

  isFlushing = true;
  try {
    const mutations = getPendingMutations();
    if (mutations.length === 0) {
      return { flushedCount: 0, remainingCount: 0, errors: [] };
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      return {
        flushedCount: 0,
        remainingCount: mutations.length,
        errors: ["Not authenticated"],
      };
    }

    let flushedCount = 0;
    const errors: unknown[] = [];
    const remainingMutations: PendingMutation[] = [];

    const isUUID = (val?: string | null) =>
      Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

    const sanitizePayload = (p: any) => {
      if (!p || typeof p !== "object") return p;
      const { categories, wallet, to_wallet, space_id, created_by_name, created_by_user_id, ...clean } = p;
      if (clean.type === "transfer") {
        clean.category_id = null;
      } else if (clean.category_id && !isUUID(clean.category_id)) {
        clean.category_id = null;
      }
      if (clean.wallet_id && !isUUID(clean.wallet_id)) clean.wallet_id = null;
      if (clean.to_wallet_id && !isUUID(clean.to_wallet_id)) clean.to_wallet_id = null;
      return clean;
    };

    for (const mutation of mutations) {
      try {
        if (mutation.type === "insert") {
          const item = sanitizePayload({ ...mutation.payload, user_id: user.id });
          let { error } = await supabase.from("transactions").upsert(item);
          if (error && item.ledger_id) {
            const { ledger_id: _lid, ...fallbackItem } = item;
            const retryRes = await supabase.from("transactions").upsert(fallbackItem);
            error = retryRes.error;
          }
          if (error) throw error;
          flushedCount++;
        } else if (mutation.type === "update") {
          const { id, user_id: _uid, ...updates } = mutation.payload;
          if (!id) continue;
          const cleanUpdates = sanitizePayload(updates);
          delete cleanUpdates.id;
          delete cleanUpdates.user_id;
          let { error } = await supabase
            .from("transactions")
            .update(cleanUpdates)
            .eq("id", id);
          if (error && cleanUpdates.ledger_id) {
            delete cleanUpdates.ledger_id;
            const retryRes = await supabase
              .from("transactions")
              .update(cleanUpdates)
              .eq("id", id);
            error = retryRes.error;
          }
          if (error) throw error;
          flushedCount++;
        } else if (mutation.type === "delete") {
          const id = mutation.payload?.id || mutation.payload;
          if (!id) continue;
          const { error } = await supabase
            .from("transactions")
            .delete()
            .eq("id", id);
          if (error) throw error;
          flushedCount++;
        }
      } catch (err: any) {
        console.warn(
          `[syncEngine] Failed to flush mutation ${mutation.id} (attempt ${mutation.retryCount + 1}):`,
          err,
        );
        errors.push(err);
        mutation.retryCount += 1;
        if (mutation.retryCount <= 5) {
          remainingMutations.push(mutation);
        } else {
          console.error(
            `[syncEngine] Dropping corrupt mutation ${mutation.id} after 5 failed retries.`,
            mutation,
          );
        }
      }
    }

    savePendingMutations(remainingMutations);

    return {
      flushedCount,
      remainingCount: remainingMutations.length,
      errors,
    };
  } finally {
    isFlushing = false;
  }
}
