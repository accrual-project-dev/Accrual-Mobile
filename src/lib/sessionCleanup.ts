// ======================================================================
// TROUVAILLE SESSION CLEANUP & TEARDOWN PIPELINE
// Purges all cached session data, local storage snapshots, IndexedDB vaults,
// pending mutations, and React Query caches to prevent cross-session leakage.
// ======================================================================

import type { QueryClient } from "@tanstack/react-query";
import { clearLocalTransactionsCache } from "../hooks/useTransactions";
import { clearAllVaultItems } from "./indexedDbStorage";
import {
  clearPersistentSession,
  clearBiometricLoginCredentials,
} from "./biometricAuth";
import { clearMerchantMemory } from "./merchantCategoryMemory";

export interface SessionCleanupOptions {
  /** If true, preserves 'trouvaille_guest_mode' flag so user stays in guest state */
  preserveGuestFlag?: boolean;
}

/**
 * Standard list of local storage keys holding user-scoped, offline or financial state.
 */
export const USER_SESSION_STORAGE_KEYS = [
  "TROUVAILLE_OFFLINE_CACHE_V1",
  "TROUVAILLE_TX_BACKUP_V1",
  "TROUVAILLE_WALLETS_BACKUP_V1",
  "TROUVAILLE_CATEGORIES_BACKUP_V1",
  "TROUVAILLE_PENDING_MUTATIONS_V2",
  "trouvaille_shortcuts",
  "trouvaille_linked_web_sessions",
  "trouvaille_merchant_category_memory",
  "trouvaille_draft_transactions",
  "trouvaille_financial_goals_v2",
  "trouvaille_onboarded",
  "trouvaille_user_name",
  "trouvaille_preset_mode",
  "trouvaille_onboarding_focus",
  "trouvaille_active_space_id",
  "trouvaille_spaces_cache",
  "trouvaille_ledgers_v1",
  "trouvaille_default_ledger_id",
  "trouvaille_custom_spaces_v1",
  "trouvaille_personal_ledger_override_v1",
  "trouvaille_selected_ledger_account_id",
  "trouvaille_wallet_classifications_v1",
  "trouvaille_streak_reminder_enabled",
  "trouvaille_streak_reminder_hour",
  "trouvaille_sync_initial_done",
  "trouvaille_holdings_v1",
  "trouvaille_holdings_guest_v1",
  "trouvaille_holdings_state_v1",
  "trouvaille_active_holding_id",
  "trouvaille_staking_records_v1",
  "trouvaille_wallets_backup_guest",
  "trouvaille_tx_backup_guest",
  "trouvaille_categories_backup_guest",
  "trouvaille_usdt_valuation_guest_v1",
  "trouvaille_usdt_valuation_v1",
  "trouvaille_usdt_valuation_v2",
  "trouvaille_market_quotes_cache_v2",
  "trouvaille_debt_receivables_v1",
  "trouvaille_debt_receivables_guest_v1",
  "trouvaille_budget_target",
  "trouvaille_budget_period_start",
  "accrual_subscription_state_v1",
] as const;

const PRESERVED_SETTINGS_KEYS = new Set([
  "trouvaille_theme",
  "trouvaille_language",
  "trouvaille_currency",
  "trouvaille_app_currency",
  "trouvaille_privacy_stealth",
  "trouvaille_stealth_mode",
  "trouvaille_haptics_enabled",
]);

/**
 * Completely purges all local state, offline caches, IndexedDB snapshots,
 * and memory representations to guarantee 100% data isolation between sessions.
 */
export async function clearAllLocalUserSessionData(
  queryClient?: QueryClient | null,
  options?: SessionCleanupOptions,
): Promise<void> {
  // 1. Cancel in-flight background requests and clear TanStack QueryCache
  if (queryClient) {
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
    } catch (qcErr) {
      console.warn("[SessionCleanup] QueryClient clear warning:", qcErr);
    }
  }

  // 2. Wipe explicit session and financial storage keys
  const storage =
    typeof window !== "undefined" && window.localStorage
      ? window.localStorage
      : typeof globalThis !== "undefined" && (globalThis as any).localStorage
        ? (globalThis as any).localStorage
        : null;

  if (storage) {
    for (const key of USER_SESSION_STORAGE_KEYS) {
      try {
        storage.removeItem(key);
      } catch {}
    }

    if (!options?.preserveGuestFlag) {
      try {
        storage.removeItem("trouvaille_guest_mode");
      } catch {}
    }

    // 3. Scan and wipe any dynamic user/guest tenant keys
    try {
      const keysToRemove: string[] = [];
      const len = storage.length ?? 0;
      for (let i = 0; i < len; i++) {
        const k = storage.key(i);
        if (!k) continue;
        if (options?.preserveGuestFlag && k === "trouvaille_guest_mode") continue;
        if (PRESERVED_SETTINGS_KEYS.has(k)) continue;

        if (
          k.startsWith("trouvaille_migrated_guest_") ||
          k.startsWith("trouvaille:usr_") ||
          k.startsWith("trouvaille:guest_") ||
          k.startsWith("trouvaille_holdings_") ||
          k.startsWith("trouvaille_usdt_") ||
          k.startsWith("trouvaille_market_quotes_") ||
          k.startsWith("trouvaille_custom_category_") ||
          k.startsWith("trouvaille_personal_") ||
          k.startsWith("trouvaille_wallets_") ||
          k.startsWith("trouvaille_transactions_") ||
          k.startsWith("trouvaille_categories_") ||
          k.startsWith("trouvaille_debt_receivables_") ||
          k.startsWith("trouvaille_") ||
          k.startsWith("accrual_") ||
          k.startsWith("accrual:")
        ) {
          keysToRemove.push(k);
        }
      }
      for (const k of keysToRemove) {
        storage.removeItem(k);
      }
    } catch {}
  }

  // 4. Clear in-memory transaction snapshots & offline transaction files
  try {
    await clearLocalTransactionsCache();
  } catch (txErr) {
    console.warn("[SessionCleanup] clearLocalTransactionsCache warning:", txErr);
  }

  // 5. Clear IndexedDB snapshot vault
  try {
    await clearAllVaultItems();
  } catch (idbErr) {
    console.warn("[SessionCleanup] clearAllVaultItems warning:", idbErr);
  }

  // 6. Clear merchant category memory and in-memory caches
  try {
    clearMerchantMemory();
  } catch (memErr) {
    console.warn("[SessionCleanup] clearMerchantMemory warning:", memErr);
  }

  // 7. Clear biometric login tokens and session vaults
  try {
    clearPersistentSession();
    clearBiometricLoginCredentials();
  } catch (bioErr) {
    console.warn("[SessionCleanup] Biometric teardown warning:", bioErr);
  }

  // 8. Terminate background WebAssembly OCR workers to release memory (dynamically imported to avoid bundle leakage)
  try {
    const ocrModule = await import("./ocrEngine");
    if (typeof ocrModule.terminateOCRWorker === "function") {
      await ocrModule.terminateOCRWorker();
    }
  } catch (ocrErr) {
    console.warn("[SessionCleanup] terminateOCRWorker warning:", ocrErr);
  }

  // 9. Notify mounted React Contexts (e.g. SpaceProvider) to purge in-memory state immediately
  try {
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new CustomEvent("trouvaille_session_teardown"));
    }
  } catch {}
}

