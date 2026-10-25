-- ==============================================================================
-- ACCRUAL SUPABASE MIGRATION: FIX USER SUBSCRIPTIONS RLS POLICIES
-- Enables authenticated users to insert and update their own subscription records.
-- ==============================================================================
-- Run this script in: Supabase Dashboard -> SQL Editor
-- Idempotent & safe to run multiple times
-- ==============================================================================

-- 1. Enable RLS (Ensure RLS is active)
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- 2. Policy: SELECT (Allow users to read their own subscription)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_subscriptions' AND policyname = 'Users can read own subscription'
    ) THEN
        CREATE POLICY "Users can read own subscription"
            ON public.user_subscriptions
            FOR SELECT
            TO authenticated
            USING (auth.uid() = user_id);
    END IF;
END $$;

-- 3. Policy: INSERT (Allow users to insert their own subscription on purchase/restore)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_subscriptions' AND policyname = 'Users can insert own subscription'
    ) THEN
        CREATE POLICY "Users can insert own subscription"
            ON public.user_subscriptions
            FOR INSERT
            TO authenticated
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- 4. Policy: UPDATE (Allow users to update their own subscription on renew/plan switch)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_subscriptions' AND policyname = 'Users can update own subscription'
    ) THEN
        CREATE POLICY "Users can update own subscription"
            ON public.user_subscriptions
            FOR UPDATE
            TO authenticated
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;
