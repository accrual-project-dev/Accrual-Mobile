import { useState, useMemo } from "react";
import {
  format,
  subDays,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { triggerHaptic } from "../lib/haptics";
import { useWallets } from "../hooks/useWallets";
import { resolveTransactionCategory } from "../lib/categoryResolver";
import {
  useCategories,
  getCategoryParent,
  getParentIcon,
  getParentDisplayName,
} from "../hooks/useCategories";
import { useAllTransactions } from "../hooks/useTransactions";
import { useTheme } from "../contexts/ThemeContext";
import { usePrivacy } from "../contexts/PrivacyContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useCurrency } from "../contexts/CurrencyContext";
import { useSpace } from "../contexts/SpaceContext";
import { useBudgetTarget } from "../hooks/useBudgetTarget";
import { useBills } from "../hooks/useBills";
import { useGoals } from "../hooks/useGoals";
import { useFinancialIntelligence } from "../hooks/useFinancialIntelligence";
import { useWalletBalances } from "../hooks/useWalletBalances";
import {
  MonthlyReviewSection,
  SpendingPatternsSection,
  ExpenseStructureCard,
  FinancialReportSection,
  MonteCarloCard,
  FirePlannerCard,
  CategoryBreakdownCard,
  InflowOutflowTrendCard,
  CashflowVelocityCard,
  StatisticsHeaderBar,
  HealthScoreHeroCard,
  CashflowSummaryBentoCard,
  CategoryAllDetailsSheet,
  StatisticsModalsContainer,
  type StatisticsRange,
  type AnalyticsSubTab,
} from "../components/statistics";
import { WhatIfSimulatorCard } from "../components/home/WhatIfSimulatorCard";
import { PersonalFinancialModelCard } from "../components/home/PersonalFinancialModelCard";
import { ReorderableWidgetGrid } from "../components/common";
import { useWidgetLayout } from "../hooks/useWidgetLayout";
import { STATS_STORAGE_KEY } from "../lib/widgetLayoutEngine";
import { DEFAULT_STATISTICS_WIDGETS } from "../lib/widgetLayoutTypes";
import type { WidgetSize } from "../lib/widgetLayoutTypes";
import {
  calculateAssetTrend,
  calculateWhatIfScenario,
  isCorrectionTx,
  type CategoryMoMShift,
} from "../lib/financialMath";

type BreakdownType = "expense" | "income";
type GroupMode = "category" | "parent";

const isTxCorrection = isCorrectionTx;

const GlassTooltip = ({ active, payload, label }: any) => {
  const { isIndonesian } = useLanguage();
  const { formatWithPreferred } = useCurrency();
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--glass-border)",
        borderRadius: 12,
        padding: "8px 12px",
        boxShadow: "0 8px 24px var(--shadow-strength)",
        fontFamily: "Urbanist, sans-serif",
      }}
    >
      <p
        style={{
          color: "var(--text-tertiary)",
          fontSize: 11,
          fontWeight: 600,
          marginBottom: 4,
        }}
      >
        {label}
      </p>
      {payload.map((p: any, i: number) => (
        <p
          key={i}
          style={{
            color: "var(--text-primary)",
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 2,
          }}
        >
          <span
            style={{
              color: "var(--text-tertiary)",
              fontSize: 11,
              fontWeight: 500,
            }}
          >
            {p.name === "income"
              ? isIndonesian
                ? "Pemasukan: "
                : "Inflow: "
              : p.name === "expense"
                ? isIndonesian
                  ? "Pengeluaran: "
                  : "Outflow: "
                : p.name === "net"
                  ? isIndonesian
                    ? "Pertumbuhan Bersih: "
                    : "Net Growth: "
                  : ""}
          </span>
          {formatWithPreferred(p.value)}
        </p>
      ))}
    </div>
  );
};

function useChartColors() {
  const { theme } = useTheme();
  const isDark = theme !== "light";
  return useMemo(
    () => ({
      donut: isDark
        ? [
            "#FFFFFF",
            "#D1D1D6",
            "#AEAEB2",
            "#8E8E93",
            "#636366",
            "#48484A",
            "#3A3A3C",
          ]
        : [
            "#121212",
            "#2C2C2E",
            "#3A3A3C",
            "#636366",
            "#8E8E93",
            "#AEAEB2",
            "#D1D1D6",
          ],
      barHigh: isDark ? "#FFFFFF" : "#121212",
      barMid: isDark ? "#AEAEB2" : "#636366",
      barLow: isDark ? "#3A3A3C" : "#D1D1D6",
      lineStroke: isDark ? "#FFFFFF" : "#121212",
      cursorFill: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
    }),
    [isDark],
  );
}

export function StatisticsPage() {
  const { theme } = useTheme();
  const { isIndonesian } = useLanguage();
  const { formatWithPreferred, formatCompactWithPreferred } = useCurrency();
  const isDark = theme !== "light";
  const [range, setRange] = useState<StatisticsRange>("month");
  const [breakdownType, setBreakdownType] = useState<BreakdownType>("expense");
  const [groupMode, setGroupMode] = useState<GroupMode>("category");
  const [allDetailsOpen, setAllDetailsOpen] = useState(false);
  const [timeframeMenuOpen, setTimeframeMenuOpen] = useState(false);
  const [analyticsSubTab, setAnalyticsSubTab] =
    useState<AnalyticsSubTab>("report");
  const now = useMemo(() => new Date(), []);
  const { data: rawAllTxs = [] } = useAllTransactions();
  const { activeSpaceId, filterTransactionsBySpace } = useSpace();
  const allTxs = useMemo(() => {
    return filterTransactionsBySpace(rawAllTxs, activeSpaceId);
  }, [rawAllTxs, activeSpaceId, filterTransactionsBySpace]);
  const { data: wallets = [] } = useWallets();
  const { totalAssets, liquidAssets, liquidAccounts, netWorth, zeroAccounts } =
    useWalletBalances();
  const { data: categories = [] } = useCategories();
  const { data: bills = [] } = useBills();
  const { goals } = useGoals();
  const { budgetTarget } = useBudgetTarget();
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedYear, setSelectedYear] = useState<number>(() =>
    new Date().getFullYear(),
  );
  const [selectedCategoryShift, setSelectedCategoryShift] =
    useState<CategoryMoMShift | null>(null);
  const [healthDiagnosticOpen, setHealthDiagnosticOpen] = useState(false);
  const [personalModelOpen, setPersonalModelOpen] = useState(false);
  const [wrappedOpen, setWrappedOpen] = useState(false);
  const [assetValuationOpen, setAssetValuationOpen] = useState(false);
  const [monteCarloOpen, setMonteCarloOpen] = useState(false);
  const [firePlannerOpen, setFirePlannerOpen] = useState(false);
  const [whatIfSheetOpen, setWhatIfSheetOpen] = useState(false);
  const [sankeyOpen, setSankeyOpen] = useState(false);
  const { isStealthMode: hideBalance } = usePrivacy();
  const colors = useChartColors();

  // Extract all available years from transactions + current year
  const availableYears = useMemo(() => {
    const currentYear = now.getFullYear();
    const yearSet = new Set<number>();
    yearSet.add(currentYear);

    for (let i = 0; i < allTxs.length; i++) {
      const dateStr = allTxs[i]?.occurred_on;
      if (dateStr && dateStr.length >= 4) {
        const y = parseInt(dateStr.slice(0, 4), 10);
        if (!isNaN(y) && y >= 2000 && y <= currentYear + 1) {
          yearSet.add(y);
        }
      }
    }

    return Array.from(yearSet).sort((a, b) => b - a);
  }, [allTxs, now]);

  // iOS-Style Springboard Widget Layout for Statistics cards
  const {
    widgets: statsWidgets,
    visibleCards: visibleStatsCards,
    hiddenCards: hiddenStatsCards,
    isEditMode: isStatsEditMode,
    setIsEditMode: setIsStatsEditMode,
    reorderCards: reorderStatsCards,
    cycleCardSize: cycleStatsCardSize,
    toggleCardVisibility: toggleStatsCardVisibility,
    resetLayout: resetStatsLayout,
    applyPreset: applyStatsPreset,
    activePresetKey: activeStatsPresetKey,
    setActivePresetKey: setActiveStatsPresetKey,
  } = useWidgetLayout({
    storageKey: STATS_STORAGE_KEY,
    defaultWidgets: DEFAULT_STATISTICS_WIDGETS,
    page: "statistics",
  });

  const [customizeStatsOpen, setCustomizeStatsOpen] = useState(false);

  const visibleReportCards = useMemo(() => {
    const reportIds = new Set(["financial_report"]);
    const reportOrder = ["financial_report"];
    return visibleStatsCards
      .filter((c) => reportIds.has(c.id))
      .sort((a, b) => reportOrder.indexOf(a.id) - reportOrder.indexOf(b.id));
  }, [visibleStatsCards]);

  const visibleIntelligenceCards = useMemo(() => {
    const intelligenceIds = new Set([
      "health_score",
      "monthly_review",
      "expense_structure",
      "spending_patterns",
    ]);
    const storyOrder = [
      "health_score",
      "monthly_review",
      "expense_structure",
      "spending_patterns",
    ];

    const cards = visibleStatsCards.filter((c) => intelligenceIds.has(c.id));
    const hasHealthScore = cards.some((c) => c.id === "health_score");
    const isHealthScoreHidden = hiddenStatsCards.some(
      (c) => c.id === "health_score",
    );

    if (!hasHealthScore && !isHealthScoreHidden) {
      cards.unshift({
        id: "health_score",
        title: "Financial Health Score",
        subtitle: "Score, health metrics & performance rating",
        page: "statistics",
        category: "telemetry",
        size: "full",
        supportedSizes: ["full"],
        order: 0,
        isVisible: true,
      });
    }

    return cards.sort(
      (a, b) => storyOrder.indexOf(a.id) - storyOrder.indexOf(b.id),
    );
  }, [visibleStatsCards, hiddenStatsCards]);

  const visibleCashflowCards = useMemo(() => {
    const cashflowIds = new Set([
      "cashflow_summary",
      "inflow_outflow_trend",
      "category_breakdown",
      "cashflow_velocity",
    ]);
    const cashflowOrder = [
      "cashflow_summary",
      "inflow_outflow_trend",
      "category_breakdown",
      "cashflow_velocity",
    ];
    const cards = visibleStatsCards.filter((c) => cashflowIds.has(c.id));

    cashflowOrder.forEach((id) => {
      const exists = cards.some((c) => c.id === id);
      const isHidden = hiddenStatsCards.some((c) => c.id === id);
      if (!exists && !isHidden) {
        cards.push({
          id,
          title: id.replace(/_/g, " "),
          subtitle: "",
          page: "statistics",
          category: "telemetry",
          size: "full",
          supportedSizes: ["full"],
          order: cashflowOrder.indexOf(id),
          isVisible: true,
        });
      }
    });

    return cards.sort(
      (a, b) => cashflowOrder.indexOf(a.id) - cashflowOrder.indexOf(b.id),
    );
  }, [visibleStatsCards, hiddenStatsCards]);

  const visibleSimulationCards = useMemo(() => {
    const simulationIds = new Set([
      "fire_planner",
      "monte_carlo",
      "what_if_simulator",
      "personal_financial_model",
    ]);
    const simulationOrder = [
      "fire_planner",
      "monte_carlo",
      "what_if_simulator",
      "personal_financial_model",
    ];

    const cards = visibleStatsCards.filter((c) => simulationIds.has(c.id));

    simulationOrder.forEach((id) => {
      const exists = cards.some((c) => c.id === id);
      const isHidden = hiddenStatsCards.some((c) => c.id === id);
      if (!exists && !isHidden) {
        cards.push({
          id,
          title: id.replace(/_/g, " "),
          subtitle: "",
          page: "statistics",
          category: "telemetry",
          size: "full",
          supportedSizes: ["full"],
          order: simulationOrder.indexOf(id),
          isVisible: true,
        });
      }
    });

    return cards.sort(
      (a, b) => simulationOrder.indexOf(a.id) - simulationOrder.indexOf(b.id),
    );
  }, [visibleStatsCards, hiddenStatsCards]);

  const analyticsTabs = useMemo<
    { key: AnalyticsSubTab; label: string }[]
  >(() => {
    const all = [
      {
        key: "report" as AnalyticsSubTab,
        label: isIndonesian ? "Laporan" : "Report",
        count: visibleReportCards.length,
      },
      {
        key: "intelligence" as AnalyticsSubTab,
        label: isIndonesian ? "Kecerdasan" : "Intelligence",
        count: visibleIntelligenceCards.length,
      },
      {
        key: "cashflow" as AnalyticsSubTab,
        label: isIndonesian ? "Arus Kas" : "Cashflow",
        count: visibleCashflowCards.length,
      },
      {
        key: "simulation" as AnalyticsSubTab,
        label: isIndonesian ? "Simulasi" : "Simulation",
        count: visibleSimulationCards.length,
      },
    ];
    return all.filter((tab) => tab.count > 0);
  }, [
    isIndonesian,
    visibleReportCards.length,
    visibleIntelligenceCards.length,
    visibleCashflowCards.length,
    visibleSimulationCards.length,
  ]);

  const activeSubTab = useMemo(() => {
    if (
      analyticsTabs.length > 0 &&
      !analyticsTabs.some((t) => t.key === analyticsSubTab)
    ) {
      return analyticsTabs[0].key;
    }
    return analyticsSubTab;
  }, [analyticsTabs, analyticsSubTab]);

  const activeMonthDate = useMemo(
    () => subMonths(now, monthOffset),
    [now, monthOffset],
  );
  const intel = useFinancialIntelligence({
    transactions: allTxs,
    budgetTarget,
    totalAssets,
    liquidAssets,
    liquidAccounts,
    bills,
    categories,
    activeMonthDate,
  });

  // 1. Filter by range with Rule 8.1 Full ISO Timestamp compatibility (.slice(0, 10))
  const rangeTxs = useMemo(() => {
    let startStr: string;
    let endStr: string;
    if (range === "week") {
      startStr = format(subDays(now, 6), "yyyy-MM-dd");
      endStr = format(now, "yyyy-MM-dd");
    } else if (range === "month") {
      const targetMonth = subMonths(now, monthOffset);
      startStr = format(startOfMonth(targetMonth), "yyyy-MM-dd");
      endStr = format(endOfMonth(targetMonth), "yyyy-MM-dd");
    } else if (range === "year") {
      const targetYearDate = new Date(selectedYear, 0, 1);
      startStr = format(startOfYear(targetYearDate), "yyyy-MM-dd");
      endStr = format(endOfYear(targetYearDate), "yyyy-MM-dd");
    } else {
      return allTxs;
    }
    return allTxs.filter((t) => {
      if (!t.occurred_on) return false;
      const d = t.occurred_on.slice(0, 10);
      return d >= startStr && d <= endStr;
    });
  }, [allTxs, range, monthOffset, selectedYear, now]);

  const currentPeriodLabel = useMemo(() => {
    if (range === "week")
      return isIndonesian ? "7 Hari Terakhir" : "Last 7 Days";
    if (range === "month")
      return format(subMonths(now, monthOffset), "MMMM yyyy", {
        locale: isIndonesian ? idLocale : undefined,
      });
    if (range === "year") return `${selectedYear}`;
    return isIndonesian ? "Semua Waktu" : "All Time";
  }, [range, monthOffset, selectedYear, now, isIndonesian]);

  const currentPeriodBounds = useMemo(() => {
    if (range === "week") {
      return {
        start: format(subDays(now, 6), "yyyy-MM-dd"),
        end: format(now, "yyyy-MM-dd"),
      };
    } else if (range === "month") {
      const targetMonth = subMonths(now, monthOffset);
      return {
        start: format(startOfMonth(targetMonth), "yyyy-MM-dd"),
        end: format(endOfMonth(targetMonth), "yyyy-MM-dd"),
      };
    } else if (range === "year") {
      const targetYearDate = new Date(selectedYear, 0, 1);
      return {
        start: format(startOfYear(targetYearDate), "yyyy-MM-dd"),
        end: format(endOfYear(targetYearDate), "yyyy-MM-dd"),
      };
    }
    return { start: undefined, end: undefined };
  }, [range, monthOffset, selectedYear, now]);

  const { totalIncome, totalExpense } = useMemo(
    () => ({
      totalIncome: rangeTxs
        .filter((t) => t.type === "income" && !isTxCorrection(t))
        .reduce((s, t) => s + Number(t.amount || 0), 0),
      totalExpense: rangeTxs
        .filter((t) => t.type === "expense" && !isTxCorrection(t))
        .reduce((s, t) => s + Number(t.amount || 0), 0),
    }),
    [rangeTxs],
  );

  const savingsRate =
    totalIncome > 0
      ? Math.max(0, ((totalIncome - totalExpense) / totalIncome) * 100)
      : 0;

  // Month-over-Month Delta Calculation (comparing to previous month, Rule 8.1 safe)
  const { prevIncome, prevExpense } = useMemo(() => {
    const prevDate = subMonths(now, monthOffset + 1);
    const start = format(startOfMonth(prevDate), "yyyy-MM-dd");
    const end = format(endOfMonth(prevDate), "yyyy-MM-dd");
    const pTxs = allTxs.filter((t) => {
      if (!t.occurred_on) return false;
      const d = t.occurred_on.slice(0, 10);
      return d >= start && d <= end;
    });
    return {
      prevIncome: pTxs
        .filter((t) => t.type === "income" && !isTxCorrection(t))
        .reduce((s, t) => s + Number(t.amount || 0), 0),
      prevExpense: pTxs
        .filter((t) => t.type === "expense" && !isTxCorrection(t))
        .reduce((s, t) => s + Number(t.amount || 0), 0),
    };
  }, [allTxs, now, monthOffset]);

  const getDelta = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? { pct: 100, isUp: true } : null;
    const diff = curr - prev;
    const pct = Math.round((Math.abs(diff) / prev) * 100);
    return { pct, isUp: diff >= 0, diff };
  };

  const incomeDelta = useMemo(
    () => getDelta(totalIncome, prevIncome),
    [totalIncome, prevIncome],
  );
  const expenseDelta = useMemo(
    () => getDelta(totalExpense, prevExpense),
    [totalExpense, prevExpense],
  );
  const netDelta = useMemo(
    () => getDelta(totalIncome - totalExpense, prevIncome - prevExpense),
    [totalIncome, totalExpense, prevIncome, prevExpense],
  );

  const modelRange =
    range === "week"
      ? "1W"
      : range === "month"
        ? "1M"
        : range === "year"
          ? "1Y"
          : "ALL";

  const assetTrend = useMemo(
    () => calculateAssetTrend(allTxs, totalAssets, modelRange),
    [allTxs, modelRange, totalAssets],
  );

  const debtBalance = useMemo(() => {
    return zeroAccounts.reduce(
      (sum: number, account: { balance: number }) =>
        account.balance < 0 ? sum + Math.abs(account.balance) : sum,
      0,
    );
  }, [zeroAccounts]);

  const modelScenario = useMemo(
    () =>
      calculateWhatIfScenario({
        monthlyIncome: intel.totalIncome,
        monthlyExpense: intel.totalExpense,
        type: "expense_cut",
        value: 500000,
      }),
    [intel.totalExpense, intel.totalIncome],
  );

  const goalTrajectoryText = useMemo(() => {
    if (!goals.length) {
      return isIndonesian
        ? "Tambahkan tujuan untuk mensimulasikan skenario linimasa."
        : "Add a goal to simulate timeline scenarios.";
    }
    const primaryGoal = goals[0];
    const planning = intel.getGoalPlanning(primaryGoal);
    const required = formatWithPreferred(planning.requiredMonthlyContribution);
    const statusText = isIndonesian
      ? planning.trajectoryStatus === "ON TRACK"
        ? "SESUAI TARGET"
        : planning.trajectoryStatus === "AHEAD OF TARGET"
          ? "LEBIH CEPAT"
          : "DI BAWAH TARGET"
      : planning.trajectoryStatus;
    return isIndonesian
      ? `${primaryGoal.title}: butuh ~${required}/bulan (${statusText}).`
      : `${primaryGoal.title}: need ~${required}/month (${statusText}).`;
  }, [goals, intel, isIndonesian, formatWithPreferred]);

  const personalBaselineText = useMemo(() => {
    const baseline = intel.personalBaselines;
    if (baseline.status === "insufficient") {
      return (
        baseline.message ||
        (isIndonesian
          ? "Riwayat transaksi belum cukup untuk baseline pribadi yang stabil."
          : "Not enough history yet for a stable personal baseline.")
      );
    }
    return isIndonesian
      ? `Pengeluaran tipikal ${formatWithPreferred(baseline.medianExpense)}/bulan dengan median kas ditahan ${formatWithPreferred(Math.max(0, baseline.medianNetCashflow))}/bulan.`
      : `Typical expense ${formatWithPreferred(baseline.medianExpense)}/month with median retained cash ${formatWithPreferred(Math.max(0, baseline.medianNetCashflow))}/month.`;
  }, [intel.personalBaselines, isIndonesian, formatWithPreferred]);

  const personalFinancialModel = useMemo(() => {
    const actualCommitted = Math.max(0, intel.committedAmount);
    const actualVariable = Math.max(0, intel.totalExpense - actualCommitted);
    const actualRetained = intel.netCashflow;

    const baselineCommitted = Math.max(
      0,
      intel.liquidityHorizon.typicalCommittedOutflow,
    );
    const baselineExpense = Math.max(0, intel.personalBaselines.medianExpense);
    const baselineVariable = Math.max(0, baselineExpense - baselineCommitted);
    const baselineRetained = intel.personalBaselines.medianNetCashflow;

    const scenarioCommitted = actualCommitted;
    const scenarioVariable = Math.max(
      0,
      modelScenario.adjustedMonthlyExpense - scenarioCommitted,
    );
    const scenarioRetained =
      modelScenario.adjustedMonthlyIncome -
      modelScenario.adjustedMonthlyExpense;

    return {
      actual: {
        income: Math.max(0, intel.totalIncome),
        committedExpenses: actualCommitted,
        variableExpenses: actualVariable,
        retainedCash: actualRetained,
        savingsInvestment: Math.max(0, actualRetained),
        assets: Math.max(0, totalAssets),
        liabilities: debtBalance,
        netWorth,
      },
      baseline: {
        income: Math.max(0, intel.personalBaselines.medianIncome),
        committedExpenses: baselineCommitted,
        variableExpenses: baselineVariable,
        retainedCash: baselineRetained,
        savingsInvestment: Math.max(0, baselineRetained),
        assets: Math.max(0, totalAssets),
        liabilities: debtBalance,
        netWorth,
      },
      scenario: {
        income: Math.max(0, modelScenario.adjustedMonthlyIncome),
        committedExpenses: scenarioCommitted,
        variableExpenses: scenarioVariable,
        retainedCash: scenarioRetained,
        savingsInvestment: Math.max(0, scenarioRetained),
        assets: Math.max(0, totalAssets + modelScenario.monthlyDifference),
        liabilities: debtBalance,
        netWorth: netWorth + modelScenario.monthlyDifference,
      },
      insights: {
        currentNetWorth: netWorth,
        historicalTrendLabel: isIndonesian
          ? `Tren Historis (${modelRange})`
          : `Historical Trend (${modelRange})`,
        historicalTrendValue: `${assetTrend.diff >= 0 ? "+" : "-"}${formatWithPreferred(Math.abs(assetTrend.diff))} (${assetTrend.percent.toFixed(1)}%)`,
        currentCashflow: intel.netCashflow,
        personalBaseline: personalBaselineText,
        upcomingCommitments: intel.committedAmount,
        goalTrajectory: goalTrajectoryText,
        scenarioImpact: isIndonesian
          ? `Jika pengeluaran turun ${formatWithPreferred(500000)}/bulan, kas ditahan berubah sebesar ${modelScenario.annualDifference >= 0 ? "+" : "-"}${formatWithPreferred(Math.abs(modelScenario.annualDifference))}/tahun.`
          : `If expense drops ${formatWithPreferred(500000)}/month, retained cash changes by ${modelScenario.annualDifference >= 0 ? "+" : "-"}${formatWithPreferred(Math.abs(modelScenario.annualDifference))}/year.`,
      },
    };
  }, [
    assetTrend.diff,
    assetTrend.percent,
    debtBalance,
    goalTrajectoryText,
    intel,
    isIndonesian,
    modelRange,
    modelScenario.adjustedMonthlyExpense,
    modelScenario.adjustedMonthlyIncome,
    modelScenario.annualDifference,
    modelScenario.monthlyDifference,
    netWorth,
    personalBaselineText,
    totalAssets,
    formatWithPreferred,
  ]);

  const healthScore = useMemo(() => {
    if (totalIncome === 0 && totalExpense === 0) return 75;
    if (totalIncome > 0 && totalExpense === 0) return 100;
    if (totalIncome === 0 && totalExpense > 0) {
      if (totalExpense < 1000000) return 65;
      if (totalExpense < 5000000) return 50;
      return 35;
    }
    const ratio = totalExpense / totalIncome;
    if (ratio >= 2.0) return 20;
    if (ratio >= 1.5) return Math.max(20, Math.round(35 - (ratio - 1.5) * 30));
    if (ratio > 1.0) return Math.round(55 - (ratio - 1.0) * 40);
    if (ratio >= 0.8) return Math.round(65 + (1.0 - ratio) * 50);
    if (ratio >= 0.4) return Math.round(75 + (0.8 - ratio) * 35);
    return Math.min(100, Math.round(90 + (0.4 - ratio) * 25));
  }, [totalIncome, totalExpense]);

  // Single-pass Pre-aggregated Monthly Map for ultra-fast All-Time and Year rendering
  const monthlyAggregates = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    for (let i = 0; i < allTxs.length; i++) {
      const t = allTxs[i];
      if (!t.occurred_on || t.type === "transfer" || isTxCorrection(t))
        continue;
      const key = t.occurred_on.slice(0, 7);
      let entry = map.get(key);
      if (!entry) {
        entry = { income: 0, expense: 0 };
        map.set(key, entry);
      }
      const amt = Number(t.amount || 0);
      if (t.type === "income") entry.income += amt;
      else if (t.type === "expense") entry.expense += amt;
    }
    return map;
  }, [allTxs]);

  // 2. Trend bar chart data with Rule 8.1 Full ISO Timestamp compatibility
  const trendData = useMemo(() => {
    if (range === "week") {
      return Array.from({ length: 7 }, (_, i) => {
        const d = subDays(now, 6 - i);
        const dStr = format(d, "yyyy-MM-dd");
        const txs = allTxs.filter(
          (t) => (t.occurred_on || "").slice(0, 10) === dStr,
        );
        return {
          label: format(d, "EEE", {
            locale: isIndonesian ? idLocale : undefined,
          }),
          income: txs
            .filter((t) => t.type === "income" && !isTxCorrection(t))
            .reduce((s, t) => s + Number(t.amount || 0), 0),
          expense: txs
            .filter((t) => t.type === "expense" && !isTxCorrection(t))
            .reduce((s, t) => s + Number(t.amount || 0), 0),
        };
      });
    } else if (range === "month") {
      const targetMonthDate = subMonths(now, monthOffset);
      const currentYear = targetMonthDate.getFullYear();
      const currentMonth = targetMonthDate.getMonth();
      const weeks = [
        { label: "W1 (1-7)", startDay: 1, endDay: 7 },
        { label: "W2 (8-14)", startDay: 8, endDay: 14 },
        { label: "W3 (15-21)", startDay: 15, endDay: 21 },
        { label: "W4 (22-28)", startDay: 22, endDay: 28 },
        { label: "W5 (29+)", startDay: 29, endDay: 31 },
      ];
      return weeks.map((w) => {
        const txs = allTxs.filter((t) => {
          if (!t.occurred_on) return false;
          const [y, m, d] = t.occurred_on
            .slice(0, 10)
            .split("-")
            .map(Number);
          if (y !== currentYear || m - 1 !== currentMonth) return false;
          return d >= w.startDay && d <= w.endDay;
        });
        return {
          label: w.label,
          income: txs
            .filter((t) => t.type === "income" && !isTxCorrection(t))
            .reduce((s, t) => s + Number(t.amount || 0), 0),
          expense: txs
            .filter((t) => t.type === "expense" && !isTxCorrection(t))
            .reduce((s, t) => s + Number(t.amount || 0), 0),
        };
      });
    } else if (range === "year") {
      return Array.from({ length: 12 }, (_, m) => {
        const d = new Date(selectedYear, m, 1);
        const key = format(d, "yyyy-MM");
        const agg = monthlyAggregates.get(key) || { income: 0, expense: 0 };
        return {
          label: format(d, "MMM", {
            locale: isIndonesian ? idLocale : undefined,
          }),
          income: agg.income,
          expense: agg.expense,
        };
      });
    } else {
      const datedTxs = allTxs.filter((t) => !!t.occurred_on);
      if (datedTxs.length === 0) return [];

      const earliestDate = datedTxs.reduce(
        (min, tx) => {
          const d = tx.occurred_on.slice(0, 10);
          return d < min ? d : min;
        },
        datedTxs[0].occurred_on.slice(0, 10),
      );
      const startMonth = new Date(`${earliestDate.slice(0, 7)}-01T00:00:00`);
      const totalMonths =
        (now.getFullYear() - startMonth.getFullYear()) * 12 +
        (now.getMonth() - startMonth.getMonth()) +
        1;

      return Array.from({ length: totalMonths }, (_, i) => {
        const d = new Date(
          startMonth.getFullYear(),
          startMonth.getMonth() + i,
          1,
        );
        const key = format(d, "yyyy-MM");
        const agg = monthlyAggregates.get(key) || { income: 0, expense: 0 };
        return {
          label: totalMonths > 12 ? format(d, "MMM yy") : format(d, "MMM"),
          income: agg.income,
          expense: agg.expense,
        };
      });
    }
  }, [
    allTxs,
    range,
    monthOffset,
    selectedYear,
    monthlyAggregates,
    now,
    isIndonesian,
  ]);

  // 3. Category breakdown (Detailed) with Envelope Budget metadata
  const categoryStats = useMemo(() => {
    const catMap = new Map<
      string,
      {
        name: string;
        emoji: string;
        total: number;
        count: number;
        budget_amount: number | null;
      }
    >();
    const userCatMap = new Map<
      string,
      { emoji: string; budget_amount: number | null }
    >();
    categories.forEach((c) =>
      userCatMap.set(c.name.trim().toLowerCase(), {
        emoji: c.emoji,
        budget_amount: c.budget_amount ?? null,
      }),
    );

    rangeTxs
      .filter((t) => t.type === breakdownType)
      .forEach((t) => {
        const resolved = resolveTransactionCategory(t, categories);
        const name = resolved.name;
        const meta = userCatMap.get(name.trim().toLowerCase());
        const emoji =
          resolved.emoji ||
          meta?.emoji ||
          (breakdownType === "income"
            ? "/icons/gaji.png"
            : "/icons/lainnya.png");
        const budget_amount =
          t.categories?.budget_amount ?? meta?.budget_amount ?? null;
        const amt = Number(t.amount || 0);
        const ex = catMap.get(name);
        if (ex) {
          ex.total += amt;
          ex.count++;
        } else
          catMap.set(name, {
            name,
            emoji,
            total: amt,
            count: 1,
            budget_amount,
          });
      });
    return Array.from(catMap.values()).sort((a, b) => b.total - a.total);
  }, [rangeTxs, breakdownType, categories]);

  // 3b. Macro Parent (Induk) breakdown
  const parentCategoryStats = useMemo(() => {
    const parentMap = new Map<
      string,
      {
        name: string;
        emoji: string;
        total: number;
        count: number;
        categoriesList: Array<{
          name: string;
          emoji: string;
          total: number;
          count: number;
        }>;
      }
    >();

    const userCatMap = new Map<
      string,
      { emoji: string; budget_amount: number | null }
    >();
    categories.forEach((c) =>
      userCatMap.set(c.name.trim().toLowerCase(), {
        emoji: c.emoji,
        budget_amount: c.budget_amount ?? null,
      }),
    );

    rangeTxs
      .filter((t) => t.type === breakdownType)
      .forEach((t) => {
        const resolved = resolveTransactionCategory(t, categories);
        const catName = resolved.name;
        const parentRaw = getCategoryParent(catName);
        const parentName = getParentDisplayName(parentRaw, isIndonesian);
        const meta = userCatMap.get(catName.trim().toLowerCase());
        const emoji =
          resolved.emoji ||
          meta?.emoji ||
          (breakdownType === "income"
            ? "/icons/gaji.png"
            : "/icons/lainnya.png");
        const amt = Number(t.amount || 0);

        let parentEntry = parentMap.get(parentName);
        if (!parentEntry) {
          parentEntry = {
            name: parentName,
            emoji: getParentIcon(parentRaw),
            total: 0,
            count: 0,
            categoriesList: [],
          };
          parentMap.set(parentName, parentEntry);
        }

        parentEntry.total += amt;
        parentEntry.count++;

        let subCat = parentEntry.categoriesList.find((c) => c.name === catName);
        if (!subCat) {
          subCat = { name: catName, emoji, total: 0, count: 0 };
          parentEntry.categoriesList.push(subCat);
        }
        subCat.total += amt;
        subCat.count++;
      });

    return Array.from(parentMap.values())
      .map((p) => ({
        ...p,
        categoriesCount: p.categoriesList.length,
        categoriesList: p.categoriesList.sort((a, b) => b.total - a.total),
      }))
      .sort((a, b) => b.total - a.total);
  }, [rangeTxs, breakdownType, categories, isIndonesian]);

  const activeBreakdownData =
    groupMode === "parent" ? parentCategoryStats : categoryStats;
  const totalBreakdownAmount = activeBreakdownData.reduce(
    (s, c) => s + c.total,
    0,
  );

  // 4. Average Transaction Size & MoM Comparison (Rule 8.1 safe)
  const avgTransactionStats = useMemo(() => {
    const expenseTxs = rangeTxs.filter(
      (t) => t.type === "expense" && !isTxCorrection(t),
    );
    const avgExpense =
      expenseTxs.length > 0 ? Math.round(totalExpense / expenseTxs.length) : 0;

    const prevDate = subMonths(now, monthOffset + 1);
    const start = format(startOfMonth(prevDate), "yyyy-MM-dd");
    const end = format(endOfMonth(prevDate), "yyyy-MM-dd");
    const prevExpenseTxs = allTxs.filter((t) => {
      if (!t.occurred_on || t.type !== "expense" || isTxCorrection(t))
        return false;
      const d = t.occurred_on.slice(0, 10);
      return d >= start && d <= end;
    });
    const prevAvgExpense =
      prevExpenseTxs.length > 0
        ? Math.round(prevExpense / prevExpenseTxs.length)
        : 0;
    const avgDelta = getDelta(avgExpense, prevAvgExpense);

    return {
      avgExpense,
      avgDelta,
      count: expenseTxs.length,
    };
  }, [rangeTxs, totalExpense, allTxs, now, monthOffset, prevExpense]);

  const rangeTitle = useMemo(() => {
    if (range === "week") return isIndonesian ? "Minggu Ini" : "This Week";
    if (range === "month") {
      if (monthOffset === 0) {
        return isIndonesian ? "Bulan Ini" : "This Month";
      }
      return format(subMonths(now, monthOffset), "MMM yyyy", {
        locale: isIndonesian ? idLocale : undefined,
      });
    }
    if (range === "year") {
      if (selectedYear === now.getFullYear()) {
        return isIndonesian ? "Tahun Ini" : "This Year";
      }
      return isIndonesian ? `Tahun ${selectedYear}` : `Year ${selectedYear}`;
    }
    return isIndonesian ? "Semua Waktu" : "All Time";
  }, [range, monthOffset, selectedYear, now, isIndonesian]);

  const renderStatisticsCard = (cardId: string, _size: WidgetSize) => {
    switch (cardId) {
      // --- REPORT TAB CARDS ---
      case "financial_report":
        return (
          <FinancialReportSection
            wallets={wallets}
            transactions={rangeTxs}
            allTransactions={allTxs}
            categories={categories}
            startDate={currentPeriodBounds.start}
            endDate={currentPeriodBounds.end}
            periodLabel={currentPeriodLabel}
          />
        );

      // --- INTELLIGENCE TAB CARDS ---
      case "health_score":
        return (
          <HealthScoreHeroCard
            isIndonesian={isIndonesian}
            isDark={isDark}
            rangeTitle={rangeTitle}
            healthScore={healthScore}
            savingsRate={savingsRate}
            totalIncome={totalIncome}
            totalExpense={totalExpense}
            committedPercentage={
              intel.expenseStructure
                ? intel.expenseStructure.committedPercentage
                : 0
            }
            hideBalance={hideBalance}
            formatWithPreferred={formatWithPreferred}
            onOpenDiagnostic={() => setHealthDiagnosticOpen(true)}
          />
        );

      case "monthly_review":
        if (range !== "month" || !intel.monthlyReview) return null;
        return (
          <MonthlyReviewSection
            review={intel.monthlyReview}
            healthScore={healthScore}
            onCategoryClick={(catName) => {
              const found = intel.categoryShifts.find(
                (s) => s.name.toLowerCase() === catName.toLowerCase(),
              );
              if (found) {
                setSelectedCategoryShift(found);
                triggerHaptic("light");
              }
            }}
          />
        );

      case "expense_structure":
        if (range !== "month") return null;
        return (
          <ExpenseStructureCard expenseStructure={intel.expenseStructure} />
        );

      case "spending_patterns":
        if (range !== "month") return null;
        return (
          <SpendingPatternsSection patterns={intel.behavioralPatterns} />
        );

      // --- CASHFLOW TAB CARDS ---
      case "cashflow_summary":
        return (
          <CashflowSummaryBentoCard
            isIndonesian={isIndonesian}
            isDark={isDark}
            range={range}
            rangeTitle={rangeTitle}
            totalIncome={totalIncome}
            totalExpense={totalExpense}
            incomeDelta={incomeDelta}
            expenseDelta={expenseDelta}
            netDelta={netDelta}
            hideBalance={hideBalance}
            formatWithPreferred={formatWithPreferred}
            formatCompactWithPreferred={formatCompactWithPreferred}
          />
        );

      case "inflow_outflow_trend":
        return (
          <InflowOutflowTrendCard
            rangeTitle={rangeTitle}
            trendData={trendData}
            range={range}
            colors={colors}
            isDark={isDark}
            isIndonesian={isIndonesian}
            GlassTooltip={GlassTooltip}
          />
        );

      case "category_breakdown":
        return (
          <CategoryBreakdownCard
            breakdownType={breakdownType}
            setBreakdownType={setBreakdownType}
            categoryStats={categoryStats}
            totalBreakdownAmount={totalBreakdownAmount}
            isDark={isDark}
            isIndonesian={isIndonesian}
            setAllDetailsOpen={setAllDetailsOpen}
          />
        );

      case "cashflow_velocity":
        return (
          <CashflowVelocityCard
            savingsRate={savingsRate}
            avgTransactionStats={avgTransactionStats}
            range={range}
            totalExpense={totalExpense}
            rangeTitle={rangeTitle}
            isDark={isDark}
            isIndonesian={isIndonesian}
            onOpenSankey={() => setSankeyOpen(true)}
          />
        );

      // --- SIMULATION TAB CARDS ---
      case "fire_planner":
        return (
          <FirePlannerCard
            netWorth={netWorth}
            monthlySavings={Math.max(0, totalIncome - totalExpense)}
            monthlyBurnRate={intel.totalExpense || totalExpense || 3500000}
            hideBalance={hideBalance}
            onOpenPlanner={() => {
              setFirePlannerOpen(true);
              triggerHaptic("light");
            }}
          />
        );

      case "monte_carlo":
        return (
          <MonteCarloCard
            netWorth={netWorth}
            monthlySavings={Math.max(1000000, totalIncome - totalExpense)}
            hideBalance={hideBalance}
            onOpenSimulator={() => {
              setMonteCarloOpen(true);
              triggerHaptic("light");
            }}
          />
        );

      case "what_if_simulator":
        return (
          <WhatIfSimulatorCard
            monthlyIncome={intel.totalIncome}
            monthlyExpense={intel.totalExpense}
            hideBalance={hideBalance}
            onOpenDetails={() => {
              setWhatIfSheetOpen(true);
              triggerHaptic("light");
            }}
          />
        );

      case "personal_financial_model":
        return (
          <PersonalFinancialModelCard
            hideBalance={hideBalance}
            actual={personalFinancialModel.actual}
            baseline={personalFinancialModel.baseline}
            scenario={personalFinancialModel.scenario}
            insights={personalFinancialModel.insights}
            liquidityHorizon={intel.liquidityHorizon}
            onOpenDetails={() => {
              setPersonalModelOpen(true);
              triggerHaptic("light");
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="px-4 sm:px-5 py-6 space-y-5 pb-36 max-w-lg sm:max-w-xl mx-auto overflow-x-clip"
      style={{ minHeight: "100dvh" }}
    >
      <StatisticsHeaderBar
        isIndonesian={isIndonesian}
        isDark={isDark}
        range={range}
        setRange={setRange}
        monthOffset={monthOffset}
        setMonthOffset={setMonthOffset}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        availableYears={availableYears}
        now={now}
        activeMonthDate={activeMonthDate}
        rangeTitle={rangeTitle}
        timeframeMenuOpen={timeframeMenuOpen}
        setTimeframeMenuOpen={setTimeframeMenuOpen}
        setCustomizeStatsOpen={setCustomizeStatsOpen}
        setWrappedOpen={setWrappedOpen}
        analyticsTabs={analyticsTabs}
        activeSubTab={activeSubTab}
        setAnalyticsSubTab={setAnalyticsSubTab}
      />

      {/* TAB 1: REPORT */}
      {activeSubTab === "report" && (
        <ReorderableWidgetGrid
          cards={visibleReportCards}
          isEditMode={isStatsEditMode}
          onReorder={reorderStatsCards}
          onEnterEditMode={() => setIsStatsEditMode(true)}
          onCycleSize={cycleStatsCardSize}
          onHide={toggleStatsCardVisibility}
          renderCard={(card) => renderStatisticsCard(card.id, card.size)}
        />
      )}

      {/* TAB 2: INTELLIGENCE */}
      {activeSubTab === "intelligence" && (
        <ReorderableWidgetGrid
          cards={visibleIntelligenceCards}
          isEditMode={isStatsEditMode}
          onReorder={reorderStatsCards}
          onEnterEditMode={() => setIsStatsEditMode(true)}
          onCycleSize={cycleStatsCardSize}
          onHide={toggleStatsCardVisibility}
          renderCard={(card) => renderStatisticsCard(card.id, card.size)}
        />
      )}

      {/* TAB 3: CASHFLOW */}
      {activeSubTab === "cashflow" && (
        <ReorderableWidgetGrid
          cards={visibleCashflowCards}
          isEditMode={isStatsEditMode}
          onReorder={reorderStatsCards}
          onEnterEditMode={() => setIsStatsEditMode(true)}
          onCycleSize={cycleStatsCardSize}
          onHide={toggleStatsCardVisibility}
          renderCard={(card) => renderStatisticsCard(card.id, card.size)}
        />
      )}

      {/* TAB 4: SIMULATION */}
      {activeSubTab === "simulation" && (
        <ReorderableWidgetGrid
          cards={visibleSimulationCards}
          isEditMode={isStatsEditMode}
          onReorder={reorderStatsCards}
          onEnterEditMode={() => setIsStatsEditMode(true)}
          onCycleSize={cycleStatsCardSize}
          onHide={toggleStatsCardVisibility}
          renderCard={(card) => renderStatisticsCard(card.id, card.size)}
        />
      )}

      {/* Comprehensive Category & Parent Breakdown BottomSheet */}
      <CategoryAllDetailsSheet
        isOpen={allDetailsOpen}
        onClose={() => setAllDetailsOpen(false)}
        isIndonesian={isIndonesian}
        breakdownType={breakdownType}
        groupMode={groupMode}
        setGroupMode={setGroupMode}
        categoryStats={categoryStats}
        parentCategoryStats={parentCategoryStats}
        totalBreakdownAmount={totalBreakdownAmount}
        donutColors={colors.donut}
        categoryShifts={intel.categoryShifts}
        onSelectCategoryShift={setSelectedCategoryShift}
        formatWithPreferred={formatWithPreferred}
      />

      {/* All Analytics Modals, Simulators & Customization Sheets */}
      <StatisticsModalsContainer
        isIndonesian={isIndonesian}
        hideBalance={hideBalance}
        range={range}
        rangeTitle={rangeTitle}
        selectedYear={selectedYear}
        activeMonthDate={activeMonthDate}
        allTxs={allTxs}
        rangeTxs={rangeTxs}
        categories={categories}
        wallets={wallets}
        netWorth={netWorth}
        totalIncome={totalIncome}
        totalExpense={totalExpense}
        healthScore={healthScore}
        savingsRate={savingsRate}
        intelTotalIncome={intel.totalIncome}
        intelTotalExpense={intel.totalExpense}
        personalBaselines={intel.personalBaselines}
        categoryShifts={intel.categoryShifts}
        personalFinancialModel={personalFinancialModel}
        sankeyOpen={sankeyOpen}
        setSankeyOpen={setSankeyOpen}
        selectedCategoryShift={selectedCategoryShift}
        setSelectedCategoryShift={setSelectedCategoryShift}
        personalModelOpen={personalModelOpen}
        setPersonalModelOpen={setPersonalModelOpen}
        healthDiagnosticOpen={healthDiagnosticOpen}
        setHealthDiagnosticOpen={setHealthDiagnosticOpen}
        wrappedOpen={wrappedOpen}
        setWrappedOpen={setWrappedOpen}
        assetValuationOpen={assetValuationOpen}
        setAssetValuationOpen={setAssetValuationOpen}
        monteCarloOpen={monteCarloOpen}
        setMonteCarloOpen={setMonteCarloOpen}
        firePlannerOpen={firePlannerOpen}
        setFirePlannerOpen={setFirePlannerOpen}
        whatIfSheetOpen={whatIfSheetOpen}
        setWhatIfSheetOpen={setWhatIfSheetOpen}
        isStatsEditMode={isStatsEditMode}
        setIsStatsEditMode={setIsStatsEditMode}
        resetStatsLayout={resetStatsLayout}
        hiddenStatsCards={hiddenStatsCards}
        toggleStatsCardVisibility={toggleStatsCardVisibility}
        customizeStatsOpen={customizeStatsOpen}
        setCustomizeStatsOpen={setCustomizeStatsOpen}
        statsWidgets={statsWidgets}
        applyStatsPreset={applyStatsPreset}
        activeStatsPresetKey={activeStatsPresetKey}
        setActiveStatsPresetKey={setActiveStatsPresetKey}
      />
    </div>
  );
}
