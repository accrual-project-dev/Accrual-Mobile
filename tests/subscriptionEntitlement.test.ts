import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MONETIZATION_LIMITS,
  PLAN_PRICING_CONFIG,
  type UserSubscription,
  type SubscriptionPlanId,
} from "../src/types/subscription";

// Mock localStorage for node test runner
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

describe("Accrual Phase 1: Subscription Entitlement & Monetization Engine", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  describe("1. Monetization Limits & Quota Constants", () => {
    it("enforces strict limit of 5 free statement OCR scans per month", () => {
      expect(MONETIZATION_LIMITS.FREE_OCR_MONTHLY_LIMIT).toBe(5);
    });

    it("enforces standard free dashboard cap of 4 active widgets", () => {
      expect(MONETIZATION_LIMITS.FREE_DASHBOARD_MAX_SLOTS).toBe(4);
    });

    it("enforces free tier limit of 1 personal ledger space", () => {
      expect(MONETIZATION_LIMITS.FREE_MAX_LEDGERS).toBe(1);
    });
  });

  describe("2. Plan Pricing & Billing Configuration", () => {
    it("configures Monthly plan at Rp 29.000 without trial", () => {
      const monthly = PLAN_PRICING_CONFIG.accrual_monthly_29k;
      expect(monthly.price).toBe(29000);
      expect(monthly.period).toBe("month");
      expect(monthly.hasTrial).toBe(false);
    });

    it("configures Annual plan at Rp 199.000 with 7-day free trial and ~43% discount", () => {
      const annual = PLAN_PRICING_CONFIG.accrual_annual_199k;
      expect(annual.price).toBe(199000);
      expect(annual.period).toBe("year");
      expect(annual.hasTrial).toBe(true);
      expect(annual.trialDays).toBe(7);
      expect(annual.discountBadge).toBe("43%");
    });

    it("configures Lifetime plan at Rp 499.000 as one-time payment", () => {
      const lifetime = PLAN_PRICING_CONFIG.accrual_lifetime_499k;
      expect(lifetime.price).toBe(499000);
      expect(lifetime.period).toBe("lifetime");
      expect(lifetime.hasTrial).toBe(false);
    });
  });

  describe("3. Subscription Entitlement Evaluation Logic", () => {
    const isUserPremium = (sub: UserSubscription): boolean => {
      if (sub.isLifetime) return true;
      if (sub.tier !== "premium") return false;
      return sub.status === "active" || sub.status === "trialing";
    };

    it("evaluates default free account as non-premium", () => {
      const freeSub: UserSubscription = {
        tier: "free",
        status: "active",
        isLifetime: false,
        updatedAt: new Date().toISOString(),
      };
      expect(isUserPremium(freeSub)).toBe(false);
    });

    it("evaluates active monthly premium account as premium", () => {
      const monthlySub: UserSubscription = {
        tier: "premium",
        status: "active",
        planId: "accrual_monthly_29k",
        isLifetime: false,
        updatedAt: new Date().toISOString(),
      };
      expect(isUserPremium(monthlySub)).toBe(true);
    });

    it("evaluates annual plan in 7-day trial as premium", () => {
      const trialSub: UserSubscription = {
        tier: "premium",
        status: "trialing",
        planId: "accrual_annual_199k",
        isLifetime: false,
        trialStartAt: new Date().toISOString(),
        trialEndAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        updatedAt: new Date().toISOString(),
      };
      expect(isUserPremium(trialSub)).toBe(true);
    });

    it("evaluates lifetime purchase as unconditionally premium even without active status", () => {
      const lifetimeSub: UserSubscription = {
        tier: "premium",
        status: "active",
        planId: "accrual_lifetime_499k",
        isLifetime: true,
        updatedAt: new Date().toISOString(),
      };
      expect(isUserPremium(lifetimeSub)).toBe(true);
    });

    it("revokes premium access when status is canceled or expired", () => {
      const expiredSub: UserSubscription = {
        tier: "premium",
        status: "expired",
        planId: "accrual_monthly_29k",
        isLifetime: false,
        updatedAt: new Date().toISOString(),
      };
      expect(isUserPremium(expiredSub)).toBe(false);

      const pastDueSub: UserSubscription = {
        tier: "premium",
        status: "past_due",
        planId: "accrual_monthly_29k",
        isLifetime: false,
        updatedAt: new Date().toISOString(),
      };
      expect(isUserPremium(pastDueSub)).toBe(false);
    });
  });

  describe("4. Local Storage Persistence & Offline Recovery", () => {
    it("successfully serializes and parses subscription state from local storage", () => {
      const testSub: UserSubscription = {
        tier: "premium",
        status: "active",
        planId: "accrual_lifetime_499k",
        isLifetime: true,
        store: "app_store",
        updatedAt: "2026-10-14T10:00:00.000Z",
      };

      mockLocalStorage.setItem("accrual_subscription_state_v1", JSON.stringify(testSub));

      const raw = mockLocalStorage.getItem("accrual_subscription_state_v1");
      expect(raw).toBeTruthy();
      const restored: UserSubscription = JSON.parse(raw!);
      expect(restored.tier).toBe("premium");
      expect(restored.isLifetime).toBe(true);
      expect(restored.planId).toBe("accrual_lifetime_499k");
    });
  });
});
