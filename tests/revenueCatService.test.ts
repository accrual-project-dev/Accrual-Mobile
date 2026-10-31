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
      const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-16T00:00:00Z"));
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
      clock.mockRestore();
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

    it("rejects entitlement with past expirationDate in isProEntitlementActive", () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const mockExpired = {
        entitlements: {
          active: {
            accrual_pro: {
              identifier: "accrual_pro",
              productIdentifier: "accrual_annual_199k",
              isActive: true,
              expirationDate: pastDate,
            },
          },
        },
      } as unknown as CustomerInfo;

      expect(revenueCatService.isProEntitlementActive(mockExpired)).toBe(false);
    });

    it("rejects unknown entitlement names and random activeSubscriptions", () => {
      const mockUnknown = {
        entitlements: {
          active: {
            random_entitlement: {
              identifier: "random_entitlement",
              productIdentifier: "random_prod",
              isActive: true,
              expirationDate: null,
            },
          },
        },
        activeSubscriptions: ["random_third_party_product"],
      } as unknown as CustomerInfo;

      expect(revenueCatService.isProEntitlementActive(mockUnknown)).toBe(false);
    });
  });

  describe("4. Package Resolution Engine (resolvePackageFromOffering)", () => {
    it("resolves direct offering properties (annual, monthly, lifetime)", () => {
      const mockAnnualPkg = { identifier: "$rc_annual", packageType: "ANNUAL", product: { identifier: "accrual_annual_199k" } };
      const mockMonthlyPkg = { identifier: "$rc_monthly", packageType: "MONTHLY", product: { identifier: "accrual_monthly_29k" } };
      const mockLifetimePkg = { identifier: "$rc_lifetime", packageType: "LIFETIME", product: { identifier: "accrual_lifetime_499k" } };

      const mockOffering = {
        identifier: "default",
        serverDescription: "Standard Offerings",
        annual: mockAnnualPkg,
        monthly: mockMonthlyPkg,
        lifetime: mockLifetimePkg,
        availablePackages: [mockAnnualPkg, mockMonthlyPkg, mockLifetimePkg],
      } as any;

      expect(revenueCatService.resolvePackageFromOffering(mockOffering, "accrual_annual_199k")).toBe(mockAnnualPkg);
      expect(revenueCatService.resolvePackageFromOffering(mockOffering, "accrual_monthly_29k")).toBe(mockMonthlyPkg);
      expect(revenueCatService.resolvePackageFromOffering(mockOffering, "accrual_lifetime_499k")).toBe(mockLifetimePkg);
    });

    it("resolves packages by packageType from availablePackages when direct properties are null", () => {
      const mockAnnualPkg = { identifier: "custom_annual_tier", packageType: "ANNUAL", product: { identifier: "custom_id" } };
      const mockOffering = {
        identifier: "default",
        annual: null,
        monthly: null,
        lifetime: null,
        availablePackages: [mockAnnualPkg],
      } as any;

      const resolved = revenueCatService.resolvePackageFromOffering(mockOffering, "accrual_annual_199k");
      expect(resolved).toBe(mockAnnualPkg);
    });

    it("resolves packages by product identifier when packageType is CUSTOM or UNKNOWN", () => {
      const mockMonthlyPkg = { identifier: "my_monthly", packageType: "CUSTOM", product: { identifier: "accrual_monthly_29k" } };
      const mockOffering = {
        identifier: "default",
        annual: null,
        monthly: null,
        lifetime: null,
        availablePackages: [mockMonthlyPkg],
      } as any;

      const resolved = revenueCatService.resolvePackageFromOffering(mockOffering, "accrual_monthly_29k");
      expect(resolved).toBe(mockMonthlyPkg);
    });

    it("returns null gracefully if offering is null, empty, or unmapped", () => {
      expect(revenueCatService.resolvePackageFromOffering(null, "accrual_annual_199k")).toBeNull();
      expect(revenueCatService.resolvePackageFromOffering({ availablePackages: [] } as any, "accrual_annual_199k")).toBeNull();
    });
  });
});
