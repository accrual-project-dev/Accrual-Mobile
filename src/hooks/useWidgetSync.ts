import { useEffect, useRef, useCallback, useMemo } from "react";
import { App as CapApp } from "@capacitor/app";
import { useWalletBalances } from "./useWalletBalances";
import { useAllTransactions, useAddTransaction } from "./useTransactions";
import { useCategories } from "./useCategories";
import { useWallets } from "./useWallets";
import { useBills } from "./useBills";
import { useBudgetTarget } from "./useBudgetTarget";
import { useSpace } from "../contexts/SpaceContext";
import { usePrivacy } from "../contexts/PrivacyContext";
import { useCurrency } from "../contexts/CurrencyContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useTheme } from "../contexts/ThemeContext";
import { useToast } from "../contexts/ToastContext";
import { triggerSuccessHaptic } from "../lib/haptics";
import { parseNaturalTransaction } from "../lib/nlpParser";
import { parseBankNotification, isPromotionalOrSpamNotification } from "../lib/bankNotificationParser";
import { parseSlipText } from "../lib/slipParser";
import {
  isMultiTransactionHistoryText,
  parseScreenshotHistory,
} from "../lib/screenshotHistoryParser";
import {
  saveDraftBatch,
  getAllDraftItems,
  useDraftTransactions,
} from "../lib/draftTransactionService";
import { isCorrectionTx, isOpeningBalanceTx } from "../lib/financialMath";
import type { ParsedStatementItem } from "../lib/statementParser";
import { format, differenceInCalendarDays, parseISO, isValid } from "date-fns";
import {
  widgetSyncService,
  type WidgetSnapshotPayload,
  type WidgetCategorySlice,
  type WidgetBillItem,
} from "../lib/widgetSyncService";

export function useWidgetSync() {
  const {
    netWorth,
    liquidAssets,
    investmentAssets = 0,
    liabilities = 0,
    totalAssets = 0,
  } = useWalletBalances();
  const { data: rawAllTxs = [], isLoading: isTxsLoading } = useAllTransactions();
  const { data: categories = [] } = useCategories();
  const { data: wallets = [], isLoading: isWalletsLoading } = useWallets();
  const { data: bills = [] } = useBills();
  const { activeSpaceId, activeSpace, filterTransactionsBySpace } = useSpace();
  const { count: reactiveDraftCount } = useDraftTransactions(
    activeSpaceId !== "all" ? activeSpaceId : undefined
  );
  const { isStealthMode } = usePrivacy();
  const { formatWithPreferred, currencyMeta } = useCurrency();
  const { budgetTarget } = useBudgetTarget();
  const { isIndonesian } = useLanguage();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const addTransactionMutation = useAddTransaction();

  const isIngestingRef = useRef(false);

  const allTxs = useMemo(
    () => filterTransactionsBySpace(rawAllTxs, activeSpaceId),
    [rawAllTxs, activeSpaceId, filterTransactionsBySpace]
  );

  useEffect(() => {
    if ((isWalletsLoading || isTxsLoading) && wallets.length === 0 && allTxs.length === 0) {
      return;
    }

    const mask = (text: string) => (isStealthMode ? "••••••••" : text);
    const nowDate = new Date();
    const nowMs = nowDate.getTime();
    const oneDayAgoMs = nowMs - 24 * 60 * 60 * 1000;
    const todayIso = format(nowDate, "yyyy-MM-dd");

    let delta24h = 0;
    let spentToday = 0;
    for (const tx of allTxs) {
      if (isCorrectionTx(tx) || isOpeningBalanceTx(tx)) continue;
      const rawDate = tx.occurred_on || tx.created_at || "";
      const txTime = rawDate ? new Date(rawDate).getTime() : nowMs;
      if (txTime >= oneDayAgoMs) {
        if (tx.type === "expense") delta24h -= Number(tx.amount || 0);
        else if (tx.type === "income") delta24h += Number(tx.amount || 0);
      }
      if (rawDate.slice(0, 10) === todayIso && tx.type === "expense") {
        spentToday += Number(tx.amount || 0);
      }
    }

    const previousNetWorth = netWorth - delta24h;
    const change24hPercentage =
      previousNetWorth > 0 ? Number(((delta24h / previousNetWorth) * 100).toFixed(1)) : 0;
    const isPositive24h = delta24h >= 0;
    const change24hFormatted = `${isPositive24h ? "+" : ""}${change24hPercentage}%`;

    const totalDebts = liabilities;
    const grossAssets = totalAssets > 0 ? totalAssets : Math.max(0, netWorth + totalDebts);
    const debtRatio = grossAssets > 0 ? Number(((totalDebts / grossAssets) * 100).toFixed(1)) : 0;
    const solvencyScore = grossAssets > 0 || totalDebts > 0 ? Math.max(0, Math.min(100, Math.round(100 - debtRatio))) : 100;
    const liquidPct = grossAssets > 0 ? Math.round((liquidAssets / grossAssets) * 100) : 0;
    const growthPct = grossAssets > 0 ? Math.round((investmentAssets / grossAssets) * 100) : 0;
    const fixedPct = grossAssets > 0 ? Math.max(0, 100 - liquidPct - growthPct) : 0;

    const currentMonthPrefix = format(nowDate, "yyyy-MM");
    let monthlyInflow = 0;
    let monthlyOutflow = 0;
    const catTotals = new Map<string, number>();

    for (const tx of allTxs) {
      if (isCorrectionTx(tx) || isOpeningBalanceTx(tx)) continue;
      const rawDate = tx.occurred_on || tx.created_at || "";
      if (rawDate.startsWith(currentMonthPrefix)) {
        const amt = Number(tx.amount || 0);
        if (tx.type === "income") {
          monthlyInflow += amt;
        } else if (tx.type === "expense") {
          monthlyOutflow += amt;
          const catObj = categories.find((c) => c.id === tx.category_id);
          const catName = catObj?.name || (isIndonesian ? "Lainnya" : "Others");
          catTotals.set(catName, (catTotals.get(catName) || 0) + amt);
        }
      }
    }

    const topCategories: WidgetCategorySlice[] = Array.from(catTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, amt]) => ({
        name,
        pct: monthlyOutflow > 0 ? Math.max(1, Math.round((amt / monthlyOutflow) * 100)) : 0,
        amountFormatted: mask(formatWithPreferred(amt)),
      }));

    const netCashflow = monthlyInflow - monthlyOutflow;
    const isPositiveCashflow = netCashflow >= 0;
    const monthlySavings = Math.max(0, netCashflow);
    const savingsRate = monthlyInflow > 0 ? Math.round((monthlySavings / monthlyInflow) * 100) : 0;
    const savingsTarget = 40;

    const currentDay = Math.max(1, nowDate.getDate());
    const dailyBurn = monthlyOutflow / currentDay;
    const monthlyBurn = dailyBurn * 30;
    const runwayMonths =
      monthlyBurn > 0
        ? Number((liquidAssets / monthlyBurn).toFixed(1))
        : liquidAssets > 0
          ? 12.0
          : 0.0;

    let capitalHealthScore = 0;
    if (grossAssets === 0 && monthlyInflow === 0 && monthlyOutflow === 0) {
      capitalHealthScore = 0;
    } else {
      const solvencyPart = Math.round(solvencyScore * 0.4);
      const runwayPart = Math.min(35, Math.round((runwayMonths / 6) * 35));
      const cashflowPart =
        monthlyInflow === 0 && monthlyOutflow > 0
          ? 12
          : netCashflow >= 0
            ? 25
            : Math.max(5, Math.round(25 * (1 - monthlyOutflow / Math.max(1, monthlyInflow * 2))));
      capitalHealthScore = Math.min(100, Math.max(0, solvencyPart + runwayPart + cashflowPart));
    }

    const capitalHealthTier =
      capitalHealthScore === 0
        ? isIndonesian ? "Belum Ada Data" : "No Data"
        : capitalHealthScore >= 80
          ? isIndonesian ? "Prima" : "Optimal"
          : capitalHealthScore >= 60
            ? isIndonesian ? "Sehat" : "Healthy"
            : isIndonesian ? "Waspada" : "Caution";

    const heatmapDots: { intensity: number; hasSpend: boolean; isToday?: boolean }[] = [];
    const daySpends: number[] = [];

    for (let i = 27; i >= 0; i--) {
      const d = new Date(nowDate);
      d.setDate(nowDate.getDate() - i);
      const isoPrefix = format(d, "yyyy-MM-dd");
      const dayTotal = allTxs
        .filter(
          (tx) =>
            !isCorrectionTx(tx) &&
            !isOpeningBalanceTx(tx) &&
            (tx.occurred_on || tx.created_at || "").slice(0, 10) === isoPrefix &&
            tx.type === "expense"
        )
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      daySpends.push(dayTotal);
    }

    const peakSpend = Math.max(...daySpends, 1);
    for (let idx = 0; idx < daySpends.length; idx++) {
      const spend = daySpends[idx];
      heatmapDots.push({
        intensity: spend > 0 ? Number((spend / peakSpend).toFixed(2)) : 0,
        hasSpend: spend > 0,
        isToday: idx === daySpends.length - 1,
      });
    }

    const activeDaysCount = heatmapDots.filter((d) => d.hasSpend).length;
    const noSpendDaysCount = 28 - activeDaysCount;

    const cashflowBars: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const spend = daySpends[27 - i] || 0;
      cashflowBars.push(spend > 0 ? Math.max(12, Math.round((spend / peakSpend) * 95)) : 0);
    }

    const activeSpends = daySpends.filter((s) => s > 0);
    let volatilityVariance = 0;
    if (activeSpends.length > 1) {
      const mean = activeSpends.reduce((a, b) => a + b, 0) / activeSpends.length;
      const varianceSum = activeSpends.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / activeSpends.length;
      volatilityVariance = Math.min(100, Math.max(0, Math.round((Math.sqrt(varianceSum) / Math.max(1, mean)) * 100)));
    }

    const spendingVolatilityStatus =
      activeSpends.length === 0
        ? isIndonesian ? "Belum Ada Data" : "No Data"
        : volatilityVariance <= 25
          ? isIndonesian ? "Stabil" : "Stable"
          : volatilityVariance <= 55
            ? isIndonesian ? "Seimbang" : "Balanced"
            : isIndonesian ? "Tinggi" : "High";

    const sparkline = widgetSyncService.generate7DaySparkline(allTxs, netWorth);

    const daysInMonth = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0).getDate();
    const daysLeftInMonth = Math.max(1, daysInMonth - nowDate.getDate() + 1);
    const activeBudget =
      budgetTarget > 0
        ? budgetTarget
        : monthlyInflow > 0
          ? monthlyInflow
          : liquidAssets > 0
            ? liquidAssets
            : 0;
    const safeToSpendRemaining = Math.max(0, activeBudget - monthlyOutflow);
    const safeToSpendDailyQuota =
      activeBudget > 0 ? Math.round((safeToSpendRemaining + spentToday) / daysLeftInMonth) : 0;
    const safeToSpendDailyLeft = Math.max(0, safeToSpendDailyQuota - spentToday);
    const safeToSpendPercent =
      activeBudget > 0 ? Math.min(100, Math.round((monthlyOutflow / activeBudget) * 100)) : 0;
    const dailyBurnPacePercent =
      safeToSpendDailyQuota > 0
        ? Math.min(100, Math.round((spentToday / safeToSpendDailyQuota) * 100))
        : spentToday > 0
          ? 100
          : 0;
    const dailyBurnPaceStatus =
      activeBudget === 0 && spentToday === 0
        ? isIndonesian ? "Belum Diatur" : "Not Set"
        : dailyBurnPacePercent >= 80
          ? isIndonesian ? "Tinggi" : "High"
          : dailyBurnPacePercent >= 45
            ? isIndonesian ? "Seimbang" : "Balanced"
            : isIndonesian ? "Rendah" : "Low";

    const prevMonth = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1);
    const prevMonthPrefix = format(prevMonth, "yyyy-MM");
    let prevInflow = 0;
    let prevOutflow = 0;
    for (const tx of allTxs) {
      if (isCorrectionTx(tx) || isOpeningBalanceTx(tx)) continue;
      const raw = tx.occurred_on || tx.created_at || "";
      if (raw.startsWith(prevMonthPrefix)) {
        if (tx.type === "income") prevInflow += Number(tx.amount || 0);
        else if (tx.type === "expense") prevOutflow += Number(tx.amount || 0);
      }
    }
    const prevNet = prevInflow - prevOutflow;
    const deltaVsPrev =
      prevNet !== 0 ? Math.round(((netCashflow - prevNet) / Math.abs(prevNet)) * 100) : 0;
    const isCashflowDeltaPositive = deltaVsPrev >= 0;
    const cashflowDeltaVsLastMonth = `${isCashflowDeltaPositive ? "+" : ""}${deltaVsPrev}%`;
    const monthShortName = nowDate
      .toLocaleDateString(isIndonesian ? "id-ID" : "en-US", { month: "short" })
      .toUpperCase();

    const liquidCashSparkline = widgetSyncService.generate7DaySparkline(allTxs, liquidAssets);
    const isLiquidCashPositive = change24hPercentage >= 0;
    const liquidCashChangeFormatted = `${isLiquidCashPositive ? "+" : ""}${change24hPercentage}%`;

    const thisWeekRaw = daySpends.slice(21, 28);
    const lastWeekRaw = daySpends.slice(14, 21);
    const wavePeak = Math.max(...thisWeekRaw, ...lastWeekRaw, 1);
    const hasAnyWeekSpend = thisWeekRaw.some((v) => v > 0) || lastWeekRaw.some((v) => v > 0);
    const thisWeekWave = thisWeekRaw.map((v) =>
      hasAnyWeekSpend ? Math.max(8, Math.round((v / wavePeak) * 90)) : 0
    );
    const lastWeekWave = lastWeekRaw.map((v) =>
      hasAnyWeekSpend ? Math.max(8, Math.round((v / wavePeak) * 90)) : 0
    );
    const thisWeekSum = thisWeekRaw.reduce((a, b) => a + b, 0);
    const lastWeekSum = lastWeekRaw.reduce((a, b) => a + b, 0);
    const weekDeltaPct =
      lastWeekSum > 0
        ? Math.round(((thisWeekSum - lastWeekSum) / lastWeekSum) * 100)
        : thisWeekSum > 0
          ? 100
          : 0;
    const isWeekDeltaPositive = weekDeltaPct <= 0;
    const weekDeltaFormatted = `${weekDeltaPct > 0 ? "+" : ""}${weekDeltaPct}%`;

    const unpaidBills = bills
      .filter((b) => !b.is_paid)
      .slice()
      .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));
    const activeSubsTotal = unpaidBills.reduce((s, b) => s + Number(b.amount || 0), 0);
    const upcomingBills: WidgetBillItem[] = unpaidBills.slice(0, 3).map((b) => {
      let dueLabel = b.due_date ? b.due_date.slice(5) : "-";
      if (b.due_date) {
        const parsedDue = parseISO(b.due_date);
        if (isValid(parsedDue)) {
          const diff = differenceInCalendarDays(parsedDue, nowDate);
          if (diff === 0) dueLabel = isIndonesian ? "Hari Ini" : "Today";
          else if (diff > 0) dueLabel = `H-${diff}`;
          else dueLabel = `H+${Math.abs(diff)}`;
        }
      }
      return {
        title: b.title,
        amountFormatted: mask(formatWithPreferred(Number(b.amount || 0))),
        dueLabel,
      };
    });

    const efficiencyGain = activeBudget > 0 ? Math.max(0, 100 - safeToSpendPercent) : savingsRate;
    const insightHeadlinePct = `${efficiencyGain}%`;
    const insightTitle =
      activeBudget > 0
        ? isIndonesian
          ? "sisa kapasitas anggaran bulan ini yang masih terjaga."
          : "of your monthly budget capacity remains available."
        : isIndonesian
          ? "rasio tabungan bersih dari arus kas bulan berjalan."
          : "net savings ratio from current monthly cashflow.";
    const insightSubtitle =
      activeBudget > 0
        ? isIndonesian
          ? `Sisa anggaran ${mask(formatWithPreferred(safeToSpendRemaining))} untuk ${daysLeftInMonth} hari ke depan.`
          : `Remaining budget ${mask(formatWithPreferred(safeToSpendRemaining))} for the next ${daysLeftInMonth} days.`
        : isIndonesian
          ? `Rata-rata pengeluaran harian ${mask(formatWithPreferred(Math.round(dailyBurn)))}.`
          : `Average daily burn ${mask(formatWithPreferred(Math.round(dailyBurn)))}.`;

    const lockInsightLine = isIndonesian
      ? `Sisa ${mask(formatWithPreferred(safeToSpendDailyLeft))} • ${noSpendDaysCount} hr tanpa belanja`
      : `${mask(formatWithPreferred(safeToSpendDailyLeft))} left • ${noSpendDaysCount} no-spend days`;

    const snapshot: WidgetSnapshotPayload = {
      netWorthFormatted: mask(formatWithPreferred(netWorth)),
      netWorthRaw: netWorth,
      currencySymbol: currencyMeta?.symbol || "Rp",
      change24hPercentage,
      change24hFormatted,
      isPositive24h,
      totalAssetsFormatted: mask(formatWithPreferred(grossAssets)),
      totalDebtsFormatted: mask(formatWithPreferred(totalDebts)),
      isPrivacyMode: isStealthMode,
      isIndonesian,
      theme,
      lastUpdated: nowDate.toISOString(),
      sparkline,
      spaceName: activeSpace?.name || (isIndonesian ? "Space Pribadi" : "Personal Space"),

      savingsRate,
      savingsTarget,
      monthlySavingsFormatted: mask(formatWithPreferred(monthlySavings)),
      runwayMonths,
      dailyBurnFormatted: mask(formatWithPreferred(Math.round(dailyBurn))),
      monthlyInflowFormatted: mask(formatWithPreferred(monthlyInflow)),
      monthlyOutflowFormatted: mask(formatWithPreferred(monthlyOutflow)),
      netCashflowFormatted: mask(`${netCashflow >= 0 ? "+" : "-"}${formatWithPreferred(Math.abs(netCashflow))}`),
      isPositiveCashflow,
      cashflowBars,
      capitalHealthScore,
      capitalHealthTier,
      heatmapDots,
      activeDaysCount,
      noSpendDaysCount,
      solvencyScore,
      debtRatio,
      liquidPct,
      growthPct,
      fixedPct,
      grossAssetsFormatted: mask(formatWithPreferred(grossAssets)),
      liabilitiesFormatted: mask(formatWithPreferred(totalDebts)),
      netEquityFormatted: mask(formatWithPreferred(netWorth)),
      spendingVolatilityStatus,
      dailyAverageFormatted: mask(`${formatWithPreferred(Math.round(dailyBurn))}${isIndonesian ? "/hr" : "/d"}`),
      volatilityVariance,

      liquidCashFormatted: mask(formatWithPreferred(liquidAssets)),
      liquidCashRaw: liquidAssets,
      liquidCashChangeFormatted,
      isLiquidCashPositive,
      liquidCashSparkline,
      safeToSpendDailyFormatted: mask(formatWithPreferred(safeToSpendDailyLeft)),
      safeToSpendRemainingFormatted: mask(formatWithPreferred(safeToSpendRemaining)),
      safeToSpendBudgetFormatted: mask(formatWithPreferred(activeBudget)),
      safeToSpendSpentTodayFormatted: mask(formatWithPreferred(spentToday)),
      safeToSpendDailyQuotaFormatted: mask(formatWithPreferred(safeToSpendDailyQuota)),
      safeToSpendPercent,
      dailyBurnPacePercent,
      dailyBurnPaceStatus,
      daysLeftInMonth,
      cashflowDeltaVsLastMonth,
      isCashflowDeltaPositive,
      monthShortName,

      topCategories,
      upcomingBills,
      activeSubsCount: unpaidBills.length,
      activeSubsTotalFormatted: mask(formatWithPreferred(activeSubsTotal)),
      draftPendingCount: reactiveDraftCount,
      thisWeekWave,
      lastWeekWave,
      weekDeltaFormatted,
      isWeekDeltaPositive,
      insightHeadlinePct,
      insightTitle,
      insightSubtitle,
      lockInsightLine,
    };

    widgetSyncService.syncSnapshot(snapshot).catch(() => {});
  }, [
    netWorth,
    liquidAssets,
    investmentAssets,
    liabilities,
    totalAssets,
    allTxs,
    wallets,
    categories,
    bills,
    activeSpaceId,
    activeSpace?.name,
    reactiveDraftCount,
    budgetTarget,
    isWalletsLoading,
    isTxsLoading,
    isStealthMode,
    isIndonesian,
    theme,
    formatWithPreferred,
    currencyMeta,
  ]);

  const processPendingAppIntents = useCallback(async () => {
    if (isIngestingRef.current) return;
    isIngestingRef.current = true;
    try {
      const { transactions, voiceLogs, navigation } = await widgetSyncService.retrievePendingIngestion();
      let ingestedCount = 0;
      const transactionIds: string[] = [];
      const voiceLogIds: string[] = [];

      if (navigation === "add") {
        window.dispatchEvent(new CustomEvent("trouvaille:open-quick-add"));
      } else if (navigation === "scan") {
        window.dispatchEvent(new CustomEvent("trouvaille:open-scanner"));
      } else if (navigation === "voice") {
        window.dispatchEvent(new CustomEvent("trouvaille:open-voice"));
      } else if (navigation === "review" || navigation === "inbox") {
        const drafts = getAllDraftItems();
        if (drafts.length > 0) {
          window.dispatchEvent(
            new CustomEvent("trouvaille:open-draft-review", {
              detail: { items: drafts, title: isIndonesian ? "Arsip Draft" : "Draft Archive" },
            })
          );
        }
      }

      if (transactions.length > 0) {
        for (const tx of transactions) {
          try {
            if (isPromotionalOrSpamNotification(tx.note || "", tx.category, tx.wallet)) {
              transactionIds.push(tx.id);
              continue;
            }
            const matchedCat = categories.find((c) => c.name.toLowerCase() === tx.category.toLowerCase());
            const matchedWallet = wallets.find((w) => w.name.toLowerCase() === tx.wallet.toLowerCase());
            const cleanNote = (tx.note || "").trim();
            await addTransactionMutation.mutateAsync({
              id: tx.id,
              amount: tx.amount,
              category_id: matchedCat?.id || categories[0]?.id || null,
              wallet_id: matchedWallet?.id || wallets[0]?.id || null,
              occurred_on: tx.date || format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
              note: cleanNote.length > 0 ? cleanNote : null,
              type: (tx as any).type || "expense",
            });
            ingestedCount++;
            transactionIds.push(tx.id);
          } catch {}
        }
      }

      let draftIngestedCount = 0;
      if (voiceLogs && voiceLogs.length > 0) {
        for (const vLog of voiceLogs) {
          if (vLog.text && vLog.text.trim()) {
            try {
              const countBefore = ingestedCount + draftIngestedCount;
              const rawText = vLog.text.trim();
              if (isPromotionalOrSpamNotification(rawText)) {
                voiceLogIds.push(vLog.id);
                continue;
              }
              let parsedItems: ParsedStatementItem[] = [];
              if (isMultiTransactionHistoryText(rawText)) {
                parsedItems = parseScreenshotHistory(rawText, allTxs, categories, wallets) || [];
              }
              if (parsedItems.length === 0) {
                const slipResult = parseSlipText(rawText, wallets, categories);
                if (slipResult && slipResult.amount && slipResult.amount > 0) {
                  parsedItems = [
                    {
                      id: `ocr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                      date: slipResult.dateFormatted || format(new Date(), "yyyy-MM-dd"),
                      time: format(new Date(), "HH:mm"),
                      description: slipResult.merchantOrRecipient || "",
                      cleanDescription: slipResult.merchantOrRecipient || "",
                      amount: slipResult.amount,
                      type: slipResult.type,
                      walletId: slipResult.sourceWalletId || wallets[0]?.id || null,
                      walletName: slipResult.sourceWalletName || wallets[0]?.name || "Account",
                      suggestedCategoryId: slipResult.type === "transfer" ? null : slipResult.categoryId,
                      suggestedCategoryName: slipResult.type === "transfer" ? null : slipResult.categoryName, suggestedCategoryEmoji: categories.find((c) => c.id === slipResult.categoryId)?.emoji || null,
                      isDuplicate: false,
                      selected: true,
                      raw: rawText,
                      confidence: slipResult.confidence || 0.9,
                      needsReview: true,
                    },
                  ];
                }
              }
              if (parsedItems.length > 0) {
                const saved = saveDraftBatch(parsedItems.map((item, index) => ({ ...item, id: `${vLog.id}:${index}` })), isIndonesian ? "Tangkapan Layar" : "Screenshot", "back_tap");
                if (!saved) throw new Error("Failed to persist widget draft");
                draftIngestedCount += parsedItems.length;
              } else {
                const bankResult = parseBankNotification(rawText, categories, wallets);
                if (bankResult && bankResult.amount > 0) {
                  await addTransactionMutation.mutateAsync({
                    id: vLog.id,
                    amount: bankResult.amount,
                    category_id: bankResult.suggestedCategoryId || categories[0]?.id || null,
                    wallet_id: bankResult.suggestedWalletId || wallets[0]?.id || null,
                    occurred_on: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
                    note: bankResult.merchantOrNote || null,
                    type: bankResult.type || "expense",
                  });
                  ingestedCount++;
                } else {
                  const parsed = parseNaturalTransaction(rawText, categories, wallets);
                  if (parsed.amount && parsed.amount > 0) {
                    await addTransactionMutation.mutateAsync({
                      id: vLog.id,
                      amount: parsed.amount,
                      category_id: parsed.categoryId || categories[0]?.id || null,
                      wallet_id: parsed.walletId || wallets[0]?.id || null,
                      occurred_on: format(parsed.date || new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
                      note: parsed.note || null,
                      type: parsed.type || "expense",
                    });
                    ingestedCount++;
                  }
                }
              }
              if (ingestedCount + draftIngestedCount > countBefore) voiceLogIds.push(vLog.id);
            } catch {}
          }
        }
      }

      if (transactionIds.length > 0 || voiceLogIds.length > 0 || navigation) {
        await widgetSyncService.clearPendingIngestion({ transactionIds, voiceLogIds, ...(navigation ? { navigation } : {}) });
      }
      if (draftIngestedCount > 0 || ingestedCount > 0) {
        triggerSuccessHaptic();
      }
    } catch {} finally {
      isIngestingRef.current = false;
    }
  }, [addTransactionMutation, allTxs, categories, wallets, isIndonesian, showToast]);

  useEffect(() => {
    processPendingAppIntents();
    let listenerHandle: { remove: () => void } | null = null;
    CapApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) processPendingAppIntents();
    })
      .then((handle) => {
        listenerHandle = handle;
      })
      .catch(() => {});
    return () => {
      if (listenerHandle) listenerHandle.remove();
    };
  }, [processPendingAppIntents]);
}

export default useWidgetSync;
