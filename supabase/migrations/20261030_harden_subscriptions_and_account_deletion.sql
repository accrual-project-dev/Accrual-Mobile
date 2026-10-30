-- ==============================================================================
-- ACCRUAL SUPABASE MIGRATION: SUBSCRIPTION RLS, QUOTA RPC & ACCOUNT DELETION HARDENING
-- Migration: 20261030_harden_subscriptions_and_account_deletion.sql
-- ==============================================================================

BEGIN;

-- 1. HARDEN RLS POLICIES ON public.user_subscriptions
ALTER TABLE IF EXISTS public.user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.user_subscriptions;

CREATE POLICY "Users can insert own subscription"
  ON public.user_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      (tier = 'free' AND is_lifetime = false)
      OR (
        store IN ('app_store', 'play_store')
        AND plan_id IN ('accrual_monthly_29k', 'accrual_annual_199k', 'accrual_lifetime_499k')
        AND original_transaction_id IS NOT NULL
        AND length(trim(original_transaction_id)) > 0
      )
    )
  );

CREATE POLICY "Users can update own subscription"
  ON public.user_subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      (tier = 'free' AND is_lifetime = false)
      OR (
        store IN ('app_store', 'play_store')
        AND plan_id IN ('accrual_monthly_29k', 'accrual_annual_199k', 'accrual_lifetime_499k')
        AND original_transaction_id IS NOT NULL
        AND length(trim(original_transaction_id)) > 0
      )
    )
  );

-- 2. HARDEN increment_monthly_ocr_usage() RPC
REVOKE EXECUTE ON FUNCTION public.increment_monthly_ocr_usage(UUID, TEXT) FROM anon;

CREATE OR REPLACE FUNCTION public.increment_monthly_ocr_usage(p_user_id UUID, p_period TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id UUID;
  v_count INTEGER;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL OR v_caller_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: caller identity does not match target user_id';
  END IF;

  INSERT INTO public.user_monthly_quotas (user_id, billing_period, ocr_import_count, updated_at)
  VALUES (v_caller_id, p_period, 1, timezone('utc'::text, now()))
  ON CONFLICT (user_id, billing_period)
  DO UPDATE SET
    ocr_import_count = public.user_monthly_quotas.ocr_import_count + 1,
    updated_at = timezone('utc'::text, now())
  RETURNING ocr_import_count INTO v_count;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_monthly_ocr_usage(UUID, TEXT) TO authenticated, service_role;

-- 3. COMPLETE delete_user_account() RPC
REVOKE EXECUTE ON FUNCTION public.delete_user_account() FROM anon;

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sesi tidak terotentikasi');
  END IF;

  DELETE FROM public.transactions WHERE user_id = v_user_id;
  DELETE FROM public.wallets WHERE user_id = v_user_id;
  DELETE FROM public.categories WHERE user_id = v_user_id;
  DELETE FROM public.bills WHERE user_id = v_user_id;
  DELETE FROM public.goals WHERE user_id = v_user_id;
  DELETE FROM public.holdings WHERE user_id = v_user_id;
  DELETE FROM public.user_budgets WHERE user_id = v_user_id;
  DELETE FROM public.user_shortcuts WHERE user_id = v_user_id;
  DELETE FROM public.user_subscriptions WHERE user_id = v_user_id;
  DELETE FROM public.user_monthly_quotas WHERE user_id = v_user_id;
  DELETE FROM public.ledger_members WHERE user_id = v_user_id;
  DELETE FROM public.ledgers WHERE user_id = v_user_id;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'debt_receivables'
  ) THEN
    EXECUTE 'DELETE FROM public.debt_receivables WHERE user_id = $1' USING v_user_id;
  END IF;

  DELETE FROM auth.users WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

COMMIT;