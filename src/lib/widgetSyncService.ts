// ======================================================================
// ACCRUAL WIDGET & APPINTENTS SYNCHRONIZATION SERVICE
// Strictly compliant with GEMINI.md:
// - Rule 1: No native colored emojis
// - Rule 2: Monochrome Apple Luxury Theme System
// - Rule 4: Graceful offline & local fallback resilience
// ======================================================================

import { registerPlugin, Capacitor } from "@capacitor/core";

export interface WidgetHeatmapDot {
  intensity: number;
  hasSpend: boolean;
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

  // Expanded fields for 10 Home Widgets & 5 Lock Screen Accessories
  savingsRate: number;
  savingsTarget: number;
  monthlySavingsFormatted: string;
  runwayMonths: number;
  dailyBurnFormatted: string;
  monthlyInflowFormatted: string;
  monthlyOutflowFormatted: string;
  netCashflowFormatted: string;
  cashflowBars: number[];
  capitalHealthScore: number;
  capitalHealthTier: string;
  heatmapDots: WidgetHeatmapDot[];
  activeDaysCount: number;
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

  // Foto 1, 2, 3 Widget Modernization Suite
  liquidCashFormatted: string;
  liquidCashRaw: number;
  liquidCashChangeFormatted: string;
  liquidCashSparkline: number[];
  safeToSpendDailyFormatted: string;
  safeToSpendRemainingFormatted: string;
  safeToSpendBudgetFormatted: string;
  safeToSpendPercent: number;
  daysLeftInMonth: number;
  cashflowDeltaVsLastMonth: string;
  monthShortName: string;
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

  /**
   * Synchronizes the real-time financial snapshot with the iOS App Group container.
   * Renders instantly inside SwiftUI Home Screen & Lock Screen widgets.
   */
  public async syncSnapshot(snapshot: WidgetSnapshotPayload): Promise<boolean> {
    const hash = JSON.stringify(snapshot);
    if (this.lastSyncedHash === hash) {
      return true; // Avoid unnecessary IPC roundtrips if data is identical
    }

    // Web / local development fallback
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") {
      try {
        localStorage.setItem("accrual_widget_snapshot", hash);
        this.lastSyncedHash = hash;
      } catch {
        // Silently tolerate storage issues in sandboxes
      }
      return true;
    }

    if (this.isSyncing) return false;
    this.isSyncing = true;

    try {
      await WidgetBridge.updateSnapshot({ snapshot });
      this.lastSyncedHash = hash;
      return true;
    } catch (err) {
      console.warn("[WidgetSyncService] updateSnapshot failed, saving locally:", err);
      try {
        localStorage.setItem("accrual_widget_snapshot", hash);
      } catch {}
      return false;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Checks for offline transactions captured via iPhone Back Tap, Siri, or Action Button (AppIntents)
   * while Accrual was not actively running.
   */
  public async retrievePendingIngestion(): Promise<{
    transactions: PendingBackTapTx[];
    voiceLogs: PendingBackTapVoice[];
    navigation?: string | null;
  }> {
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
    } catch (err) {
      console.warn("[WidgetSyncService] retrievePendingIngestion failed:", err);
      return { transactions: [], voiceLogs: [], navigation: null };
    }
  }

  /**
   * Clears pending transactions from the native App Group queue once successfully processed.
   */
  public async clearPendingIngestion(): Promise<boolean> {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") {
      return true;
    }

    try {
      await WidgetBridge.clearPendingIngestion();
      return true;
    } catch (err) {
      console.warn("[WidgetSyncService] clearPendingIngestion failed:", err);
      return false;
    }
  }

  /**
   * Computes a normalized 7-day velocity array (0-100 scale) for the widget sparkline.
   */
  public generate7DaySparkline(
    transactions: Array<{ amount: number; type: string; occurred_on?: string; date?: string }>,
    currentNetWorth: number
  ): number[] {
    const points: number[] = [];
    const now = new Date();

    // Generate cumulative snapshots for the past 7 days
    for (let i = 6; i >= 0; i--) {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() - i);
      const targetIso = targetDate.toISOString().slice(0, 10);

      // Delta of transactions occurring strictly after this target day
      const subsequentDelta = transactions
        .filter((t) => {
          const rawDate = t.occurred_on || t.date || "";
          return rawDate.slice(0, 10) > targetIso;
        })
        .reduce((acc, t) => {
          if (t.type === "expense") return acc - t.amount;
          if (t.type === "income") return acc + t.amount;
          return acc;
        }, 0);

      const estimatedDayNetWorth = Math.max(0, currentNetWorth - subsequentDelta);
      points.push(estimatedDayNetWorth);
    }

    // Normalize to 0-100 for SVG / SwiftUI Path rendering
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min;

    if (range === 0) {
      return [50, 50, 50, 50, 50, 50, 50];
    }

    return points.map((p) => Math.round(((p - min) / range) * 100));
  }
}

export const widgetSyncService = new WidgetSyncService();
