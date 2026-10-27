// ======================================================================
// ACCRUAL SUBSCRIPTION CONTEXT & ENTITLEMENT ENGINE
// Strictly compliant with GEMINI.md: Monochrome Apple Luxury Theme
// ======================================================================

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type {
  UserSubscription,
  SubscriptionPlanId,
  PaywallTriggerContext,
} from "../types/subscription";
import { MONETIZATION_LIMITS } from "../types/subscription";
import { useAuth, GUEST_USER_ID } from "./AuthContext";
import { supabase } from "../lib/supabase";
import { revenueCatService } from "../lib/revenueCatService";
import { triggerSuccessHaptic, triggerHaptic } from "../lib/haptics";

export const SUBSCRIPTION_STORAGE_KEY = "accrual_subscription_state_v1";

export function getSubscriptionStorageKey(userId?: string | null): string {
  if (!userId || userId === GUEST_USER_ID) {
    return `${SUBSCRIPTION_STORAGE_KEY}_guest`;
  }
  return `${SUBSCRIPTION_STORAGE_KEY}_${userId}`;
}

export interface UpgradePlanResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
}

export interface RestorePurchasesResult {
  success: boolean;
  hasActivePro: boolean;
  error?: string;
}

export interface SubscriptionContextValue {
  subscription: UserSubscription;
  isPremium: boolean;
  isLoading: boolean;
  isPaywallOpen: boolean;
  isSuccessModalOpen: boolean;
  successModalSub: UserSubscription | null;
  isCancelModalOpen: boolean;
  paywallContext: PaywallTriggerContext | null;
  openPaywall: (ctx?: PaywallTriggerContext) => void;
  closePaywall: () => void;
  openSuccessModal: (sub?: UserSubscription) => void;
  closeSuccessModal: () => void;
  openCancelModal: () => void;
  closeCancelModal: () => void;
  upgradeToPlan: (planId: SubscriptionPlanId) => Promise<UpgradePlanResult>;
  restorePurchases: () => Promise<RestorePurchasesResult>;
  setLocalTierOverride: (tier: "free" | "premium") => void; // for debug/testing
  limits: typeof MONETIZATION_LIMITS;
}

const DEFAULT_SUBSCRIPTION: UserSubscription = {
  tier: "free",
  status: "active",
  planId: null,
  store: null,
  originalTransactionId: null,
  trialStartAt: null,
  trialEndAt: null,
  currentPeriodStart: null,
  currentPeriodEnd: null,
  isLifetime: false,
  updatedAt: new Date().toISOString(),
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [paywallContext, setPaywallContext] = useState<PaywallTriggerContext | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successModalSub, setSuccessModalSub] = useState<UserSubscription | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  // Initialize from local offline cache for immediate synchronous boot
  const [subscription, setSubscription] = useState<UserSubscription>(() => {
    try {
      const cached = localStorage.getItem(SUBSCRIPTION_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed.tier === "string") {
          return parsed as UserSubscription;
        }
      }
    } catch {
      // Fallback on corrupt storage
    }
    return DEFAULT_SUBSCRIPTION;
  });

  // Persist to local storage whenever subscription changes (scoped by user ID)
  const saveToLocal = useCallback(
    (sub: UserSubscription) => {
      setSubscription(sub);
      try {
        const key = getSubscriptionStorageKey(user?.id);
        localStorage.setItem(key, JSON.stringify(sub));
        localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(sub));
      } catch {
        // Ignore quota storage issues
      }
    },
    [user?.id]
  );

  // Fetch remote subscription from Supabase if logged in
  const fetchRemoteSubscription = useCallback(async () => {
    if (!user || user.id === GUEST_USER_ID) {
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        // Table may not exist yet if migration hasn't been executed
        console.warn("[SubscriptionContext] Failed to fetch subscription:", error.message);
        return;
      }

      if (data) {
        const remoteSub: UserSubscription = {
          tier: data.tier || "free",
          status: data.status || "active",
          planId: data.plan_id || null,
          store: data.store || null,
          originalTransactionId: data.original_transaction_id || null,
          trialStartAt: data.trial_start_at || null,
          trialEndAt: data.trial_end_at || null,
          currentPeriodStart: data.current_period_start || null,
          currentPeriodEnd: Boolean(data.is_lifetime || data.plan_id === "accrual_lifetime_499k")
            ? null
            : (data.current_period_end || null),
          isLifetime: Boolean(data.is_lifetime || data.plan_id === "accrual_lifetime_499k"),
          updatedAt: data.updated_at || new Date().toISOString(),
        };
        saveToLocal(remoteSub);
      }
    } catch (err) {
      console.warn("[SubscriptionContext] Network or schema error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user, saveToLocal]);

  useEffect(() => {
    if (!user || user.id === GUEST_USER_ID) {
      // Switched to guest / logged out: load guest state or default free
      try {
        const guestKey = getSubscriptionStorageKey(user?.id);
        const cached = localStorage.getItem(guestKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed.tier === "string") {
            setSubscription(parsed);
          } else {
            setSubscription(DEFAULT_SUBSCRIPTION);
          }
        } else {
          setSubscription(DEFAULT_SUBSCRIPTION);
        }
      } catch {
        setSubscription(DEFAULT_SUBSCRIPTION);
      }
      revenueCatService.initialize();
      return;
    }

    // Authenticated user: load user cache and fetch remote
    try {
      const userKey = getSubscriptionStorageKey(user.id);
      const cached = localStorage.getItem(userKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed.tier === "string") {
          setSubscription(parsed);
        }
      }
    } catch {}

    fetchRemoteSubscription();
    revenueCatService.initialize(user.id);
  }, [fetchRemoteSubscription, user]);

  const isPremium = useMemo(() => {
    if (subscription.isLifetime) return true;
    if (subscription.tier !== "premium") return false;
    return subscription.status === "active" || subscription.status === "trialing";
  }, [subscription]);

  const openPaywall = useCallback((ctx?: PaywallTriggerContext) => {
    triggerHaptic();
    setPaywallContext(ctx || null);
    setIsPaywallOpen(true);
  }, []);

  const closePaywall = useCallback(() => {
    setIsPaywallOpen(false);
    setPaywallContext(null);
  }, []);

  const openSuccessModal = useCallback((sub?: UserSubscription) => {
    triggerHaptic("light");
    setSuccessModalSub(sub || subscription);
    setIsSuccessModalOpen(true);
  }, [subscription]);

  const closeSuccessModal = useCallback(() => {
    setIsSuccessModalOpen(false);
    setSuccessModalSub(null);
  }, []);

  const openCancelModal = useCallback(() => {
    triggerHaptic("light");
    setIsCancelModalOpen(true);
  }, []);

  const closeCancelModal = useCallback(() => {
    setIsCancelModalOpen(false);
  }, []);

  const upgradeToPlan = useCallback(
    async (planId: SubscriptionPlanId): Promise<UpgradePlanResult> => {
      try {
        setIsLoading(true);

        // 1. Trigger purchase via RevenueCat StoreKit bridge (or mock sandbox)
        const result = await revenueCatService.purchasePlan(planId);
        if (!result.success) {
          if (result.cancelled) {
            console.info("[SubscriptionContext] Checkout cancelled by user.");
            return { success: false, cancelled: true };
          }
          console.warn("[SubscriptionContext] Purchase failed:", result.error);
          return { success: false, error: result.error };
        }

        triggerSuccessHaptic();

        let updatedSub: UserSubscription;
        if (result.customerInfo) {
          updatedSub = revenueCatService.mapCustomerInfoToSubscription(result.customerInfo, planId);
        } else {
          // Mock Sandbox calculation
          const isLifetime = planId === "accrual_lifetime_499k";
          const hasTrial = planId === "accrual_annual_199k";
          const now = new Date();
          const trialEnd = hasTrial
            ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
            : null;

          updatedSub = {
            tier: "premium",
            status: hasTrial ? "trialing" : "active",
            planId,
            store: "app_store",
            isLifetime,
            trialStartAt: hasTrial ? now.toISOString() : null,
            trialEndAt: trialEnd,
            currentPeriodStart: now.toISOString(),
            currentPeriodEnd: isLifetime
              ? null
              : new Date(
                  now.getTime() +
                    (planId === "accrual_annual_199k" ? 365 : 30) * 24 * 60 * 60 * 1000
                ).toISOString(),
            updatedAt: now.toISOString(),
          };
        }

        // 2. Save locally immediately
        saveToLocal(updatedSub);

        // 3. Sync to Supabase if authenticated
        if (user && user.id !== GUEST_USER_ID) {
          try {
            await supabase.from("user_subscriptions").upsert(
              {
                user_id: user.id,
                tier: updatedSub.tier,
                status: updatedSub.status,
                plan_id: updatedSub.planId,
                store: updatedSub.store,
                trial_start_at: updatedSub.trialStartAt,
                trial_end_at: updatedSub.trialEndAt,
                current_period_start: updatedSub.currentPeriodStart,
                current_period_end: updatedSub.currentPeriodEnd,
                is_lifetime: updatedSub.isLifetime,
                updated_at: updatedSub.updatedAt,
              },
              { onConflict: "user_id" }
            );
          } catch (syncErr) {
            console.warn("[SubscriptionContext] Background sync error:", syncErr);
          }
        }

        closePaywall();
        openSuccessModal(updatedSub);
        return { success: true };
      } catch (err: any) {
        console.error("[SubscriptionContext] Upgrade error:", err);
        return { success: false, error: err?.message || "Gagal memproses transaksi." };
      } finally {
        setIsLoading(false);
      }
    },
    [user, saveToLocal, closePaywall, openSuccessModal]
  );

  const restorePurchases = useCallback(async (): Promise<RestorePurchasesResult> => {
    try {
      setIsLoading(true);
      triggerHaptic();

      // 1. Call native RevenueCat restore
      const restoreRes = await revenueCatService.restorePurchases();
      if (restoreRes.hasActivePro && restoreRes.customerInfo) {
        const restoredSub = revenueCatService.mapCustomerInfoToSubscription(restoreRes.customerInfo);
        saveToLocal(restoredSub);

        if (user && user.id !== GUEST_USER_ID) {
          try {
            await supabase.from("user_subscriptions").upsert(
              {
                user_id: user.id,
                tier: restoredSub.tier,
                status: restoredSub.status,
                plan_id: restoredSub.planId,
                store: restoredSub.store,
                trial_start_at: restoredSub.trialStartAt,
                trial_end_at: restoredSub.trialEndAt,
                current_period_start: restoredSub.currentPeriodStart,
                current_period_end: restoredSub.currentPeriodEnd,
                is_lifetime: restoredSub.isLifetime,
                updated_at: restoredSub.updatedAt,
              },
              { onConflict: "user_id" }
            );
          } catch (syncErr) {
            console.warn("[SubscriptionContext] Restore sync error:", syncErr);
          }
        }
        closePaywall();
        openSuccessModal(restoredSub);
        return { success: true, hasActivePro: true };
      }

      if (restoreRes.error) {
        return { success: false, hasActivePro: false, error: restoreRes.error };
      }

      // 2. In offline/mock mode, check remote Supabase record if logged in
      if (user && user.id !== GUEST_USER_ID) {
        await fetchRemoteSubscription();
        return { success: true, hasActivePro: subscription.tier === "premium" };
      }

      return { success: true, hasActivePro: false };
    } catch (err: any) {
      return { success: false, hasActivePro: false, error: err?.message };
    } finally {
      setIsLoading(false);
    }
  }, [user, saveToLocal, fetchRemoteSubscription, subscription.tier, closePaywall, openSuccessModal]);

  const setLocalTierOverride = useCallback(
    (tier: "free" | "premium") => {
      const now = new Date().toISOString();
      const updated: UserSubscription = {
        tier,
        status: "active",
        planId: tier === "premium" ? "accrual_annual_199k" : null,
        isLifetime: false,
        updatedAt: now,
      };
      saveToLocal(updated);
    },
    [saveToLocal]
  );

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      subscription,
      isPremium,
      isLoading,
      isPaywallOpen,
      isSuccessModalOpen,
      successModalSub,
      isCancelModalOpen,
      paywallContext,
      openPaywall,
      closePaywall,
      openSuccessModal,
      closeSuccessModal,
      openCancelModal,
      closeCancelModal,
      upgradeToPlan,
      restorePurchases,
      setLocalTierOverride,
      limits: MONETIZATION_LIMITS,
    }),
    [
      subscription,
      isPremium,
      isLoading,
      isPaywallOpen,
      isSuccessModalOpen,
      successModalSub,
      isCancelModalOpen,
      paywallContext,
      openPaywall,
      closePaywall,
      openSuccessModal,
      closeSuccessModal,
      openCancelModal,
      closeCancelModal,
      upgradeToPlan,
      restorePurchases,
      setLocalTierOverride,
    ]
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  if (!context) {
    // Resilient fallback for isolated test environments
    return {
      subscription: DEFAULT_SUBSCRIPTION,
      isPremium: false,
      isLoading: false,
      isPaywallOpen: false,
      isSuccessModalOpen: false,
      successModalSub: null,
      isCancelModalOpen: false,
      paywallContext: null,
      openPaywall: () => {},
      closePaywall: () => {},
      openSuccessModal: () => {},
      closeSuccessModal: () => {},
      openCancelModal: () => {},
      closeCancelModal: () => {},
      upgradeToPlan: async () => ({ success: false }),
      restorePurchases: async () => ({ success: false, hasActivePro: false }),
      setLocalTierOverride: () => {},
      limits: MONETIZATION_LIMITS,
    };
  }
  return context;
}
