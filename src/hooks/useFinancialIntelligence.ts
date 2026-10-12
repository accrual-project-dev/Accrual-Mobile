import { useMemo } from "react";
import { getDaysInMonth, isSameMonth, subMonths, format, subDays } from "date-fns";
import type { Transaction, Bill, Category, Goal } from "../lib/types";
import { useLanguage } from "../contexts/LanguageContext";
import { formatRupiah } from "../lib/utils";
import {
  computeMonthAggregates,
  computeSpendingPace,
  computeBudgetRisk,
  computeCategoryMoMChanges,
  generateActionCenterInsight,
  generateMonthlyFinancialReview,
  getMonthTransactions,
  calculatePersonalBaselines,
  detectBehavioralPatterns,
  calculateLongitudinalTimeline,
  calculateGoalPlanning,
  detectRecurringTransactions,
  calculateExpenseStructure,
  calculateCashflowFloor,
  calculateLiquidityHorizon,
  calculateExpenseVolatility,
  getBudgetPeriodInterval,
  filterTransactionsByBudgetPeriod,
  type BudgetPeriodInterval,
  type BudgetRiskLevel,
  type CategoryMoMShift,
  type ActionCenterInsight,
  type MonthlyFinancialReviewData,
  type PersonalBaselineResult,
  type BehavioralPattern,
  type LongitudinalTimelineResult,
  type GoalPlanningResult,
  type DetectedRecurringItem,
  type ExpenseStructureResult,
  type CashflowFloorResult,
  type LiquidityHorizonResult,
  type ExpenseVolatilityResult,
  type CashflowCalendarDayPoint,
  type ExpenseClassification,
} from "../lib/financialMath";

export type { BudgetPeriodInterval };

export type {
  BudgetRiskLevel,
  CategoryMoMShift,
  ActionCenterInsight,
  MonthlyFinancialReviewData,
  PersonalBaselineResult,
  BehavioralPattern,
  LongitudinalTimelineResult,
  GoalPlanningResult,
  DetectedRecurringItem,
  ExpenseStructureResult,
  CashflowFloorResult,
  LiquidityHorizonResult,
  ExpenseVolatilityResult,
  CashflowCalendarDayPoint,
  ExpenseClassification,
};
export type MomentumState = "positive" | "neutral" | "negative";

interface FinancialIntelligenceOptions {
  transactions: Transaction[];
  budgetTarget: number;
  budgetPeriodStart?: number;
  totalAssets: number;
  liquidAssets?: number;
  liquidAccounts?: Array<{ name: string; balance: number; icon: string }>;
  bills: Bill[];
  categories?: Category[];
  categoryOverrides?: Record<string, ExpenseClassification>;
  activeMonthDate?: Date;
}

const EMPTY_CATEGORIES: Category[] = [];
const EMPTY_CATEGORY_OVERRIDES: Record<string, ExpenseClassification> = {};

export function useFinancialIntelligence({
  transactions,
  budgetTarget,
  budgetPeriodStart = 1,
  totalAssets,
  liquidAssets,
  liquidAccounts,
  bills,
  categories = EMPTY_CATEGORIES,
  categoryOverrides = EMPTY_CATEGORY_OVERRIDES,
  activeMonthDate,
}: FinancialIntelligenceOptions) {
  const { language } = useLanguage();
  const isIndonesian = language === "id";
  const activeMonthTimestamp = activeMonthDate ? activeMonthDate.getTime() : null;

  return useMemo(() => {
    const now = new Date();
    const referenceDate = activeMonthDate ?? now;
    const isCurrentReferenceMonth = isSameMonth(referenceDate, now);
    const currentYear = referenceDate.getFullYear();
    const currentMonth = referenceDate.getMonth() + 1;
    const totalDays = getDaysInMonth(referenceDate);
    const daysElapsed = isSameMonth(referenceDate, now)
      ? now.getDate()
      : totalDays;

    // 1. Current Month Aggregates
    const currentMonthAgg = computeMonthAggregates(
      transactions,
      currentYear,
      currentMonth,
    );
    const { totalIncome, totalExpense, netCashflow, savingsRate } =
      currentMonthAgg;

    // 2. Previous Month Aggregates
    const prevDate = subMonths(referenceDate, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth() + 1;
    const prevMonthAgg = computeMonthAggregates(
      transactions,
      prevYear,
      prevMonth,
    );

    // 3. Personal Historical Baselines (Phase II)
    const personalBaselines = calculatePersonalBaselines(
      transactions,
      categories,
      referenceDate,
      language,
    );

    // 4. Behavioral Spending Patterns (Phase II)
    const behavioralPatterns = detectBehavioralPatterns(
      transactions,
      personalBaselines,
      referenceDate,
      language,
    );

    // 5. Spending Pace & Projections (Custom Payday Interval Aware)
    const budgetInterval = getBudgetPeriodInterval(referenceDate, budgetPeriodStart);
    const isCustomCycle = budgetPeriodStart > 1;
    const effectiveTotalDays = isCustomCycle ? budgetInterval.totalDays : totalDays;
    const effectiveDaysElapsed = isCustomCycle ? budgetInterval.daysElapsed : daysElapsed;

    const budgetCycleTxs = isCustomCycle
      ? filterTransactionsByBudgetPeriod(transactions, budgetInterval)
      : null;
    const budgetExpense = budgetCycleTxs
      ? budgetCycleTxs
          .filter((t) => t.type === "expense")
          .reduce((sum, t) => sum + (t.amount || 0), 0)
      : totalExpense;

    const budget = budgetTarget > 0 ? budgetTarget : 0;
    const pace = computeSpendingPace(
      budgetExpense,
      budget,
      effectiveDaysElapsed,
      effectiveTotalDays,
    );
    const risk = computeBudgetRisk(pace.consumedPct, pace.timePct, budget, language);

    // 6. Category MoM Shifts
    const currentMonthTxs = getMonthTransactions(
      transactions,
      currentYear,
      currentMonth,
    );
    const prevMonthTxs = getMonthTransactions(
      transactions,
      prevYear,
      prevMonth,
    );
    const categoryShifts = computeCategoryMoMChanges(
      currentMonthTxs,
      prevMonthTxs,
      categories,
    );
    const categoryMoMMap = new Map<string, CategoryMoMShift>();
    categoryShifts.forEach((c) => categoryMoMMap.set(c.categoryId, c));

    // 7. Financial Momentum
    let momentum: MomentumState = "neutral";
    let momentumReason = isIndonesian
      ? "Laju pemasukan dan pengeluaran seimbang"
      : "Balanced income and expense pace";

    if (
      netCashflow > 0 &&
      (!budget || !pace.isAheadOfPace || savingsRate >= 25)
    ) {
      momentum = "positive";
      momentumReason =
        savingsRate >= 30
          ? (isIndonesian
              ? `Rasio tabungan kuat ${savingsRate.toFixed(0)}% dengan arus kas sehat`
              : `Strong ${savingsRate.toFixed(0)}% savings rate with healthy cashflow`)
          : (isIndonesian
              ? `Surplus arus kas dan laju pengeluaran terkendali`
              : `Surplus cashflow and controlled spending pace`);
    } else if (
      netCashflow < 0 ||
      (budget > 0 && risk.riskLevel === "AT RISK")
    ) {
      momentum = "negative";
      momentumReason =
        netCashflow < 0
          ? (isIndonesian
              ? `Pengeluaran melebihi pemasukan ${isCurrentReferenceMonth ? "bulan ini" : "di bulan terpilih"} sebesar ${formatRupiah(Math.abs(netCashflow))}`
              : `Outflow exceeds inflow ${isCurrentReferenceMonth ? "this month" : "in the selected month"} by ${formatRupiah(Math.abs(netCashflow))}`)
          : (isIndonesian
              ? `Laju belanja meningkat terhadap batas anggaran`
              : `Spending pace is elevated against budget limit`);
    } else {
      momentum = "neutral";
      momentumReason = isIndonesian
        ? `Arus kas stabil dengan ${savingsRate.toFixed(0)}% tersimpan`
        : `Steady cashflow with ${savingsRate.toFixed(0)}% saved`;
    }

    // 8. Safety Buffer
    const unpaidUpcomingBills = bills.filter((b) => !b.is_paid);
    const committedAmount = unpaidUpcomingBills.reduce(
      (s, b) => s + Number(b.amount || 0),
      0,
    );
    const safeToSpend = Math.max(0, totalAssets - committedAmount);

    // 9. Financial Action Center Insight (Extended with Personal Baseline)
    const actionCenterInsight = generateActionCenterInsight({
      totalExpense,
      budget,
      projectedMonthEnd: pace.projectedMonthEnd,
      projectedVariance: pace.projectedVariance,
      budgetRisk: risk.riskLevel,
      isAheadOfPace: pace.isAheadOfPace,
      paceDiff: pace.paceDiff,
      consumedPct: pace.consumedPct,
      timePct: pace.timePct,
      categoryShifts,
      safeToSpend,
      unpaidBillsCount: unpaidUpcomingBills.length,
      language,
    });

    // 10. Monthly Financial Review (for Statistics Page)
    const activeReviewTxs = getMonthTransactions(
      transactions,
      referenceDate.getFullYear(),
      referenceDate.getMonth() + 1,
    );
    const activePrevReviewDate = subMonths(referenceDate, 1);
    const activePrevReviewTxs = getMonthTransactions(
      transactions,
      activePrevReviewDate.getFullYear(),
      activePrevReviewDate.getMonth() + 1,
    );

    const monthlyReview = generateMonthlyFinancialReview(
      activeReviewTxs,
      activePrevReviewTxs,
      categories,
      budget,
      referenceDate,
      language,
    );

    // Enrich Monthly Review with Baseline Comparison if available
    if (personalBaselines.status !== "insufficient") {
      const minStr = formatRupiah(personalBaselines.typicalExpenseRange[0]);
      const maxStr = formatRupiah(personalBaselines.typicalExpenseRange[1]);
      monthlyReview.baselineComparison = {
        typicalRangeText: `${minStr} – ${maxStr}`,
        statusText:
          personalBaselines.currentMonthStatus === "above_range"
            ? (isIndonesian ? "Di atas rentang normal bulanan Anda" : "Above your typical monthly range")
            : personalBaselines.currentMonthStatus === "below_range"
              ? (isIndonesian ? "Di bawah rentang normal bulanan Anda" : "Below your typical monthly range")
              : (isIndonesian ? "Dalam rentang normal historis Anda" : "Within your typical monthly range"),
        isAboveRange: personalBaselines.currentMonthStatus === "above_range",
      };
    }

    // 11. Longitudinal Timeline Helper (Phase II)
    const getLongitudinalTimeline = (
      range: "3M" | "6M" | "12M" | "ALL" = "6M",
    ) => {
      return calculateLongitudinalTimeline(transactions, range, referenceDate, language);
    };

    // 12. Planning & Goal Trajectory Helper (Phase II)
    const getGoalPlanning = (goal: Goal) => {
      return calculateGoalPlanning(goal, personalBaselines, referenceDate, language);
    };

    // 13. Helpers for "Why?" Drill-Down Insights
    const explainCategory = (catId: string) => {
      return categoryMoMMap.get(catId) || null;
    };

    const explainExpenseChange = () => {
      const topContributors = categoryShifts
        .filter((s) => s.deltaAmount !== 0)
        .slice(0, 4);
      return {
        totalCurrent: totalExpense,
        totalPrevious: prevMonthAgg.totalExpense,
        delta: totalExpense - prevMonthAgg.totalExpense,
        pctChange:
          prevMonthAgg.totalExpense > 0
            ? Math.round(
                ((totalExpense - prevMonthAgg.totalExpense) /
                  prevMonthAgg.totalExpense) *
                  100,
              )
            : 0,
        topContributors,
      };
    };

    // 14. Phase III: Recurring Transaction Detection
    const detectedRecurring = detectRecurringTransactions(
      transactions,
      bills,
      categories,
      referenceDate,
      language,
    );

    // 15. Phase III: Expense Structure (Fixed, Variable, Discretionary)
    const expenseStructure = calculateExpenseStructure(
      activeReviewTxs,
      detectedRecurring,
      categoryOverrides,
      activeMonthDate,
    );

    // 16. Phase III: Cashflow Calendar & Cashflow Floor
    const effectiveLiquidAssets =
      liquidAssets !== undefined ? liquidAssets : totalAssets;
    const cashflowFloor = calculateCashflowFloor(
      effectiveLiquidAssets,
      bills,
      detectedRecurring,
      14,
      referenceDate,
      language,
    );
    const getCashflowHorizon = (days = 14) => {
      return calculateCashflowFloor(
        effectiveLiquidAssets,
        bills,
        detectedRecurring,
        days,
        referenceDate,
        language,
      );
    };

    // 17. Phase III: Liquidity Horizon
    const liquidityHorizon = calculateLiquidityHorizon(
      effectiveLiquidAssets,
      personalBaselines,
      expenseStructure,
      liquidAccounts,
      language,
    );

    // 18. Expense Volatility (Spending Stability)
    const expenseVolatility = calculateExpenseVolatility(
      transactions,
      referenceDate,
      language,
    );

    // 19. Daily Logging Streak (Gamification & Retention)
    const uniqueTxDays = new Set(
      transactions
        .filter((t) => t.occurred_on)
        .map((t) => t.occurred_on.slice(0, 10))
    );
    const todayStr = format(now, "yyyy-MM-dd");
    const yesterdayStr = format(subDays(now, 1), "yyyy-MM-dd");
    const loggedToday = uniqueTxDays.has(todayStr);
    const loggedYesterday = uniqueTxDays.has(yesterdayStr);

    let loggingStreak = 0;
    if (loggedToday || loggedYesterday) {
      let checkDate = loggedToday ? now : subDays(now, 1);
      while (uniqueTxDays.has(format(checkDate, "yyyy-MM-dd"))) {
        loggingStreak++;
        checkDate = subDays(checkDate, 1);
      }
    }

    return {
      daysElapsed,
      totalDays,
      totalIncome,
      totalExpense,
      netCashflow,
      savingsRate,
      loggingStreak,
      loggedToday,
      // Spending Pace
      budget,
      budgetExpense,
      budgetInterval,
      expectedPace: pace.expectedPace,
      paceDiff: pace.paceDiff,
      isAheadOfPace: pace.isAheadOfPace,
      // Projection
      dailyAvg: pace.dailyAvg,
      projectedMonthEnd: pace.projectedMonthEnd,
      projectedVariance: pace.projectedVariance,
      // Risk & Momentum
      budgetRisk: risk.riskLevel,
      budgetRiskReason: risk.reason,
      consumedPct: pace.consumedPct,
      timePct: pace.timePct,
      momentum,
      momentumReason,
      // Safety Buffer
      totalAssets,
      liquidAssets: effectiveLiquidAssets,
      committedAmount,
      safeToSpend,
      unpaidBillsCount: unpaidUpcomingBills.length,
      // Phase II Personal Financial Intelligence
      personalBaselines,
      behavioralPatterns,
      getLongitudinalTimeline,
      getGoalPlanning,
      // Phase III Cashflow Intelligence & Financial Structure
      detectedRecurring,
      expenseStructure,
      cashflowFloor,
      getCashflowHorizon,
      liquidityHorizon,
      // Expense Volatility
      expenseVolatility,
      // Intelligence Layers
      actionCenterInsight,
      monthlyReview,
      categoryShifts,
      categoryMoMMap,
      explainCategory,
      explainExpenseChange,
    };
  }, [
    transactions,
    budgetTarget,
    budgetPeriodStart,
    totalAssets,
    liquidAssets,
    liquidAccounts,
    bills,
    categories,
    categoryOverrides,
    activeMonthTimestamp,
    language,
    isIndonesian,
  ]);
}
