import type { InvestmentHolding, AssetType, HoldingActivity } from "./types";
import { supabase } from "./supabase";
import { Capacitor, CapacitorHttp } from "@capacitor/core";

export const HOLDINGS_STORAGE_KEY = "trouvaille_holdings_v1";
export const QUOTES_CACHE_KEY = "trouvaille_market_quotes_cache_v2";
const QUOTE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

export interface CachedQuote {
  price: number;
  timestamp: number;
}

export interface HoldingValuation {
  costBasis: number;
  marketValue: number;
  floatingPnL: number;
  floatingPnLPct: number;
  effectivePrice?: number;
}

export interface PortfolioSummary {
  totalCostBasis: number;
  totalMarketValue: number;
  totalFloatingPnL: number;
  totalFloatingPnLPct: number;
  totalRealizedPnL?: number;
  byAssetType: Record<AssetType, { costBasis: number; marketValue: number; floatingPnL: number }>;
}

/**
 * Standard USD/IDR exchange rate fallback if real-time exchange fetch is offline.
 */
export const USD_IDR_ESTIMATE = 16300;

// In-memory fallback cache for Node environments, SSR, and test runners
const memoryStorage: Record<string, string> = {};

function safeGetItem(key: string): string | null {
  try {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem(key);
    }
  } catch {}
  return memoryStorage[key] ?? null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, value);
    }
  } catch {}
  memoryStorage[key] = value;
}

function safeRemoveItem(key: string): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(key);
    }
  } catch {}
  delete memoryStorage[key];
}

export function getHoldingsStorageKey(userId?: string): string {
  const isGuest =
    userId === "guest_local_user" ||
    safeGetItem("trouvaille_guest_mode") === "true";
  if (isGuest) return "trouvaille_holdings_guest_v1";

  if (userId) {
    return `trouvaille_holdings_${userId}_v1`;
  }
  if (typeof localStorage !== "undefined") {
    // Inspect if there is an active Supabase user session token
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) {
        const raw = safeGetItem(k);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed?.user?.id) return `trouvaille_holdings_${parsed.user.id}_v1`;
          } catch {}
        }
      }
    }
  }
  return "trouvaille_holdings_guest_v1";
}

export function getUsdtStorageKey(userId?: string): string {
  const isGuest =
    userId === "guest_local_user" ||
    safeGetItem("trouvaille_guest_mode") === "true";
  if (isGuest) return "trouvaille_usdt_valuation_guest_v1";

  if (userId) {
    return `trouvaille_usdt_valuation_${userId}_v1`;
  }
  if (typeof localStorage !== "undefined") {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) {
        const raw = safeGetItem(k);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed?.user?.id) return `trouvaille_usdt_valuation_${parsed.user.id}_v1`;
          } catch {}
        }
      }
    }
  }
  return "trouvaille_usdt_valuation_guest_v1";
}

export interface UsdtValuationPref {
  units: number;
  rate: number;
  costBasis: number;
}

/**
 * Retrieve saved USDT valuation preferences scoped to user.
 * Strictly isolated per user / guest session without cross-session leakage.
 */
export function getSavedUsdtPref(userId?: string): UsdtValuationPref {
  try {
    const key = getUsdtStorageKey(userId);
    const saved = safeGetItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      const units = Number(parsed.units) || 0;
      if (units > 0) {
        const rate = Number(parsed.rate);
        return {
          units,
          rate: rate > 5000 && rate < 50000 ? rate : USD_IDR_ESTIMATE,
          costBasis: Number(parsed.costBasis) || 0,
        };
      }
    }
  } catch {}
  return {
    units: 0,
    rate: USD_IDR_ESTIMATE,
    costBasis: 0,
  };
}

/**
 * Persist USDT valuation preferences scoped to user, and asynchronously syncs to Supabase cloud.
 */
export function saveUsdtPref(pref: UsdtValuationPref, userId?: string): void {
  try {
    const key = getUsdtStorageKey(userId);
    safeSetItem(key, JSON.stringify(pref));
    safeRemoveItem("trouvaille_usdt_valuation_v2");
    safeRemoveItem("trouvaille_usdt_valuation_v1");

    // Asynchronously synchronize USDT to Supabase holdings table ONLY if user has positive units
    if (userId && userId !== "guest_local_user") {
      if (pref.units > 0) {
        syncHoldingToSupabase(
          {
            id: `usdt-${userId}`,
            symbol: "USDT",
            name: "Tether USD",
            asset_type: "crypto",
            units: pref.units,
            avg_buy_price: Math.round(pref.costBasis / pref.units),
            current_price: pref.rate,
            currency: "IDR",
            icon: "Coins",
            last_price_updated_at: new Date().toISOString(),
          },
          userId,
        ).catch(() => {});
      } else {
        // If units are 0 or cleared, clean up any phantom USDT holding in Supabase
        supabase
          .from("holdings")
          .delete()
          .eq("user_id", userId)
          .eq("symbol", "USDT")
          .then(
            () => {},
            () => {},
          );
      }
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("trouvaille_holdings_updated"));
    }
  } catch (e) {
    console.warn("Failed to persist USDT preference:", e);
  }
}

export function isValidUUID(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
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

export interface HoldingNotesMetadata {
  userNotes?: string;
  activities?: HoldingActivity[];
  reconciledTxIds?: string[];
  isCustomPrice?: boolean;
  customPrice?: number;
}

export function serializeHoldingNotes(
  userNotesOrMeta?: string | HoldingNotesMetadata,
  activities?: HoldingActivity[],
  reconciledTxIds?: string[],
  isCustomPrice?: boolean,
  customPrice?: number,
): string {
  if (typeof userNotesOrMeta === "object" && userNotesOrMeta !== null) {
    const meta: HoldingNotesMetadata = {};
    if (userNotesOrMeta.userNotes && userNotesOrMeta.userNotes.trim()) {
      meta.userNotes = userNotesOrMeta.userNotes.trim();
    }
    if (userNotesOrMeta.activities && userNotesOrMeta.activities.length > 0) {
      meta.activities = userNotesOrMeta.activities;
    }
    if (userNotesOrMeta.reconciledTxIds && userNotesOrMeta.reconciledTxIds.length > 0) {
      meta.reconciledTxIds = userNotesOrMeta.reconciledTxIds;
    }
    if (userNotesOrMeta.isCustomPrice) meta.isCustomPrice = true;
    if (userNotesOrMeta.customPrice && userNotesOrMeta.customPrice > 0) {
      meta.customPrice = userNotesOrMeta.customPrice;
    }
    if (!meta.activities && !meta.reconciledTxIds && !meta.isCustomPrice && !meta.customPrice) {
      return meta.userNotes || "";
    }
    return JSON.stringify(meta);
  }

  const userNotes = userNotesOrMeta;
  const meta: HoldingNotesMetadata = {};
  if (userNotes && typeof userNotes === "string" && userNotes.trim()) meta.userNotes = userNotes.trim();
  if (activities && activities.length > 0) meta.activities = activities;
  if (reconciledTxIds && reconciledTxIds.length > 0) meta.reconciledTxIds = reconciledTxIds;
  if (isCustomPrice) meta.isCustomPrice = true;
  if (customPrice && customPrice > 0) meta.customPrice = customPrice;

  if (!meta.activities && !meta.reconciledTxIds && !meta.isCustomPrice && !meta.customPrice) {
    return userNotes || "";
  }
  return JSON.stringify(meta);
}

export function parseHoldingNotes(rawNotes?: string | null): HoldingNotesMetadata {
  if (!rawNotes) return {};
  try {
    const trimmed = rawNotes.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null) {
        return parsed as HoldingNotesMetadata;
      }
    }
  } catch {}
  return { userNotes: rawNotes };
}

export function getReconciledTxStorageKey(userId?: string): string {
  if (userId && userId !== "guest_local_user") {
    return `trouvaille_reconciled_tx_ids_${userId}`;
  }
  return "trouvaille_reconciled_tx_ids_default";
}

export function getReconciledTxIds(userId?: string): Set<string> {
  try {
    const raw = safeGetItem(getReconciledTxStorageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch {}
  return new Set<string>();
}

export function markTxAsReconciled(txIds: string[], userId?: string): void {
  try {
    const existing = getReconciledTxIds(userId);
    for (const id of txIds) {
      if (id) existing.add(id);
    }
    safeSetItem(getReconciledTxStorageKey(userId), JSON.stringify(Array.from(existing)));
  } catch {}
}

const HOLDINGS_SYNC_QUEUE_PREFIX = "trouvaille_holdings_sync_queue_";

function getHoldingSyncQueue(userId: string): InvestmentHolding[] {
  try {
    const raw = localStorage.getItem(`${HOLDINGS_SYNC_QUEUE_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHoldingSyncQueue(queue: InvestmentHolding[], userId: string): void {
  try {
    if (queue.length === 0) {
      localStorage.removeItem(`${HOLDINGS_SYNC_QUEUE_PREFIX}${userId}`);
    } else {
      localStorage.setItem(`${HOLDINGS_SYNC_QUEUE_PREFIX}${userId}`, JSON.stringify(queue));
    }
  } catch {}
}

export function queueHoldingSync(holding: InvestmentHolding, userId: string): void {
  if (!userId || userId === "guest_local_user") return;
  const queue = getHoldingSyncQueue(userId);
  const idx = queue.findIndex(
    (h) => (h.id && h.id === holding.id) || (h.symbol && holding.symbol && h.symbol.toUpperCase() === holding.symbol.toUpperCase())
  );
  if (idx >= 0) {
    queue[idx] = holding;
  } else {
    queue.push(holding);
  }
  saveHoldingSyncQueue(queue, userId);
}

export async function flushPendingHoldingSyncs(userId: string): Promise<void> {
  if (!userId || userId === "guest_local_user") return;
  const queue = getHoldingSyncQueue(userId);
  if (queue.length === 0) return;
  const remaining: InvestmentHolding[] = [];
  for (const item of queue) {
    try {
      await syncHoldingToSupabase(item, userId, false);
    } catch {
      remaining.push(item);
    }
  }
  saveHoldingSyncQueue(remaining, userId);
}

/**
 * Asynchronously synchronizes a holding row with Supabase cloud table `public.holdings`.
 */
export async function syncHoldingToSupabase(
  holding: InvestmentHolding,
  userId: string,
  queueOnFail = true,
): Promise<void> {
  if (!userId || userId === "guest_local_user" || !isValidUUID(userId)) return;
  // Never persist a 0-unit USDT holding into cloud holdings
  if (
    holding.symbol?.toUpperCase() === "USDT" &&
    (!holding.units || Number(holding.units) <= 0)
  ) {
    return;
  }
  try {
    let holdingId = holding.id;

    // Ensure ID is a valid UUID for PostgreSQL UUID primary key
    const isFixed = holding.asset_type === "fixed_asset";
    if (!isValidUUID(holdingId)) {
      if (!isFixed && holding.symbol) {
        const { data: existingList } = await supabase
          .from("holdings")
          .select("id")
          .eq("user_id", userId)
          .eq("symbol", holding.symbol)
          .order("updated_at", { ascending: false })
          .limit(1);

        const existing = existingList?.[0];
        if (existing?.id && isValidUUID(existing.id)) {
          holdingId = existing.id;
        } else {
          holdingId = generateUUID();
        }
      } else {
        holdingId = generateUUID();
      }
      holding.id = holdingId;
    }

    const validWalletId = holding.wallet_id && isValidUUID(holding.wallet_id) ? holding.wallet_id : null;
    const isUsdt = holding.symbol?.toUpperCase() === "USDT";
    const existingMeta = parseHoldingNotes(holding.notes);
    const serializedNotes = serializeHoldingNotes(
      existingMeta.userNotes || (typeof holding.notes === "string" && !holding.notes.startsWith("{") ? holding.notes : undefined),
      holding.activities,
      isUsdt ? Array.from(getReconciledTxIds(userId)) : existingMeta.reconciledTxIds,
      holding.is_custom_price,
      holding.custom_price,
    );

    const nowIso = new Date().toISOString();
    const payload = {
      id: holdingId,
      user_id: userId,
      symbol: holding.symbol?.toUpperCase().trim() || null,
      name: holding.name,
      asset_type: holding.asset_type,
      units: holding.units,
      avg_buy_price: holding.avg_buy_price,
      current_price: holding.current_price,
      currency: holding.currency || "IDR",
      notes: serializedNotes || null,
      icon: holding.icon || "TrendingUp",
      annual_rate: holding.annual_rate || null,
      purchase_date: holding.purchase_date || null,
      wallet_id: validWalletId,
      last_price_updated_at: holding.last_price_updated_at || nowIso,
      updated_at: nowIso,
    };

    const { error: upsertErr } = isFixed
      ? await supabase.from("holdings").upsert(payload, { onConflict: "id" })
      : await supabase.from("holdings").upsert(payload, { onConflict: "user_id,symbol" });

    // Safe fallback if unique constraint (user_id, symbol) has not yet been applied in DB
    if (upsertErr) {
      const { error: fallbackErr } = await supabase.from("holdings").upsert(payload);
      if (fallbackErr) {
        throw fallbackErr;
      }
    }
  } catch (e) {
    console.warn("[syncHoldingToSupabase] Supabase sync notice:", e);
    if (queueOnFail) {
      queueHoldingSync(holding, userId);
    }
  }
}

/**
 * Asynchronously removes a holding row from Supabase.
 */
export async function deleteHoldingFromSupabase(id: string, userId: string): Promise<void> {
  if (!userId || userId === "guest_local_user") return;
  try {
    if (isValidUUID(id)) {
      await supabase.from("holdings").delete().eq("id", id).eq("user_id", userId);
    }
  } catch (e) {
    console.warn("[deleteHoldingFromSupabase] Supabase delete notice:", e);
  }
}

const holdingsHydratedUsers = new Set<string>();

export function isHoldingsHydrated(userId?: string): boolean {
  if (!userId || userId === "guest_local_user") return true;
  return holdingsHydratedUsers.has(userId);
}

export function markHoldingsHydrated(userId: string): void {
  if (userId) holdingsHydratedUsers.add(userId);
}

/**
 * Loads cloud holdings from Supabase and merges into local cache.
 */
export async function fetchHoldingsFromSupabase(userId: string): Promise<InvestmentHolding[]> {
  if (!userId || userId === "guest_local_user") return getSavedHoldings(userId);
  try {
    // Flush any pending holding sync mutations first
    await flushPendingHoldingSyncs(userId).catch(() => {});

    const { data, error } = await supabase
      .from("holdings")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      markHoldingsHydrated(userId);
      // Map deduplicating by normalized symbol for market assets, keeping unique row.id for fixed/custom assets.
      // If multiple duplicate rows exist in Supabase (e.g. from previous sync issues), pick the candidate
      // with highest units or latest updated_at, and purge stale duplicate rows.
      const symbolMap = new Map<string, any>();
      const duplicateIdsToDelete: string[] = [];

      for (const row of data) {
        const sym = (row.symbol || "").toUpperCase().trim();
        const isFixed = row.asset_type === "fixed_asset";
        const mapKey = isFixed || !sym ? `id_${row.id}` : sym;
        if (!symbolMap.has(mapKey)) {
          symbolMap.set(mapKey, row);
        } else {
          const existing = symbolMap.get(mapKey);
          const rowUnits = Number(row.units) || 0;
          const existingUnits = Number(existing.units) || 0;
          const rowTime = new Date(row.updated_at || row.last_price_updated_at || 0).getTime();
          const existingTime = new Date(existing.updated_at || existing.last_price_updated_at || 0).getTime();
          if (rowUnits > existingUnits || (rowUnits === existingUnits && rowTime > existingTime)) {
            duplicateIdsToDelete.push(existing.id);
            symbolMap.set(mapKey, row);
          } else {
            duplicateIdsToDelete.push(row.id);
          }
        }
      }

      // Asynchronously prune stale duplicate rows in Supabase
      if (duplicateIdsToDelete.length > 0) {
        for (const dupId of duplicateIdsToDelete) {
          if (isValidUUID(dupId)) {
            supabase.from("holdings").delete().eq("id", dupId).eq("user_id", userId).then(() => {}, () => {});
          }
        }
      }

      const deduplicatedRows = Array.from(symbolMap.values());
      const nonUsdtHoldings: InvestmentHolding[] = [];
      let foundUsdtRow: any = null;
      let usdtHolding: InvestmentHolding | null = null;

      for (const row of deduplicatedRows) {
        const meta = parseHoldingNotes(row.notes);
        if (meta.reconciledTxIds && meta.reconciledTxIds.length > 0) {
          markTxAsReconciled(meta.reconciledTxIds, userId);
        }

        const holdingItem: InvestmentHolding = {
          id: row.id,
          wallet_id: row.wallet_id || undefined,
          symbol: (row.symbol || "").toUpperCase().trim(),
          name: row.name,
          asset_type: row.asset_type,
          units: Number(row.units) || 0,
          avg_buy_price: Number(row.avg_buy_price) || 0,
          current_price: Number(row.current_price) || 0,
          currency: row.currency || "IDR",
          notes: meta.userNotes || undefined,
          icon: row.icon || "TrendingUp",
          annual_rate: row.annual_rate ? Number(row.annual_rate) : undefined,
          purchase_date: row.purchase_date || undefined,
          last_price_updated_at: row.last_price_updated_at || undefined,
          activities: meta.activities || [],
          is_custom_price: meta.isCustomPrice,
          custom_price: meta.customPrice,
        };

        if (holdingItem.symbol === "USDT") {
          foundUsdtRow = row;
          usdtHolding = holdingItem;
        } else {
          nonUsdtHoldings.push(holdingItem);
        }
      }

      // If USDT was found in cloud, align local preference and store in holdings
      if (foundUsdtRow && usdtHolding) {
        const cloudUnits = Number(foundUsdtRow.units) || 0;
        const currentUsdt = getSavedUsdtPref(userId);

        // If local units are higher than cloud units (e.g. recent addition before logout),
        // PRESERVE local units and immediately push sync to cloud!
        if (currentUsdt.units > cloudUnits) {
          syncHoldingToSupabase(
            {
              ...usdtHolding,
              units: currentUsdt.units,
              current_price: currentUsdt.rate,
              avg_buy_price: Math.round(currentUsdt.costBasis / currentUsdt.units),
            },
            userId,
          ).catch(() => {});
          usdtHolding.units = currentUsdt.units;
        } else if (cloudUnits > 0 || currentUsdt.units <= 0) {
          const restoredUsdt: UsdtValuationPref = {
            units: cloudUnits,
            rate: Number(foundUsdtRow.current_price) || currentUsdt.rate || USD_IDR_ESTIMATE,
            costBasis: Math.round(cloudUnits * (Number(foundUsdtRow.avg_buy_price) || currentUsdt.rate || USD_IDR_ESTIMATE)),
          };
          const key = getUsdtStorageKey(userId);
          localStorage.setItem(key, JSON.stringify(restoredUsdt));
        }
        const allHoldings = [usdtHolding, ...nonUsdtHoldings];
        saveHoldings(allHoldings, userId, false);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("trouvaille_holdings_updated"));
        }
        return allHoldings;
      }

      // If no USDT was found in cloud, but local user has saved USDT units, push to cloud
      const currentUsdt = getSavedUsdtPref(userId);
      if (currentUsdt.units > 0) {
        const restoredUsdtHolding: InvestmentHolding = {
          id: `usdt-${userId}`,
          symbol: "USDT",
          name: "Tether USD",
          asset_type: "crypto",
          units: currentUsdt.units,
          avg_buy_price: Math.round(currentUsdt.costBasis / currentUsdt.units),
          current_price: currentUsdt.rate,
          currency: "IDR",
          icon: "Coins",
          last_price_updated_at: new Date().toISOString(),
        };
        syncHoldingToSupabase(restoredUsdtHolding, userId).catch(() => {});
        const allHoldings = [restoredUsdtHolding, ...nonUsdtHoldings];
        saveHoldings(allHoldings, userId, false);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("trouvaille_holdings_updated"));
        }
        return allHoldings;
      }

      saveHoldings(nonUsdtHoldings, userId, false);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("trouvaille_holdings_updated"));
      }
      return nonUsdtHoldings;
    }
  } catch (e) {
    console.warn("[fetchHoldingsFromSupabase] Fetch notice:", e);
    markHoldingsHydrated(userId);
  }
  return getSavedHoldings(userId);
}

/**
 * Retrieve saved investment holdings from localStorage scoped to user.
 * Strictly isolated per user / guest session without cross-session leakage.
 */
export function getSavedHoldings(userId?: string): InvestmentHolding[] {
  try {
    const key = getHoldingsStorageKey(userId);
    const raw = safeGetItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Save investment holdings to localStorage scoped to user, and syncs to Supabase.
 */
export function saveHoldings(holdings: InvestmentHolding[], userId?: string, syncToCloud: boolean = true): void {
  try {
    const key = getHoldingsStorageKey(userId);
    safeSetItem(key, JSON.stringify(holdings));
    // Clear un-scoped legacy key to prevent leaks into guest mode
    safeRemoveItem(HOLDINGS_STORAGE_KEY);

    // Sync to Supabase if authenticated and requested
    if (syncToCloud && userId && userId !== "guest_local_user") {
      for (const h of holdings) {
        syncHoldingToSupabase(h, userId).catch(() => {});
      }
    }

    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent("trouvaille_holdings_updated", { detail: holdings }));
    }
  } catch (e) {
    console.warn("Failed to persist holdings:", e);
  }
}

/**
 * Add or update a holding.
 */
export function upsertHolding(holding: InvestmentHolding, userId?: string): InvestmentHolding[] {
  const current = getSavedHoldings(userId);
  const isFixed = holding.asset_type === "fixed_asset";
  const index = current.findIndex(
    (h) => h.id === holding.id || (!isFixed && h.asset_type !== "fixed_asset" && h.symbol && h.symbol === holding.symbol),
  );
  const existingId = index >= 0 ? current[index].id : undefined;
  const targetId = holding.id && holding.id.trim() !== "" ? holding.id : (existingId || generateUUID());
  let updated: InvestmentHolding[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = { ...holding, id: targetId, last_price_updated_at: new Date().toISOString() };
  } else {
    updated = [
      ...current,
      {
        ...holding,
        id: targetId,
        last_price_updated_at: new Date().toISOString(),
      },
    ];
  }
  saveHoldings(updated, userId, true);
  return updated;
}

/**
 * Automatically refreshes live market quotes for USDT and all active investment holdings.
 * Updates current_price, saves to storage, syncs to Supabase, and dispatches change event.
 * Strictly respects custom broker prices (does not overwrite user-defined broker prices).
 */
export async function refreshAllPortfolioPrices(userId?: string): Promise<{
  usdtRate: number;
  updatedHoldings: InvestmentHolding[];
}> {
  const holdings = getSavedHoldings(userId);
  const currentPref = getSavedUsdtPref(userId);
  const usdtHolding = holdings.find((h) => h.symbol?.toUpperCase() === "USDT");
  const isCustomUsdt = usdtHolding?.is_custom_price && (usdtHolding.custom_price || 0) > 0;

  // 1. Refresh USDT live rate
  let liveUsdtRate = await fetchUsdtPriceInIDR();
  if (isCustomUsdt) {
    liveUsdtRate = usdtHolding!.custom_price!;
  } else if (liveUsdtRate && liveUsdtRate > 5000 && liveUsdtRate < 50000) {
    if (currentPref.units > 0 && currentPref.rate !== liveUsdtRate) {
      saveUsdtPref({ ...currentPref, rate: liveUsdtRate }, userId);
    }
  } else {
    liveUsdtRate = currentPref.rate || USD_IDR_ESTIMATE;
  }

  // 2. Refresh active market holdings (crypto & stock) in parallel
  const quotePromises = holdings.map(async (h) => {
    // If holding uses custom broker price, preserve it
    if (h.is_custom_price && h.custom_price && h.custom_price > 0) {
      return {
        holding: {
          ...h,
          current_price: h.custom_price,
          price_source: "manual",
        },
        changed: h.price_source !== "manual" || h.current_price !== h.custom_price,
      };
    }

    let newPrice: number | null = null;
    let newNativePrice: number | null = null;
    let quoteSource: string = "live";

    try {
      if (h.asset_type === "crypto") {
        const quote = await fetchCryptoQuote(h.symbol);
        if (quote) {
          newPrice = quote.idr;
          newNativePrice = quote.usd;
          quoteSource = quote.source === "cache" ? "cache" : "live";
        }
      } else if (h.asset_type === "stock") {
        const quote = await fetchStockQuote(h.symbol, false, h.currency === "IDR");
        if (quote) {
          newPrice = quote.idr;
          newNativePrice = quote.usd ?? quote.regularMarketPrice;
          quoteSource = "live";
        }
      } else if (h.asset_type === "gold" || h.symbol?.toUpperCase() === "ANTAM" || h.symbol?.toUpperCase() === "XAU") {
        const quote = await fetchGoldQuote();
        if (quote) {
          newPrice = quote.pricePerGramIDR;
          newNativePrice = quote.usdPerTroyOz;
          quoteSource = quote.source === "cache" ? "cache" : "live";
        }
      }
    } catch {
      quoteSource = "cache";
    }

    if (newPrice && newPrice > 0 && (Math.abs(newPrice - h.current_price) > 0.001 || h.price_source !== quoteSource)) {
      return {
        holding: {
          ...h,
          current_price: newPrice,
          native_price: newNativePrice ?? h.native_price,
          price_source: quoteSource,
          last_price_updated_at: new Date().toISOString(),
        },
        changed: true,
      };
    }

    return { holding: h, changed: false };
  });

  const settled = await Promise.allSettled(quotePromises);
  let hasChanges = false;
  const updatedHoldings: InvestmentHolding[] = settled.map((res, idx) => {
    if (res.status === "fulfilled") {
      if (res.value.changed) hasChanges = true;
      return res.value.holding;
    }
    return holdings[idx];
  });

  if (hasChanges) {
    saveHoldings(updatedHoldings, userId, true);
  }

  return {
    usdtRate: liveUsdtRate,
    updatedHoldings,
  };
}

/**
 * Delete a holding by ID.
 */
export function deleteHolding(id: string, userId?: string): InvestmentHolding[] {
  const current = getSavedHoldings(userId);
  const updated = current.filter((h) => h.id !== id);
  saveHoldings(updated, userId);
  if (userId && userId !== "guest_local_user") {
    deleteHoldingFromSupabase(id, userId).catch(() => {});
  }
  return updated;
}

/**
 * Get cached quote if valid within TTL.
 */
function getCachedQuote(key: string): number | null {
  try {
    const raw = localStorage.getItem(QUOTES_CACHE_KEY);
    if (!raw) return null;
    const cache: Record<string, CachedQuote> = JSON.parse(raw);
    const item = cache[key];
    if (item && Date.now() - item.timestamp < QUOTE_CACHE_TTL_MS) {
      return item.price;
    }
  } catch {}
  return null;
}

/**
 * Save quote to cache.
 */
function setCachedQuote(key: string, price: number): void {
  try {
    const raw = localStorage.getItem(QUOTES_CACHE_KEY);
    const cache: Record<string, CachedQuote> = raw ? JSON.parse(raw) : {};
    cache[key] = { price, timestamp: Date.now() };
    localStorage.setItem(QUOTES_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

/**
 * AbortController-wrapped fetch guaranteeing hard timeout protection.
 * Prevents requests from hanging indefinitely on blocked or slow network routes.
 */
async function universalFetchWithTimeout(
  url: string,
  options?: RequestInit,
  timeoutMs = 3500,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch live USD/USDT price in IDR.
 * Priority: CoinGecko (CORS *) → Open Exchange Rate (CORS *) → static fallback.
 */
export async function fetchUsdtPriceInIDR(forceRefresh = false): Promise<number> {
  const cacheKey = "usdt_rate_idr";
  if (!forceRefresh) {
    const cached = getCachedQuote(cacheKey);
    if (cached !== null) return cached;
  }

  // 1. CoinGecko — free, no auth, CORS *
  try {
    const res = await universalFetchWithTimeout(
      "https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=idr",
      { headers: { Accept: "application/json" } },
      3000,
    );
    if (res.ok) {
      const data = await res.json();
      const price = data?.tether?.idr;
      if (typeof price === "number" && price > 10000) {
        const rounded = Math.round(price);
        setCachedQuote(cacheKey, rounded);
        return rounded;
      }
    }
  } catch {}

  // 2. Open Exchange Rates — free, no auth, CORS *
  try {
    const res = await universalFetchWithTimeout(
      "https://open.er-api.com/v6/latest/USD",
      undefined,
      3000,
    );
    if (res.ok) {
      const data = await res.json();
      const rate = data?.rates?.IDR;
      if (typeof rate === "number" && rate > 10000) {
        const rounded = Math.round(rate);
        setCachedQuote(cacheKey, rounded);
        return rounded;
      }
    }
  } catch {}

  return USD_IDR_ESTIMATE;
}

export interface CryptoMarketQuote {
  usd: number;
  idr: number;
  source: string;
}

export const COINGECKO_ID_MAP: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  MATIC: "matic-network",
  POL: "polygon-ecosystem-token",
  LINK: "chainlink",
  TRX: "tron",
  SHIB: "shiba-inu",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  NEAR: "near",
  UNI: "uniswap",
  SUI: "sui",
  APT: "aptos",
  TON: "the-open-network",
  PEPE: "pepe",
  RENDER: "render-token",
  FET: "artificial-superintelligence-alliance",
  USDT: "tether",
  USDC: "usd-coin",
};

/**
 * Multi-Provider Crypto Quote Engine:
 * Provider 1: Gate.io Public Spot Tickers (Sub-200ms, CORS *, unblocked in Indonesia)
 * Provider 2: CoinGecko Simple Price (Multi-currency USD & IDR)
 * Provider 3: Indodax Ticker API (Official regulated Indonesian exchange)
 * Provider 4: Binance Fallback (Strict 2-second timeout for VPN/global networks)
 */
export async function fetchCryptoQuote(
  symbol: string,
  forceRefresh = false,
): Promise<CryptoMarketQuote | null> {
  const clean = symbol.trim().toUpperCase();
  if (!clean) return null;

  if (clean === "USDT" || clean === "USD" || clean === "USDC") {
    const rate = await fetchUsdtPriceInIDR(forceRefresh);
    return { usd: 1, idr: rate, source: "pegged" };
  }

  const cleanSymbol = clean.replace(/USDT$/, "");
  const cacheKeyUSD = `crypto_quote_usd_${cleanSymbol}`;
  const cacheKeyIDR = `crypto_quote_idr_${cleanSymbol}`;

  if (!forceRefresh) {
    const cachedUSD = getCachedQuote(cacheKeyUSD);
    const cachedIDR = getCachedQuote(cacheKeyIDR);
    if (cachedUSD !== null && cachedIDR !== null) {
      return { usd: cachedUSD, idr: cachedIDR, source: "cache" };
    }
  }

  // Provider 1: Gate.io Public Spot Tickers (High-Speed, Sub-200ms, CORS *, Unblocked in ID)
  try {
    const pair = `${cleanSymbol}_USDT`;
    const res = await universalFetchWithTimeout(
      `https://api.gateio.ws/api/v4/spot/tickers?currency_pair=${pair}`,
      undefined,
      3000,
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data[0]?.last) {
        const usdPrice = parseFloat(data[0].last);
        if (!isNaN(usdPrice) && usdPrice > 0) {
          const usdtRate = await fetchUsdtPriceInIDR(forceRefresh);
          const idrPrice = Math.round(usdPrice * usdtRate);
          setCachedQuote(cacheKeyUSD, usdPrice);
          setCachedQuote(cacheKeyIDR, idrPrice);
          return { usd: usdPrice, idr: idrPrice, source: "gateio" };
        }
      }
    }
  } catch {}

  // Provider 2: CoinGecko Simple Price API (High Reliability, Multi-Currency)
  const cgId = COINGECKO_ID_MAP[cleanSymbol];
  if (cgId) {
    try {
      const res = await universalFetchWithTimeout(
        `https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd,idr`,
        { headers: { Accept: "application/json" } },
        3000,
      );
      if (res.ok) {
        const data = await res.json();
        const info = data?.[cgId];
        if (info && typeof info.usd === "number" && info.usd > 0) {
          const usdPrice = info.usd;
          const idrPrice =
            typeof info.idr === "number" && info.idr > 0
              ? Math.round(info.idr)
              : Math.round(usdPrice * (await fetchUsdtPriceInIDR(forceRefresh)));
          setCachedQuote(cacheKeyUSD, usdPrice);
          setCachedQuote(cacheKeyIDR, idrPrice);
          return { usd: usdPrice, idr: idrPrice, source: "coingecko" };
        }
      }
    } catch {}
  }

  // Provider 3: Indodax Ticker API (Official Regulated Indonesian Exchange)
  try {
    const res = await universalFetchWithTimeout(
      `https://indodax.com/api/ticker/${cleanSymbol.toLowerCase()}idr`,
      undefined,
      3000,
    );
    if (res.ok) {
      const data = await res.json();
      const rawLast = data?.ticker?.last;
      const idrPrice = parseFloat(rawLast);
      if (!isNaN(idrPrice) && idrPrice > 0) {
        const usdtRate = await fetchUsdtPriceInIDR(forceRefresh);
        const usdPrice = parseFloat((idrPrice / usdtRate).toFixed(4));
        setCachedQuote(cacheKeyUSD, usdPrice);
        setCachedQuote(cacheKeyIDR, Math.round(idrPrice));
        return { usd: usdPrice, idr: Math.round(idrPrice), source: "indodax" };
      }
    }
  } catch {}

  // Provider 4: Binance Fallback (Strict 2-second timeout for non-ID / VPN networks)
  try {
    const pair = `${cleanSymbol}USDT`;
    const res = await universalFetchWithTimeout(
      `https://api.binance.com/api/v3/ticker/price?symbol=${pair}`,
      undefined,
      2000,
    );
    if (res.ok) {
      const data = await res.json();
      const usdPrice = parseFloat(data?.price);
      if (!isNaN(usdPrice) && usdPrice > 0) {
        const usdtRate = await fetchUsdtPriceInIDR(forceRefresh);
        const idrPrice = Math.round(usdPrice * usdtRate);
        setCachedQuote(cacheKeyUSD, usdPrice);
        setCachedQuote(cacheKeyIDR, idrPrice);
        return { usd: usdPrice, idr: idrPrice, source: "binance" };
      }
    }
  } catch {}

  return null;
}

/**
 * Fetch live Crypto price in IDR.
 */
export async function fetchCryptoPriceInIDR(
  symbol: string,
  forceRefresh = false,
): Promise<number | null> {
  const quote = await fetchCryptoQuote(symbol, forceRefresh);
  return quote ? quote.idr : null;
}

/**
 * Fetch live Crypto price in USD.
 */
export async function fetchCryptoPriceInUSD(
  symbol: string,
  forceRefresh = false,
): Promise<number | null> {
  const quote = await fetchCryptoQuote(symbol, forceRefresh);
  return quote ? quote.usd : null;
}

export interface GoldMarketQuote {
  pricePerGramIDR: number;
  usdPerTroyOz: number;
  change24hPct: number;
  source: string;
}

/**
 * Fetch live gold spot quote in IDR per gram (with Antam physical minting parity ~3% premium).
 * Uses public Gold API (https://api.gold-api.com/price/XAU).
 */
export async function fetchGoldQuote(forceRefresh = false): Promise<GoldMarketQuote | null> {
  const cacheKey = "gold_quote_xau_idr";
  if (!forceRefresh) {
    const cached = getCachedQuote(cacheKey);
    if (cached !== null && cached > 0) {
      return {
        pricePerGramIDR: cached,
        usdPerTroyOz: 0,
        change24hPct: 0,
        source: "cached",
      };
    }
  }

  const TROY_OUNCE_TO_GRAM = 31.1034768;
  const usdIdrRate = await fetchUsdtPriceInIDR(forceRefresh);

  try {
    const res = await universalFetchWithTimeout("https://api.gold-api.com/price/XAU", undefined, 3500);
    if (res.ok) {
      const data = await res.json();
      const pricePerTroyOz = Number(data?.price);
      if (pricePerTroyOz > 500) {
        const usdPerGram = pricePerTroyOz / TROY_OUNCE_TO_GRAM;
        // Physical Antam parity: ~3% premium over international spot
        const idrPerGram = Math.round(usdPerGram * usdIdrRate * 1.03);
        const change24hPct = Number(data?.chp) || Number(data?.change_percent) || 0;

        setCachedQuote(cacheKey, idrPerGram);
        setCachedQuote("gold_quote_xau_usd", Math.round(usdPerGram * 100) / 100);
        setCachedQuote("XAU", idrPerGram);
        setCachedQuote("ANTAM", idrPerGram);
        setCachedQuote("GOLD", idrPerGram);
        setCachedQuote("EMAS", idrPerGram);
        setCachedQuote("UBS", Math.round(idrPerGram * 0.995));

        return {
          pricePerGramIDR: idrPerGram,
          usdPerTroyOz: pricePerTroyOz,
          change24hPct: Math.round(change24hPct * 100) / 100,
          source: "gold_api",
        };
      }
    }
  } catch {}

  return null;
}

/**
 * Fetch live gold price in IDR per gram.
 */
export async function fetchGoldPriceInIDR(forceRefresh = false): Promise<number | null> {
  const quote = await fetchGoldQuote(forceRefresh);
  return quote ? quote.pricePerGramIDR : null;
}

export interface StockMarketQuote {
  usd?: number;
  idr: number;
  regularMarketPrice: number;
  isUS: boolean;
}

export const INDEX_ALIAS_MAP: Record<string, string> = {
  IHSG: "^JKSE",
  COMPOSITE: "^JKSE",
  LQ45: "^JKLQ45",
  IDX30: "^JK30",
  "S&P500": "^GSPC",
  "S&P 500": "^GSPC",
  SPX: "^GSPC",
  SPY: "SPY",
  NASDAQ: "^IXIC",
  NDX: "^NDX",
  QQQ: "QQQ",
  DOW: "^DJI",
  DJI: "^DJI",
  DIA: "DIA",
  NIKKEI: "^N225",
  N225: "^N225",
  HANGSENG: "^HSI",
  HSI: "^HSI",
  FTSE: "^FTSE",
  STI: "^STI",
  STOXX50: "^STOXX50E",
};

const KNOWN_US_TICKERS = new Set([
  "AAPL", "NVDA", "TSLA", "MSFT", "GOOGL", "GOOG", "AMZN", "META",
  "NFLX", "AMD", "INTC", "SPY", "QQQ", "VOO", "VTI", "COIN", "PLTR",
  "DIS", "BABA", "UBER", "PYPL", "BRK.B", "BRK.A", "BRK-B", "JPM", "V", "MA",
  "WMT", "COST", "XOM", "CVX", "LLY", "UNH", "JNJ", "PG", "HD", "BAC",
  "ARM", "SMCI", "TSM",
  "^GSPC", "^IXIC", "^DJI", "^NDX", "^RUT", "^N225", "^HSI", "^FTSE", "^STI", "^STOXX50E", "DIA", "IWM",
]);

/**
 * Resilient multi-tier Yahoo Finance Chart data fetcher:
 * Tier 1: Native CapacitorHttp on iOS/Android (bypasses CORS via native NSURLSession, sets desktop UA).
 * Tier 2: Vite Dev Proxy (/api/yahoo) when running locally in development.
 * Tier 3: Supabase Edge Function ('market-quote') for production Web/PWA deployments.
 * Tier 4: Direct browser fetch with timeout protection.
 */
async function resilientFetchYahooChart(ticker: string, timeoutMs = 4000): Promise<any | null> {
  const encodedTicker = encodeURIComponent(ticker);

  // Tier 1: Native CapacitorHttp (iOS / Android)
  if (typeof Capacitor !== "undefined" && Capacitor.isNativePlatform()) {
    try {
      const resp = await CapacitorHttp.get({
        url: `https://query1.finance.yahoo.com/v8/finance/chart/${encodedTicker}?interval=1d&range=1d`,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
        connectTimeout: timeoutMs,
        readTimeout: timeoutMs,
      });
      if (resp.status >= 200 && resp.status < 300 && resp.data) {
        const data = typeof resp.data === "string" ? JSON.parse(resp.data) : resp.data;
        if (data?.chart?.result?.[0]?.meta) return data;
      }
    } catch (e) {
      console.warn("[resilientFetchYahooChart] Native CapacitorHttp notice:", e);
    }
  }

  // Tier 2: Vite Dev Proxy when running in local browser
  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ) {
    try {
      const res = await universalFetchWithTimeout(
        `/api/yahoo/v8/finance/chart/${encodedTicker}?interval=1d&range=1d`,
        undefined,
        timeoutMs,
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.chart?.result?.[0]?.meta) return data;
      }
    } catch {}
  }

  // Tier 3: Supabase Edge Function 'market-quote' (Serverless proxy for Web/PWA)
  try {
    const { data, error } = await supabase.functions.invoke("market-quote", {
      body: { ticker },
    });
    if (!error && data?.chart?.result?.[0]?.meta) {
      return data;
    }
  } catch {}

  // Tier 4: Direct universalFetchWithTimeout
  try {
    const res = await universalFetchWithTimeout(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodedTicker}?interval=1d&range=1d`,
      undefined,
      timeoutMs,
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.chart?.result?.[0]?.meta) return data;
    }
  } catch {}

  return null;
}

/**
 * Fetch live stock and market index quote via Yahoo Finance Chart API.
 * Supports Indonesian equities (*.JK), global indices (^JKSE, ^GSPC, ^IXIC), and US equities with smart disambiguation.
 */
export async function fetchStockQuote(
  symbol: string,
  forceRefresh = false,
  preferIDR = false,
): Promise<StockMarketQuote | null> {
  const rawClean = symbol.trim().toUpperCase();
  if (!rawClean) return null;

  // Resolve alias (e.g. IHSG -> ^JKSE, S&P 500 -> ^GSPC)
  const cleanSymbol = INDEX_ALIAS_MAP[rawClean] || rawClean;

  const isIndex = cleanSymbol.startsWith("^");
  const isJKIndex = cleanSymbol === "^JKSE" || cleanSymbol === "^JKLQ45" || cleanSymbol === "^JK30";
  const isExplicitJK = cleanSymbol.endsWith(".JK");
  const baseTicker = cleanSymbol.replace(/\.JK$/, "");

  let candidates: string[];
  if (isIndex) {
    candidates = [cleanSymbol];
  } else {
    const shouldTryJKFirst =
      isExplicitJK || preferIDR || (!KNOWN_US_TICKERS.has(baseTicker) && baseTicker.length === 4);
    candidates = shouldTryJKFirst
      ? [`${baseTicker}.JK`, baseTicker]
      : [baseTicker, `${baseTicker}.JK`];
  }

  const cacheKeyUSD = `stock_quote_usd_${baseTicker}`;
  const cacheKeyIDR = `stock_quote_idr_${baseTicker}`;

  if (!forceRefresh) {
    const cachedIDR = getCachedQuote(cacheKeyIDR);
    if (cachedIDR !== null) {
      const cachedUSD = getCachedQuote(cacheKeyUSD);
      const isUS = isIndex ? !isJKIndex : (candidates[0] === baseTicker && !isExplicitJK);
      return {
        regularMarketPrice: isUS ? (cachedUSD ?? 0) : cachedIDR,
        idr: cachedIDR,
        usd: cachedUSD ?? undefined,
        isUS,
      };
    }
  }

  const usdtRate = await fetchUsdtPriceInIDR(forceRefresh);

  for (const ticker of candidates) {
    try {
      const data = await resilientFetchYahooChart(ticker, 4000);
      const meta = data?.chart?.result?.[0]?.meta;
      const regularMarketPrice = meta?.regularMarketPrice;

      if (typeof regularMarketPrice === "number" && regularMarketPrice > 0) {
        const isJK = ticker.endsWith(".JK") || meta?.currency === "IDR" || isJKIndex;
        let idrPrice: number;
        let usdPrice: number;

        if (isJK) {
          idrPrice = Math.round(regularMarketPrice);
          usdPrice = parseFloat((idrPrice / usdtRate).toFixed(4));
        } else {
          usdPrice = regularMarketPrice;
          idrPrice = Math.round(usdPrice * usdtRate);
        }

        setCachedQuote(cacheKeyUSD, usdPrice);
        setCachedQuote(cacheKeyIDR, idrPrice);
        setCachedQuote(`stock_quote_idr_${ticker}`, idrPrice);
        if (rawClean !== cleanSymbol) {
          setCachedQuote(`stock_quote_idr_${rawClean}`, idrPrice);
          setCachedQuote(`stock_quote_usd_${rawClean}`, usdPrice);
        }

        return {
          regularMarketPrice,
          idr: idrPrice,
          usd: usdPrice,
          isUS: !isJK,
        };
      }
    } catch {}
  }

  return null;
}

/**
 * Fetch live stock price in IDR.
 */
export async function fetchStockPriceInIDR(
  symbol: string,
  forceRefresh = false,
  preferIDR = false,
): Promise<number | null> {
  const quote = await fetchStockQuote(symbol, forceRefresh, preferIDR);
  return quote ? quote.idr : null;
}

/**
 * Calculates current price/value given buy price, annual growth/depreciation rate %, and purchase date.
 * Uses continuous/compound annual rate: value = buyPrice * (1 + rate / 100)^yearsElapsed
 */
export function calculateAssetDepreciation(
  buyPrice: number,
  annualRatePct: number,
  purchaseDate: string,
  targetDate: Date = new Date(),
): {
  currentPrice: number;
  yearsElapsed: number;
  totalChange: number;
  totalChangePct: number;
} {
  const buy = Math.max(0, Number(buyPrice) || 0);
  if (buy === 0 || !purchaseDate) {
    return { currentPrice: buy, yearsElapsed: 0, totalChange: 0, totalChangePct: 0 };
  }

  const pDate = new Date(purchaseDate);
  if (isNaN(pDate.getTime())) {
    return { currentPrice: buy, yearsElapsed: 0, totalChange: 0, totalChangePct: 0 };
  }

  const msDiff = targetDate.getTime() - pDate.getTime();
  const yearsElapsed = Math.max(0, msDiff / (365.25 * 24 * 3600 * 1000));
  const rate = Number(annualRatePct) || 0;

  // Compound rate: price = buyPrice * (1 + rate / 100)^yearsElapsed
  let factor = 1;
  if (rate <= -100) {
    factor = 0;
  } else {
    factor = Math.pow(1 + rate / 100, yearsElapsed);
  }

  const currentPrice = Math.max(0, Math.round(buy * factor));
  const totalChange = currentPrice - buy;
  const totalChangePct = buy > 0 ? (totalChange / buy) * 100 : 0;

  return {
    currentPrice,
    yearsElapsed,
    totalChange,
    totalChangePct,
  };
}

/**
 * Calculate valuation and floating profit/loss for a single holding.
 */
export function calculateHoldingValuation(holding: InvestmentHolding): HoldingValuation {
  const units = Number(holding.units || 0);
  let buyPrice = Number(holding.avg_buy_price || 0);

  // Custom price override if user has locked a manual price
  let currentPrice =
    holding.is_custom_price && typeof holding.custom_price === "number" && holding.custom_price > 0
      ? holding.custom_price
      : Number(holding.current_price || buyPrice);

  // Self-healing legacy fallback: If holding was saved with USD buyPrice but IDR currentPrice (ratio > 500x)
  if (
    (holding.currency === "USD" || holding.native_currency === "USD") &&
    buyPrice > 0 &&
    currentPrice > buyPrice * 500
  ) {
    buyPrice = Math.round(buyPrice * USD_IDR_ESTIMATE);
  }

  // If holding has annual depreciation/growth rate and purchase date, dynamically adjust current market price
  if (
    typeof holding.annual_rate === "number" &&
    holding.annual_rate !== 0 &&
    holding.purchase_date
  ) {
    const dep = calculateAssetDepreciation(
      buyPrice,
      holding.annual_rate,
      holding.purchase_date,
    );
    currentPrice = dep.currentPrice;
  }

  const costBasis = units * buyPrice;
  const marketValue = units * currentPrice;
  const floatingPnL = marketValue - costBasis;
  const floatingPnLPct = costBasis > 0 ? (floatingPnL / costBasis) * 100 : 0;

  return {
    costBasis,
    marketValue,
    floatingPnL,
    floatingPnLPct,
    effectivePrice: currentPrice,
  };
}

/**
 * Calculates cumulative realized profit and loss across all liquidated positions.
 */
export function calculateTotalRealizedPnL(holdings: InvestmentHolding[]): {
  totalRealizedPnL: number;
  realizedSalesCount: number;
  bySymbol: Record<string, number>;
} {
  let totalRealizedPnL = 0;
  let realizedSalesCount = 0;
  const bySymbol: Record<string, number> = {};

  holdings.forEach((h) => {
    const activities = getHoldingActivities(h);
    const sym = h.symbol?.toUpperCase() || "UNKNOWN";
    activities.forEach((act) => {
      if (act.type === "sell") {
        realizedSalesCount++;
        let pnl = 0;
        if (typeof act.realized_pnl === "number" && !isNaN(act.realized_pnl)) {
          pnl = act.realized_pnl;
        } else {
          const proceeds = act.total_amount || (act.units * act.price_per_unit);
          const costOfUnits = act.units * (h.avg_buy_price || 0);
          pnl = proceeds - costOfUnits;
        }
        totalRealizedPnL += pnl;
        bySymbol[sym] = (bySymbol[sym] || 0) + pnl;
      }
    });
  });

  return {
    totalRealizedPnL,
    realizedSalesCount,
    bySymbol,
  };
}

/**
 * Calculate aggregate portfolio summary and asset distribution.
 */
export function calculatePortfolioSummary(holdings: InvestmentHolding[]): PortfolioSummary {
  let totalCostBasis = 0;
  let totalMarketValue = 0;

  const byAssetType: Record<
    AssetType,
    { costBasis: number; marketValue: number; floatingPnL: number }
  > = {
    stock: { costBasis: 0, marketValue: 0, floatingPnL: 0 },
    crypto: { costBasis: 0, marketValue: 0, floatingPnL: 0 },
    mutual_fund: { costBasis: 0, marketValue: 0, floatingPnL: 0 },
    gold: { costBasis: 0, marketValue: 0, floatingPnL: 0 },
    bond: { costBasis: 0, marketValue: 0, floatingPnL: 0 },
    fixed_asset: { costBasis: 0, marketValue: 0, floatingPnL: 0 },
  };

  holdings.forEach((h) => {
    const val = calculateHoldingValuation(h);
    totalCostBasis += val.costBasis;
    totalMarketValue += val.marketValue;

    const t = h.asset_type || "stock";
    if (byAssetType[t]) {
      byAssetType[t].costBasis += val.costBasis;
      byAssetType[t].marketValue += val.marketValue;
      byAssetType[t].floatingPnL += val.floatingPnL;
    }
  });

  const totalFloatingPnL = totalMarketValue - totalCostBasis;
  const totalFloatingPnLPct =
    totalCostBasis > 0 ? (totalFloatingPnL / totalCostBasis) * 100 : 0;

  const { totalRealizedPnL } = calculateTotalRealizedPnL(holdings);

  return {
    totalCostBasis,
    totalMarketValue,
    totalFloatingPnL,
    totalFloatingPnLPct,
    totalRealizedPnL,
    byAssetType,
  };
}

/**
 * Deduplicate and sanitize holding activities, removing ghost or duplicated rows
 * caused by previous transaction updates while keeping the latest entry.
 */
export function sanitizeHoldingActivities(activities: HoldingActivity[]): HoldingActivity[] {
  if (!activities || activities.length <= 1) return activities || [];
  const seenKeys = new Set<string>();
  const sanitized: HoldingActivity[] = [];

  for (const act of activities) {
    let key = "";
    if (act.transaction_id) {
      key = `tx:${act.transaction_id}`;
    } else if (act.id.startsWith("act-tx-")) {
      key = `tx:${act.id.replace("act-tx-", "")}`;
    } else if (act.id.startsWith("tx-bridge-")) {
      key = `tx:${act.id.replace("tx-bridge-", "")}`;
    } else {
      const d = (act.date || "").slice(0, 10);
      const amt = Math.round(act.total_amount || 0);
      const u = Number(act.units.toFixed(2));
      key = `legacy:${act.type}:${d}:${amt}:${u}`;
    }

    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      sanitized.push(act);
    }
  }
  return sanitized;
}

/**
 * Retrieve all activities/positions recorded for a holding.
 * If activities array is empty or undefined, synthesizes an initial position from the holding's current values.
 */
export function getHoldingActivities(holding: InvestmentHolding): HoldingActivity[] {
  if (holding.activities && Array.isArray(holding.activities) && holding.activities.length > 0) {
    const healed = holding.activities.map((act) => {
      // Auto-heal any legacy activities with distorted total_amount
      if (
        act.units > 0 &&
        act.price_per_unit > 0 &&
        act.total_amount > act.units * act.price_per_unit * 1.5
      ) {
        return {
          ...act,
          total_amount: Math.round(act.units * act.price_per_unit),
        };
      }
      return act;
    });
    const sanitized = sanitizeHoldingActivities(healed);
    return sanitized.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }

  // Synthesize an initial position for backward compatibility
  const initialDate = holding.purchase_date || (holding.last_price_updated_at ? holding.last_price_updated_at.split("T")[0] : "Initial");
  return [
    {
      id: `act-initial-${holding.id}`,
      holding_id: holding.id,
      type: "initial",
      date: initialDate,
      units: holding.units,
      price_per_unit: holding.avg_buy_price,
      total_amount: Math.round(holding.units * holding.avg_buy_price),
      note: "Initial position",
      created_at: holding.last_price_updated_at || new Date().toISOString(),
    },
  ];
}

/**
 * Retrieve the standard uniform holding ID for USDT.
 */
export function getStandardUsdtHoldingId(userId?: string): string {
  return `usdt-${userId || "local"}`;
}

/**
 * Record a new DCA Buy or partial/full Sell position on a holding.
 * Automatically recalculates weighted average buy price on buys and updates units.
 */
export function recordHoldingActivity(
  holdingId: string,
  activityInput: {
    type: "buy" | "sell";
    units: number;
    price_per_unit: number;
    total_amount?: number;
    date?: string;
    note?: string;
    realized_pnl?: number;
    transaction_id?: string;
    id?: string;
  },
  userId?: string,
): { updatedHolding: InvestmentHolding; realizedPnL: number } {
  const allHoldings = getSavedHoldings(userId);
  const isUsdtRef =
    holdingId.startsWith("usdt-") ||
    holdingId === "usdt-core-holding" ||
    holdingId === "usdt";

  let target =
    allHoldings.find((h) => h.id === holdingId) ||
    (isUsdtRef ? allHoldings.find((h) => h.symbol?.toUpperCase() === "USDT") : undefined);

  if (!target && isUsdtRef) {
    const usdtPref = getSavedUsdtPref(userId);
    target = {
      id: getStandardUsdtHoldingId(userId),
      user_id: userId,
      symbol: "USDT",
      name: "Tether USD",
      asset_type: "crypto",
      units: usdtPref.units,
      avg_buy_price: usdtPref.units > 0 ? Math.round(usdtPref.costBasis / usdtPref.units) : usdtPref.rate,
      current_price: usdtPref.rate,
      currency: "IDR",
      icon: "Coins",
      activities: [],
    };
  }
  if (!target) {
    throw new Error(`Holding with id ${holdingId} not found`);
  }

  const dateStr = activityInput.date || new Date().toISOString();
  const existingActivities = getHoldingActivities(target);
  const units = Math.max(0, Number(activityInput.units) || 0);
  const price = Math.max(0, Number(activityInput.price_per_unit) || 0);
  const totalNominal = activityInput.total_amount ? Number(activityInput.total_amount) : units * price;

  const actId =
    activityInput.id ||
    (activityInput.transaction_id
      ? `act-tx-${activityInput.transaction_id}`
      : `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);

  // Idempotency check: if an activity for this transaction or ID already exists,
  // revert its effect first so we update the position cleanly without duplicating.
  let baseUnits = target.units;
  const filteredExisting = existingActivities.filter((a) => {
    const isSameTx =
      (activityInput.transaction_id && a.transaction_id === activityInput.transaction_id) ||
      a.id === actId ||
      (activityInput.transaction_id && a.id === `act-tx-${activityInput.transaction_id}`);
    if (isSameTx) {
      if (a.type === "buy") {
        baseUnits = Math.max(0, Number((baseUnits - a.units).toFixed(4)));
      } else if (a.type === "sell") {
        baseUnits = Number((baseUnits + a.units).toFixed(4));
      }
      return false; // remove old activity
    }
    return !a.id.startsWith("act-initial-");
  });

  let newUnits = baseUnits;
  let newAvgBuyPrice = target.avg_buy_price;
  let realizedPnL = 0;

  if (activityInput.type === "buy") {
    // Weighted average cost basis:
    // (previous_units * previous_avg + new_units * new_price) / (previous_units + new_units)
    const prevCost = baseUnits * target.avg_buy_price;
    const addCost = units * price;
    newUnits = baseUnits + units;
    newAvgBuyPrice = newUnits > 0 ? (prevCost + addCost) / newUnits : price;
  } else if (activityInput.type === "sell") {
    // Realized Profit/Loss = units_sold * (selling_price - avg_buy_price)
    realizedPnL = units * (price - target.avg_buy_price);
    newUnits = Math.max(0, Number((baseUnits - units).toFixed(4)));
    // avg_buy_price per remaining unit remains unchanged on partial liquidation
  }

  const newActivity: HoldingActivity = {
    id: actId,
    holding_id: target.id,
    type: activityInput.type,
    date: dateStr,
    units,
    price_per_unit: price,
    total_amount: totalNominal,
    realized_pnl: activityInput.type === "sell" ? Math.round(realizedPnL * 100) / 100 : undefined,
    note: activityInput.note || (activityInput.type === "buy" ? "DCA Purchase" : "Position Sell"),
    created_at: new Date().toISOString(),
    transaction_id: activityInput.transaction_id,
  };

  const updatedHolding: InvestmentHolding = {
    ...target,
    units: newUnits,
    avg_buy_price: Math.round(newAvgBuyPrice * 100) / 100,
    current_price: price > 0 ? price : target.current_price,
    last_price_updated_at: new Date().toISOString(),
    activities: [newActivity, ...filteredExisting],
  };

  upsertHolding(updatedHolding, userId);
  if (updatedHolding.symbol?.toUpperCase() === "USDT") {
    saveUsdtPref(
      {
        units: newUnits,
        rate: updatedHolding.current_price || USD_IDR_ESTIMATE,
        costBasis: Math.round(newUnits * newAvgBuyPrice),
      },
      userId,
    );
  }
  return { updatedHolding, realizedPnL };
}

/**
 * Undo/revert a previously recorded holding activity.
 * Restores units and cost basis according to the reverted action (buy vs sell).
 */
export function undoHoldingActivity(
  holdingId: string,
  activityId: string,
  userId?: string,
  fallbackActivity?: HoldingActivity,
): { updatedHolding: InvestmentHolding; revertedActivity: HoldingActivity } {
  const allHoldings = getSavedHoldings(userId);
  const isUsdtRef =
    holdingId.startsWith("usdt-") ||
    holdingId === "usdt-core-holding" ||
    holdingId === "usdt";

  let target =
    allHoldings.find((h) => h.id === holdingId) ||
    (isUsdtRef ? allHoldings.find((h) => h.symbol?.toUpperCase() === "USDT") : undefined);

  if (!target && isUsdtRef) {
    const usdtPref = getSavedUsdtPref(userId);
    target = {
      id: getStandardUsdtHoldingId(userId),
      user_id: userId,
      symbol: "USDT",
      name: "Tether USD",
      asset_type: "crypto",
      units: usdtPref.units,
      avg_buy_price: usdtPref.units > 0 ? Math.round(usdtPref.costBasis / usdtPref.units) : usdtPref.rate,
      current_price: usdtPref.rate,
      currency: "IDR",
      icon: "Coins",
      activities: [],
    };
  }

  if (!target) {
    throw new Error(`Holding with id ${holdingId} not found`);
  }

  const existingActivities = target.activities || [];
  const rawTxId = activityId.startsWith("act-tx-")
    ? activityId.replace("act-tx-", "")
    : activityId.startsWith("tx-bridge-")
      ? activityId.replace("tx-bridge-", "")
      : activityId;

  const actIndex = existingActivities.findIndex(
    (a) =>
      a.id === activityId ||
      (rawTxId && a.transaction_id === rawTxId) ||
      (a.transaction_id && a.transaction_id === activityId) ||
      (rawTxId && a.id === `act-tx-${rawTxId}`) ||
      (rawTxId && a.id === `tx-bridge-${rawTxId}`),
  );

  let act: HoldingActivity;
  if (actIndex >= 0) {
    act = existingActivities[actIndex];
  } else if (fallbackActivity) {
    act = fallbackActivity;
  } else {
    throw new Error(`Activity ${activityId} not found`);
  }

  let newUnits = target.units;

  if (act.type === "sell") {
    // Undoing a sell restores the deducted units
    newUnits = Number((target.units + act.units).toFixed(4));
  } else if (act.type === "buy") {
    // Undoing a buy removes the added units
    newUnits = Math.max(0, Number((target.units - act.units).toFixed(4)));
  }

  // If this was a bridged transaction or transaction-linked activity, un-reconcile it from reconciledTxIds
  if (rawTxId) {
    try {
      const currentReconciled = getReconciledTxIds(userId);
      currentReconciled.delete(rawTxId);
      const key = getReconciledTxStorageKey(userId);
      safeSetItem(key, JSON.stringify(Array.from(currentReconciled)));
    } catch {}
  }

  const remainingActivities = existingActivities.filter(
    (a) =>
      a.id !== act.id &&
      (!rawTxId || a.transaction_id !== rawTxId) &&
      (!rawTxId || a.id !== `act-tx-${rawTxId}`) &&
      (!rawTxId || a.id !== `tx-bridge-${rawTxId}`),
  );

  const updatedHolding: InvestmentHolding = {
    ...target,
    units: newUnits,
    activities: remainingActivities,
    last_price_updated_at: new Date().toISOString(),
  };

  upsertHolding(updatedHolding, userId);

  if (updatedHolding.symbol?.toUpperCase() === "USDT") {
    saveUsdtPref(
      {
        units: newUnits,
        rate: updatedHolding.current_price || USD_IDR_ESTIMATE,
        costBasis: Math.round(newUnits * (updatedHolding.avg_buy_price || USD_IDR_ESTIMATE)),
      },
      userId,
    );
  }

  return { updatedHolding, revertedActivity: act };
}

/**
 * Direct balance correction for a holding.
 * Directly sets the total units owned, updates usdtPref (if USDT), and records a balancing activity.
 */
export function setHoldingDirectUnits(
  holdingId: string,
  newUnits: number,
  userId?: string,
  note: string = "Manual balance correction",
  anchorCostBasis?: number,
): InvestmentHolding {
  const allHoldings = getSavedHoldings(userId);
  const isUsdtRef =
    holdingId.startsWith("usdt-") ||
    holdingId === "usdt-core-holding" ||
    holdingId === "usdt";

  let target =
    allHoldings.find((h) => h.id === holdingId) ||
    (isUsdtRef ? allHoldings.find((h) => h.symbol?.toUpperCase() === "USDT") : undefined);

  if (!target && isUsdtRef) {
    const usdtPref = getSavedUsdtPref(userId);
    target = {
      id: getStandardUsdtHoldingId(userId),
      user_id: userId,
      symbol: "USDT",
      name: "Tether USD",
      asset_type: "crypto",
      units: usdtPref.units,
      avg_buy_price: usdtPref.units > 0 ? Math.round(usdtPref.costBasis / usdtPref.units) : usdtPref.rate,
      current_price: usdtPref.rate,
      currency: "IDR",
      icon: "Coins",
      activities: [],
    };
  }

  if (!target) {
    throw new Error(`Holding with id ${holdingId} not found`);
  }

  const sanitizedUnits = Math.max(0, newUnits);
  const prevUnits = target.units;
  const deltaUnits = Number((sanitizedUnits - prevUnits).toFixed(4));
  const existingActivities = target.activities || [];

  const isUsdtTarget = target.symbol?.toUpperCase() === "USDT" || target.id.startsWith("usdt-");
  let validAnchorCostBasis = anchorCostBasis;
  if (validAnchorCostBasis && validAnchorCostBasis > 0 && sanitizedUnits > 0) {
    const impliedPrice = validAnchorCostBasis / sanitizedUnits;
    if (isUsdtTarget && (impliedPrice < 10000 || impliedPrice > 30000)) {
      validAnchorCostBasis = undefined; // Reject distorted anchor that would distort average price
    }
  }

  const calibratedAvgBuyPrice =
    validAnchorCostBasis && validAnchorCostBasis > 0 && sanitizedUnits > 0
      ? Math.round((validAnchorCostBasis / sanitizedUnits) * 100) / 100
      : target.avg_buy_price;

  const unitPrice =
    calibratedAvgBuyPrice || target.current_price || USD_IDR_ESTIMATE;
  const activityValuation = Math.round(Math.abs(deltaUnits) * unitPrice);

  const correctionActivity: HoldingActivity = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    holding_id: target.id,
    type: deltaUnits >= 0 ? "buy" : "sell",
    date: new Date().toISOString().split("T")[0],
    units: Math.abs(deltaUnits),
    price_per_unit: unitPrice,
    total_amount: activityValuation,
    note,
    created_at: new Date().toISOString(),
  };

  // Sanitize any historically distorted correction activities where total_amount was mistakenly set to entire wallet cost basis
  const sanitizedExistingActivities = existingActivities.map((act) => {
    if (
      act.units > 0 &&
      act.price_per_unit > 0 &&
      act.total_amount > act.units * act.price_per_unit * 1.5
    ) {
      return {
        ...act,
        total_amount: Math.round(act.units * act.price_per_unit),
      };
    }
    return act;
  });

  const updatedActivities = deltaUnits !== 0 ? [correctionActivity, ...sanitizedExistingActivities] : sanitizedExistingActivities;

  const updatedHolding: InvestmentHolding = {
    ...target,
    units: sanitizedUnits,
    avg_buy_price: calibratedAvgBuyPrice,
    activities: updatedActivities,
    last_price_updated_at: new Date().toISOString(),
  };

  upsertHolding(updatedHolding, userId);

  if (updatedHolding.symbol?.toUpperCase() === "USDT") {
    const resolvedCostBasis =
      validAnchorCostBasis && validAnchorCostBasis > 0
        ? Math.round(validAnchorCostBasis)
        : Math.round(sanitizedUnits * (updatedHolding.avg_buy_price || USD_IDR_ESTIMATE));
    saveUsdtPref(
      {
        units: sanitizedUnits,
        rate: updatedHolding.current_price || USD_IDR_ESTIMATE,
        costBasis: resolvedCostBasis,
      },
      userId,
    );
  }

  return updatedHolding;
}


/**
 * Generate smooth historical chart points for Value (nominal) and Return (PnL) curves.
 */
export function generateAssetHistoryCurve(
  holding: InvestmentHolding,
  timeframe: "1D" | "1W" | "1M" | "6M" | "YTD" | "1Y" | "ALL",
  currentPrice?: number,
): Array<{
  label: string;
  date: string;
  value: number;
  cost: number;
  returnVal: number;
  returnPct: number;
}> {
  const units = holding.units;
  const avgBuy = holding.avg_buy_price;
  const livePrice = currentPrice && currentPrice > 0 ? currentPrice : holding.current_price || avgBuy;
  const currentTotalValue = units * livePrice;
  const totalCost = units * avgBuy;

  const numPoints =
    timeframe === "1D" ? 12 : timeframe === "1W" ? 7 : timeframe === "1M" ? 15 : timeframe === "6M" ? 12 : 12;
  const points: Array<{
    label: string;
    date: string;
    value: number;
    cost: number;
    returnVal: number;
    returnPct: number;
  }> = [];

  const priceDiff = livePrice - avgBuy;
  const now = new Date();

  // If fixed asset, custom price, or flat price (no price deviation or single purchase):
  // do NOT inject synthetic sine waves. Yield a clean, stable horizontal curve.
  const isFixed = holding.asset_type === "fixed_asset";
  const isCustomPrice = Boolean(holding.is_custom_price);
  const isFlatPrice = Math.abs(priceDiff) < 0.0001;
  const hasMultipleActivities = Array.isArray(holding.activities) && holding.activities.length > 1;

  for (let i = 0; i < numPoints; i++) {
    const progress = i / (numPoints - 1);
    
    let simulatedPrice = livePrice;
    if (!isFixed && !isCustomPrice && !isFlatPrice && (hasMultipleActivities || Math.abs(priceDiff) >= 0.0001)) {
      const factor = Math.sin((progress * Math.PI) / 2);
      const wave = Math.sin(i * 1.7) * 0.015 * (1 - progress);
      simulatedPrice = avgBuy + priceDiff * factor + livePrice * wave;
    } else if (isFixed && holding.annual_rate && holding.purchase_date) {
      // If fixed asset has depreciation/appreciation configured, calculate smooth linear accrual over elapsed time
      const purchaseTime = new Date(holding.purchase_date).getTime();
      const totalSpan = Math.max(1, now.getTime() - purchaseTime);
      const pointTime = purchaseTime + progress * totalSpan;
      const yearsElapsed = Math.max(0, (pointTime - purchaseTime) / (365.25 * 86400000));
      const rateFactor = 1 + (Number(holding.annual_rate) / 100) * yearsElapsed;
      simulatedPrice = Math.max(0, avgBuy * rateFactor);
    } else {
      // Completely stable flat line representing cost basis / fixed price
      simulatedPrice = livePrice;
    }

    const simulatedVal = Math.max(0, Math.round(units * simulatedPrice));
    const simulatedPnL = simulatedVal - totalCost;
    const simulatedPnLPct = totalCost > 0 ? (simulatedPnL / totalCost) * 100 : 0;

    let label = "";
    if (timeframe === "1D") {
      label = `${String(9 + Math.floor(i * 0.75)).padStart(2, "0")}:00`;
    } else if (timeframe === "1W") {
      const d = new Date(now.getTime() - (6 - i) * 86400000);
      label = d.toLocaleDateString("en-US", { weekday: "short" });
    } else if (timeframe === "1M") {
      label = `${i * 2 + 1}`;
    } else if (timeframe === "6M") {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const mIndex = (now.getMonth() - (5 - i) + 12) % 12;
      label = monthNames[mIndex];
    } else {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const mIndex = (now.getMonth() - (11 - i) + 12) % 12;
      label = monthNames[mIndex];
    }

    points.push({
      label,
      date: label,
      value: i === numPoints - 1 ? currentTotalValue : simulatedVal,
      cost: totalCost,
      returnVal: i === numPoints - 1 ? currentTotalValue - totalCost : simulatedPnL,
      returnPct: i === numPoints - 1 && totalCost > 0 ? ((currentTotalValue - totalCost) / totalCost) * 100 : Math.round(simulatedPnLPct * 100) / 100,
    });
  }

  return points;
}
