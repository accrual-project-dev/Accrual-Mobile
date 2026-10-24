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
import { useTheme } from "../contexts/ThemeContext";
import { useToast } from "../contexts/ToastContext";
import { triggerSuccessHaptic } from "../lib/haptics";
import {
  widgetSyncService,
  type WidgetSnapshotPayload,
} from "../lib/widgetSyncService";

export function useWidgetSync() {
  const { netWorth, liquidAssets } = useWalletBalances();
  const { data: allTxs = [], isLoading: isTxsLoading } = useAllTransactions();
  const { data: categories = [] } = useCategories();
  const { data: wallets = [], isLoading: isWalletsLoading } = useWallets();
  const { isStealthMode } = usePrivacy();
  const { formatWithPreferred, currencyMeta } = useCurrency();
  const { isIndonesian } = useLanguage();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const addTransactionMutation = useAddTransaction();

  const isIngestingRef = useRef(false);

  // 1. Synchronize real-time snapshot to iOS App Group (WidgetKit)
  useEffect(() => {
    // Avoid pushing an empty state during cold boot before cache/network resolves
    if ((isWalletsLoading || isTxsLoading) && wallets.length === 0 && allTxs.length === 0) {
      return;
    }

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
    const grossAssets = netWorth + totalDebts;
    const debtRatio = grossAssets > 0 ? Number(((totalDebts / grossAssets) * 100).toFixed(1)) : 0;
    const solvencyScore = Math.max(0, Math.round(100 - debtRatio));
    const liquidPct = grossAssets > 0 ? Number(((liquidAssets / grossAssets) * 100).toFixed(1)) : 100;

    // Monthly Inflow & Outflow calculation
    const currentMonthPrefix = new Date().toISOString().slice(0, 7);
    let monthlyInflow = 0;
    let monthlyOutflow = 0;

    for (const tx of allTxs) {
      const rawDate = tx.occurred_on || tx.created_at || "";
      if (rawDate.startsWith(currentMonthPrefix)) {
        if (tx.type === "income") monthlyInflow += tx.amount;
        else if (tx.type === "expense") monthlyOutflow += tx.amount;
      }
    }

    const netCashflow = monthlyInflow - monthlyOutflow;
    const monthlySavings = Math.max(0, netCashflow);
    const savingsRate = monthlyInflow > 0 ? Math.round((monthlySavings / monthlyInflow) * 100) : 0;
    const savingsTarget = 40;

    // Runway and Daily Burn
    const currentDay = Math.max(1, new Date().getDate());
    const dailyBurn = monthlyOutflow / currentDay;
    const monthlyBurn = dailyBurn * 30;
    const runwayMonths = monthlyBurn > 0 ? Number((liquidAssets / monthlyBurn).toFixed(1)) : 12.0;

    // Capital Health Score calculation (0 - 100)
    const cashflowScore = netCashflow >= 0 ? 35 : Math.max(10, Math.round(35 * (1 + netCashflow / Math.max(1, monthlyInflow))));
    const runwayScore = runwayMonths >= 6 ? 35 : Math.round((runwayMonths / 6) * 35);
    const savingsScore = Math.min(30, Math.round((savingsRate / savingsTarget) * 30));
    const capitalHealthScore = Math.min(100, Math.max(20, cashflowScore + runwayScore + savingsScore));
    const capitalHealthTier =
      capitalHealthScore >= 80
        ? isIndonesian ? "Prima" : "Optimal"
        : capitalHealthScore >= 60
          ? isIndonesian ? "Baik" : "Good"
          : isIndonesian ? "Cukup" : "Fair";

    // 28-day Activity Heatmap
    const heatmapDots: { intensity: number; hasSpend: boolean }[] = [];
    const daySpends: number[] = [];

    for (let i = 27; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const isoPrefix = d.toISOString().slice(0, 10);

      const dayTotal = allTxs
        .filter((tx) => {
          const rawDate = tx.occurred_on || tx.created_at || "";
          return rawDate.slice(0, 10) === isoPrefix && tx.type === "expense";
        })
        .reduce((sum, tx) => sum + tx.amount, 0);

      daySpends.push(dayTotal);
    }

    const peakSpend = Math.max(...daySpends, 1);
    for (const spend of daySpends) {
      heatmapDots.push({
        intensity: spend > 0 ? Number((spend / peakSpend).toFixed(2)) : 0,
        hasSpend: spend > 0,
      });
    }

    const activeDaysCount = heatmapDots.filter((d) => d.hasSpend).length;

    // Cashflow Bar Ticks (Last 12 relative activity points)
    const cashflowBars: number[] = [];
    for (let i = 11; i >= 0; i--) {
      const spend = daySpends[27 - i] || 0;
      cashflowBars.push(Math.round((spend / peakSpend) * 100));
    }

    // Spending Volatility
    const activeSpends = daySpends.filter((s) => s > 0);
    let volatilityVariance = 14;
    if (activeSpends.length > 2) {
      const mean = activeSpends.reduce((a, b) => a + b, 0) / activeSpends.length;
      const varianceSum = activeSpends.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / activeSpends.length;
      const stdDev = Math.sqrt(varianceSum);
      volatilityVariance = Math.min(95, Math.max(8, Math.round((stdDev / Math.max(1, mean)) * 100)));
    }

    const spendingVolatilityStatus =
      volatilityVariance <= 25
        ? isIndonesian ? "Stabil" : "Stable"
        : volatilityVariance <= 55
          ? isIndonesian ? "Moderat" : "Moderate"
          : isIndonesian ? "Volatil" : "Volatile";

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
      isIndonesian,
      theme,
      lastUpdated: new Date().toISOString(),
      sparkline,

      // Expanded Data
      savingsRate,
      savingsTarget,
      monthlySavingsFormatted: formatWithPreferred(monthlySavings),
      runwayMonths,
      dailyBurnFormatted: formatWithPreferred(Math.round(dailyBurn)),
      monthlyInflowFormatted: formatWithPreferred(monthlyInflow),
      monthlyOutflowFormatted: formatWithPreferred(monthlyOutflow),
      netCashflowFormatted: `${netCashflow >= 0 ? "+" : ""}${formatWithPreferred(netCashflow)}`,
      cashflowBars,
      capitalHealthScore,
      capitalHealthTier,
      heatmapDots,
      activeDaysCount,
      solvencyScore,
      debtRatio,
      liquidPct,
      growthPct: 0,
      fixedPct: 0,
      grossAssetsFormatted: formatWithPreferred(grossAssets),
      liabilitiesFormatted: formatWithPreferred(totalDebts),
      netEquityFormatted: formatWithPreferred(netWorth),
      spendingVolatilityStatus,
      dailyAverageFormatted: `${formatWithPreferred(Math.round(dailyBurn))}${isIndonesian ? "/hr" : "/d"}`,
      volatilityVariance,
    };

    widgetSyncService.syncSnapshot(snapshot).catch(() => {});
  }, [
    netWorth,
    liquidAssets,
    allTxs,
    wallets,
    isWalletsLoading,
    isTxsLoading,
    isStealthMode,
    isIndonesian,
    theme,
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
