import { registerPlugin, Capacitor } from "@capacitor/core";
import { format } from "date-fns";

export interface WidgetHeatmapDot {
  intensity: number;
  hasSpend: boolean;
  isToday?: boolean;
}

export interface WidgetCategorySlice {
  name: string;
  pct: number;
  amountFormatted: string;
}

export interface WidgetBillItem {
  title: string;
  amountFormatted: string;
  dueLabel: string;
}

export interface WidgetSnapshotPayload {
  netWorthFormatted: string;
  netWorthRaw: number;
  currencySymbol: string;
  change24hPercentage: number;
  change24hFormatted: string;
  isPositive24h: boolean;
  totalAssetsFormatted: string;
  totalDebtsFormatted: string;
  isPrivacyMode: boolean;
  isIndonesian: boolean;
  theme?: "light" | "dark";
  lastUpdated: string;
  sparkline: number[];
  spaceName?: string;

  savingsRate: number;
  savingsTarget: number;
  monthlySavingsFormatted: string;
  runwayMonths: number;
  dailyBurnFormatted: string;
  monthlyInflowFormatted: string;
  monthlyOutflowFormatted: string;
  netCashflowFormatted: string;
  isPositiveCashflow?: boolean;
  cashflowBars: number[];
  capitalHealthScore: number;
  capitalHealthTier: string;
  heatmapDots: WidgetHeatmapDot[];
  activeDaysCount: number;
  noSpendDaysCount?: number;
  solvencyScore: number;
  debtRatio: number;
  liquidPct: number;
  growthPct: number;
  fixedPct: number;
  grossAssetsFormatted: string;
  liabilitiesFormatted: string;
  netEquityFormatted: string;
  spendingVolatilityStatus: string;
  dailyAverageFormatted: string;
  volatilityVariance: number;

  liquidCashFormatted: string;
  liquidCashRaw: number;
  liquidCashChangeFormatted: string;
  isLiquidCashPositive?: boolean;
  liquidCashSparkline: number[];
  safeToSpendDailyFormatted: string;
  safeToSpendRemainingFormatted: string;
  safeToSpendBudgetFormatted: string;
  safeToSpendSpentTodayFormatted?: string;
  safeToSpendDailyQuotaFormatted?: string;
  safeToSpendPercent: number;
  dailyBurnPacePercent?: number;
  dailyBurnPaceStatus?: string;
  daysLeftInMonth: number;
  cashflowDeltaVsLastMonth: string;
  isCashflowDeltaPositive?: boolean;
  monthShortName: string;

  topCategories?: WidgetCategorySlice[];
  upcomingBills?: WidgetBillItem[];
  activeSubsCount?: number;
  activeSubsTotalFormatted?: string;
  draftPendingCount?: number;
  thisWeekWave?: number[];
  lastWeekWave?: number[];
  weekDeltaFormatted?: string;
  isWeekDeltaPositive?: boolean;
  insightHeadlinePct?: string;
  insightTitle?: string;
  insightSubtitle?: string;
  lockInsightLine?: string;
}

export interface PendingBackTapTx {
  id: string;
  amount: number;
  category: string;
  wallet: string;
  date: string;
  note: string;
  createdAt: number;
}

export interface PendingBackTapVoice {
  id: string;
  text: string;
  createdAt: number;
}

export interface WidgetBridgePlugin {
  updateSnapshot(options: { snapshot: WidgetSnapshotPayload }): Promise<{ success: boolean }>;
  getPendingIngestion(): Promise<{
    transactions: PendingBackTapTx[];
    voiceLogs: PendingBackTapVoice[];
    navigation?: string | null;
  }>;
  clearPendingIngestion(): Promise<{ success: boolean }>;
  reloadWidgets(): Promise<{ success: boolean }>;
}

export const WidgetBridge = registerPlugin<WidgetBridgePlugin>("WidgetBridge");

class WidgetSyncService {
  private lastSyncedHash: string | null = null;
  private isSyncing = false;

  public async syncSnapshot(snapshot: WidgetSnapshotPayload): Promise<boolean> {
    const payloadWithoutTimestamp = { ...snapshot, lastUpdated: "" };
    const hash = JSON.stringify(payloadWithoutTimestamp);
    if (this.lastSyncedHash === hash) return true;

    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") {
      try {
        localStorage.setItem("accrual_widget_snapshot", JSON.stringify(snapshot));
        this.lastSyncedHash = hash;
      } catch {}
      return true;
    }

    if (this.isSyncing) return false;
    this.isSyncing = true;

    try {
      await WidgetBridge.updateSnapshot({ snapshot });
      this.lastSyncedHash = hash;
      return true;
    } catch {
      try {
        localStorage.setItem("accrual_widget_snapshot", JSON.stringify(snapshot));
      } catch {}
      return false;
    } finally {
      this.isSyncing = false;
    }
  }

  public async retrievePendingIngestion() {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") {
      return { transactions: [], voiceLogs: [], navigation: null };
    }
    try {
      const result = await WidgetBridge.getPendingIngestion();
      return {
        transactions: Array.isArray(result?.transactions) ? result.transactions : [],
        voiceLogs: Array.isArray(result?.voiceLogs) ? result.voiceLogs : [],
        navigation: result?.navigation || null,
      };
    } catch {
      return { transactions: [], voiceLogs: [], navigation: null };
    }
  }

  public async clearPendingIngestion(): Promise<boolean> {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") return true;
    try {
      await WidgetBridge.clearPendingIngestion();
      return true;
    } catch {
      return false;
    }
  }

  public generate7DaySparkline(
    transactions: Array<{ amount: number; type: string; occurred_on?: string; date?: string }>,
    currentBalance: number
  ): number[] {
    const points: number[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() - i);
      const targetIso = format(targetDate, "yyyy-MM-dd");
      const subsequentDelta = transactions
        .filter((t) => (t.occurred_on || t.date || "").slice(0, 10) > targetIso)
        .reduce((acc, t) => (t.type === "expense" ? acc - t.amount : t.type === "income" ? acc + t.amount : acc), 0);
      points.push(Math.max(0, currentBalance - subsequentDelta));
    }
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min;
    if (range === 0) {
      const flatVal = currentBalance > 0 ? 50 : 0;
      return [flatVal, flatVal, flatVal, flatVal, flatVal, flatVal, flatVal];
    }
    return points.map((p) => Math.max(10, Math.min(95, Math.round(12 + ((p - min) / range) * 80))));
  }
}

export const widgetSyncService = new WidgetSyncService();
