// ======================================================================
// REVENUECAT IN-APP PURCHASE SERVICE
// Strictly compliant with GEMINI.md:
// - Rule 1: Zero native colored emojis
// - Rule 2: Monochrome Apple Luxury Theme & Obsidian styling
// - Rule 6: 100% pure localization support
// - Apple App Store Guideline 2.1 & 3.1.1: Zero Mock Bypass on Native iOS
// ======================================================================

import { Capacitor } from "@capacitor/core";
import {
  Purchases,
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from "@revenuecat/purchases-capacitor";
import type { SubscriptionPlanId, UserSubscription } from "../types/subscription";

export const REVENUECAT_ENTITLEMENT_ID = "accrual_pro";

export const REVENUECAT_PRODUCT_IDS: Record<SubscriptionPlanId, string> = {
  accrual_monthly_29k: "accrual_monthly_29k",
  accrual_annual_199k: "accrual_annual_199k",
  accrual_lifetime_499k: "accrual_lifetime_499k",
};

export interface PurchaseResult {
  success: boolean;
  cancelled?: boolean;
  customerInfo?: CustomerInfo | null;
  error?: string;
  planId?: SubscriptionPlanId;
}

class RevenueCatService {
  private isConfigured = false;
  private isMockMode = false;
  private currentUserId: string | null = null;

  /**
   * Initializes RevenueCat Purchases SDK.
   * On native iOS/Android, strictly requires a valid RevenueCat API key and StoreKit configuration.
   * Mock mode is strictly restricted to non-native local web development.
   */
  public async initialize(userId?: string): Promise<boolean> {
    const targetUserId = userId && userId !== "guest" ? userId : null;

    if (this.isConfigured && this.currentUserId === targetUserId) {
      return true;
    }

    const platform = Capacitor.getPlatform();
    const isNative = platform === "ios" || platform === "android";

    const apiKey =
      platform === "ios"
        ? import.meta.env.VITE_REVENUECAT_APPLE_KEY
        : import.meta.env.VITE_REVENUECAT_GOOGLE_KEY;

    // On Web (non-native), allow mock mode only during local development
    if (!isNative) {
      this.isMockMode = Boolean(import.meta.env.DEV);
      this.isConfigured = true;
      this.currentUserId = targetUserId;
      return true;
    }

    // On Native iOS/Android, NEVER enable mock mode if API key is missing
    if (!apiKey || apiKey.trim() === "") {
      this.isMockMode = false;
      this.isConfigured = false;
      this.currentUserId = targetUserId;
      console.error("[RevenueCat] Missing native RevenueCat API key for platform:", platform);
      return false;
    }

    try {
      // Check if native SDK is already configured
      let nativeConfigured = false;
      try {
        const status = await Purchases.isConfigured();
        nativeConfigured = Boolean(status?.isConfigured);
      } catch {
        nativeConfigured = false;
      }

      if (nativeConfigured) {
        this.isConfigured = true;
        this.isMockMode = false;
        if (targetUserId && this.currentUserId !== targetUserId) {
          await this.logIn(targetUserId);
        } else if (!targetUserId && this.currentUserId) {
          await this.logOut();
        }
        this.currentUserId = targetUserId;
        return true;
      }

      // Configure native Purchases SDK for the first time
      try {
        await Purchases.setLogLevel({
          level: import.meta.env.DEV ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN,
        });
      } catch {}

      await Purchases.configure({
        apiKey: apiKey.trim(),
        appUserID: targetUserId || undefined,
      });

      this.isMockMode = false;
      this.isConfigured = true;
      this.currentUserId = targetUserId;
      console.info("[RevenueCat] Native Purchases SDK configured successfully.");
      return true;
    } catch (err) {
      console.error("[RevenueCat] Native initialization failed:", err);
      this.isMockMode = false;
      this.isConfigured = false;
      this.currentUserId = targetUserId;
      return false;
    }
  }

  /**
   * Log in user identity to RevenueCat (aliases anonymous purchases to Supabase user ID).
   */
  public async logIn(userId: string): Promise<boolean> {
    if (!userId || userId === "guest") {
      await this.logOut();
      return true;
    }

    this.currentUserId = userId;

    if (this.isMockMode || !this.isConfigured) {
      return true;
    }

    try {
      await Purchases.logIn({ appUserID: userId });
      console.info(`[RevenueCat] Logged in user: ${userId}`);
      return true;
    } catch (err) {
      console.warn("[RevenueCat] logIn failed:", err);
      return false;
    }
  }

  /**
   * Log out user identity from RevenueCat to revert to anonymous state.
   */
  public async logOut(): Promise<void> {
    const prevUserId = this.currentUserId;
    this.currentUserId = null;

    if (this.isMockMode || !this.isConfigured || !prevUserId) {
      return;
    }

    try {
      await Purchases.logOut();
      console.info("[RevenueCat] Successfully logged out to anonymous user.");
    } catch (err) {
      console.warn("[RevenueCat] logOut failed:", err);
    }
  }

  /**
   * Fetches current offerings from RevenueCat or StoreKit.
   */
  public async getOffering(): Promise<PurchasesOffering | null> {
    if (!this.isConfigured) {
      const ok = await this.initialize(this.currentUserId || undefined);
      if (!ok) return null;
    }

    if (this.isMockMode) {
      return null;
    }

    try {
      const offerings = await Purchases.getOfferings();
      return offerings.current || null;
    } catch (err) {
      console.warn("[RevenueCat] getOfferings failed:", err);
      return null;
    }
  }

  /**
   * Resolves a package from a RevenueCat offering by planId.
   * Matches predefined annual/monthly/lifetime slots, standard package identifiers,
   * packageType enums, or exact StoreKit product identifiers.
   */
  public resolvePackageFromOffering(
    offering: PurchasesOffering | null | undefined,
    planId: SubscriptionPlanId
  ): PurchasesPackage | null {
    if (!offering) return null;

    const productId = REVENUECAT_PRODUCT_IDS[planId];

    // 1. Direct offering property matching
    if (planId === "accrual_annual_199k" && offering.annual) {
      return offering.annual;
    }
    if (planId === "accrual_monthly_29k" && offering.monthly) {
      return offering.monthly;
    }
    if (planId === "accrual_lifetime_499k" && offering.lifetime) {
      return offering.lifetime;
    }

    // 2. Search packages in availablePackages
    const packages = offering.availablePackages || [];

    // 2a. Match product identifier directly
    let match = packages.find(
      (pkg) => pkg.product?.identifier === productId || pkg.identifier === productId
    );
    if (match) return match;

    // 2b. Match by package type or standard package identifier
    if (planId === "accrual_annual_199k") {
      match = packages.find(
        (pkg) =>
          pkg.packageType === "ANNUAL" ||
          pkg.identifier === "$rc_annual" ||
          pkg.identifier?.toLowerCase().includes("annual")
      );
      if (match) return match;
    } else if (planId === "accrual_monthly_29k") {
      match = packages.find(
        (pkg) =>
          pkg.packageType === "MONTHLY" ||
          pkg.identifier === "$rc_monthly" ||
          pkg.identifier?.toLowerCase().includes("monthly")
      );
      if (match) return match;
    } else if (planId === "accrual_lifetime_499k") {
      match = packages.find(
        (pkg) =>
          pkg.packageType === "LIFETIME" ||
          pkg.identifier === "$rc_lifetime" ||
          pkg.identifier?.toLowerCase().includes("lifetime")
      );
      if (match) return match;
    }

    return null;
  }

  /**
   * Purchases a specific plan by identifier.
   */
  public async purchasePlan(planId: SubscriptionPlanId): Promise<PurchaseResult> {
    const isNative = Capacitor.isNativePlatform();

    if (!this.isConfigured) {
      const initialized = await this.initialize(this.currentUserId || undefined);
      if (!initialized && isNative) {
        return {
          success: false,
          error: this.formatErrorMessage({ code: "23", message: "configuration" }),
        };
      }
    }

    // Mock mode is strictly prohibited on native iOS/Android
    if (this.isMockMode && !isNative) {
      console.info(`[RevenueCat:Mock] Simulated web dev purchase for ${planId} succeeded.`);
      return {
        success: true,
        planId,
      };
    }

    if (!this.isConfigured) {
      return {
        success: false,
        error: this.formatErrorMessage({ code: "23", message: "configuration" }),
      };
    }

    try {
      const productId = REVENUECAT_PRODUCT_IDS[planId];
      if (!productId) {
        return { success: false, error: "Invalid product identifier" };
      }

      // 1. Search in current offering first
      const offerings = await Purchases.getOfferings();
      let packageToPurchase = this.resolvePackageFromOffering(offerings?.current, planId);

      // 2. Search all offerings if not found in current
      if (!packageToPurchase && offerings?.all) {
        for (const offeringKey of Object.keys(offerings.all)) {
          const off = offerings.all[offeringKey];
          const found = this.resolvePackageFromOffering(off, planId);
          if (found) {
            packageToPurchase = found;
            break;
          }
        }
      }

      let customerInfo: CustomerInfo;
      if (packageToPurchase) {
        console.info(
          `[RevenueCat] Purchasing package '${packageToPurchase.identifier}' (product: '${packageToPurchase.product?.identifier}')`
        );
        const result = await Purchases.purchasePackage({ aPackage: packageToPurchase });
        customerInfo = result.customerInfo;
      } else {
        // 3. Fallback: Query StoreKit directly using getProducts to obtain full PurchasesStoreProduct
        console.info(`[RevenueCat] Package not found in offerings, querying StoreKit for '${productId}'...`);
        const productsResponse = await Purchases.getProducts({ productIdentifiers: [productId] });
        const storeProduct = productsResponse.products?.find((p) => p.identifier === productId);
        if (!storeProduct) {
          throw new Error(
            `Produk In-App Purchase '${productId}' belum aktif di Apple StoreKit / RevenueCat. Mohon periksa status produk di App Store Connect.`
          );
        }
        const result = await Purchases.purchaseStoreProduct({
          product: storeProduct,
        });
        customerInfo = result.customerInfo;
      }

      const isActivePro = this.isProEntitlementActive(customerInfo);

      return {
        success: isActivePro,
        customerInfo,
        planId,
      };
    } catch (err: any) {
      const userCancelled =
        err?.userCancelled === true ||
        err?.code === "1" ||
        err?.code === 1 ||
        (typeof err?.message === "string" && err.message.toLowerCase().includes("cancel")) ||
        (err?.domain === "SKErrorDomain" && (err?.code === 2 || err?.code === "2"));

      if (userCancelled) {
        return { success: false, cancelled: true };
      }

      console.error("[RevenueCat] Purchase failed:", err);
      return {
        success: false,
        error: this.formatErrorMessage(err),
      };
    }
  }

  /**
   * Translates native RevenueCat and StoreKit errors into user-friendly localized messages.
   * Strictly compliant with GEMINI.md Rule 6 (zero bilingual mixing).
   */
  public formatErrorMessage(err: any, isIndonesian = true): string {
    const rawMsg = typeof err?.message === "string" ? err.message.toLowerCase() : "";
    const code = String(err?.code || "");

    // 1. Configuration / StoreKit 0-products error (RC Code 23)
    if (
      code === "23" ||
      rawMsg.includes("configuration") ||
      rawMsg.includes("storeproduct") ||
      rawMsg.includes("there is an issue with your configuration")
    ) {
      return isIndonesian
        ? "Layanan langganan App Store sedang dalam penyiapan. Pastikan perjanjian Paid Applications di App Store Connect dan konfigurasi produk telah aktif."
        : "App Store subscription service is being set up. Please ensure Paid Applications Agreement and products are active in App Store Connect.";
    }

    // 2. Network / Offline issues (RC Code 10)
    if (
      code === "10" ||
      rawMsg.includes("network") ||
      rawMsg.includes("offline") ||
      rawMsg.includes("internet")
    ) {
      return isIndonesian
        ? "Koneksi jaringan terputus. Pastikan perangkat Anda terhubung ke internet."
        : "Network connection lost. Please check your internet connection.";
    }

    // 3. Apple StoreKit Server Problem (RC Code 2)
    if (code === "2" || rawMsg.includes("storeproblem") || rawMsg.includes("store problem")) {
      return isIndonesian
        ? "Terjadi kendala pada server App Store Apple. Silakan coba kembali beberapa saat lagi."
        : "Apple App Store servers are experiencing issues. Please try again shortly.";
    }

    // 4. Receipt already in use (RC Code 7)
    if (code === "7" || rawMsg.includes("already in use") || rawMsg.includes("receiptinuse")) {
      return isIndonesian
        ? "Langganan ini telah terhubung dengan akun Apple ID yang berbeda."
        : "This subscription is already linked to another Apple ID account.";
    }

    // 5. Default fallback
    return isIndonesian
      ? "Transaksi tidak dapat diselesaikan. Silakan coba kembali beberapa saat lagi."
      : "Unable to complete transaction. Please try again later.";
  }

  /**
   * Restores existing purchases for the active Apple ID.
   */
  public async restorePurchases(): Promise<{
    success: boolean;
    hasActivePro: boolean;
    customerInfo?: CustomerInfo;
    error?: string;
  }> {
    const isNative = Capacitor.isNativePlatform();

    if (!this.isConfigured) {
      const initialized = await this.initialize(this.currentUserId || undefined);
      if (!initialized && isNative) {
        return {
          success: false,
          hasActivePro: false,
          error: this.formatErrorMessage({ code: "23", message: "configuration" }),
        };
      }
    }

    if (this.isMockMode && !isNative) {
      return { success: true, hasActivePro: false };
    }

    if (!this.isConfigured) {
      return {
        success: false,
        hasActivePro: false,
        error: this.formatErrorMessage({ code: "23", message: "configuration" }),
      };
    }

    try {
      const { customerInfo } = await Purchases.restorePurchases();
      const hasActivePro = this.isProEntitlementActive(customerInfo);

      return {
        success: true,
        hasActivePro,
        customerInfo,
      };
    } catch (err: any) {
      console.warn("[RevenueCat] restorePurchases failed:", err);
      return {
        success: false,
        hasActivePro: false,
        error: this.formatErrorMessage(err),
      };
    }
  }

  /**
   * Strictly validates whether customer has active 'accrual_pro' entitlement
   * and verifies that its expirationDate (if any) is still in the future.
   */
  public isProEntitlementActive(customerInfo: CustomerInfo): boolean {
    const entitlement = customerInfo.entitlements?.active?.[REVENUECAT_ENTITLEMENT_ID];
    if (entitlement) {
      const isActiveFlag = entitlement.isActive !== false;
      if (!isActiveFlag) return false;

      // Lifetime or non-expiring entitlement
      if (!entitlement.expirationDate) {
        return true;
      }
      const expiryTime = new Date(entitlement.expirationDate).getTime();
      return !Number.isNaN(expiryTime) && expiryTime > Date.now();
    }

    // Strict fallback: ONLY accept known Accrual Pro subscription product IDs if present in activeSubscriptions
    if (customerInfo.activeSubscriptions && customerInfo.activeSubscriptions.length > 0) {
      const knownProProductIds = new Set<string>([
        REVENUECAT_PRODUCT_IDS.accrual_monthly_29k,
        REVENUECAT_PRODUCT_IDS.accrual_annual_199k,
        REVENUECAT_PRODUCT_IDS.accrual_lifetime_499k,
      ]);
      return customerInfo.activeSubscriptions.some((subId) => knownProProductIds.has(subId));
    }

    return false;
  }

  /**
   * Checks whether the user currently has an active 'accrual_pro' entitlement.
   */
  public async checkProEntitlement(): Promise<boolean> {
    if (this.isMockMode || !this.isConfigured) {
      return false;
    }

    try {
      const { customerInfo } = await Purchases.getCustomerInfo();
      return this.isProEntitlementActive(customerInfo);
    } catch {
      return false;
    }
  }

  /**
   * Fetches the latest CustomerInfo from native StoreKit/RevenueCat and maps it to UserSubscription.
   */
  public async getCustomerInfoSubscription(): Promise<UserSubscription | null> {
    if (!Capacitor.isNativePlatform() || this.isMockMode || !this.isConfigured) {
      return null;
    }

    try {
      const { customerInfo } = await Purchases.getCustomerInfo();
      if (!customerInfo) return null;
      return this.mapCustomerInfoToSubscription(customerInfo);
    } catch {
      return null;
    }
  }

  /**
   * Converts RevenueCat customer info to an Accrual UserSubscription snapshot.
   */
  public mapCustomerInfoToSubscription(
    customerInfo: CustomerInfo,
    planIdHint?: SubscriptionPlanId
  ): UserSubscription {
    const activeEntitlements = customerInfo.entitlements?.active || {};
    const entitlement = activeEntitlements[REVENUECAT_ENTITLEMENT_ID] || null;

    const knownProProductIds = new Set<string>([
      REVENUECAT_PRODUCT_IDS.accrual_monthly_29k,
      REVENUECAT_PRODUCT_IDS.accrual_annual_199k,
      REVENUECAT_PRODUCT_IDS.accrual_lifetime_499k,
    ]);
    const fallbackSubId =
      customerInfo.activeSubscriptions?.find((id) => knownProProductIds.has(id)) || null;

    const isPro = this.isProEntitlementActive(customerInfo);

    const resolvedPlanId =
      planIdHint ||
      (entitlement?.productIdentifier as SubscriptionPlanId | undefined) ||
      (fallbackSubId as SubscriptionPlanId | null) ||
      null;
    const isLifetime = Boolean(
      entitlement?.productIdentifier?.includes("lifetime") ||
      resolvedPlanId === "accrual_lifetime_499k"
    );

    return {
      tier: isPro ? "premium" : "free",
      status: isPro ? (entitlement?.periodType === "TRIAL" ? "trialing" : "active") : "expired",
      planId: resolvedPlanId,
      store: "app_store",
      originalTransactionId:
        entitlement?.originalPurchaseDate ||
        customerInfo.originalPurchaseDate ||
        (isPro ? `rc_${Date.now()}` : null),
      trialStartAt: entitlement?.periodType === "TRIAL" ? entitlement.originalPurchaseDate : null,
      trialEndAt: entitlement?.periodType === "TRIAL" ? entitlement.expirationDate : null,
      currentPeriodStart: entitlement?.latestPurchaseDate || null,
      currentPeriodEnd: isLifetime ? null : entitlement?.expirationDate || null,
      isLifetime,
      updatedAt: new Date().toISOString(),
    };
  }

  public getStatus() {
    return {
      isConfigured: this.isConfigured,
      isMockMode: this.isMockMode,
      userId: this.currentUserId,
    };
  }
}

export const revenueCatService = new RevenueCatService();
