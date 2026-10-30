// ======================================================================
// ACCRUAL DRAFT TRANSACTIONS SERVICE
// Client-side persistent draft storage (localStorage) with Active Space scoping.
// Keeps unreviewed Shortcut & automated transactions safely queued in the
// active Space without prematurely mutating wallet balances.
// ======================================================================

import { useState, useEffect, useMemo } from "react";
import type { ParsedStatementItem } from "./statementParser";

const STORAGE_KEY = "trouvaille_draft_transactions";
const ACTIVE_SPACE_STORAGE_KEY = "trouvaille_active_space_id";
const DEFAULT_SPACE_STORAGE_KEY = "trouvaille_default_ledger_id";
const EXPIRATION_DAYS = 7;

export type DraftSourceType =
  | "back_tap"
  | "screen_scan"
  | "notification"
  | "glass_dialog"
  | "wallet_tap"
  | "smart_text"
  | "clipboard"
  | "manual";

export interface DraftBatch {
  id: string;
  appName: string;
  source: DraftSourceType;
  spaceId: string;
  createdAt: string; // ISO 8601
  items: ParsedStatementItem[];
}

/**
 * Resolves the currently active Space ID from localStorage (falling back to default space or "personal").
 * If the user is currently viewing "all" (Consolidated View), defaults to their defaultSpaceId or "personal".
 */
export function resolveActiveDraftSpaceId(explicitSpaceId?: string | null): string {
  if (explicitSpaceId && explicitSpaceId !== "all") {
    return explicitSpaceId;
  }
  if (typeof window === "undefined") return "personal";
  try {
    const active = localStorage.getItem(ACTIVE_SPACE_STORAGE_KEY);
    if (active && active !== "all") return active;
    const def = localStorage.getItem(DEFAULT_SPACE_STORAGE_KEY);
    if (def && def !== "all") return def;
  } catch {}
  return "personal";
}

/**
 * Dispatches a window-wide event so any active component (e.g. HomePage Draft Banner)
 * immediately synchronizes its draft badge/count without reloading.
 */
function notifyDraftsUpdated() {
  if (typeof window === "undefined") return;
  const count = getDraftCount();
  window.dispatchEvent(new CustomEvent("trouvaille:drafts-updated", { detail: { count } }));
}

/**
 * Loads all draft batches from localStorage, automatically purging expired ones (> 7 days).
 */
export function getDraftBatches(spaceId?: string | null): DraftBatch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: DraftBatch[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const now = Date.now();
    const maxAgeMs = EXPIRATION_DAYS * 24 * 60 * 60 * 1000;

    // Filter out batches older than EXPIRATION_DAYS
    const valid = parsed
      .filter((b) => {
        const createdTime = new Date(b.createdAt).getTime();
        return !isNaN(createdTime) && now - createdTime < maxAgeMs && b.items && b.items.length > 0;
      })
      .map((b) => ({
        ...b,
        spaceId: b.spaceId || "personal",
      }));

    if (valid.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
    }

    if (spaceId && spaceId !== "all") {
      return valid.filter((b) => (b.spaceId || "personal") === spaceId);
    }

    return valid;
  } catch (err) {
    console.warn("[DraftService] Failed to read drafts from storage:", err);
    return [];
  }
}

/**
 * Returns a flat array of all pending draft items across batches (optionally filtered by spaceId).
 */
export function getAllDraftItems(spaceId?: string | null): ParsedStatementItem[] {
  const batches = getDraftBatches(spaceId);
  return batches.flatMap((b) =>
    b.items.map((it) => ({
      ...it,
      spaceId: it.spaceId || b.spaceId || "personal",
    }))
  );
}

/**
 * Returns total number of pending draft items (optionally filtered by spaceId).
 */
export function getDraftCount(spaceId?: string | null): number {
  return getAllDraftItems(spaceId).length;
}

/**
 * Saves a new batch of items to drafts, bound directly to the Active Space.
 * Deduplicates by item ID so re-saving from BatchTransactionReviewSheet never duplicates existing drafts.
 * Returns the created batch ID.
 */
export function saveDraftBatch(
  items: ParsedStatementItem[],
  appName: string = "Transaksi Pintasan",
  source: DraftSourceType = "back_tap",
  explicitSpaceId?: string | null,
): string {
  if (!items || items.length === 0) return "";
  try {
    const targetSpaceId = resolveActiveDraftSpaceId(explicitSpaceId);
    const incomingIds = new Set(items.map((it) => it.id));

    // Remove any existing items with identical IDs before inserting updated items
    const existing = getDraftBatches()
      .map((b) => ({
        ...b,
        items: b.items.filter((it) => !incomingIds.has(it.id)),
      }))
      .filter((b) => b.items.length > 0);

    const batchId = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const normalizedItems: ParsedStatementItem[] = items.map((item) => ({
      ...item,
      spaceId: item.spaceId && item.spaceId !== "all" ? item.spaceId : targetSpaceId,
    }));

    const newBatch: DraftBatch = {
      id: batchId,
      appName,
      source,
      spaceId: targetSpaceId,
      createdAt: new Date().toISOString(),
      items: normalizedItems,
    };

    const updated = [newBatch, ...existing];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    notifyDraftsUpdated();
    return batchId;
  } catch (err) {
    console.error("[DraftService] Failed to save draft batch:", err);
    return "";
  }
}

/**
 * Removes a specific batch by its ID.
 */
export function deleteDraftBatch(batchId: string): void {
  try {
    const existing = getDraftBatches();
    const updated = existing.filter((b) => b.id !== batchId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    notifyDraftsUpdated();
  } catch (err) {
    console.error("[DraftService] Failed to delete draft batch:", err);
  }
}

/**
 * Removes a single draft item by its ID across all batches.
 */
export function removeDraftItem(itemId: string): void {
  removeDraftItems([itemId]);
}

/**
 * Atomically removes multiple draft items by their IDs across all batches.
 * Called immediately when user approves selected items in BatchTransactionReviewSheet.
 */
export function removeDraftItems(itemIds: string[]): void {
  if (!itemIds || itemIds.length === 0) return;
  try {
    const idSet = new Set(itemIds);
    const existing = getDraftBatches();
    const updated = existing
      .map((b) => ({
        ...b,
        items: b.items.filter((it) => !idSet.has(it.id)),
      }))
      .filter((b) => b.items.length > 0);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    notifyDraftsUpdated();
  } catch (err) {
    console.error("[DraftService] Failed to remove draft items:", err);
  }
}

/**
 * Clears draft batches (all batches, or only batches for a specific spaceId).
 */
export function clearAllDrafts(spaceId?: string | null): void {
  try {
    if (spaceId && spaceId !== "all") {
      const existing = getDraftBatches();
      const remaining = existing.filter((b) => (b.spaceId || "personal") !== spaceId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    notifyDraftsUpdated();
  } catch (err) {
    console.error("[DraftService] Failed to clear drafts:", err);
  }
}

/**
 * React hook to reactively subscribe to draft updates in any component,
 * automatically scoped to the provided activeSpaceId (or all spaces).
 */
export function useDraftTransactions(activeSpaceId?: string | null) {
  const [allBatches, setAllBatches] = useState<DraftBatch[]>(() => getDraftBatches());

  useEffect(() => {
    const handleUpdate = () => {
      setAllBatches(getDraftBatches());
    };

    window.addEventListener("trouvaille:drafts-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("trouvaille:drafts-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const scopedBatches = useMemo(() => {
    if (!activeSpaceId || activeSpaceId === "all") return allBatches;
    return allBatches.filter((b) => (b.spaceId || "personal") === activeSpaceId);
  }, [allBatches, activeSpaceId]);

  const totalItems = useMemo(() => {
    return scopedBatches.flatMap((b) =>
      b.items.map((it) => ({
        ...it,
        spaceId: it.spaceId || b.spaceId || "personal",
      }))
    );
  }, [scopedBatches]);

  return {
    batches: scopedBatches,
    items: totalItems,
    count: totalItems.length,
    saveBatch: saveDraftBatch,
    deleteBatch: deleteDraftBatch,
    removeItem: removeDraftItem,
    removeItems: removeDraftItems,
    clearAll: () => clearAllDrafts(activeSpaceId),
    refresh: () => setAllBatches(getDraftBatches()),
  };
}
