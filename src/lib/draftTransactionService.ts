// ======================================================================
// TROUVAILLE DRAFT TRANSACTIONS SERVICE
// Client-side persistent draft storage (localStorage)
// Keeps unreviewed transactions safely queued without affecting balances.
// ======================================================================

import { useState, useEffect } from "react";
import type { ParsedStatementItem } from "./statementParser";

const STORAGE_KEY = "trouvaille_draft_transactions";

export interface DraftBatch {
  id: string;
  appName: string;
  source: "back_tap" | "clipboard" | "manual";
  createdAt: string; // ISO 8601
  items: ParsedStatementItem[];
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
 * Loads pending draft batches from localStorage until the user resolves them.
 */
let captureDraftOwner: string | null = null;
function readAllDraftBatches(): DraftBatch[] {
  const raw=localStorage.getItem(STORAGE_KEY);
  const batches:DraftBatch[]=raw===null?[]:JSON.parse(raw);
  if(!Array.isArray(batches)||batches.some(batch=>!batch||!Array.isArray(batch.items))) throw new Error("Invalid draft storage");
  return batches;
}
function visibleDraftBatches(batches:DraftBatch[]):DraftBatch[]{
 return batches.map(batch=>({...batch,items:batch.items.filter(item=>!item.captureOwnerId || item.captureOwnerId===captureDraftOwner)})).filter(batch=>batch.items.length>0);
}
export function getDraftBatches(): DraftBatch[] {
 if(typeof window==='undefined') return [];
 try{return visibleDraftBatches(readAllDraftBatches());}catch(error){console.error('[DraftService]',error);return [];}
}
/**
 * Returns a flat array of all pending draft items across all batches.
 */
export function getAllDraftItems(): ParsedStatementItem[] {
  const batches = getDraftBatches();
  return batches.flatMap((b) => b.items);
}

/**
 * Returns total number of pending draft items.
 */
export function getDraftCount(): number {
  return getAllDraftItems().length;
}

/**
 * Saves a new batch of items to drafts.
 * Returns the created batch ID.
 */
export function saveDraftBatch(
  items: ParsedStatementItem[],
  appName: string = "Transaksi",
  source: "back_tap" | "clipboard" | "manual" = "back_tap"
): string {
  if (!items || items.length === 0) return "";
  try {
    const existing = readAllDraftBatches();
    const batchId = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const newBatch: DraftBatch = {
      id: batchId,
      appName,
      source,
      createdAt: new Date().toISOString(),
      items,
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
    const existing = readAllDraftBatches();
    const updated = existing.map(batch=>batch.id!==batchId?batch:{...batch,items:batch.items.filter(item=>item.captureOwnerId && item.captureOwnerId!==captureDraftOwner)}).filter(batch=>batch.items.length>0);
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
  try {
    const existing = readAllDraftBatches();
    const updated = existing
      .map((b) => ({
        ...b,
        items: b.items.filter((it) => it.id !== itemId || (!!it.captureOwnerId && it.captureOwnerId!==captureDraftOwner)),
      }))
      .filter((b) => b.items.length > 0);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    notifyDraftsUpdated();
  } catch (err) {
    console.error("[DraftService] Failed to remove draft item:", err);
  }
}

/**
 * Clears all draft batches.
 */
export function clearAllDrafts(): void {
  try {
    const retained = readAllDraftBatches().map(batch => ({...batch, items: batch.items.filter(item => item.captureOwnerId && item.captureOwnerId !== captureDraftOwner)})).filter(batch => batch.items.length);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(retained));
    notifyDraftsUpdated();
  } catch (err) {
    console.error("[DraftService] Failed to clear drafts:", err);
  }
}

/**
 * React hook to reactively subscribe to draft updates in any component.
 */
export function useDraftTransactions() {
  const [batches, setBatches] = useState<DraftBatch[]>(() => getDraftBatches());

  useEffect(() => {
    const handleUpdate = () => {
      setBatches(getDraftBatches());
    };

    window.addEventListener("trouvaille:drafts-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("trouvaille:drafts-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const visible = visibleDraftBatches(batches);
  const totalItems = visible.flatMap((b) => b.items);

  return {
    batches: visible,
    items: totalItems,
    count: totalItems.length,
    saveBatch: saveDraftBatch,
    deleteBatch: deleteDraftBatch,
    removeItem: removeDraftItem,
    clearAll: clearAllDrafts,
    refresh: () => setBatches(getDraftBatches()),
  };
}
export function setCaptureDraftOwner(owner:string|null):void {captureDraftOwner=owner;}
export function adoptCaptureDrafts(from:string,to:string):void {
 if(!from.startsWith("guest:") || !to) throw new Error("Explicit guest adoption required");
 const batches=readAllDraftBatches().map(batch=>({...batch,items:batch.items.map(item=>item.captureOwnerId===from?{...item,captureOwnerId:to}:item)}));
 localStorage.setItem(STORAGE_KEY,JSON.stringify(batches));notifyDraftsUpdated();
}
export function discardCaptureDrafts(owner:string):void {
 const batches=readAllDraftBatches().map(batch=>({...batch,items:batch.items.filter(item=>item.captureOwnerId!==owner)})).filter(batch=>batch.items.length>0);
 localStorage.setItem(STORAGE_KEY,JSON.stringify(batches));notifyDraftsUpdated();
}
