import { supabase } from "./supabase";
import type { Transaction } from "./types";

export interface PendingMutation {
  id: string;
  type: "insert" | "update" | "delete";
  entity: "transaction";
  payload: any;
  timestamp: string;
  retryCount: number;
  lastAttemptAt?: string;
  lastError?: string;
}

const PENDING_STORAGE_KEY = "TROUVAILLE_PENDING_MUTATIONS_V2";
const DEAD_STORAGE_KEY = "TROUVAILLE_DEAD_MUTATIONS_V1";

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

export function getDeadMutations(): PendingMutation[] {
  try {
    const raw = localStorage.getItem(DEAD_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearDeadMutations(): void {
  try {
    localStorage.removeItem(DEAD_STORAGE_KEY);
  } catch (err) {
    console.error("[syncEngine] Failed to clear dead mutations:", err);
  }
}

export function quarantineMutation(mutation: PendingMutation, error: unknown): void {
  try {
    const dead = getDeadMutations();
    dead.push({
      ...mutation,
      lastError: String((error as any)?.message || (error as any)?.details || error || "Permanent validation error"),
      lastAttemptAt: new Date().toISOString(),
    });
    const trimmed = dead.slice(-50);
    localStorage.setItem(DEAD_STORAGE_KEY, JSON.stringify(trimmed));
    console.error(
      `[syncEngine] Quarantined invalid mutation ${mutation.id} after repeated non-network errors.`,
      mutation,
      error,
    );
  } catch (err) {
    console.error("[syncEngine] Failed to quarantine mutation:", err);
  }
}

/**
 * Accurately detects whether an error is transient / connectivity-related
 * so that offline user mutations are NEVER dropped on poor network.
 */
export function isNetworkOrTransientError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }
  if (!err) return false;

  const errorObj = err as any;
  const message = (
    errorObj?.message ||
    errorObj?.error_description ||
    errorObj?.details ||
    (typeof err === "string" ? err : "")
  ).toLowerCase();

  const name = (errorObj?.name || "").toLowerCase();
  const code = String(errorObj?.code || "");
  const status =
    errorObj?.status !== undefined && errorObj?.status !== null
      ? Number(errorObj.status)
      : undefined;

  // Browser & Fetch network errors
  if (
    name.includes("abort") ||
    name.includes("timeout") ||
    name.includes("network")
  ) {
    return true;
  }

  if (
    message.includes("fetch") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("offline") ||
    message.includes("connection") ||
    message.includes("load failed") ||
    message.includes("failed to fetch") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("enotfound")
  ) {
    return true;
  }

  // HTTP status codes representing transient issues (0 = dropped/CORS/abort, 408 = Timeout, 429 = Rate Limit, 5xx = Server Error)
  if (
    status !== undefined &&
    (status === 0 || status === 408 || status === 429 || (status >= 500 && status <= 599))
  ) {
    return true;
  }

  // PostgreSQL transient error codes (Class 08: Connection Exception, Class 53: Resources, Class 57: Operator Intervention)
  if (
    code.startsWith("08") ||
    code.startsWith("53") ||
    code.startsWith("57") ||
    code.startsWith("PGRST0")
  ) {
    return true;
  }

  return false;
}

/**
 * Calculates exponential backoff in milliseconds: 1s, 2s, 4s, 8s, 16s, up to max 30s.
 */
export function getMutationBackoffMs(retryCount: number): number {
  if (retryCount <= 0) return 0;
  const backoff = 1000 * Math.pow(2, Math.min(retryCount - 1, 5));
  return Math.min(backoff, 30000);
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
    } else if (type === "insert") {
      nextMutations = mutations.filter(
        (m) => !(m.payload?.id === txId && m.type === "delete"),
      );
      nextMutations.push(newMutation);
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
 * Preserves mutations in local storage indefinitely until explicit server ACK.
 * Differentiates between network/transient failures (never dropped) and permanent errors (quarantined).
 */
export async function flushPendingMutations(options?: {
  force?: boolean;
}): Promise<{
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

  // Offline pre-check: if completely offline, never make futile network calls
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      flushedCount: 0,
      remainingCount: getPendingMutations().length,
      errors: ["Device is currently offline"],
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
    const successfullyFlushedIds = new Set<string>();
    const updatedFailedMutations = new Map<string, PendingMutation>();
    const quarantinedIds = new Set<string>();

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
      if (clean.amount !== undefined) clean.amount = Number(clean.amount) || 0;
      if (clean.note === undefined) clean.note = null;
      return clean;
    };

    for (const mutation of mutations) {
      // Respect exponential backoff unless forced (e.g. manual sync or network reconnect)
      if (!options?.force && mutation.lastAttemptAt && mutation.retryCount > 0) {
        const lastAttemptMs = new Date(mutation.lastAttemptAt).getTime();
        const backoffMs = getMutationBackoffMs(mutation.retryCount);
        if (Date.now() - lastAttemptMs < backoffMs) {
          continue;
        }
      }

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
          successfullyFlushedIds.add(mutation.id);
        } else if (mutation.type === "update") {
          const { id, user_id: _uid, ...updates } = mutation.payload;
          if (!id) {
            successfullyFlushedIds.add(mutation.id);
            continue;
          }
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
          successfullyFlushedIds.add(mutation.id);
        } else if (mutation.type === "delete") {
          const id = mutation.payload?.id || mutation.payload;
          if (!id) {
            successfullyFlushedIds.add(mutation.id);
            continue;
          }
          const { error } = await supabase
            .from("transactions")
            .delete()
            .eq("id", id);
          if (error) throw error;
          flushedCount++;
          successfullyFlushedIds.add(mutation.id);
        }
      } catch (err: any) {
        const isNetwork = isNetworkOrTransientError(err);
        const errMsg = String(err?.message || err?.details || err || "Network error");
        console.warn(
          `[syncEngine] Failed to flush mutation ${mutation.id} (attempt ${mutation.retryCount + 1}, isNetwork=${isNetwork}):`,
          err,
        );
        errors.push(err);

        mutation.retryCount += 1;
        mutation.lastAttemptAt = new Date().toISOString();
        mutation.lastError = errMsg;

        if (isNetwork) {
          // NETWORK / TRANSIENT ERROR: NEVER DROP MUTATION!
          updatedFailedMutations.set(mutation.id, mutation);
          // Stop processing subsequent mutations to conserve battery and preserve FIFO order
          break;
        } else {
          // Permanent schema or client validation error
          if (mutation.retryCount >= 5) {
            quarantineMutation(mutation, err);
            quarantinedIds.add(mutation.id);
          } else {
            updatedFailedMutations.set(mutation.id, mutation);
          }
        }
      }
    }

    // CONCURRENCY-SAFE MERGE:
    // Read fresh mutations so mutations enqueued while flush was awaiting Supabase are NEVER overwritten
    const freshMutations = getPendingMutations();
    const nextMutations: PendingMutation[] = [];

    for (const m of freshMutations) {
      if (successfullyFlushedIds.has(m.id) || quarantinedIds.has(m.id)) {
        continue;
      }
      if (updatedFailedMutations.has(m.id)) {
        const failed = updatedFailedMutations.get(m.id)!;
        nextMutations.push({
          ...m, // preserve any updated payload from concurrent edits
          retryCount: failed.retryCount,
          lastAttemptAt: failed.lastAttemptAt,
          lastError: failed.lastError,
        });
      } else {
        nextMutations.push(m);
      }
    }

    savePendingMutations(nextMutations);

    return {
      flushedCount,
      remainingCount: nextMutations.length,
      errors,
    };
  } finally {
    isFlushing = false;
  }
}
