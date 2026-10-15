// ======================================================================
// ACCRUAL MONETIZATION & SUBSCRIPTION TYPES
// Strictly compliant with GEMINI.md: Monochrome Apple Luxury Theme
// ======================================================================

export type SubscriptionTier = 'free' | 'premium';

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'canceled'
  | 'expired'
  | 'past_due';

export type SubscriptionPlanId =
  | 'accrual_monthly_29k'
  | 'accrual_annual_199k'
  | 'accrual_lifetime_499k';

export interface UserSubscription {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  planId?: SubscriptionPlanId | string | null;
  store?: 'app_store' | 'play_store' | 'manual' | null;
  originalTransactionId?: string | null;
  trialStartAt?: string | null;
  trialEndAt?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  isLifetime: boolean;
  updatedAt: string;
}

export type PaywallTriggerFeature =
  | 'dashboard_limit'
  | 'advanced_widget'
  | 'ocr_quota'
  | 'multi_ledger'
  | 'luxury_export'
  | 'settings_manual';

export interface PaywallTriggerContext {
  feature?: PaywallTriggerFeature;
  title?: string;
  description?: string;
}

export interface PlanPricingMeta {
  id: SubscriptionPlanId;
  price: number;
  period: 'month' | 'year' | 'lifetime';
  hasTrial: boolean;
  trialDays?: number;
  discountBadge?: string;
}

export const PLAN_PRICING_CONFIG: Record<SubscriptionPlanId, PlanPricingMeta> = {
  accrual_monthly_29k: {
    id: 'accrual_monthly_29k',
    price: 29000,
    period: 'month',
    hasTrial: false,
  },
  accrual_annual_199k: {
    id: 'accrual_annual_199k',
    price: 199000,
    period: 'year',
    hasTrial: true,
    trialDays: 7,
    discountBadge: '43%',
  },
  accrual_lifetime_499k: {
    id: 'accrual_lifetime_499k',
    price: 499000,
    period: 'lifetime',
    hasTrial: false,
  },
};

export const MONETIZATION_LIMITS = {
  FREE_OCR_MONTHLY_LIMIT: 5,
  FREE_DASHBOARD_MAX_SLOTS: 4,
  FREE_MAX_LEDGERS: 2,
} as const;

export const PRO_WIDGET_IDS = [
  'financial_health_gauge',
  'liquid_runway',
  'spending_stability',
] as const;

export type ProWidgetId = (typeof PRO_WIDGET_IDS)[number];
