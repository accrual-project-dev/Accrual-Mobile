import { supabase } from "./supabase";
import { WALLETS_BACKUP_STORAGE_KEY } from "../hooks/useWallets";
import { TX_BACKUP_STORAGE_KEY, generateUUID } from "../hooks/useTransactions";
import {
  getPendingMutations,
  savePendingMutations,
  flushPendingMutations,
} from "./syncEngine";
import type { Wallet, Transaction } from "./types";
import {
  getSavedUsdtPref,
  saveUsdtPref,
  getSavedHoldings,
  saveHoldings,
} from "./marketPriceService";

export interface MigrationResult {
  walletsMigrated: number;
  transactionsMigrated: number;
}

/**
 * Automatically transfers offline local guest ledger records (wallets, transactions)
 * to the authenticated Supabase user upon connecting an email/Google account.
 */
export async function migrateGuestDataToCloud(userId: string): Promise<MigrationResult> {
  if (!userId || userId === "guest_local_user") {
    return { walletsMigrated: 0, transactionsMigrated: 0 };
  }

  const migrationKey = `trouvaille_migrated_guest_${userId}`;
  if (localStorage.getItem(migrationKey) === "true" || !hasGuestData()) {
    localStorage.setItem(migrationKey, "true");
    return { walletsMigrated: 0, transactionsMigrated: 0 };
  }

  let walletsMigrated = 0;
  let transactionsMigrated = 0;

  try {
    // 1. Wallets Migration: If cloud account has 0 wallets, migrate local guest wallets
    const cachedWalletsRaw = localStorage.getItem(WALLETS_BACKUP_STORAGE_KEY);
    if (cachedWalletsRaw) {
      try {
        const cachedWallets: Wallet[] = JSON.parse(cachedWalletsRaw);
        if (Array.isArray(cachedWallets) && cachedWallets.length > 0) {
          const { data: cloudWallets } = await supabase
            .from("wallets")
            .select("id")
            .eq("user_id", userId)
            .limit(1);

          if (!cloudWallets || cloudWallets.length === 0) {
            const walletsToInsert = cachedWallets.map((w) => ({
              id: w.id && !w.id.startsWith("fallback-") && !w.id.startsWith("wallet-onboard-")
                ? w.id
                : generateUUID(),
              name: w.name,
              icon: w.icon || "Wallet",
              user_id: userId,
            }));

            const { error: wErr } = await supabase.from("wallets").insert(walletsToInsert);
            if (!wErr) {
              walletsMigrated = walletsToInsert.length;
            } else {
              console.warn("[migrateGuestDataToCloud] Failed inserting wallets:", wErr);
            }
          }
        }
      } catch (wParseErr) {
        console.warn("[migrateGuestDataToCloud] Failed parsing cached wallets:", wParseErr);
      }
    }

    // 2. Transactions Migration: Gather all local transactions
    const cachedTxRaw = localStorage.getItem(TX_BACKUP_STORAGE_KEY);
    const existingMutations = getPendingMutations();
    const allPendingTxMap = new Map<string, any>();

    // Include existing pending mutations re-assigned to current user
    for (const m of existingMutations) {
      if (m.payload && m.payload.id) {
        allPendingTxMap.set(m.payload.id, { ...m.payload, user_id: userId });
      }
    }

    // Include any offline backup transactions
    if (cachedTxRaw) {
      try {
        const cachedTxs: Transaction[] = JSON.parse(cachedTxRaw);
        if (Array.isArray(cachedTxs)) {
          for (const tx of cachedTxs) {
            if (tx.id && !allPendingTxMap.has(tx.id)) {
              allPendingTxMap.set(tx.id, { ...tx, user_id: userId });
            }
          }
        }
      } catch (txParseErr) {
        console.warn("[migrateGuestDataToCloud] Failed parsing cached txs:", txParseErr);
      }
    }

    if (allPendingTxMap.size > 0) {
      const nextMutations = Array.from(allPendingTxMap.values()).map((txPayload) => ({
        id: `migrated-${txPayload.id}`,
        type: "insert" as const,
        entity: "transaction" as const,
        payload: { ...txPayload, user_id: userId },
        timestamp: new Date().toISOString(),
        retryCount: 0,
      }));

      savePendingMutations(nextMutations);
      transactionsMigrated = nextMutations.length;

      // Flush to Supabase
      await flushPendingMutations({ force: true });
    }

    // 3. Migrate USDT & Investment Holdings to Cloud User
    try {
      const guestUsdt = getSavedUsdtPref("guest_local_user");
      if (guestUsdt && guestUsdt.units > 0) {
        saveUsdtPref(guestUsdt, userId);
      }
      const guestHoldings = getSavedHoldings("guest_local_user");
      if (guestHoldings && guestHoldings.length > 0) {
        saveHoldings(guestHoldings, userId);
      }
    } catch (assetMigErr) {
      console.warn("[migrateGuestDataToCloud] Asset migration notice:", assetMigErr);
    }

    // Mark migration as completed for this user
    localStorage.setItem(migrationKey, "true");
    localStorage.removeItem("trouvaille_guest_mode");
    localStorage.removeItem("trouvaille_holdings_guest_local_user");
    localStorage.removeItem("trouvaille_usdt_pref_guest_local_user");
  } catch (err) {
    console.error("[migrateGuestDataToCloud] Migration process failed:", err);
  }

  return { walletsMigrated, transactionsMigrated };
}

/**
 * Checks whether unmigrated guest records (transactions, wallets, holdings) exist locally.
 */
export function hasGuestData(): boolean {
  try {
    const cachedTxRaw = localStorage.getItem(TX_BACKUP_STORAGE_KEY);
    if (cachedTxRaw) {
      const parsed = JSON.parse(cachedTxRaw);
      if (Array.isArray(parsed) && parsed.length > 0) return true;
    }

    const mutations = getPendingMutations();
    if (mutations.some((m) => m.payload?.user_id === "guest_local_user" || !m.payload?.user_id)) {
      return true;
    }

    const guestUsdt = getSavedUsdtPref("guest_local_user");
    if (guestUsdt && guestUsdt.units > 0) return true;

    const guestHoldings = getSavedHoldings("guest_local_user");
    if (guestHoldings && guestHoldings.length > 0) return true;

    const wasGuestMode = localStorage.getItem("trouvaille_guest_mode") === "true";
    const cachedWalletsRaw = localStorage.getItem(WALLETS_BACKUP_STORAGE_KEY);
    if (wasGuestMode && cachedWalletsRaw) {
      const parsedWallets = JSON.parse(cachedWalletsRaw);
      if (Array.isArray(parsedWallets) && parsedWallets.length > 0) return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Safely discards local guest ledger data when a user decides to start fresh with their authenticated account.
 */
export function discardGuestData(userId?: string): void {
  try {
    localStorage.removeItem(TX_BACKUP_STORAGE_KEY);
    localStorage.removeItem("trouvaille_holdings_guest_local_user");
    localStorage.removeItem("trouvaille_usdt_pref_guest_local_user");
    localStorage.removeItem("trouvaille_guest_mode");

    // Clean mutations originating from guest
    const remainingMutations = getPendingMutations().filter(
      (m) => m.payload?.user_id && m.payload.user_id !== "guest_local_user",
    );
    savePendingMutations(remainingMutations);

    if (userId) {
      localStorage.setItem(`trouvaille_migrated_guest_${userId}`, "true");
    }
  } catch (err) {
    console.warn("[discardGuestData] Error clearing guest data:", err);
  }
}

