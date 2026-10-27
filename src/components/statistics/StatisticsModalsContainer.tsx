import { lazy, Suspense, useMemo } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { WidgetCustomizationBar } from "../common";
import { CashflowSankeySection } from "./CashflowSankeySection";
import { CustomizeStatisticsModal } from "./CustomizeStatisticsModal";
import type { Transaction, Category, Wallet } from "../../lib/types";
import type {
  CategoryMoMShift,
  PersonalBaselineResult,
} from "../../lib/financialMath";
import type {
  CardWidgetConfig,
  StatisticsPresetKey,
} from "../../lib/widgetLayoutTypes";

const CategoryDrillDownSheet = lazy(() =>
  import("./CategoryDrillDownSheet").then((m) => ({
    default: m.CategoryDrillDownSheet,
  })),
);
const FinancialHealthDiagnosticModal = lazy(() =>
  import("./FinancialHealthDiagnosticModal").then((m) => ({
    default: m.FinancialHealthDiagnosticModal,
  })),
);
const FinancialWrappedModal = lazy(() =>
  import("./FinancialWrappedModal").then((m) => ({
    default: m.FinancialWrappedModal,
  })),
);
const PersonalFinancialModelSheet = lazy(() =>
  import("../home/PersonalFinancialModelSheet").then((m) => ({
    default: m.PersonalFinancialModelSheet,
  })),
);
const AssetValuationSheet = lazy(() =>
  import("../settings/AssetValuationSheet").then((m) => ({
    default: m.AssetValuationSheet,
  })),
);
const MonteCarloSimulatorSheet = lazy(() =>
  import("./MonteCarloSimulatorSheet").then((m) => ({
    default: m.MonteCarloSimulatorSheet,
  })),
);
const FirePlannerSheet = lazy(() =>
  import("./FirePlannerSheet").then((m) => ({
    default: m.FirePlannerSheet,
  })),
);
const WhatIfSimulatorSheet = lazy(() =>
  import("../home/WhatIfSimulatorSheet").then((m) => ({
    default: m.WhatIfSimulatorSheet,
  })),
);

interface StatisticsModalsContainerProps {
  isIndonesian: boolean;
  hideBalance: boolean;
  range: "week" | "month" | "year" | "all";
  rangeTitle: string;
  selectedYear: number;
  activeMonthDate: Date;
  allTxs: Transaction[];
  rangeTxs: Transaction[];
  categories: Category[];
  wallets: Wallet[];
  netWorth: number;
  totalIncome: number;
  totalExpense: number;
  healthScore: number;
  savingsRate: number;
  intelTotalIncome: number;
  intelTotalExpense: number;
  personalBaselines?: PersonalBaselineResult;
  categoryShifts: CategoryMoMShift[];
  personalFinancialModel: any;
  sankeyOpen: boolean;
  setSankeyOpen: (open: boolean) => void;
  selectedCategoryShift: CategoryMoMShift | null;
  setSelectedCategoryShift: (shift: CategoryMoMShift | null) => void;
  personalModelOpen: boolean;
  setPersonalModelOpen: (open: boolean) => void;
  healthDiagnosticOpen: boolean;
  setHealthDiagnosticOpen: (open: boolean) => void;
  wrappedOpen: boolean;
  setWrappedOpen: (open: boolean) => void;
  assetValuationOpen: boolean;
  setAssetValuationOpen: (open: boolean) => void;
  monteCarloOpen: boolean;
  setMonteCarloOpen: (open: boolean) => void;
  firePlannerOpen: boolean;
  setFirePlannerOpen: (open: boolean) => void;
  whatIfSheetOpen: boolean;
  setWhatIfSheetOpen: (open: boolean) => void;
  isStatsEditMode: boolean;
  setIsStatsEditMode: (edit: boolean) => void;
  resetStatsLayout: () => void;
  hiddenStatsCards: CardWidgetConfig[];
  toggleStatsCardVisibility: (id: string) => void;
  customizeStatsOpen: boolean;
  setCustomizeStatsOpen: (open: boolean) => void;
  statsWidgets: CardWidgetConfig[];
  applyStatsPreset: (key: StatisticsPresetKey) => void;
  activeStatsPresetKey: StatisticsPresetKey | null;
  setActiveStatsPresetKey: (key: StatisticsPresetKey | null) => void;
  reorderStatsCards?: (reorderedIds: string[]) => void;
  cycleStatsCardSize?: (cardId: string) => void;
}

export function StatisticsModalsContainer({
  isIndonesian,
  hideBalance,
  range,
  rangeTitle,
  selectedYear,
  activeMonthDate,
  allTxs,
  rangeTxs,
  categories,
  wallets,
  netWorth,
  totalIncome,
  totalExpense,
  healthScore,
  savingsRate,
  intelTotalIncome,
  intelTotalExpense,
  personalBaselines,
  categoryShifts,
  personalFinancialModel,
  sankeyOpen,
  setSankeyOpen,
  selectedCategoryShift,
  setSelectedCategoryShift,
  personalModelOpen,
  setPersonalModelOpen,
  healthDiagnosticOpen,
  setHealthDiagnosticOpen,
  wrappedOpen,
  setWrappedOpen,
  assetValuationOpen,
  setAssetValuationOpen,
  monteCarloOpen,
  setMonteCarloOpen,
  firePlannerOpen,
  setFirePlannerOpen,
  whatIfSheetOpen,
  setWhatIfSheetOpen,
  isStatsEditMode,
  setIsStatsEditMode,
  resetStatsLayout,
  hiddenStatsCards,
  toggleStatsCardVisibility,
  customizeStatsOpen,
  setCustomizeStatsOpen,
  statsWidgets,
  applyStatsPreset,
  activeStatsPresetKey,
  setActiveStatsPresetKey,
  reorderStatsCards,
  cycleStatsCardSize,
}: StatisticsModalsContainerProps) {
  const liquidAssets = useMemo(() => {
    return (wallets || [])
      .filter(
        (w) =>
          w.classification !== "investment" &&
          w.classification !== "loan" &&
          w.classification !== "credit" &&
          w.classification !== "fixed_asset"
      )
      .reduce((sum, w) => sum + Math.max(0, Number(w.balance || 0)), 0);
  }, [wallets]);

  const totalLiabilities = useMemo(() => {
    return (wallets || []).reduce(
      (sum, w) =>
        sum +
        Math.abs(Math.min(0, Number(w.balance || 0))) +
        (w.classification === "loan" || w.classification === "credit"
          ? Math.max(0, Number(w.balance || 0))
          : 0),
      0
    );
  }, [wallets]);

  const monthlyDebtService = useMemo(() => {
    return totalLiabilities > 0 ? Math.round(totalLiabilities * 0.03) : 0;
  }, [totalLiabilities]);

  const walletBalances = useMemo(() => {
    return (wallets || []).map((w) => Number(w.balance || 0));
  }, [wallets]);

  return (
    <>
      {/* Cashflow Sankey Flow Diagram BottomSheet */}
      <BottomSheet
        isOpen={sankeyOpen}
        onClose={() => setSankeyOpen(false)}
        title={isIndonesian ? "Diagram Alur Arus Kas" : "Cashflow Sankey Flow"}
      >
        <div className="px-5 pb-[max(calc(env(safe-area-inset-bottom,0px)+16px),28px)] space-y-4">
          <CashflowSankeySection
            transactions={rangeTxs}
            categories={categories}
            wallets={wallets}
            periodLabel={rangeTitle}
            hideTitle
          />
        </div>
      </BottomSheet>

      <Suspense fallback={null}>
        <CategoryDrillDownSheet
          isOpen={!!selectedCategoryShift}
          onClose={() => setSelectedCategoryShift(null)}
          shift={selectedCategoryShift}
        />

        <PersonalFinancialModelSheet
          isOpen={personalModelOpen}
          onClose={() => setPersonalModelOpen(false)}
          hideBalance={hideBalance}
          actual={personalFinancialModel.actual}
          baseline={personalFinancialModel.baseline}
          scenario={personalFinancialModel.scenario}
          insights={personalFinancialModel.insights}
        />

        <FinancialHealthDiagnosticModal
          isOpen={healthDiagnosticOpen}
          onClose={() => setHealthDiagnosticOpen(false)}
          healthScore={healthScore}
          savingsRate={savingsRate}
          totalIncome={totalIncome}
          totalExpense={totalExpense}
          rangeTitle={rangeTitle}
          baselines={range === "month" ? personalBaselines : undefined}
          categoryShifts={range === "month" ? categoryShifts : []}
          liquidAssets={liquidAssets}
          monthlyDebtService={monthlyDebtService}
          walletBalances={walletBalances}
        />

        <FinancialWrappedModal
          isOpen={wrappedOpen}
          onClose={() => setWrappedOpen(false)}
          transactions={allTxs}
          categories={categories}
          mode={range === "year" ? "year" : "month"}
          targetDate={
            range === "year" ? new Date(selectedYear, 0, 1) : activeMonthDate
          }
        />

        <AssetValuationSheet
          isOpen={assetValuationOpen}
          onClose={() => setAssetValuationOpen(false)}
        />

        <MonteCarloSimulatorSheet
          isOpen={monteCarloOpen}
          onClose={() => setMonteCarloOpen(false)}
          initialNetWorth={netWorth}
          defaultMonthlySavings={Math.max(1000000, totalIncome - totalExpense)}
          defaultMonthlyBurnRate={intelTotalExpense || totalExpense || 3500000}
          hideBalance={hideBalance}
        />

        <FirePlannerSheet
          isOpen={firePlannerOpen}
          onClose={() => setFirePlannerOpen(false)}
          initialNetWorth={netWorth}
          defaultMonthlySavings={Math.max(1000000, totalIncome - totalExpense)}
          defaultMonthlyBurnRate={intelTotalExpense || totalExpense || 3500000}
          hideBalance={hideBalance}
        />

        <WhatIfSimulatorSheet
          isOpen={whatIfSheetOpen}
          onClose={() => setWhatIfSheetOpen(false)}
          monthlyIncome={intelTotalIncome}
          monthlyExpense={intelTotalExpense}
          netWorth={netWorth}
          hideBalance={hideBalance}
        />
      </Suspense>

      {/* Floating iOS Springboard Customization Pill for Statistics Tab */}
      {isStatsEditMode && (
        <WidgetCustomizationBar
          isEditMode={isStatsEditMode}
          onDone={() => setIsStatsEditMode(false)}
          onReset={resetStatsLayout}
          hiddenCards={hiddenStatsCards}
          onUnhideCard={toggleStatsCardVisibility}
        />
      )}

      {/* Intelligence Cards Customization Modal */}
      <CustomizeStatisticsModal
        isOpen={customizeStatsOpen}
        onClose={() => setCustomizeStatsOpen(false)}
        widgets={statsWidgets}
        onToggleVisibility={toggleStatsCardVisibility}
        onReset={resetStatsLayout}
        onApplyPreset={applyStatsPreset}
        onEnterGridEdit={() => setIsStatsEditMode(true)}
        activePresetKey={activeStatsPresetKey}
        onSelectPresetKey={setActiveStatsPresetKey}
        onReorder={reorderStatsCards}
        onCycleSize={cycleStatsCardSize}
      />
    </>
  );
}
