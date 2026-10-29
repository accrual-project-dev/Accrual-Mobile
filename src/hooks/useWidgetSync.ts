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
import { useAllTransactions } from "./useTransactions";
import { useWallets } from "./useWallets";
import { useBudgetTarget } from "./useBudgetTarget";
import { usePrivacy } from "../contexts/PrivacyContext";
import { useCurrency } from "../contexts/CurrencyContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useTheme } from "../contexts/ThemeContext";
import { useToast } from "../contexts/ToastContext";
import { getAllDraftItems } from "../lib/draftTransactionService";
import { useAuth } from "../contexts/AuthContext";
import { useSecurityLock } from "../contexts/SecurityLockContext";
import {
  widgetSyncService,
  type WidgetSnapshotPayload,
} from "../lib/widgetSyncService";

export function useWidgetSync() {
  const {
    netWorth,
    liquidAssets,
    investmentAssets = 0,
    fixedAssets = 0,
    liabilities = 0,
    totalAssets = 0,
  } = useWalletBalances();
  const { data: allTxs = [], isLoading: isTxsLoading } = useAllTransactions();
  const { data: wallets = [], isLoading: isWalletsLoading } = useWallets();
  const { isStealthMode } = usePrivacy();
  const { formatWithPreferred, currencyMeta } = useCurrency();
  const { budgetTarget } = useBudgetTarget();
  const { isIndonesian } = useLanguage();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { isLocked } = useSecurityLock();

  const isNavigatingRef = useRef(false);
  const inboxReadyRef = useRef(false);
  const warnedLegacyOwnerRef = useRef<string | null>(null);
  const sessionRef = useRef({ userId: user?.id, isLocked });
  sessionRef.current = { userId: user?.id, isLocked };

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

    const totalDebts = liabilities;
    const grossAssets = totalAssets > 0 ? totalAssets : (netWorth + totalDebts);
    const debtRatio = grossAssets > 0 ? Number(((totalDebts / grossAssets) * 100).toFixed(1)) : 0;
    const solvencyScore = Math.max(0, Math.min(100, Math.round(100 - debtRatio)));
    const liquidPct = grossAssets > 0 ? Math.round((liquidAssets / grossAssets) * 100) : 100;
    const growthPct = grossAssets > 0 ? Math.round((investmentAssets / grossAssets) * 100) : 0;
    const fixedPct = grossAssets > 0 ? Math.max(0, 100 - liquidPct - growthPct) : 0;

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

    // Safe to Spend metrics
    const nowDate = new Date();
    const daysInMonth = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0).getDate();
    const daysLeftInMonth = Math.max(1, daysInMonth - nowDate.getDate());
    const activeBudget = budgetTarget > 0 ? budgetTarget : Math.max(5000000, monthlyInflow > 0 ? monthlyInflow : 10000000);
    const safeToSpendRemaining = Math.max(0, activeBudget - monthlyOutflow);
    const safeToSpendDaily = Math.round(safeToSpendRemaining / daysLeftInMonth);
    const safeToSpendPercent = Math.min(100, Math.round((monthlyOutflow / activeBudget) * 100));

    // Cashflow Delta vs Last Month
    const prevMonth = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1);
    const prevMonthPrefix = prevMonth.toISOString().slice(0, 7);
    let prevInflow = 0;
    let prevOutflow = 0;
    for (const tx of allTxs) {
      const raw = tx.occurred_on || tx.created_at || "";
      if (raw.startsWith(prevMonthPrefix)) {
        if (tx.type === "income") prevInflow += tx.amount;
        else if (tx.type === "expense") prevOutflow += tx.amount;
      }
    }
    const prevNet = prevInflow - prevOutflow;
    const deltaVsPrev = prevNet !== 0 ? Math.round(((netCashflow - prevNet) / Math.abs(prevNet)) * 100) : 0;
    const cashflowDeltaVsLastMonth = `${deltaVsPrev >= 0 ? "+" : ""}${deltaVsPrev}%`;
    const monthShortName = nowDate.toLocaleDateString(isIndonesian ? "id-ID" : "en-US", { month: "short" }).toUpperCase();

    // Liquid cash sparkline (7-day trend using genuine liquid cash)
    const liquidCashSparkline = widgetSyncService.generate7DaySparkline(allTxs, liquidAssets);
    const liquidCashChangeFormatted = `${change24hPercentage >= 0 ? "+" : ""}${change24hPercentage}%`;

    const snapshot: WidgetSnapshotPayload = {
      netWorthFormatted: formatWithPreferred(netWorth),
      netWorthRaw: netWorth,
      currencySymbol: currencyMeta?.symbol || "Rp",
      change24hPercentage,
      change24hFormatted,
      isPositive24h,
      totalAssetsFormatted: formatWithPreferred(grossAssets),
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
      growthPct,
      fixedPct,
      grossAssetsFormatted: formatWithPreferred(grossAssets),
      liabilitiesFormatted: formatWithPreferred(totalDebts),
      netEquityFormatted: formatWithPreferred(netWorth),
      spendingVolatilityStatus,
      dailyAverageFormatted: `${formatWithPreferred(Math.round(dailyBurn))}${isIndonesian ? "/hr" : "/d"}`,
      volatilityVariance,

      // Foto 1, 2, 3 Widget Modernization Suite
      liquidCashFormatted: formatWithPreferred(liquidAssets),
      liquidCashRaw: liquidAssets,
      liquidCashChangeFormatted,
      liquidCashSparkline,
      safeToSpendDailyFormatted: `${formatWithPreferred(safeToSpendDaily)}${isIndonesian ? "/hr" : "/day"}`,
      safeToSpendRemainingFormatted: formatWithPreferred(safeToSpendRemaining),
      safeToSpendBudgetFormatted: formatWithPreferred(activeBudget),
      safeToSpendPercent,
      daysLeftInMonth,
      cashflowDeltaVsLastMonth,
      monthShortName,
    };

    widgetSyncService.syncSnapshot(snapshot).catch(() => {});
  }, [
    netWorth,
    liquidAssets,
    investmentAssets,
    fixedAssets,
    liabilities,
    totalAssets,
    allTxs,
    wallets,
    budgetTarget,
    isWalletsLoading,
    isTxsLoading,
    isStealthMode,
    isIndonesian,
    theme,
    formatWithPreferred,
    currencyMeta,
  ]);

  // Monetary captures use the owner-scoped inbox. This bridge handles navigation only.
  const processPendingNavigation = useCallback(async () => {
    if (!user?.id || isLocked || document.hidden || isNavigatingRef.current) return;
    const userId = user.id;
    const sessionIsCurrent = () => sessionRef.current.userId === userId && !sessionRef.current.isLocked;
    isNavigatingRef.current = true;
    try {
      const { transactions, voiceLogs, navigation } = await widgetSyncService.retrievePendingIngestion();
      if (!sessionIsCurrent()) return;
      if ((transactions.length || voiceLogs.length) && warnedLegacyOwnerRef.current !== userId) {
        warnedLegacyOwnerRef.current = userId;
        showToast(
          isIndonesian
            ? "Tangkapan lama ditahan karena sesi asal tidak diketahui."
            : "Older captures are held because their original session is unknown.",
          "info",
        );
      }
      if (!navigation) return;
      if ((navigation === "review" || navigation === "inbox") && !inboxReadyRef.current) return;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (!sessionIsCurrent() || document.hidden) return;
      if (navigation === "add") {
        window.dispatchEvent(new CustomEvent("trouvaille:open-quick-add"));
      } else if (navigation === "scan") {
        window.dispatchEvent(new CustomEvent("trouvaille:open-scanner"));
      } else if (navigation === "voice") {
        window.dispatchEvent(new CustomEvent("trouvaille:open-voice"));
      } else if (navigation === "review" || navigation === "inbox") {
        window.dispatchEvent(new CustomEvent("trouvaille:open-draft-review", {
          detail: { items: getAllDraftItems(), title: isIndonesian ? "Tangkapan" : "Captures" },
        }));
      } else return;
      // Legacy ownerless money queues remain untouched, including when navigation succeeds.
      await widgetSyncService.clearPendingIngestion({ navigation });
    } catch (error) {
      console.warn("[useWidgetSync] Pending navigation failed:", error);
    } finally {
      isNavigatingRef.current = false;
    }
  }, [user?.id, isLocked, isIndonesian, showToast]);

  useEffect(() => {
    inboxReadyRef.current = false;
    if (!user?.id) warnedLegacyOwnerRef.current = null;
  }, [user?.id, isLocked]);

  useEffect(() => {
    const onInboxDrained = (event: Event) => {
      const { userId } = (event as CustomEvent<{ userId?: string }>).detail || {};
      if (!userId || sessionRef.current.userId !== userId || sessionRef.current.isLocked) return;
      inboxReadyRef.current = true;
      void processPendingNavigation();
    };
    window.addEventListener("accrual:inbox-drained", onInboxDrained);
    void processPendingNavigation();
    let disposed = false;
    let listenerHandle: { remove: () => Promise<void> } | undefined;
    void CapApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        inboxReadyRef.current = false;
        void processPendingNavigation();
      }
    }).then((handle) => {
      if (disposed) void handle.remove();
      else listenerHandle = handle;
    }).catch(() => {});
    return () => {
      disposed = true;
      window.removeEventListener("accrual:inbox-drained", onInboxDrained);
      void listenerHandle?.remove();
    };
  }, [processPendingNavigation]);
}
