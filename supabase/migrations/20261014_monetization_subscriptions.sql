-- ==============================================================================
-- ACCRUAL SUPABASE MIGRATION: MONETIZATION, SUBSCRIPTIONS & USAGE QUOTAS
-- 1. Creates ENUM types for subscription tier and status safely
-- 2. Creates user_subscriptions table with RLS and user isolation
-- 3. Creates user_monthly_quotas table with atomic increment RPC for OCR scans
-- 4. Enables Row Level Security (RLS) with user-scoped access policies
-- ==============================================================================
-- Run this script in: Supabase Dashboard -> SQL Editor
-- Idempotent & safe to run multiple times
-- ==============================================================================

-- 1. ENUM TIER & STATUS LANGGANAN
DO $$ BEGIN
    CREATE TYPE subscription_tier_enum AS ENUM ('free', 'premium');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_status_enum AS ENUM ('active', 'trialing', 'canceled', 'expired', 'past_due');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. TABEL SUBSCRIPTION PENGGUNA
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tier subscription_tier_enum NOT NULL DEFAULT 'free',
    status subscription_status_enum NOT NULL DEFAULT 'active',
    plan_id TEXT, -- 'accrual_monthly_29k', 'accrual_annual_199k', 'accrual_lifetime_499k'
    store TEXT,   -- 'app_store', 'play_store', 'stripe', 'manual'
    original_transaction_id TEXT,
    trial_start_at TIMESTAMPTZ,
    trial_end_at TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    is_lifetime BOOLEAN NOT NULL DEFAULT false,
    raw_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_user_subscriptions_user UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_tier ON public.user_subscriptions (user_id, tier, status);

-- 3. TABEL QUOTA PENGGUNAAN BULANAN (HYBRID OCR & HEAVY JOBS)
CREATE TABLE IF NOT EXISTS public.user_monthly_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    billing_period TEXT NOT NULL, -- Format: 'YYYY-MM'
    ocr_import_count INTEGER NOT NULL DEFAULT 0,
    luxury_export_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_user_monthly_quotas_period UNIQUE (user_id, billing_period)
);

CREATE INDEX IF NOT EXISTS idx_user_monthly_quotas_lookup ON public.user_monthly_quotas (user_id, billing_period);

-- 4. ATOMIC FUNCTION: INCREMENT OCR USAGE
CREATE OR REPLACE FUNCTION public.increment_monthly_ocr_usage(p_user_id UUID, p_period TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    INSERT INTO public.user_monthly_quotas (user_id, billing_period, ocr_import_count, updated_at)
    VALUES (p_user_id, p_period, 1, timezone('utc'::text, now()))
    ON CONFLICT (user_id, billing_period)
    DO UPDATE SET 
        ocr_import_count = public.user_monthly_quotas.ocr_import_count + 1,
        updated_at = timezone('utc'::text, now())
    RETURNING ocr_import_count INTO v_count;

    RETURN v_count;
END;
$$;

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_monthly_quotas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_subscriptions' AND policyname = 'Users can read own subscription'
    ) THEN
        CREATE POLICY "Users can read own subscription"
            ON public.user_subscriptions
            FOR SELECT
            USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_monthly_quotas' AND policyname = 'Users can read own monthly quotas'
    ) THEN
        CREATE POLICY "Users can read own monthly quotas"
            ON public.user_monthly_quotas
            FOR SELECT
            USING (auth.uid() = user_id);
    END IF;
END $$;
