import React from "react";
import {
  Bell,
  Check,
  CalendarDays,
  Target,
} from "lucide-react";
import { useSubscription } from "../../contexts/SubscriptionContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import { format, isToday } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { WidgetSize } from "../../lib/widgetLayoutTypes";
import { triggerHaptic } from "../../lib/haptics";
import { getBillDueStatusLabel, getDaysUntilDue } from "../../hooks/useBills";
import { resolveTransactionCategory } from "../../lib/categoryResolver";
import { IconRenderer } from "../ui/IconRenderer";
import { BalanceCard } from "../ui/BalanceCard";
import { ActionCenterCard } from "./ActionCenterCard";
import { CashflowPulseCard } from "./CashflowPulseCard";
import { ExpenseVolatilityCard } from "./ExpenseVolatilityCard";
import { CategoryBudgetDeck } from "./CategoryBudgetDeck";
import { InvestmentPulseCard } from "./InvestmentPulseCard";
import { LiquidPositionHorizonHero, type HorizonAssetData, type StockRange } from "./LiquidPositionHorizonHero";
import {
  CompactSpendingStabilityHalf,
  CompactCashflowPulseHalf,
  CompactAIInsightsHalf,
  CompactGoalsHalf,
  CompactBillsHalf,
  CompactTopCategoriesHalf,
  CompactCategoryBudgetsHalf,
  CompactSavingsRateVelocityHalf,
  SavingsRingCard,
  SpendingVelocityBarCard,
  CategoryDonutCard,
  MiniHeatmapCard,
  HealthMeterCard,
  LiquidRunwayCard,
  CalendarCard,
  WidgetFallbackCard,
} from "./CompactHomeCards";
import { DebtReceivablesCard } from "../debt/DebtReceivablesCard";
import type { DebtReceivableSummary } from "../../types/debt";

export interface HomeWidgetRendererProps {
  cardId: string;
  size: WidgetSize;
  isEditMode?: boolean;
  intel: any;
  hideBalance: boolean;
  isDark: boolean;
  isIndonesian: boolean;
  allTxs: any[];
  monthTxs: any[];
  categories: any[];
  goals: any[];
  goalMilestonesMap: Map<string, any>;
  upcomingBills: any[];
  markBillPaid: any;
  budgetTarget?: number;
  dailyAverage: number;
  daysInMonth: number;
  totalExpense: number;
  liquidAssets: number;
  currentMonthStats: any;
  categoryDonutData: any[];
  last7DaysOutlays: any[];
  heatmapDaysData: any[];
  activeSpendDaysCount: number;
  healthScore: number;
  runwayMonths: number;
  calendarExpanded: boolean;
  setCalendarExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  calPad: number;
  calDays: Date[];
  compactDays: Date[];
  renderCalendarDay: (d: Date) => React.ReactNode;
  onOpenMetricDrillDown: (data: any) => void;
  onOpenGoalDetail: (goal: any) => void;
  onOpenBillManagement: () => void;
  onOpenPayBill: (bill: any) => void;
  assetData: HorizonAssetData;
  stockRange: StockRange;
  onRangeChange: (range: StockRange) => void;
  stockRangeLabels: Record<StockRange, string>;
  onToggleHideBalance: () => void;
  isColdLoading?: boolean;
  onOpenCategoryManagement: () => void;
  onOpenDebtReceivables?: () => void;
  debtSummary?: DebtReceivableSummary;
  navigate: (to: string) => void;
}

function HomeWidgetRendererComponent({
  cardId,
  size,
  isEditMode = false,
  intel,
  hideBalance,
  isDark,
  isIndonesian,
  allTxs,
  monthTxs,
  categories,
  goals,
  goalMilestonesMap,
  upcomingBills,
  markBillPaid,
  budgetTarget,
  dailyAverage,
  daysInMonth,
  totalExpense,
  liquidAssets,
  currentMonthStats,
  categoryDonutData,
  last7DaysOutlays,
  heatmapDaysData,
  activeSpendDaysCount,
  healthScore,
  runwayMonths,
  calendarExpanded,
  setCalendarExpanded,
  calPad,
  calDays,
  compactDays,
  renderCalendarDay,
  assetData,
  stockRange,
  onRangeChange,
  stockRangeLabels,
  onToggleHideBalance,
  isColdLoading,
  onOpenMetricDrillDown,
  onOpenGoalDetail,
  onOpenBillManagement,
  onOpenPayBill,
  onOpenCategoryManagement,
  onOpenDebtReceivables,
  debtSummary,
  navigate,
}: HomeWidgetRendererProps) {
  const { isPremium, openPaywall } = useSubscription();
  const { formatWithPreferred } = useCurrency();

  switch (cardId) {
    case "net_portfolio":
      return (
        <LiquidPositionHorizonHero
          assetData={assetData}
          stockRange={stockRange}
          onRangeChange={onRangeChange}
          stockRangeLabels={stockRangeLabels}
          isDark={isDark}
          isIndonesian={isIndonesian}
          hideBalance={hideBalance}
          onToggleHideBalance={onToggleHideBalance}
          isColdLoading={isColdLoading}
        />
      );
    case "portfolio_account":
      return <BalanceCard hideBalance={hideBalance} />;

    case "investment_pulse":
      return <InvestmentPulseCard />;

    case "spending_stability":
      if (!intel.expenseVolatility) {
        return isEditMode ? (
          <WidgetFallbackCard
            cardId={cardId}
            size={size === "half" ? "half" : "full"}
            isEditMode={isEditMode}
            isIndonesian={isIndonesian}
            isDark={isDark}
          />
        ) : null;
      }
      if (size === "half") {
        return (
          <CompactSpendingStabilityHalf
            level={
              intel.expenseVolatility.stability === "VOLATILE"
                ? "High"
                : intel.expenseVolatility.stability === "MODERATE"
                  ? "Moderate"
                  : "Low"
            }
            dailyAvg={dailyAverage}
            volatilityScore={(intel.expenseVolatility.score ?? 80) / 100}
            onOpenDetail={() => {
              onOpenMetricDrillDown({
                type: "snapshot",
                data: {
                  totalCurrent: dailyAverage,
                  totalPrevious: 0,
                  delta: 0,
                  pctChange: 0,
                  title: isIndonesian ? "Stabilitas Pengeluaran" : "Spending Stability",
                  subtitle: isIndonesian
                    ? `Konsistensi pengeluaran Anda dievaluasi sebagai ${intel.expenseVolatility.stability === "VOLATILE" ? "Tinggi (Volatil)" : intel.expenseVolatility.stability === "MODERATE" ? "Moderat" : "Stabil"} dengan rata-rata belanja ${formatWithPreferred(dailyAverage)}/hari.`
                    : `Your spending consistency is evaluated as ${intel.expenseVolatility.stability} with a daily average outlay of ${formatWithPreferred(dailyAverage)}/day.`,
                  badge: isIndonesian
                    ? intel.expenseVolatility.stability === "VOLATILE"
                      ? "VOLATIL"
                      : intel.expenseVolatility.stability === "MODERATE"
                        ? "MODERAT"
                        : "STABIL"
                    : intel.expenseVolatility.stability,
                  ctaLabel: isIndonesian ? "Lihat Rincian Analisis" : "View Analytics Breakdown",
                },
              });
            }}
          />
        );
      }
      return (
        <ExpenseVolatilityCard
          volatility={intel.expenseVolatility}
          hideBalance={hideBalance}
        />
      );

    case "cashflow_pulse":
      if (size === "half") {
        return (
          <div data-tour="quick-cashflow">
            <CompactCashflowPulseHalf
              netCashflow={intel.netCashflow}
              consumedPct={intel.consumedPct}
              isAheadOfPace={intel.isAheadOfPace}
              onOpenDetail={() => {
                onOpenMetricDrillDown({
                  type: "snapshot",
                  data: {
                    totalCurrent: intel.netCashflow,
                    totalPrevious: 0,
                    delta: intel.netCashflow,
                    pctChange: 0,
                    title: isIndonesian ? "Arus Kas Bersih" : "Net Cashflow",
                    subtitle: isIndonesian
                      ? `Bulan ini ditutup dengan ${intel.netCashflow >= 0 ? "surplus" : "defisit"} setelah pemasukan ${formatWithPreferred(intel.totalIncome)} dan pengeluaran ${formatWithPreferred(intel.totalExpense)}.`
                      : `This month closes at ${intel.netCashflow >= 0 ? "a surplus" : "a deficit"} after ${formatWithPreferred(intel.totalIncome)} inflow and ${formatWithPreferred(intel.totalExpense)} outflow.`,
                    badge: isIndonesian ? "Bulan Ini" : "Current Month",
                    ctaLabel: isIndonesian ? "Lihat Analisis Lengkap" : "View Full Analytics Breakdown",
                  },
                });
              }}
            />
          </div>
        );
      }
      return (
        <div data-tour="quick-cashflow">
          <CashflowPulseCard
            netCashflow={intel.netCashflow}
            totalIncome={intel.totalIncome}
            totalExpense={intel.totalExpense}
            dailyAverage={dailyAverage}
            daysElapsed={daysInMonth}
            savingsRate={intel.savingsRate}
            momentum={intel.momentum}
            momentumReason={intel.momentumReason}
            hideBalance={hideBalance}
            budgetTarget={budgetTarget}
            budgetRisk={intel.budgetRisk}
            consumedPct={intel.consumedPct}
            isAheadOfPace={intel.isAheadOfPace}
            paceDiff={intel.paceDiff}
            onOpenDrillDown={(mode) => {
              if (mode === "budget") {
                onOpenMetricDrillDown({
                  type: "budget_risk",
                  data: {
                    totalCurrent: totalExpense,
                    totalPrevious: 0,
                    delta: 0,
                    pctChange: 0,
                    budget: budgetTarget,
                    consumedPct: intel.consumedPct,
                    timePct: intel.timePct,
                    budgetRisk: intel.budgetRisk,
                    budgetRiskReason: intel.budgetRiskReason,
                  },
                });
              } else if (mode === "net") {
                onOpenMetricDrillDown({
                  type: "snapshot",
                  data: {
                    totalCurrent: intel.netCashflow,
                    totalPrevious: 0,
                    delta: intel.netCashflow,
                    pctChange: 0,
                    title: isIndonesian ? "Arus Kas Bersih" : "Net Cashflow",
                    subtitle: isIndonesian
                      ? `Bulan ini ditutup dengan ${intel.netCashflow >= 0 ? "surplus" : "defisit"} setelah pemasukan ${formatWithPreferred(intel.totalIncome)} dan pengeluaran ${formatWithPreferred(intel.totalExpense)}.`
                      : `This month closes at ${intel.netCashflow >= 0 ? "a surplus" : "a deficit"} after ${formatWithPreferred(intel.totalIncome)} inflow and ${formatWithPreferred(intel.totalExpense)} outflow.`,
                    badge: isIndonesian ? "Bulan Ini" : "Current Month",
                    ctaLabel: isIndonesian ? "Lihat Analisis Lengkap" : "View Full Analytics Breakdown",
                  },
                });
              } else {
                const exp = intel.explainExpenseChange();
                onOpenMetricDrillDown({
                  type: "snapshot",
                  data: {
                    totalCurrent: intel.totalExpense,
                    totalPrevious: exp.totalPrevious,
                    delta: exp.delta,
                    pctChange: exp.pctChange,
                    title: isIndonesian ? "Total Pengeluaran" : "Total Outflow",
                    subtitle: isIndonesian
                      ? `Pengeluaran bulan berjalan adalah ${formatWithPreferred(intel.totalExpense)}. Dibandingkan bulan sebelumnya, perubahannya ${exp.delta >= 0 ? "meningkat" : "menurun"} sebesar ${formatWithPreferred(Math.abs(exp.delta))}.`
                      : `Current-month spending is ${formatWithPreferred(intel.totalExpense)}. Compared with the previous month, the change is ${exp.delta >= 0 ? "an increase" : "a decrease"} of ${formatWithPreferred(Math.abs(exp.delta))}.`,
                    badge: isIndonesian ? "Bulan Ini" : "Current Month",
                    ctaLabel: isIndonesian ? "Lihat Rincian Analisis" : "View Analytics Breakdown",
                  },
                });
              }
            }}
          />
        </div>
      );

    case "ai_insights":
      if (!intel.actionCenterInsight) {
        return isEditMode ? (
          <WidgetFallbackCard
            cardId={cardId}
            size={size === "half" ? "half" : "full"}
            isEditMode={isEditMode}
            isIndonesian={isIndonesian}
            isDark={isDark}
          />
        ) : null;
      }
      if (size === "half") {
        return (
          <CompactAIInsightsHalf
            insightTitle={intel.actionCenterInsight.title}
            insightCategory={intel.actionCenterInsight.badge}
            onOpenDetail={() => {
              onOpenMetricDrillDown({
                type: "snapshot",
                data: {
                  totalCurrent: 0,
                  totalPrevious: 0,
                  delta: 0,
                  pctChange: 0,
                  title:
                    intel.actionCenterInsight?.title ||
                    (isIndonesian ? "Peringatan Finansial" : "Financial Alert"),
                  subtitle:
                    intel.actionCenterInsight?.subtitle ||
                    (isIndonesian
                      ? "Terdeteksi pola pengeluaran anomali"
                      : "Anomalous spending detected"),
                  badge:
                    intel.actionCenterInsight?.badge ||
                    (isIndonesian ? "Wawasan" : "Insight"),
                  ctaLabel:
                    intel.actionCenterInsight?.actionLabel ||
                    (isIndonesian ? "Buka Pusat Aksi" : "Open Action Center"),
                },
              });
            }}
          />
        );
      }
      return (
        <ActionCenterCard
          insight={intel.actionCenterInsight}
          transactions={allTxs}
          budgetTarget={budgetTarget}
          dailyAverage={intel.dailyAvg}
          projectedMonthEnd={intel.projectedMonthEnd}
          totalExpense={intel.totalExpense}
          totalIncome={intel.totalIncome}
        />
      );

    case "activity_heatmap":
      return (
        <section className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <span
              className="text-[11px] font-bold tracking-wider block"
              style={{ color: "var(--text-tertiary)" }}
            >
              {calendarExpanded
                ? isIndonesian
                  ? "Aktivitas Bulanan"
                  : "Monthly Activity"
                : isIndonesian
                  ? "Aktivitas 7 Hari Terakhir"
                  : "Past 7 Days Activity"}
            </span>
            {!isEditMode && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setCalendarExpanded((prev) => !prev);
                }}
                className="text-[10px] font-bold px-2.5 py-1 rounded-full transition-all active:scale-95 cursor-pointer select-none flex items-center gap-1"
                style={{
                  background: "var(--glass-fill)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                <CalendarDays size={12} />
                <span>
                  {calendarExpanded
                    ? isIndonesian
                      ? "Ringkas (7H)"
                      : "Compact (7D)"
                    : isIndonesian
                      ? "Bulan Penuh"
                      : "Full Month"}
                </span>
              </button>
            )}
          </div>

          <div
            className="glass-surface p-3.5 rounded-[22px]"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--glass-border)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            {calendarExpanded ? (
              <div className="grid grid-cols-7 gap-y-1 gap-x-1 text-center">
                {(isIndonesian
                  ? ["M", "S", "S", "R", "K", "J", "S"]
                  : ["S", "M", "T", "W", "T", "F", "S"]
                ).map((w, i) => (
                  <div
                    key={i}
                    className="text-[9px] font-bold mb-0.5"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {w}
                  </div>
                ))}
                {Array.from({ length: calPad }).map((_, i) => (
                  <div key={`pad-${i}`} />
                ))}
                {calDays.map((d) => renderCalendarDay(d))}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-y-1 gap-x-1 text-center">
                {compactDays.map((d) => (
                  <div
                    key={`h-${d.toISOString()}`}
                    className="text-[9px] font-bold mb-0.5"
                    style={{
                      color: isToday(d)
                        ? "var(--text-primary)"
                        : "var(--text-tertiary)",
                    }}
                  >
                    {format(d, "EEE", {
                      locale: isIndonesian ? idLocale : undefined,
                    })}
                  </div>
                ))}
                {compactDays.map((d) => renderCalendarDay(d))}
              </div>
            )}
          </div>
        </section>
      );

    case "financial_goals":
      if (goals.length === 0) {
        return isEditMode ? (
          <WidgetFallbackCard
            cardId={cardId}
            size={size === "half" ? "half" : "full"}
            isEditMode={isEditMode}
            isIndonesian={isIndonesian}
            isDark={isDark}
          />
        ) : null;
      }
      if (size === "half") {
        const g: any = goals[0];
        const curr = Number(g.currentAmount || g.current_amount || 0);
        const tgt = Number(g.targetAmount || g.target_amount || 1);
        const pct = Math.min(100, Math.round((curr / tgt) * 100));
        return (
          <CompactGoalsHalf
            goalTitle={
              g.title || g.name || (isIndonesian ? "Target Tabungan" : "Savings Goal")
            }
            progressPct={pct}
            currentAmount={curr}
            targetAmount={tgt}
            onOpenDetail={() => onOpenGoalDetail(g)}
          />
        );
      }
      return (
        <section className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <span
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? "Target Finansial" : "Financial Goals"}
            </span>
            {!isEditMode && (
              <span
                className="text-[11px] font-bold"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian
                  ? `${goals.length} Target`
                  : `${goals.length} ${goals.length === 1 ? "Goal" : "Goals"}`}
              </span>
            )}
          </div>

          <div className="space-y-2.5">
            {goals.slice(0, 3).map((g: any) => {
              const pct = Math.min(
                100,
                Math.round((g.currentAmount / (g.targetAmount || 1)) * 100),
              );
              return (
                <div
                  key={g.id}
                  onClick={() => {
                    onOpenGoalDetail(g);
                    triggerHaptic("light");
                  }}
                  className="p-4 rounded-[22px] glass-surface cursor-pointer active:scale-[0.98] transition-transform"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--glass-border)",
                    boxShadow: "var(--shadow-card)",
                  }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-[15px]"
                        style={{
                          background: "var(--glass-fill)",
                          border: "1px solid var(--glass-border)",
                        }}
                      >
                        {g.icon ? (
                          <IconRenderer icon={g.icon} size="w-4 h-4" />
                        ) : (
                          <Target
                            size={16}
                            style={{ color: "var(--text-primary)" }}
                          />
                        )}
                      </div>
                      <div>
                        <p
                          className="text-[13px] font-bold leading-tight"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {g.title}
                        </p>
                        <p
                          className="text-[11px] font-medium"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          {formatWithPreferred(g.currentAmount)}{" "}
                          {isIndonesian ? "dari" : "of"}{" "}
                          {formatWithPreferred(g.targetAmount)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {goalMilestonesMap.get(g.id) && (
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full truncate"
                          style={{
                            background: "var(--glass-fill)",
                            color: goalMilestonesMap.get(g.id)?.isComplete
                              ? "var(--accent)"
                              : "var(--text-secondary)",
                            border: "1px solid var(--glass-border)",
                          }}
                        >
                          {goalMilestonesMap.get(g.id)?.label}
                        </span>
                      )}
                      <span
                        className="amount text-[12px] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          background: "var(--glass-fill)",
                          color: "var(--text-primary)",
                          border: "1px solid var(--glass-border)",
                        }}
                      >
                        {pct}%
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div
                    className="h-2 w-full rounded-full overflow-hidden mt-2"
                    style={{
                      background: isDark
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(0,0,0,0.06)",
                    }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        background: "var(--text-primary)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      );

    case "upcoming_bills":
      if (upcomingBills.length === 0) {
        return isEditMode ? (
          <WidgetFallbackCard
            cardId={cardId}
            size={size === "half" ? "half" : "full"}
            isEditMode={isEditMode}
            isIndonesian={isIndonesian}
            isDark={isDark}
            onAction={onOpenBillManagement}
          />
        ) : null;
      }
      if (size === "half") {
        const nextBill: any = upcomingBills[0];
        const days = getDaysUntilDue(nextBill.due_date);
        return (
          <CompactBillsHalf
            nextBillName={nextBill.title || "Bill"}
            nextBillAmount={Number(nextBill.amount || 0)}
            daysLeft={days}
            onOpenDetail={() => {
              triggerHaptic("light");
              onOpenBillManagement();
            }}
          />
        );
      }
      return (
        <section className="space-y-2">
          <div
            className="flex items-center justify-between px-1 cursor-pointer select-none"
            onClick={() => {
              if (isEditMode) return;
              triggerHaptic("light");
              onOpenBillManagement();
            }}
          >
            <span
              className="text-[11px] font-semibold uppercase tracking-wider block"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? "Tagihan Mendatang" : "Upcoming Bills"}
            </span>
            {!isEditMode && (
              <span
                className="text-[11px] font-medium hover:underline flex items-center gap-1"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Kelola Tagihan" : "Manage Bills"}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {upcomingBills.slice(0, 3).map((bill: any) => {
              const dueStatusLabel = getBillDueStatusLabel(
                bill.due_date,
                isIndonesian,
              );
              const isMarkingPaid =
                markBillPaid.isPending &&
                markBillPaid.variables?.bill.id === bill.id;
              return (
                <div
                  key={bill.id}
                  onClick={() => {
                    triggerHaptic("light");
                    onOpenBillManagement();
                  }}
                  className="glass-surface flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer active:scale-[0.99] transition-transform"
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--glass-border)",
                    boxShadow: "var(--shadow-card)",
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-[14px] shrink-0"
                    style={{
                      background: "var(--glass-fill)",
                      border: "1px solid var(--glass-border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <Bell size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[13px] font-semibold truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {bill.title}
                    </p>
                    <p
                      className="text-[11px]"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {dueStatusLabel}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <p
                      className="amount text-[14px] font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {formatWithPreferred(Number(bill.amount))}
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenPayBill(bill);
                        triggerHaptic("light");
                      }}
                      disabled={isMarkingPaid}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                      style={{
                        background: "var(--text-primary)",
                        color: "var(--bg-base)",
                      }}
                      title={isIndonesian ? "Bayar Tagihan" : "Pay Bill"}
                    >
                      <Check size={11} strokeWidth={2} />
                      <span>
                        {isMarkingPaid
                          ? isIndonesian
                            ? "Menyimpan..."
                            : "Saving..."
                          : isIndonesian
                            ? "Bayar"
                            : "Pay"}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Total Recurring Bills Runway & Calendar Link */}
            <div
              onClick={() => {
                triggerHaptic("light");
                navigate("/calendar");
              }}
              className="p-3.5 rounded-2xl glass-surface flex items-center justify-between mt-2.5 cursor-pointer active:scale-[0.99] transition-transform"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
                boxShadow: "var(--shadow-card)",
              }}
              title={
                isIndonesian
                  ? "Buka Kalender & Runway Tagihan"
                  : "View Calendar & Bill Runway"
              }
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{
                    background: "var(--glass-fill)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <CalendarDays size={13} />
                </div>
                <span
                  className="text-[12px] font-medium"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian
                    ? "Total Tagihan · Buka Kalender"
                    : "Total Upcoming Bills · View Calendar"}
                </span>
              </div>
              <span
                className="amount text-[14px] font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {formatWithPreferred(
                  upcomingBills.reduce(
                    (s: number, b: any) => s + Number(b.amount || 0),
                    0,
                  ),
                )}
              </span>
            </div>
          </div>
        </section>
      );

    case "debt_receivables":
      if (!debtSummary) {
        return isEditMode ? (
          <WidgetFallbackCard
            cardId={cardId}
            size={size === "half" ? "half" : "full"}
            isEditMode={isEditMode}
            isIndonesian={isIndonesian}
            isDark={isDark}
            onAction={onOpenDebtReceivables}
          />
        ) : null;
      }
      return (
        <DebtReceivablesCard
          summary={debtSummary}
          isDark={isDark}
          isIndonesian={isIndonesian}
          size={size === "half" ? "half" : "full"}
          isEditMode={isEditMode}
          onClick={() => {
            triggerHaptic("light");
            if (onOpenDebtReceivables) {
              onOpenDebtReceivables();
            } else {
              navigate("/assets");
            }
          }}
        />
      );

    case "category_budgets": {
      if (size === "half") {
        const configuredCats = categories.filter(
          (c: any) => c.type !== "income" && Number(c.budget_amount || 0) > 0,
        );

        if (configuredCats.length === 0) {
          return (
            <CompactCategoryBudgetsHalf
              totalEnvelopesCount={0}
              hideBalance={hideBalance}
              onOpenManage={onOpenCategoryManagement}
            />
          );
        }

        const spendMap = new Map<string, number>();
        monthTxs.forEach((t: any) => {
          if (t.type !== "expense") return;
          const isCorrection =
            t.note?.includes("[Correction]") ||
            t.note?.includes("Saldo Awal") ||
            t.note?.includes("Opening Balance");
          if (isCorrection) return;

          const amt = Number(t.amount || 0);
          const catId = t.category_id || "uncategorized";
          spendMap.set(catId, (spendMap.get(catId) || 0) + amt);
        });

        const items = configuredCats.map((cat: any) => {
          const spent = spendMap.get(cat.id) || 0;
          const budgetAmount = Number(cat.budget_amount || 0);
          const percentage =
            budgetAmount > 0 ? Math.round((spent / budgetAmount) * 100) : 0;
          const remaining = budgetAmount - spent;
          return {
            id: cat.id,
            name: cat.name,
            emoji: cat.emoji || "Wallet",
            budgetAmount,
            spent,
            percentage,
            remaining,
            isOverbudget: spent > budgetAmount,
          };
        });

        items.sort((a: any, b: any) => b.percentage - a.percentage);
        const topEnvelope = items[0];

        return (
          <CompactCategoryBudgetsHalf
            topEnvelope={topEnvelope}
            totalEnvelopesCount={configuredCats.length}
            hideBalance={hideBalance}
            onOpenManage={onOpenCategoryManagement}
          />
        );
      }

      return (
        <CategoryBudgetDeck
          onOpenManageCategories={onOpenCategoryManagement}
          hideBalance={hideBalance}
          isEditMode={isEditMode}
        />
      );
    }

    case "recent_transactions":
      if (allTxs.length === 0) {
        return isEditMode ? (
          <WidgetFallbackCard
            cardId={cardId}
            size={size === "half" ? "half" : "full"}
            isEditMode={isEditMode}
            isIndonesian={isIndonesian}
            isDark={isDark}
          />
        ) : null;
      }
      return (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3
              className="text-[13px] font-semibold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {isIndonesian ? "Transaksi Terkini" : "Recent Transactions"}
            </h3>
            {!isEditMode && (
              <span
                className="text-[11px] font-medium"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian
                  ? `${size === "half" ? "3" : "5"} Terakhir`
                  : `Latest ${size === "half" ? "3" : "5"}`}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {allTxs.slice(0, size === "half" ? 3 : 5).map((tx) => {
              const resCat = resolveTransactionCategory(tx, categories);
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 rounded-2xl glass-surface relative overflow-hidden"
                  style={{
                    background: isDark
                      ? "linear-gradient(160deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.015) 100%)"
                      : "linear-gradient(160deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 247, 250, 0.90) 100%)",
                    border: isDark
                      ? "1px solid rgba(255, 255, 255, 0.08)"
                      : "1px solid rgba(0, 0, 0, 0.06)",
                    boxShadow: isDark
                      ? "0 8px 24px -6px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.12)"
                      : "0 4px 14px -3px rgba(31, 36, 48, 0.06), inset 0 1px 0 #ffffff",
                    backdropFilter: "blur(24px) saturate(180%)",
                    WebkitBackdropFilter: "blur(24px) saturate(180%)",
                  }}
                >
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute left-[12%] right-[12%] top-[1px] h-[1.5px] rounded-full"
                    style={{
                      background: isDark
                        ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), rgba(255,255,255,0.45), rgba(255,255,255,0.25), transparent)"
                        : "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), rgba(255,255,255,1), rgba(255,255,255,0.8), transparent)",
                    }}
                  />
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: isDark
                          ? "rgba(255, 255, 255, 0.04)"
                          : "rgba(0, 0, 0, 0.035)",
                        border: isDark
                          ? "1px solid rgba(255, 255, 255, 0.08)"
                          : "1px solid rgba(0, 0, 0, 0.06)",
                      }}
                    >
                      <IconRenderer icon={resCat.emoji} size="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[var(--text-primary)] leading-tight truncate">
                        {resCat.name}
                      </p>
                      <p className="text-[11px] text-[var(--text-tertiary)] truncate max-w-[170px] mt-0.5">
                        {tx.note || tx.occurred_on}
                      </p>
                    </div>
                  </div>
                  <span
                    className="amount font-semibold text-[13px] shrink-0 ml-2"
                    style={{
                      color:
                        tx.type === "income"
                          ? "var(--accent)"
                          : tx.type === "transfer"
                            ? "var(--text-secondary)"
                            : "var(--text-primary)",
                    }}
                  >
                    {tx.type === "income"
                      ? "+"
                      : tx.type === "expense"
                        ? "-"
                        : ""}
                    {formatWithPreferred(Number(tx.amount))}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      );

    case "top_categories":
      if (
        !currentMonthStats.topExpenseCategories ||
        currentMonthStats.topExpenseCategories.length === 0
      ) {
        return isEditMode ? (
          <WidgetFallbackCard
            cardId={cardId}
            size={size === "half" ? "half" : "full"}
            isEditMode={isEditMode}
            isIndonesian={isIndonesian}
            isDark={isDark}
          />
        ) : null;
      }
      if (size === "half") {
        const topCat = currentMonthStats.topExpenseCategories[0];
        const pct =
          currentMonthStats.expense > 0
            ? Math.round((topCat.total / currentMonthStats.expense) * 100)
            : 0;
        return (
          <CompactTopCategoriesHalf
            topCategoryName={topCat.name}
            topCategoryAmount={topCat.total}
            topCategoryPct={pct}
            onOpenDetail={() => {
              onOpenMetricDrillDown({
                type: "snapshot",
                data: {
                  totalCurrent: topCat.total,
                  totalPrevious: 0,
                  delta: 0,
                  pctChange: 0,
                  title: isIndonesian
                    ? `Kategori Utama: ${topCat.name}`
                    : `Top Category: ${topCat.name}`,
                  subtitle: isIndonesian
                    ? `${topCat.name} adalah pendorong pengeluaran tertinggi Anda bulan ini (${formatWithPreferred(topCat.total)}), menyumbang ${pct}% dari total belanja bulanan.`
                    : `${topCat.name} is your highest expense driver this month (${formatWithPreferred(topCat.total)}), making up ${pct}% of total monthly spending.`,
                  badge: isIndonesian
                    ? `${pct}% dari Total`
                    : `${pct}% of Total`,
                  ctaLabel: isIndonesian
                    ? "Lihat Semua Kategori"
                    : "View All Categories",
                  onCta: () => navigate("/statistics"),
                },
              });
            }}
          />
        );
      }
      return (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3
              className="text-[13px] font-semibold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {isIndonesian
                ? "Kategori Pengeluaran Terbesar"
                : "Top Spending Categories"}
            </h3>
            {!isEditMode && (
              <span
                className="text-[11px] font-medium"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Bulan Ini" : "This Month"}
              </span>
            )}
          </div>
          <div
            className="p-4 rounded-3xl glass-surface border border-[var(--glass-border)] space-y-3"
            style={{
              background: "var(--bg-elevated)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            {currentMonthStats.topExpenseCategories.slice(0, 3).map((cat: any) => {
              const pct =
                currentMonthStats.expense > 0
                  ? Math.round((cat.total / currentMonthStats.expense) * 100)
                  : 0;
              return (
                <div key={cat.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[12px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <IconRenderer icon={cat.emoji} size="w-4 h-4" />
                      <span
                        className="font-medium truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {cat.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="font-semibold amount"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {formatWithPreferred(cat.total)}
                      </span>
                      <span
                        className="text-[10px] font-medium"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        ({pct}%)
                      </span>
                    </div>
                  </div>
                  <div
                    className="h-1.5 w-full rounded-full overflow-hidden"
                    style={{
                      background: isDark
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(0,0,0,0.06)",
                    }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(4, pct))}%`,
                        background: "var(--text-primary)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      );

    case "savings_rate_velocity": {
      const savingsRate =
        currentMonthStats.income > 0
          ? Math.max(
              0,
              Math.round(
                ((currentMonthStats.income - currentMonthStats.expense) /
                  currentMonthStats.income) *
                  100,
              ),
            )
          : 0;
      const runway =
        currentMonthStats.expense > 0
          ? liquidAssets / currentMonthStats.expense
          : 0;

      if (size === "half") {
        return (
          <CompactSavingsRateVelocityHalf
            savingsRate={savingsRate}
            runwayMonths={runway}
            onOpenDetail={() => {
              onOpenMetricDrillDown({
                type: "snapshot",
                data: {
                  totalCurrent:
                    currentMonthStats.income - currentMonthStats.expense,
                  totalPrevious: 0,
                  delta: 0,
                  pctChange: 0,
                  title: isIndonesian
                    ? "Telemetri Laju Tabungan"
                    : "Savings Telemetry",
                  subtitle: isIndonesian
                    ? `Rasio tabungan saat ini ${savingsRate}% dengan estimasi ketahanan dana likuid ${runway > 0 ? runway.toFixed(1) : "0"} bulan.`
                    : `Current savings rate is ${savingsRate}% with estimated liquid runway of ${runway > 0 ? runway.toFixed(1) : "0"} months.`,
                  badge: isIndonesian ? "Rasio & Runway" : "Rate & Runway",
                  ctaLabel: isIndonesian
                    ? "Lihat Analisis Statistik"
                    : "View Statistics Analytics",
                  onCta: () => navigate("/statistics"),
                },
              });
            }}
          />
        );
      }

      return (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3
              className="text-[13px] font-semibold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {isIndonesian
                ? "Rasio & Laju Tabungan"
                : "Savings Rate & Velocity"}
            </h3>
            <span
              className="text-[11px] font-medium"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? "Telemetri" : "Telemetry"}
            </span>
          </div>
          <div
            className="p-4 rounded-3xl glass-surface border border-[var(--glass-border)] grid grid-cols-2 gap-3"
            style={{
              background: "var(--bg-elevated)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div
              className="p-3 rounded-2xl space-y-1"
              style={{
                background: "var(--glass-fill)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <p
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Rasio Tabungan" : "Savings Rate"}
              </p>
              <p
                className="text-[20px] font-semibold tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                {savingsRate}%
              </p>
              <p
                className="text-[10px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian
                  ? "Sisa modal bersih"
                  : "Net capital retained"}
              </p>
            </div>
            <div
              className="p-3 rounded-2xl space-y-1"
              style={{
                background: "var(--glass-fill)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <p
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Runway Kas" : "Runway"}
              </p>
              <p
                className="text-[20px] font-semibold tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                {currentMonthStats.expense > 0
                  ? `${runway.toFixed(1)} ${isIndonesian ? "bln" : "mo"}`
                  : "∞"}
              </p>
              <p
                className="text-[10px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian
                  ? "Cadangan dana likuid"
                  : "Liquid reserves buffer"}
              </p>
            </div>
          </div>
        </section>
      );
    }

    case "savings_ring":
      return (
        <SavingsRingCard
          size={size}
          rate={intel.savingsRate}
          inflow={currentMonthStats.income}
          outflow={currentMonthStats.expense}
          onOpenDetail={() => {
            const netRetention =
              currentMonthStats.income - currentMonthStats.expense;
            const isSurplus = netRetention >= 0;
            onOpenMetricDrillDown({
              type: "snapshot",
              data: {
                totalCurrent: Math.abs(netRetention),
                totalPrevious: 0,
                delta: netRetention,
                pctChange: 0,
                displayValue: `${isSurplus ? "+" : "-"}${formatWithPreferred(Math.abs(netRetention))}`,
                title: isIndonesian ? "Telemetri Tabungan" : "Savings Telemetry",
                subtitle: isSurplus
                  ? isIndonesian
                    ? `Retensi modal bersih adalah ${intel.savingsRate.toFixed(1)}% dari total arus kas masuk bulanan (${formatWithPreferred(currentMonthStats.income)}). Modal yang tersimpan: ${formatWithPreferred(netRetention)}.`
                    : `Net capital retention is ${intel.savingsRate.toFixed(1)}% of total monthly inflow (${formatWithPreferred(currentMonthStats.income)}). Retained capital: ${formatWithPreferred(netRetention)}.`
                  : isIndonesian
                    ? `Pengeluaran (${formatWithPreferred(currentMonthStats.expense)}) melebihi pemasukan (${formatWithPreferred(currentMonthStats.income)}) bulan ini dengan defisit ${formatWithPreferred(Math.abs(netRetention))}.`
                    : `Outflow (${formatWithPreferred(currentMonthStats.expense)}) exceeds inflow (${formatWithPreferred(currentMonthStats.income)}) this month by a deficit of ${formatWithPreferred(Math.abs(netRetention))}.`,
                badge: isSurplus
                  ? isIndonesian
                    ? `${intel.savingsRate.toFixed(0)}% Ditabung`
                    : `${intel.savingsRate.toFixed(0)}% Saved`
                  : isIndonesian
                    ? "Defisit Kas"
                    : "Cash Deficit",
                hideGrid: true,
                items: [
                  {
                    label: isIndonesian ? "Pemasukan Kotor" : "Gross Inflow",
                    amount: currentMonthStats.income,
                    detail: isIndonesian
                      ? "Semua pendapatan & transfer masuk"
                      : "All earnings and incoming transfers",
                  },
                  {
                    label: isIndonesian ? "Pengeluaran Kotor" : "Gross Outflow",
                    amount: currentMonthStats.expense,
                    detail: isIndonesian
                      ? "Semua belanja & alokasi aset"
                      : "All spending and asset allocations",
                  },
                  {
                    label: isSurplus
                      ? isIndonesian
                        ? "Modal Bersih Ditahan"
                        : "Net Capital Retained"
                      : isIndonesian
                        ? "Defisit Kas Bersih"
                        : "Net Cash Deficit",
                    amount: Math.abs(netRetention),
                    valueText: `${isSurplus ? "+" : "-"}${formatWithPreferred(Math.abs(netRetention))}`,
                    detail: isSurplus
                      ? isIndonesian
                        ? "Modal tersimpan dalam periode"
                        : "Capital retained in period"
                      : isIndonesian
                        ? "Tambahan modal yang dibutuhkan"
                        : "Additional capital required",
                  },
                ],
                ctaLabel: isIndonesian
                  ? "Lihat Laporan Finansial"
                  : "View Financial Report",
                onCta: () => navigate("/statistics"),
              },
            });
          }}
        />
      );

    case "spending_velocity_bar":
      return (
        <SpendingVelocityBarCard
          size={size}
          dailyOutlays={last7DaysOutlays}
          dailyAverage={dailyAverage}
          onOpenDetail={() => {
            const total7d = last7DaysOutlays.reduce(
              (sum, d) => sum + d.amount,
              0,
            );
            const peak7d = last7DaysOutlays.reduce(
              (max, d) => (d.amount > max.amount ? d : max),
              last7DaysOutlays[0] || { dayLabel: "-", amount: 0 },
            );
            onOpenMetricDrillDown({
              type: "snapshot",
              data: {
                totalCurrent: total7d,
                totalPrevious: 0,
                delta: 0,
                pctChange: 0,
                displayValue: formatWithPreferred(total7d),
                title: isIndonesian
                  ? "Laju Pengeluaran 7-Hari"
                  : "7-Day Spending Velocity",
                subtitle: isIndonesian
                  ? `Total pengeluaran selama 7 hari terakhir adalah ${formatWithPreferred(total7d)} dengan rata-rata harian ${formatWithPreferred(Math.round(total7d / 7))}. Pengeluaran tertinggi pada ${peak7d.dayLabel} (${formatWithPreferred(peak7d.amount)}).`
                  : `Total outflow over the last 7 days is ${formatWithPreferred(total7d)} with a daily average of ${formatWithPreferred(Math.round(total7d / 7))}. Peak spending was on ${peak7d.dayLabel} (${formatWithPreferred(peak7d.amount)}).`,
                badge: isIndonesian ? "7 Hari Terakhir" : "Last 7 Days",
                hideGrid: true,
                items: last7DaysOutlays.map((d) => ({
                  label: `${d.dayLabel} ${isIndonesian ? "Pengeluaran" : "Outflow"}`,
                  amount: d.amount,
                  pct: total7d > 0 ? (d.amount / total7d) * 100 : 0,
                  detail:
                    d.amount > dailyAverage
                      ? isIndonesian
                        ? "Di atas rata-rata harian"
                        : "Above daily average"
                      : isIndonesian
                        ? "Sesuai laju aman"
                        : "Within pace",
                })),
                ctaLabel: isIndonesian
                  ? "Lihat Semua Transaksi"
                  : "View All Transactions",
                onCta: () => navigate("/transactions"),
              },
            });
          }}
        />
      );

    case "category_donut":
      return (
        <CategoryDonutCard
          size={size}
          categories={categoryDonutData}
          totalExpense={currentMonthStats.expense}
          onOpenDetail={() => {
            onOpenMetricDrillDown({
              type: "snapshot",
              data: {
                totalCurrent: currentMonthStats.expense,
                totalPrevious: 0,
                delta: -currentMonthStats.expense,
                pctChange: 0,
                displayValue: formatWithPreferred(currentMonthStats.expense),
                title: isIndonesian
                  ? "Alokasi Pengeluaran Kategori"
                  : "Category Expense Allocation",
                subtitle: isIndonesian
                  ? `Total pengeluaran kotor bulan ini adalah ${formatWithPreferred(currentMonthStats.expense)}. Pemasukan tercatat sebesar ${formatWithPreferred(currentMonthStats.income)}, menghasilkan saldo bersih bulanan ${formatWithPreferred(currentMonthStats.income - currentMonthStats.expense)}.`
                  : `Total gross outflow this month is ${formatWithPreferred(currentMonthStats.expense)}. Inflow is recorded at ${formatWithPreferred(currentMonthStats.income)}, resulting in a net monthly balance of ${formatWithPreferred(currentMonthStats.income - currentMonthStats.expense)}.`,
                badge: isIndonesian ? "Pengeluaran Kotor" : "Gross Outflow",
                hideGrid: true,
                items: categoryDonutData.map((c) => ({
                  label: c.name,
                  amount: c.amount,
                  pct: c.pct,
                  detail: `${c.pct.toFixed(0)}% ${isIndonesian ? "dari total pengeluaran" : "of total outflow"}${c.count ? ` (${c.count} ${isIndonesian ? "trx" : "txs"})` : ""}`,
                })),
                ctaLabel: isIndonesian
                  ? "Lihat Analisis di Statistik"
                  : "View Analytics in Statistics",
                onCta: () => navigate("/statistics"),
              },
            });
          }}
        />
      );

    case "mini_heatmap":
      return (
        <MiniHeatmapCard
          size={size}
          daysWithSpend={heatmapDaysData}
          activeDaysCount={activeSpendDaysCount}
          totalMonthSpend={currentMonthStats.expense}
          dailyAverage={dailyAverage}
          onOpenDetail={() => {
            const peak = heatmapDaysData.reduce(
              (max, d) => ((d.amount || 0) > (max.amount || 0) ? d : max),
              heatmapDaysData[0] || { day: 1, amount: 0 },
            );
            onOpenMetricDrillDown({
              type: "snapshot",
              data: {
                totalCurrent: currentMonthStats.expense,
                totalPrevious: 0,
                delta: 0,
                pctChange: 0,
                displayValue: `${activeSpendDaysCount} ${isIndonesian ? "Hari Aktif" : "Active Days"}`,
                title: isIndonesian
                  ? "Matriks Aktivitas Bulanan"
                  : "Monthly Activity Matrix",
                subtitle: isIndonesian
                  ? `Anda mencatat transaksi pada ${activeSpendDaysCount} dari ${heatmapDaysData.length} hari bulan ini (frekuensi aktif ${Math.round((activeSpendDaysCount / heatmapDaysData.length) * 100)}%). Total pengeluaran mencapai ${formatWithPreferred(currentMonthStats.expense)} dengan pengeluaran harian puncak pada Hari ke-${peak.day} (${formatWithPreferred(peak.amount || 0)}).`
                  : `You recorded transactions on ${activeSpendDaysCount} out of ${heatmapDaysData.length} days this month (${Math.round((activeSpendDaysCount / heatmapDaysData.length) * 100)}% active frequency). Total outflow reached ${formatWithPreferred(currentMonthStats.expense)} with peak daily spend on Day ${peak.day} (${formatWithPreferred(peak.amount || 0)}).`,
                badge: `${activeSpendDaysCount} ${isIndonesian ? "Hari Aktif" : "Active Days"}`,
                hideGrid: true,
                items: [
                  {
                    label: isIndonesian
                      ? "Total Pengeluaran Bulan Ini"
                      : "Total Outflow This Month",
                    amount: currentMonthStats.expense,
                    detail: isIndonesian
                      ? "Pengeluaran kumulatif di seluruh akun"
                      : "Cumulative spending across all accounts",
                  },
                  {
                    label: isIndonesian
                      ? "Rata-rata Pengeluaran Harian"
                      : "Daily Average Outflow",
                    amount: Math.round(dailyAverage),
                    detail: isIndonesian
                      ? `Berdasarkan ${daysInMonth} hari berjalan`
                      : `Based on ${daysInMonth} elapsed days`,
                  },
                  {
                    label: isIndonesian
                      ? "Rerata Hari Aktif"
                      : "Active Day Average",
                    amount:
                      activeSpendDaysCount > 0
                        ? Math.round(
                            currentMonthStats.expense / activeSpendDaysCount,
                          )
                        : 0,
                    detail: isIndonesian
                      ? "Rata-rata belanja pada hari transaksi aktif"
                      : "Average spending on active transaction days",
                  },
                  {
                    label: isIndonesian
                      ? `Pengeluaran Puncak (Hari ke-${peak.day})`
                      : `Peak Outflow (Day ${peak.day})`,
                    amount: peak.amount || 0,
                    detail: isIndonesian
                      ? "Hari belanja tertinggi dalam bulan ini"
                      : "Highest spending day of the month",
                  },
                ],
                ctaLabel: isIndonesian
                  ? "Lihat Pola Aktivitas di Statistik"
                  : "View Activity Patterns in Statistics",
                onCta: () => navigate("/statistics"),
              },
            });
          }}
        />
      );

    case "financial_health_gauge":
      return (
        <HealthMeterCard
          size={size}
          healthScore={healthScore}
          onOpenDetail={() => {
            if (!isPremium) {
              openPaywall({
                feature: "advanced_widget",
                title: isIndonesian
                  ? "Audit Diagnostik Kesehatan Modal"
                  : "Capital Health Diagnostic Audit",
                description: isIndonesian
                  ? "Buka rincian lengkap pilar ketahanan modal, simulasi likuiditas, dan rekomendasi solvabilitas dengan Accrual Pro."
                  : "Unlock full capital health pillar breakdown, liquidity simulations, and solvency advisory with Accrual Pro.",
              });
              return;
            }
            const score = healthScore;
            onOpenMetricDrillDown({
              type: "snapshot",
              data: {
                totalCurrent: score,
                totalPrevious: 0,
                delta: 0,
                pctChange: 0,
                displayValue: `${score}/100`,
                title: isIndonesian
                  ? "Telemetri Kesehatan Modal"
                  : "Capital Health Telemetry",
                subtitle: isIndonesian
                  ? `Skor kesehatan modal Anda dinilai ${score}/100 berdasarkan laju tabungan, pemenuhan kewajiban, dan rasio bantalan likuiditas.`
                  : `Your capital health score is rated at ${score}/100 based on savings pace, debt servicing, and liquidity buffer ratios.`,
                badge: `${score}/100 ${isIndonesian ? "Skor" : "Score"}`,
                ctaLabel: isIndonesian
                  ? "Diagnostik Kesehatan Modal"
                  : "Capital Health Diagnostics",
                onCta: () => navigate("/statistics"),
              },
            });
          }}
        />
      );

    case "liquid_runway":
      return (
        <LiquidRunwayCard
          size={size}
          runwayMonths={runwayMonths}
          liquidAssets={liquidAssets}
          monthlyBurn={totalExpense || 1}
          onOpenDetail={() => {
            triggerHaptic("light");
            navigate("/calendar?view=runway");
          }}
        />
      );

    case "calendar_activity":
      return (
        <CalendarCard
          size={size}
          monthTransactionsCount={monthTxs.length}
          activeDaysCount={activeSpendDaysCount}
          onOpenDetail={() => {
            triggerHaptic("light");
            navigate("/calendar");
          }}
        />
      );

    default:
      return isEditMode ? (
        <WidgetFallbackCard
          cardId={cardId}
          size={size === "half" ? "half" : "full"}
          isEditMode={isEditMode}
          isIndonesian={isIndonesian}
          isDark={isDark}
        />
      ) : null;
  }
}

const MemoizedHomeWidgetRenderer = React.memo(
  HomeWidgetRendererComponent,
  (prev, next) => {
    // Only re-render if critical props or underlying widget state actually changed
    if (prev.cardId !== next.cardId) return false;
    if (prev.size !== next.size) return false;
    if (prev.isEditMode !== next.isEditMode) return false;
    if (prev.hideBalance !== next.hideBalance) return false;
    if (prev.isDark !== next.isDark) return false;
    if (prev.isIndonesian !== next.isIndonesian) return false;
    if (prev.isColdLoading !== next.isColdLoading) return false;
    if (prev.budgetTarget !== next.budgetTarget) return false;
    if (prev.dailyAverage !== next.dailyAverage) return false;
    if (prev.daysInMonth !== next.daysInMonth) return false;
    if (prev.totalExpense !== next.totalExpense) return false;
    if (prev.liquidAssets !== next.liquidAssets) return false;
    if (prev.healthScore !== next.healthScore) return false;
    if (prev.runwayMonths !== next.runwayMonths) return false;
    if (prev.calendarExpanded !== next.calendarExpanded) return false;
    if (prev.stockRange !== next.stockRange) return false;
    if (prev.calPad !== next.calPad) return false;
    if (prev.activeSpendDaysCount !== next.activeSpendDaysCount) return false;
    if (prev.allTxs !== next.allTxs) return false;
    if (prev.monthTxs !== next.monthTxs) return false;
    if (prev.categories !== next.categories) return false;
    if (prev.goals !== next.goals) return false;
    if (prev.upcomingBills !== next.upcomingBills) return false;
    if (prev.intel !== next.intel) return false;
    if (prev.assetData !== next.assetData) return false;
    if (prev.debtSummary !== next.debtSummary) return false;
    if (prev.currentMonthStats !== next.currentMonthStats) return false;
    if (prev.categoryDonutData !== next.categoryDonutData) return false;
    if (prev.last7DaysOutlays !== next.last7DaysOutlays) return false;
    if (prev.heatmapDaysData !== next.heatmapDaysData) return false;

    return true;
  },
);

export const HomeWidgetRenderer = Object.assign(
  function HomeWidgetRenderer(props: HomeWidgetRendererProps) {
    return HomeWidgetRendererComponent(props);
  },
  MemoizedHomeWidgetRenderer,
) as unknown as typeof MemoizedHomeWidgetRenderer;
