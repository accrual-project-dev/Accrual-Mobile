import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  revenueCatService,
  REVENUECAT_ENTITLEMENT_ID,
  REVENUECAT_PRODUCT_IDS,
} from "../src/lib/revenueCatService";
import type { CustomerInfo } from "@revenuecat/purchases-capacitor";

describe("RevenueCat In-App Purchase Service (StoreKit 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Configuration & Constants Invariants", () => {
    it("targets official accrual_pro entitlement ID", () => {
      expect(REVENUECAT_ENTITLEMENT_ID).toBe("accrual_pro");
    });

    it("maps all 3 tiers to exact App Store product identifiers", () => {
      expect(REVENUECAT_PRODUCT_IDS.accrual_monthly_29k).toBe("accrual_monthly_29k");
      expect(REVENUECAT_PRODUCT_IDS.accrual_annual_199k).toBe("accrual_annual_199k");
      expect(REVENUECAT_PRODUCT_IDS.accrual_lifetime_499k).toBe("accrual_lifetime_499k");
    });
  });

  describe("2. Mock & Sandbox Fallback Mode", () => {
    it("initializes in Mock mode when running on web or missing native API keys", async () => {
      const initialized = await revenueCatService.initialize("test-user-id");
      expect(initialized).toBe(true);

      const status = revenueCatService.getStatus();
      expect(status.isConfigured).toBe(true);
      expect(status.isMockMode).toBe(true);
      expect(status.userId).toBe("test-user-id");
    });

    it("simulates successful plan purchase in mock/sandbox mode", async () => {
      await revenueCatService.initialize("test-user-123");
      const result = await revenueCatService.purchasePlan("accrual_annual_199k");
      expect(result.success).toBe(true);
      expect(result.planId).toBe("accrual_annual_199k");
    });

    it("simulates restore purchases safely in mock mode without crashing", async () => {
      await revenueCatService.initialize("test-user-123");
      const result = await revenueCatService.restorePurchases();
      expect(result.success).toBe(true);
      expect(result.hasActivePro).toBe(false);
    });
  });

  describe("3. CustomerInfo to UserSubscription Mapping Engine", () => {
    it("maps active trial subscription correctly", () => {
      const mockCustomerInfo = {
        entitlements: {
          active: {
            accrual_pro: {
              identifier: "accrual_pro",
              productIdentifier: "accrual_annual_199k",
              periodType: "TRIAL",
              originalPurchaseDate: "2026-10-15T00:00:00.000Z",
              latestPurchaseDate: "2026-10-15T00:00:00.000Z",
              expirationDate: "2026-10-22T00:00:00.000Z",
            },
          },
        },
      } as unknown as CustomerInfo;

      const sub = revenueCatService.mapCustomerInfoToSubscription(
        mockCustomerInfo,
        "accrual_annual_199k"
      );

      expect(sub.tier).toBe("premium");
      expect(sub.status).toBe("trialing");
      expect(sub.planId).toBe("accrual_annual_199k");
      expect(sub.isLifetime).toBe(false);
      expect(sub.trialEndAt).toBe("2026-10-22T00:00:00.000Z");
      expect(sub.currentPeriodEnd).toBe("2026-10-22T00:00:00.000Z");
    });

    it("maps active lifetime purchase correctly with null expiration", () => {
      const mockCustomerInfo = {
        entitlements: {
          active: {
            accrual_pro: {
              identifier: "accrual_pro",
              productIdentifier: "accrual_lifetime_499k",
              periodType: "NORMAL",
              originalPurchaseDate: "2026-10-15T00:00:00.000Z",
              latestPurchaseDate: "2026-10-15T00:00:00.000Z",
              expirationDate: null,
            },
          },
        },
      } as unknown as CustomerInfo;

      const sub = revenueCatService.mapCustomerInfoToSubscription(
        mockCustomerInfo,
        "accrual_lifetime_499k"
      );

      expect(sub.tier).toBe("premium");
      expect(sub.status).toBe("active");
      expect(sub.planId).toBe("accrual_lifetime_499k");
      expect(sub.isLifetime).toBe(true);
      expect(sub.currentPeriodEnd).toBeNull();
    });

    it("maps expired or missing entitlement to free tier", () => {
      const mockCustomerInfo = {
        entitlements: {
          active: {},
        },
      } as unknown as CustomerInfo;

      const sub = revenueCatService.mapCustomerInfoToSubscription(mockCustomerInfo);

      expect(sub.tier).toBe("free");
      expect(sub.status).toBe("expired");
      expect(sub.isLifetime).toBe(false);
    });
  });
});
