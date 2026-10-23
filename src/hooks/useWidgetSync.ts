// ======================================================================
// ACCRUAL WIDGET SYNCHRONIZATION HOOK
// Strictly compliant with GEMINI.md:
// - Rule 1: No native colored emojis
// - Rule 2: Monochrome Apple Luxury Theme System
// - Rule 4: Graceful offline & local fallback resilience
// - Rule 6: 100% pure localization
// ======================================================================

import { useEffect, useRef, useCallback } from "react";
import { App as CapApp } from "@capacitor/app";
import { useWalletBalances } from "./useWalletBalances";
import { useAllTransactions, useAddTransaction } from "./useTransactions";
import { useCategories } from "./useCategories";
import { useWallets } from "./useWallets";
import { usePrivacy } from "../contexts/PrivacyContext";
import { useCurrency } from "../contexts/CurrencyContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useToast } from "../contexts/ToastContext";
import { triggerSuccessHaptic } from "../lib/haptics";
import {
  widgetSyncService,
  type WidgetSnapshotPayload,
} from "../lib/widgetSyncService";

export function useWidgetSync() {
  const { netWorth, liquidAssets } = useWalletBalances();
  const { data: allTxs = [] } = useAllTransactions();
  const { data: categories = [] } = useCategories();
  const { data: wallets = [] } = useWallets();
  const { isStealthMode } = usePrivacy();
  const { formatWithPreferred, currencyMeta } = useCurrency();
  const { isIndonesian } = useLanguage();
  const { showToast } = useToast();
  const addTransactionMutation = useAddTransaction();

  const isIngestingRef = useRef(false);

  // 1. Synchronize real-time snapshot to iOS App Group (WidgetKit)
  useEffect(() => {
    // Calculate 24h change
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    let delta24h = 0;
    for (const tx of allTxs) {
      const rawDate = tx.occurred_on || tx.created_at || "";
      const txTime = rawDate ? new Date(rawDate).getTime() : now;
      if (txTime >= oneDayAgo) {
        if (tx.type === "expense") delta24h -= tx.amount;
        else if (tx.type === "income") delta24h += tx.amount;
      }
    }

    const previousNetWorth = netWorth - delta24h;
    const change24hPercentage =
      previousNetWorth > 0
        ? Number(((delta24h / previousNetWorth) * 100).toFixed(1))
        : 0;

    const isPositive24h = delta24h >= 0;
    const change24hFormatted = `${isPositive24h ? "+" : ""}${change24hPercentage}%`;

    const totalDebts = Math.max(0, liquidAssets - netWorth);

    const sparkline = widgetSyncService.generate7DaySparkline(allTxs, netWorth);

    const snapshot: WidgetSnapshotPayload = {
      netWorthFormatted: formatWithPreferred(netWorth),
      netWorthRaw: netWorth,
      currencySymbol: currencyMeta?.symbol || "Rp",
      change24hPercentage,
      change24hFormatted,
      isPositive24h,
      totalAssetsFormatted: formatWithPreferred(liquidAssets),
      totalDebtsFormatted: formatWithPreferred(totalDebts),
      isPrivacyMode: isStealthMode,
      lastUpdated: new Date().toISOString(),
      sparkline,
    };

    widgetSyncService.syncSnapshot(snapshot).catch(() => {});
  }, [
    netWorth,
    liquidAssets,
    allTxs,
    isStealthMode,
    formatWithPreferred,
    currencyMeta,
  ]);

  // 2. Ingest offline Siri / Back Tap transactions from App Group queue
  const processPendingAppIntents = useCallback(async () => {
    if (isIngestingRef.current) return;
    isIngestingRef.current = true;

    try {
      const { transactions } = await widgetSyncService.retrievePendingIngestion();

      let ingestedCount = 0;

      // Process structured quick-log transactions
      if (transactions.length > 0) {
        for (const tx of transactions) {
          try {
            // Match category name or fallback to first available
            const matchedCat = categories.find(
              (c) => c.name.toLowerCase() === tx.category.toLowerCase()
            );
            const categoryId = matchedCat?.id || categories[0]?.id || null;

            // Match wallet name or fallback to first available
            const matchedWallet = wallets.find(
              (w) => w.name.toLowerCase() === tx.wallet.toLowerCase()
            );
            const walletId = matchedWallet?.id || wallets[0]?.id || null;

            await addTransactionMutation.mutateAsync({
              amount: tx.amount,
              category_id: categoryId,
              wallet_id: walletId,
              occurred_on: tx.date || new Date().toISOString(),
              note:
                tx.note ||
                (isIndonesian
                  ? "Pencatatan Siri / Ketukan Belakang"
                  : "Siri / Back Tap Quick Log"),
              type: "expense",
            });
            ingestedCount++;
          } catch (e) {
            console.warn("[useWidgetSync] Failed to insert pending tx:", e);
          }
        }
      }

      if (ingestedCount > 0) {
        await widgetSyncService.clearPendingIngestion();
        triggerSuccessHaptic();
        showToast(
          isIndonesian
            ? `${ingestedCount} transaksi dari Pintasan/Siri berhasil dicatat`
            : `${ingestedCount} shortcut/Siri transactions synced successfully`,
          "add"
        );
      }
    } catch (err) {
      console.warn("[useWidgetSync] processPendingAppIntents error:", err);
    } finally {
      isIngestingRef.current = false;
    }
  }, [
    addTransactionMutation,
    categories,
    wallets,
    isIndonesian,
    showToast,
  ]);

  // 3. Trigger ingestion on initial mount and whenever app resumes to foreground
  useEffect(() => {
    processPendingAppIntents();

    let listenerHandle: { remove: () => void } | null = null;
    CapApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        processPendingAppIntents();
      }
    })
      .then((handle) => {
        listenerHandle = handle;
      })
      .catch(() => {});

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, [processPendingAppIntents]);
}
