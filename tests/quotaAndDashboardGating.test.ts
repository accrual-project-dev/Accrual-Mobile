import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MONETIZATION_LIMITS,
  PRO_WIDGET_IDS,
  type PaywallTriggerContext,
} from "../src/types/subscription";

// Mock localStorage
let store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = String(v);
  },
  removeItem: (k: string) => {
    delete store[k];
  },
  clear: () => {
    store = {};
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

describe("Accrual Phase 2: Hybrid Quota Engine & Feature Gating Suite", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  // ─── 1. Statement OCR Import Quota Engine ────────────────────────────────
  describe("1. Statement & Receipt OCR Quota Evaluation", () => {
    const evaluateOcrQuota = (count: number, isPremium: boolean) => {
      const limit = isPremium ? Infinity : MONETIZATION_LIMITS.FREE_OCR_MONTHLY_LIMIT;
      const remaining = isPremium ? Infinity : Math.max(0, limit - count);
      const isLimitReached = !isPremium && count >= MONETIZATION_LIMITS.FREE_OCR_MONTHLY_LIMIT;
      return { limit, remaining, isLimitReached };
    };

    it("grants 5 free scans per month with exact remaining counts", () => {
      expect(evaluateOcrQuota(0, false)).toEqual({
        limit: 5,
        remaining: 5,
        isLimitReached: false,
      });

      expect(evaluateOcrQuota(3, false)).toEqual({
        limit: 5,
        remaining: 2,
        isLimitReached: false,
      });

      expect(evaluateOcrQuota(5, false)).toEqual({
        limit: 5,
        remaining: 0,
        isLimitReached: true,
      });

      expect(evaluateOcrQuota(7, false)).toEqual({
        limit: 5,
        remaining: 0,
        isLimitReached: true,
      });
    });

    it("provides unlimited scans for premium accounts", () => {
      expect(evaluateOcrQuota(5, true)).toEqual({
        limit: Infinity,
        remaining: Infinity,
        isLimitReached: false,
      });

      expect(evaluateOcrQuota(50, true)).toEqual({
        limit: Infinity,
        remaining: Infinity,
        isLimitReached: false,
      });
    });

    it("triggers paywall with ocr_quota context when free quota exhausted", () => {
      const openPaywallMock = vi.fn();
      const checkOcrLimitAndPrompt = (count: number, isPremium: boolean) => {
        const { isLimitReached } = evaluateOcrQuota(count, isPremium);
        if (isLimitReached) {
          openPaywallMock({ feature: "ocr_quota" });
          return false;
        }
        return true;
      };

      expect(checkOcrLimitAndPrompt(4, false)).toBe(true);
      expect(openPaywallMock).not.toHaveBeenCalled();

      expect(checkOcrLimitAndPrompt(5, false)).toBe(false);
      expect(openPaywallMock).toHaveBeenCalledWith(
        expect.objectContaining({ feature: "ocr_quota" })
      );
    });
  });

  // ─── 2. Dashboard Slot Limitation & Gating ────────────────────────────────
  describe("2. Home Dashboard Widget Slot Limiting", () => {
    const canAddHomeWidget = (activeCount: number, isPremium: boolean) => {
      if (isPremium) return true;
      return activeCount < MONETIZATION_LIMITS.FREE_DASHBOARD_MAX_SLOTS;
    };

    it("enforces maximum 4 active widgets for free tier accounts", () => {
      expect(canAddHomeWidget(0, false)).toBe(true);
      expect(canAddHomeWidget(2, false)).toBe(true);
      expect(canAddHomeWidget(3, false)).toBe(true);
      expect(canAddHomeWidget(4, false)).toBe(false);
      expect(canAddHomeWidget(5, false)).toBe(false);
    });

    it("allows unlimited active widgets for premium accounts", () => {
      expect(canAddHomeWidget(4, true)).toBe(true);
      expect(canAddHomeWidget(8, true)).toBe(true);
      expect(canAddHomeWidget(20, true)).toBe(true);
    });
  });

  // ─── 3. Pro Widget Identification & Telemetry Interception ─────────────────
  describe("3. Executive Telemetry Pro Widgets", () => {
    const isWidgetProOnly = (widgetId: string) => {
      return (PRO_WIDGET_IDS as readonly string[]).includes(widgetId);
    };

    it("correctly identifies Executive Health Meter, Runway, and Volatility as Pro", () => {
      expect(isWidgetProOnly("financial_health_gauge")).toBe(true);
      expect(isWidgetProOnly("liquid_runway")).toBe(true);
      expect(isWidgetProOnly("spending_stability")).toBe(true);
    });

    it("treats core widgets as non-Pro so free users retain essential functionality", () => {
      expect(isWidgetProOnly("net_portfolio")).toBe(false);
      expect(isWidgetProOnly("portfolio_account")).toBe(false);
      expect(isWidgetProOnly("cashflow_pulse")).toBe(false);
      expect(isWidgetProOnly("recent_transactions")).toBe(false);
      expect(isWidgetProOnly("financial_goals")).toBe(false);
      expect(isWidgetProOnly("upcoming_bills")).toBe(false);
    });

    it("prompts paywall when attempting to add or render Pro widget on Free tier", () => {
      const openPaywallMock = vi.fn();
      const checkWidgetAndPrompt = (
        widgetId: string,
        activeCount: number,
        isPremium: boolean
      ) => {
        if (isWidgetProOnly(widgetId) && !isPremium) {
          openPaywallMock({ feature: "advanced_widget" });
          return false;
        }
        if (!isPremium && activeCount >= MONETIZATION_LIMITS.FREE_DASHBOARD_MAX_SLOTS) {
          openPaywallMock({ feature: "dashboard_limit" });
          return false;
        }
        return true;
      };

      // Free user trying to add Pro widget (even with 0 active cards)
      expect(checkWidgetAndPrompt("financial_health_gauge", 0, false)).toBe(false);
      expect(openPaywallMock).toHaveBeenCalledWith(
        expect.objectContaining({ feature: "advanced_widget" })
      );

      // Free user trying to add basic widget within slot limit
      openPaywallMock.mockClear();
      expect(checkWidgetAndPrompt("cashflow_pulse", 2, false)).toBe(true);
      expect(openPaywallMock).not.toHaveBeenCalled();

      // Free user trying to add basic widget exceeding slot limit
      openPaywallMock.mockClear();
      expect(checkWidgetAndPrompt("cashflow_pulse", 4, false)).toBe(false);
      expect(openPaywallMock).toHaveBeenCalledWith(
        expect.objectContaining({ feature: "dashboard_limit" })
      );

      // Premium user can add anything at any slot count
      openPaywallMock.mockClear();
      expect(checkWidgetAndPrompt("financial_health_gauge", 10, true)).toBe(true);
      expect(openPaywallMock).not.toHaveBeenCalled();
    });
  });

  // ─── 4. Multi-Ledger Spaces Quota ──────────────────────────────────────────
  describe("4. Multi-Ledger / Spaces Quota", () => {
    const canCreateLedger = (currentLedgers: number, isPremium: boolean) => {
      if (isPremium) return true;
      return currentLedgers < MONETIZATION_LIMITS.FREE_MAX_LEDGERS;
    };

    it("restricts Free tier to exactly 1 personal ledger space", () => {
      expect(canCreateLedger(0, false)).toBe(true);
      expect(canCreateLedger(1, false)).toBe(false);
      expect(canCreateLedger(2, false)).toBe(false);
    });

    it("permits unlimited ledger spaces for Pro members", () => {
      expect(canCreateLedger(1, true)).toBe(true);
      expect(canCreateLedger(5, true)).toBe(true);
      expect(canCreateLedger(20, true)).toBe(true);
    });
  });
});
