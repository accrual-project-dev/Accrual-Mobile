import { useState, useMemo, useEffect, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight, X, SlidersHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  format,
  isToday,
  isSameDay,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  getDay,
  subDays,
  startOfDay,
} from "date-fns";
import { id as idLocale } from "date-fns/locale";

import { useLanguage } from "../contexts/LanguageContext";
import { useCurrency } from "../contexts/CurrencyContext";
import { useSpace } from "../contexts/SpaceContext";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { usePrivacy } from "../contexts/PrivacyContext";
import { useToast } from "../contexts/ToastContext";

import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { useGoals } from "../hooks/useGoals";
import { useWallets } from "../hooks/useWallets";
import { useBills, useUpcomingBills, useMarkBillPaid } from "../hooks/useBills";
import { useBudgetTarget } from "../hooks/useBudgetTarget";
import { useAllTransactions } from "../hooks/useTransactions";
import { useCategories } from "../hooks/useCategories";
import { useWalletBalances } from "../hooks/useWalletBalances";
import { useFinancialIntelligence } from "../hooks/useFinancialIntelligence";
import { useWidgetLayout } from "../hooks/useWidgetLayout";
import { useDraftTransactions } from "../lib/draftTransactionService";

import { triggerHaptic } from "../lib/haptics";
import { syncDailyStreakReminder } from "../lib/notifications";
import { resolveTransactionCategory } from "../lib/categoryResolver";
import {
  calculateAssetTrend,
  calculatePersonalBaselines,
  calculateDynamicGoalMilestones,
  isCorrectionTx,
} from "../lib/financialMath";
import type { WidgetSize } from "../lib/widgetLayoutTypes";
import type { ParsedStatementItem } from "../lib/statementParser";

import { PullToRefreshIndicator } from "../components/ui/PullToRefreshIndicator";
import { ReorderableWidgetGrid } from "../components/common";
import {
  TopIdentityCapsule,
  ProfileMenuModal,
  HomeWidgetRenderer,
  HomeModalsContainer,
  type StockRange,
} from "../components/home";
import { useDebtReceivables } from "../hooks/useDebtReceivables";

const DebtReceivablesSheet = lazy(() =>
  import("../components/debt/DebtReceivablesSheet").then((m) => ({
    default: m.DebtReceivablesSheet,
  })),
);

interface HomePageProps {
  onOpenAdd?: () => void;
  onOpenScan?: () => void;
  onOpenBatchReview?: (items: ParsedStatementItem[], appName?: string) => void;
}

type ActiveHomeModal =
  | null
  | "notif"
  | "billManagement"
  | "spaceSwitcher"
  | "profileMenu"
  | "profileSheet"
  | "nfc"
  | "webDashboard"
  | "categoryManagement"
  | "customizeHome";

function formatNetAmount(net: number): string {
  const abs = Math.abs(net);
  let val = "";
  if (abs >= 1000000) {
    val = (abs / 1000000).toFixed(1).replace(/\.0$/, "") + "m";
  } else if (abs >= 1000) {
    val = Math.round(abs / 1000) + "k";
  } else {
    val = abs.toString();
  }
  return net < 0 ? `-${val}` : `+${val}`;
}

export function HomePage({
  onOpenAdd: _onOpenAdd,
  onOpenScan: _onOpenScan,
  onOpenBatchReview,
}: HomePageProps) {
  const navigate = useNavigate();
  const { t, isIndonesian } = useLanguage();
  const {
    items: allDraftItems,
    count: draftCount,
    clearAll: clearAllDrafts,
  } = useDraftTransactions();
  useCurrency();

  const [todayDate, setTodayDate] = useState(() => startOfDay(new Date()));
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());

  useEffect(() => {
    const checkDateAndHour = () => {
      const current = new Date();
      const h = current.getHours();
      setCurrentHour((prev) => (prev !== h ? h : prev));

      const dayMidnight = startOfDay(current);
      setTodayDate((prev) =>
        prev.getTime() !== dayMidnight.getTime() ? dayMidnight : prev,
      );
    };

    const timer = setInterval(checkDateAndHour, 60000);
    const handleVis = () => {
      if (!document.hidden) checkDateAndHour();
    };
    document.addEventListener("visibilitychange", handleVis);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVis);
    };
  }, []);

  const now = todayDate;
  const { session } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme !== "light";

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveHomeModal>(null);

  const notifOpen = activeModal === "notif";
  const setNotifOpen = (open: boolean) => setActiveModal(open ? "notif" : null);

  const [stockRange, setStockRange] = useState<StockRange>("1W");
  const { isStealthMode: hideBalance, toggleStealthMode: toggleHideBalance } =
    usePrivacy();

  const { showToast } = useToast();
  const markBillPaid = useMarkBillPaid();
  const upcomingBills = useUpcomingBills();
  const { budgetTarget, budgetPeriodStart } = useBudgetTarget();
  const { summary: debtSummary } = useDebtReceivables();
  const [debtSheetOpen, setDebtSheetOpen] = useState(false);

  const {
    data: rawAllTxs = [],
    refetch: refetchAllTxs,
    isLoading: isTxsLoading,
  } = useAllTransactions();
  const { data: categories = [], refetch: refetchCategories } = useCategories();
  const {
    data: _walletsData = [],
    refetch: refetchWallets,
    isLoading: isWalletsLoading,
  } = useWallets();
  const { data: allBills = [], refetch: refetchBills } = useBills();
  const isColdLoading =
    (isTxsLoading || isWalletsLoading) && rawAllTxs.length === 0;

  const { goals, depositToGoal, updateGoal, deleteGoal } = useGoals();
  const [selectedGoal, setSelectedGoal] = useState<any | null>(null);

  const [isTourOpen, setIsTourOpen] = useState(() => {
    try {
      return localStorage.getItem("trouvaille_tour_pending") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleStartTour = () => setIsTourOpen(true);
    window.addEventListener("trouvaille:start-tour", handleStartTour);
    return () =>
      window.removeEventListener("trouvaille:start-tour", handleStartTour);
  }, []);

  const { netWorth, liquidAssets, liquidAccounts } = useWalletBalances();

  const [metricDrillDown, setMetricDrillDown] = useState<{
    type: "expense" | "income" | "budget_risk" | "snapshot";
    data: any;
  } | null>(null);

  const billManagementOpen = activeModal === "billManagement";
  const setBillManagementOpen = (open: boolean) =>
    setActiveModal(open ? "billManagement" : null);

  const [payingBill, setPayingBill] = useState<any | null>(null);

  const {
    activeSpace,
    activeSpaceId,
    defaultSpaceId,
    setActiveSpaceId,
    filterTransactionsBySpace,
  } = useSpace();

  const allTxs = useMemo(() => {
    return filterTransactionsBySpace(rawAllTxs, activeSpaceId);
  }, [rawAllTxs, activeSpaceId, filterTransactionsBySpace]);

  const spaceSwitcherOpen = activeModal === "spaceSwitcher";
  const setSpaceSwitcherOpen = (open: boolean) =>
    setActiveModal(open ? "spaceSwitcher" : null);

  const profileMenuOpen = activeModal === "profileMenu";
  const setProfileMenuOpen = (val: boolean | ((prev: boolean) => boolean)) => {
    setActiveModal((curr) => {
      const isCurrentlyOpen = curr === "profileMenu";
      const next = typeof val === "function" ? val(isCurrentlyOpen) : val;
      return next ? "profileMenu" : null;
    });
  };

  const profileSheetOpen = activeModal === "profileSheet";
  const setProfileSheetOpen = (open: boolean) =>
    setActiveModal(open ? "profileSheet" : null);

  const nfcModalOpen = activeModal === "nfc";
  const setNfcModalOpen = (open: boolean) =>
    setActiveModal(open ? "nfc" : null);

  const webDashboardOpen = activeModal === "webDashboard";
  const setWebDashboardOpen = (open: boolean) =>
    setActiveModal(open ? "webDashboard" : null);

  const categoryManagementOpen = activeModal === "categoryManagement";
  const setCategoryManagementOpen = (open: boolean) =>
    setActiveModal(open ? "categoryManagement" : null);

  const customizeHomeOpen = activeModal === "customizeHome";
  const setCustomizeHomeOpen = (open: boolean) =>
    setActiveModal(open ? "customizeHome" : null);

  const {
    widgets,
    visibleCards,
    hiddenCards,
    isEditMode,
    setIsEditMode,
    reorderCards,
    cycleCardSize,
    toggleCardVisibility,
    resetLayout,
    applyPreset,
    activePresetKey,
    setActivePresetKey,
  } = useWidgetLayout();

  const intel = useFinancialIntelligence({
    transactions: allTxs,
    budgetTarget,
    budgetPeriodStart,
    totalAssets: netWorth,
    liquidAssets,
    liquidAccounts,
    bills: allBills,
    categories,
  });

  const { pullDistance, isRefreshing, threshold } = usePullToRefresh({
    onRefresh: async () => {
      await Promise.all([
        refetchAllTxs(),
        refetchWallets(),
        refetchCategories(),
        refetchBills(),
      ]);
    },
  });

  // 1. Liquid Position and Apple Stocks Layout Data Calculation
  const assetData = useMemo(() => {
    const liquidAccountIds = new Set(liquidAccounts.map((a: any) => a.id));
    const liquidTxs = allTxs.filter(
      (t: any) =>
        !t.wallet_id ||
        liquidAccountIds.has(t.wallet_id) ||
        (t.destination_wallet_id &&
          liquidAccountIds.has(t.destination_wallet_id)),
    );
    return calculateAssetTrend(liquidTxs, liquidAssets, stockRange);
  }, [allTxs, liquidAssets, liquidAccounts, stockRange]);

  // Personal Baselines & Dynamic Goal Milestones
  const baselines = useMemo(
    () =>
      calculatePersonalBaselines(
        allTxs,
        categories,
        now,
        isIndonesian ? "id" : "en",
      ),
    [allTxs, categories, now, isIndonesian],
  );

  const goalMilestonesMap = useMemo(() => {
    const map = new Map<string, { label: string; isComplete: boolean }>();
    goals.forEach((g) => {
      const res = calculateDynamicGoalMilestones(
        g,
        baselines,
        now,
        isIndonesian ? "id" : "en",
      );
      if (res.isAlreadyCompleted) {
        map.set(g.id, {
          label: isIndonesian ? "Tercapai" : "Completed",
          isComplete: true,
        });
      } else {
        const est = res.velocityPaces.current.projectedCompletion;
        map.set(g.id, {
          label: est
            ? `Est. ${est}`
            : isIndonesian
              ? "Sedang Berjalan"
              : "In Progress",
          isComplete: false,
        });
      }
    });
    return map;
  }, [goals, baselines, now, isIndonesian]);

  // 2. Current Month Financial Calculations
  const currentMonthStats = useMemo(() => {
    const currentMonthKey = format(now, "yyyy-MM");
    let income = 0;
    let expense = 0;
    const expCatMap = new Map<
      string,
      { name: string; emoji: string; total: number; count: number }
    >();
    const incCatMap = new Map<
      string,
      { name: string; emoji: string; total: number; count: number }
    >();

    allTxs.forEach((t) => {
      if (!t.occurred_on || !t.occurred_on.startsWith(currentMonthKey)) return;
      const amt = Number(t.amount || 0);
      const resCat = resolveTransactionCategory(t, categories);
      const catName = resCat.name;
      if (t.type === "income") {
        income += amt;
        const emoji = resCat.emoji || "/icons/gaji.png";
        const ex = incCatMap.get(catName) || {
          name: catName,
          emoji,
          total: 0,
          count: 0,
        };
        ex.total += amt;
        ex.count += 1;
        incCatMap.set(catName, ex);
      } else if (t.type === "expense") {
        expense += amt;
        const emoji = resCat.emoji || "/icons/lainnya.png";
        const ex = expCatMap.get(catName) || {
          name: catName,
          emoji,
          total: 0,
          count: 0,
        };
        ex.total += amt;
        ex.count += 1;
        expCatMap.set(catName, ex);
      }
    });

    const topExpList = Array.from(expCatMap.values()).sort(
      (a, b) => b.total - a.total,
    );
    const topIncList = Array.from(incCatMap.values()).sort(
      (a, b) => b.total - a.total,
    );
    return {
      income,
      expense,
      topExpense: topExpList[0] || null,
      topIncome: topIncList[0] || null,
      topExpenseCategories: topExpList,
    };
  }, [allTxs, categories, now]);

  const totalExpense = currentMonthStats.expense;
  const currentMonthKey = format(now, "yyyy-MM");

  const monthTxs = useMemo(() => {
    return allTxs.filter(
      (t) => t.occurred_on && t.occurred_on.startsWith(currentMonthKey),
    );
  }, [allTxs, currentMonthKey]);

  useEffect(() => {
    syncDailyStreakReminder(intel.loggedToday, isIndonesian);
  }, [intel.loggedToday, isIndonesian]);

  const daysInMonth = now.getDate();
  const dailyAverage = daysInMonth > 0 ? totalExpense / daysInMonth : 0;

  // 3. Calendar heatmap calculations
  const { calDays, calPad } = useMemo(() => {
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    return {
      calDays: eachDayOfInterval({ start, end }),
      calPad: getDay(start),
    };
  }, [now]);

  const compactDays = useMemo(() => {
    return eachDayOfInterval({
      start: subDays(now, 6),
      end: now,
    });
  }, [now]);

  const monthlyStats = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    allTxs.forEach((tx) => {
      const dStr = tx.occurred_on;
      if (!dStr) return;
      const existing = map.get(dStr) || { income: 0, expense: 0 };
      if (tx.type === "income") existing.income += Number(tx.amount || 0);
      else if (tx.type === "expense")
        existing.expense += Number(tx.amount || 0);
      map.set(dStr, existing);
    });
    let maxSurplus = 0,
      maxDeficit = 0;
    map.forEach(({ income, expense }) => {
      const net = income - expense;
      if (net > 0 && net > maxSurplus) maxSurplus = net;
      if (net < 0 && Math.abs(net) > maxDeficit) maxDeficit = Math.abs(net);
    });
    return { map, maxSurplus, maxDeficit };
  }, [allTxs]);

  const last7DaysOutlays = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(now, 6), end: now });
    return days.map((d) => {
      const dStr = format(d, "yyyy-MM-dd");
      const dayTxs = allTxs.filter(
        (t) =>
          t.occurred_on === dStr && t.type === "expense" && !isCorrectionTx(t),
      );
      const amount = dayTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
      return {
        dayLabel: format(d, "EEE", {
          locale: isIndonesian ? idLocale : undefined,
        }),
        amount,
      };
    });
  }, [allTxs, now, isIndonesian]);

  const categoryDonutData = useMemo(() => {
    const list = currentMonthStats.topExpenseCategories || [];
    const top4 = list.slice(0, 4);
    const top4Total = top4.reduce((s, c) => s + c.total, 0);
    const otherTotal = Math.max(0, totalExpense - top4Total);

    const res = top4.map((c) => ({
      name: c.name,
      amount: c.total,
      pct: totalExpense > 0 ? (c.total / totalExpense) * 100 : 0,
      count: c.count,
    }));

    if (otherTotal > 0 && list.length > 4) {
      res.push({
        name: isIndonesian ? "Lainnya" : "Others",
        amount: otherTotal,
        pct: totalExpense > 0 ? (otherTotal / totalExpense) * 100 : 0,
        count: list.slice(4).reduce((s, c) => s + c.count, 0),
      });
    }
    return res;
  }, [currentMonthStats.topExpenseCategories, totalExpense, isIndonesian]);

  const { heatmapDaysData, activeSpendDaysCount } = useMemo(() => {
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    const days = eachDayOfInterval({ start, end });
    const todayStr = format(now, "yyyy-MM-dd");
    let active = 0;
    const maxDaySpend = Math.max(
      1,
      ...days.map((d) => {
        const dStr = format(d, "yyyy-MM-dd");
        const stat = monthlyStats.map.get(dStr);
        return stat ? stat.expense : 0;
      }),
    );
    const list = days.map((d) => {
      const dStr = format(d, "yyyy-MM-dd");
      const stat = monthlyStats.map.get(dStr);
      const exp = stat ? stat.expense : 0;
      if (exp > 0) active++;
      return {
        day: d.getDate(),
        date: d,
        hasSpend: exp > 0,
        amount: exp,
        intensity: exp / maxDaySpend,
        isToday: dStr === todayStr,
        dayOfWeek: d.getDay(),
      };
    });
    return { heatmapDaysData: list, activeSpendDaysCount: active };
  }, [now, monthlyStats.map]);

  const healthScore = useMemo(() => {
    const inc = currentMonthStats.income;
    const exp = currentMonthStats.expense;
    if (inc === 0 && exp === 0) return 75;
    if (inc > 0 && exp === 0) return 100;
    if (inc === 0 && exp > 0) {
      if (exp < 1000000) return 65;
      if (exp < 5000000) return 50;
      return 35;
    }
    const ratio = exp / inc;
    if (ratio >= 2.0) return 20;
    if (ratio >= 1.5) return Math.max(20, Math.round(35 - (ratio - 1.5) * 30));
    if (ratio > 1.0) return Math.round(55 - (ratio - 1.0) * 40);
    if (ratio >= 0.8) return Math.round(65 + (1.0 - ratio) * 50);
    if (ratio >= 0.4) return Math.round(75 + (0.8 - ratio) * 35);
    return Math.min(100, Math.round(90 + (0.4 - ratio) * 25));
  }, [currentMonthStats.income, currentMonthStats.expense]);

  const runwayMonths = useMemo(() => {
    if (totalExpense <= 0) return 99;
    return liquidAssets / totalExpense;
  }, [liquidAssets, totalExpense]);

  const dayData = (d: Date) => {
    const dStr = format(d, "yyyy-MM-dd");
    const data = monthlyStats.map.get(dStr) || { income: 0, expense: 0 };
    return {
      income: data.income,
      expense: data.expense,
      hasTx: monthlyStats.map.has(dStr),
    };
  };

  const lerpHex = (
    from: [number, number, number],
    to: [number, number, number],
    t: number,
  ): string => {
    const r = Math.round(from[0] + (to[0] - from[0]) * t);
    const g = Math.round(from[1] + (to[1] - from[1]) * t);
    const b = Math.round(from[2] + (to[2] - from[2]) * t);
    return `rgb(${r},${g},${b})`;
  };

  const renderCalendarDay = (d: Date) => {
    const { income, expense, hasTx } = dayData(d);
    const isT = isToday(d);
    const isSel = selectedDate && isSameDay(d, selectedDate);
    const net = income - expense;
    const isSurplus = hasTx && net >= 0;
    const isDeficit = hasTx && net < 0;

    let bg = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)";
    let textColor = "var(--text-tertiary)";
    let border = "1px solid transparent";

    if (isSurplus && monthlyStats.maxSurplus > 0) {
      const intensity = Math.min(1, net / monthlyStats.maxSurplus);
      if (isDark) {
        bg = lerpHex(
          [160, 160, 175],
          [255, 255, 255],
          Math.max(0.2, intensity),
        );
        textColor = "#121212";
      } else {
        bg = lerpHex([85, 85, 95], [24, 24, 27], Math.max(0.2, intensity));
        textColor = "#FFFFFF";
      }
    } else if (isDeficit && monthlyStats.maxDeficit > 0) {
      const intensity = Math.min(1, Math.abs(net) / monthlyStats.maxDeficit);
      if (isDark) {
        bg = lerpHex([82, 82, 91], [30, 30, 34], Math.max(0.2, intensity));
        textColor = "#FFFFFF";
        border = "1px solid rgba(255,255,255,0.18)";
      } else {
        bg = lerpHex(
          [225, 225, 230],
          [180, 180, 190],
          Math.max(0.2, intensity),
        );
        textColor = "#18181B";
        border = "1px solid rgba(0,0,0,0.14)";
      }
    }

    if (isT && !hasTx) {
      border = "1px solid var(--glass-border)";
      textColor = "var(--text-primary)";
    }
    if (isSel) {
      border = "2px solid var(--text-primary)";
    }

    return (
      <button
        key={d.toISOString()}
        type="button"
        onClick={() => {
          triggerHaptic("light");
          setSelectedDate(d);
        }}
        className="flex flex-col items-center justify-center rounded-lg active:scale-90 transition-transform py-0.5"
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-semibold transition-all"
          style={{
            background: bg,
            color: textColor,
            border,
            boxShadow: isSel ? "0 0 0 2px var(--text-primary)" : "none",
          }}
        >
          {format(d, "d")}
        </div>
        <div className="h-[10px] flex items-center justify-center mt-0.5">
          {hasTx && net !== 0 ? (
            <span
              className="text-[9px] font-semibold tracking-tight leading-none truncate max-w-[34px] tabular-nums"
              style={{
                color: isSurplus
                  ? "var(--text-primary)"
                  : "var(--text-tertiary)",
                opacity: isSurplus ? 0.95 : 0.65,
              }}
            >
              {formatNetAmount(net)}
            </span>
          ) : (
            <span className="text-[8px] opacity-0 select-none">-</span>
          )}
        </div>
      </button>
    );
  };

  const selectedDayTxs = useMemo(() => {
    if (!selectedDate) return [];
    const dStr = format(selectedDate, "yyyy-MM-dd");
    return allTxs.filter((t) => t.occurred_on === dStr);
  }, [selectedDate, allTxs]);

  const [customDisplayName, setCustomDisplayName] = useState<string | null>(
    null,
  );
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | null>(null);

  const displayName =
    customDisplayName ??
    session?.user?.user_metadata?.display_name ??
    session?.user?.email?.split("@")[0] ??
    "User";

  const avatarUrl =
    customAvatarUrl ??
    session?.user?.user_metadata?.avatar_url ??
    localStorage.getItem("trouvaille_avatar") ??
    "";

  const hour = currentHour;
  const greetingPrefix = isIndonesian
    ? hour >= 4 && hour < 12
      ? "Selamat Pagi"
      : hour >= 12 && hour < 15
        ? "Selamat Siang"
        : hour >= 15 && hour < 19
          ? "Selamat Sore"
          : "Selamat Malam"
    : hour >= 4 && hour < 12
      ? "Good Morning"
      : hour >= 12 && hour < 17
        ? "Good Afternoon"
        : hour >= 17 && hour < 21
          ? "Good Evening"
          : "Good Night";

  const greetingTitle = `${greetingPrefix}, ${displayName}`;

  const stockRangeLabels: Record<StockRange, string> = {
    "1D": isIndonesian ? "Hari Ini" : "Past Day",
    "1W": isIndonesian ? "7 Hari Terakhir" : "Past Week",
    "1M": isIndonesian ? "1 Bulan Terakhir" : "Past Month",
    "6M": isIndonesian ? "6 Bulan Terakhir" : "Past 6 Months",
    YTD: isIndonesian ? "Tahun Berjalan" : "Year to Date",
    "1Y": isIndonesian ? "1 Tahun Terakhir" : "Past 1 Year",
    ALL: isIndonesian ? "Sepanjang Waktu" : "All Time",
  };

  const renderCardContent = (cardId: string, size: WidgetSize) => {
    // In Normal Mode (not edit mode), filter out cards with no data so they do not take up space
    if (!isEditMode) {
      if (cardId === "spending_stability" && !intel?.expenseVolatility) return null;
      if (cardId === "ai_insights" && !intel?.actionCenterInsight) return null;
      if (cardId === "financial_goals" && (!goals || goals.length === 0)) return null;
      if (cardId === "upcoming_bills" && (!upcomingBills || upcomingBills.length === 0)) return null;
      if (cardId === "debt_receivables" && !debtSummary) return null;
      if (cardId === "recent_transactions" && (!allTxs || allTxs.length === 0)) return null;
      if (
        cardId === "top_categories" &&
        (!currentMonthStats?.topExpenseCategories ||
          currentMonthStats.topExpenseCategories.length === 0)
      ) {
        return null;
      }
    }

    return (
      <HomeWidgetRenderer
        cardId={cardId}
        size={size}
        isEditMode={isEditMode}
        intel={intel}
        hideBalance={hideBalance}
        isDark={isDark}
        isIndonesian={isIndonesian}
        allTxs={allTxs}
        monthTxs={monthTxs}
        categories={categories}
        goals={goals}
        goalMilestonesMap={goalMilestonesMap}
        upcomingBills={upcomingBills}
        markBillPaid={markBillPaid}
        budgetTarget={budgetTarget}
        dailyAverage={dailyAverage}
        daysInMonth={daysInMonth}
        totalExpense={totalExpense}
        liquidAssets={liquidAssets}
        currentMonthStats={currentMonthStats}
        categoryDonutData={categoryDonutData}
        last7DaysOutlays={last7DaysOutlays}
        heatmapDaysData={heatmapDaysData}
        activeSpendDaysCount={activeSpendDaysCount}
        healthScore={healthScore}
        runwayMonths={runwayMonths}
        calendarExpanded={calendarExpanded}
        setCalendarExpanded={setCalendarExpanded}
        calPad={calPad}
        calDays={calDays}
        compactDays={compactDays}
        renderCalendarDay={renderCalendarDay}
        assetData={assetData}
        stockRange={stockRange}
        onRangeChange={setStockRange}
        stockRangeLabels={stockRangeLabels}
        onToggleHideBalance={toggleHideBalance}
        isColdLoading={isColdLoading}
        onOpenMetricDrillDown={setMetricDrillDown}
        onOpenGoalDetail={setSelectedGoal}
        onOpenBillManagement={() => setBillManagementOpen(true)}
        onOpenPayBill={setPayingBill}
        onOpenCategoryManagement={() => setCategoryManagementOpen(true)}
        onOpenDebtReceivables={() => setDebtSheetOpen(true)}
        debtSummary={debtSummary}
        navigate={navigate}
      />
    );
  };

  return (
    <div className="space-y-3.5 pb-36 px-4 pt-3 max-w-lg sm:max-w-xl mx-auto select-none">
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
        threshold={threshold}
      />

      {/* Top Identity Capsule */}
      <TopIdentityCapsule
        displayName={displayName}
        avatarUrl={avatarUrl}
        upcomingBillsCount={upcomingBills.length}
        greetingTitle={greetingTitle}
        onOpenProfileMenu={() => setProfileMenuOpen((prev) => !prev)}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenCustomize={() => setCustomizeHomeOpen(true)}
        onNavigateSettings={() => navigate("/settings")}
        activeSpace={activeSpace}
        activeSpaceId={activeSpaceId}
        defaultSpaceId={defaultSpaceId}
        onResetActiveSpace={() =>
          setActiveSpaceId(defaultSpaceId || "personal")
        }
        isIndonesian={isIndonesian}
        t={t}
      />

      {/* Dynamic Island Profile Menu Floating Capsule */}
      <ProfileMenuModal
        isOpen={profileMenuOpen}
        onClose={() => setProfileMenuOpen(false)}
        onOpenProfileSettings={() => {
          setProfileMenuOpen(false);
          setProfileSheetOpen(true);
        }}
        onOpenManageLedgers={() => {
          setProfileMenuOpen(false);
          setSpaceSwitcherOpen(true);
        }}
        onOpenWebDashboard={() => {
          setProfileMenuOpen(false);
          setWebDashboardOpen(true);
        }}
        onOpenNotifications={() => {
          setProfileMenuOpen(false);
          setNotifOpen(true);
        }}
        displayName={displayName}
        avatarUrl={avatarUrl}
      />

      {/* Draft Inbox Banner — Apple Liquid Glass Styling */}
      <AnimatePresence>
        {draftCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            className="p-3 sm:p-3.5 rounded-[22px] flex items-center justify-between gap-3 relative overflow-hidden transition-all mb-2"
            style={{
              background: isDark
                ? "linear-gradient(160deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%)"
                : "linear-gradient(160deg, rgba(255, 255, 255, 0.96) 0%, rgba(246, 247, 250, 0.9) 100%)",
              border: isDark
                ? "1px solid rgba(255, 255, 255, 0.12)"
                : "1px solid rgba(0, 0, 0, 0.08)",
              boxShadow: isDark
                ? "0 12px 30px -8px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.14)"
                : "0 6px 20px -4px rgba(31, 36, 48, 0.06), inset 0 1px 0 #ffffff",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
            }}
          >
            {/* Specular Rim Light */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-[12%] right-[12%] top-[1px] h-[1.5px] rounded-full"
              style={{
                background: isDark
                  ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), rgba(255,255,255,0.5), rgba(255,255,255,0.3), transparent)"
                  : "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), rgba(255,255,255,1), rgba(255,255,255,0.8), transparent)",
              }}
            />

            <div className="flex items-center gap-2.5 min-w-0 relative z-10">
              <div
                className="w-7.5 h-7.5 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: isDark
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(0, 0, 0, 0.05)",
                  border: isDark
                    ? "1px solid rgba(255, 255, 255, 0.1)"
                    : "1px solid rgba(0, 0, 0, 0.06)",
                  color: "var(--text-primary)",
                }}
              >
                <Sparkles size={13} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-[var(--text-primary)] truncate leading-tight">
                  {isIndonesian
                    ? `${draftCount} Transaksi Siap Ditinjau`
                    : `${draftCount} Transactions Ready to Review`}
                </p>
                <p className="text-[10px] text-[var(--text-tertiary)] truncate mt-0.5">
                  {isIndonesian
                    ? "Tersimpan di draft · Saldo belum terpotong"
                    : "Saved in drafts · Balance unchanged"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 relative z-10">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("medium");
                  onOpenBatchReview?.(
                    allDraftItems,
                    isIndonesian ? "Draft Transaksi" : "Draft Inbox",
                  );
                }}
                className="h-7 px-3 rounded-full text-[11px] font-semibold flex items-center gap-1 active:scale-95 transition-all cursor-pointer shadow-sm"
                style={{
                  background: isDark ? "#ffffff" : "#18181b",
                  color: isDark ? "#000000" : "#ffffff",
                }}
              >
                <span>{isIndonesian ? "Tinjau" : "Review"}</span>
                <ArrowRight size={11} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  clearAllDrafts();
                }}
                className="w-6.5 h-6.5 rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-90"
                style={{
                  background: isDark
                    ? "rgba(255, 255, 255, 0.06)"
                    : "rgba(0, 0, 0, 0.04)",
                  border: isDark
                    ? "1px solid rgba(255, 255, 255, 0.08)"
                    : "1px solid rgba(0, 0, 0, 0.06)",
                  color: "var(--text-tertiary)",
                }}
                title={
                  isIndonesian ? "Buang Semua Draft" : "Dismiss All Drafts"
                }
              >
                <X size={12} strokeWidth={2} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Reorderable iOS-Style Card Springboard */}
      <ReorderableWidgetGrid
        cards={visibleCards}
        isEditMode={isEditMode}
        onReorder={reorderCards}
        onEnterEditMode={() => setIsEditMode(true)}
        onCycleSize={cycleCardSize}
        onHide={toggleCardVisibility}
        renderCard={(card) => renderCardContent(card.id, card.size)}
      />

      {/* CUSTOMIZE DASHBOARD — Minimalist Floating Capsule */}
      <div className="flex justify-center pt-2 pb-2">
        <button
          type="button"
          onClick={() => {
            triggerHaptic("light");
            setCustomizeHomeOpen(true);
          }}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-full text-[11.5px] font-semibold tracking-tight transition-all active:scale-95 cursor-pointer select-none"
          style={{
            background: isDark
              ? "linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.035) 100%)"
              : "linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(246, 247, 250, 0.72) 100%)",
            border: isDark
              ? "1px solid rgba(255, 255, 255, 0.09)"
              : "1px solid rgba(0, 0, 0, 0.065)",
            boxShadow: isDark
              ? "inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 4px 14px rgba(0, 0, 0, 0.25)"
              : "inset 0 1px 0 #ffffff, 0 2px 8px rgba(30, 35, 50, 0.05)",
            color: isDark ? "rgba(255, 255, 255, 0.85)" : "#27272a",
          }}
        >
          <SlidersHorizontal
            size={13}
            strokeWidth={1.8}
            className="text-[var(--text-primary)]"
          />
          <span>
            {isIndonesian ? "Kustomisasi Dashboard" : "Customize Dashboard"}
          </span>
        </button>
      </div>

      {/* Modals & Bottom Sheets Orchestrator */}
      <HomeModalsContainer
        selectedDate={selectedDate}
        onCloseDayTransactions={() => setSelectedDate(null)}
        selectedDayTxs={selectedDayTxs}
        categories={categories}
        isIndonesian={isIndonesian}
        isDark={isDark}
        t={t}
        notifOpen={notifOpen}
        onCloseNotif={() => setNotifOpen(false)}
        selectedGoal={selectedGoal}
        onCloseGoal={() => setSelectedGoal(null)}
        depositToGoal={depositToGoal}
        updateGoal={updateGoal}
        deleteGoal={deleteGoal}
        metricDrillDown={metricDrillDown}
        onCloseMetricDrillDown={() => setMetricDrillDown(null)}
        billManagementOpen={billManagementOpen}
        onCloseBillManagement={() => setBillManagementOpen(false)}
        payingBill={payingBill}
        onClosePayingBill={() => setPayingBill(null)}
        markBillPaid={markBillPaid}
        showToast={showToast}
        spaceSwitcherOpen={spaceSwitcherOpen}
        onCloseSpaceSwitcher={() => setSpaceSwitcherOpen(false)}
        categoryManagementOpen={categoryManagementOpen}
        onCloseCategoryManagement={() => setCategoryManagementOpen(false)}
        nfcModalOpen={nfcModalOpen}
        onCloseNfcModal={() => setNfcModalOpen(false)}
        customizeHomeOpen={customizeHomeOpen}
        onCloseCustomizeHome={() => setCustomizeHomeOpen(false)}
        widgets={widgets}
        toggleCardVisibility={toggleCardVisibility}
        activePresetKey={activePresetKey}
        setActivePresetKey={setActivePresetKey}
        applyPreset={applyPreset}
        resetLayout={resetLayout}
        isEditMode={isEditMode}
        setIsEditMode={setIsEditMode}
        hiddenCards={hiddenCards}
        profileSheetOpen={profileSheetOpen}
        onCloseProfileSheet={() => setProfileSheetOpen(false)}
        avatarUrl={avatarUrl}
        setCustomAvatarUrl={setCustomAvatarUrl}
        displayName={displayName}
        setCustomDisplayName={setCustomDisplayName}
        onOpenDeleteAccount={() => {
          setProfileSheetOpen(false);
          navigate("/settings");
        }}
        webDashboardOpen={webDashboardOpen}
        onCloseWebDashboard={() => setWebDashboardOpen(false)}
        isTourOpen={isTourOpen}
        onCloseTour={() => setIsTourOpen(false)}
      />

      {debtSheetOpen && (
        <Suspense fallback={null}>
          <DebtReceivablesSheet
            isOpen={debtSheetOpen}
            onClose={() => setDebtSheetOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
