-- ======================================================================
-- MIGRATION: 20261016_harden_supabase_schema_audit.sql
-- Description: Comprehensive schema audit hardening for Supabase Cloud:
-- 1. Migrate transactions.occurred_on from date to timestamptz (preserves HH:mm:ss).
-- 2. Add ON DELETE CASCADE on auth.users foreign keys for wallets, categories, bills, and transactions.
-- 3. Add ON DELETE SET NULL on transactions.wallet_id and to_wallet_id.
-- 4. Clean up redundant duplicate unique constraints on holdings and wallets.
-- 5. Add cashflow_nature on categories and non-negative amount check on bills.
-- 6. Add unique constraint on user_budgets (user_id, coalesce(month, 'global')).
-- ======================================================================

BEGIN;

-- 1. TRANSACTIONS: Migrate occurred_on to timestamptz & Harden Foreign Keys
ALTER TABLE public.transactions 
  DROP CONSTRAINT IF EXISTS check_occurred_on_reasonable_year;

ALTER TABLE public.transactions 
  ALTER COLUMN occurred_on TYPE timestamp with time zone 
  USING occurred_on::timestamp with time zone;

ALTER TABLE public.transactions 
  ALTER COLUMN occurred_on SET DEFAULT now();

ALTER TABLE public.transactions 
  ADD CONSTRAINT check_occurred_on_reasonable_year 
  CHECK (
    occurred_on >= '2000-01-01 00:00:00+00'::timestamp with time zone 
    AND occurred_on <= '2100-12-31 23:59:59+00'::timestamp with time zone
  );

ALTER TABLE public.transactions 
  DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;

ALTER TABLE public.transactions 
  ADD CONSTRAINT transactions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;

ALTER TABLE public.transactions 
  DROP CONSTRAINT IF EXISTS transactions_wallet_id_fkey;

ALTER TABLE public.transactions 
  ADD CONSTRAINT transactions_wallet_id_fkey 
  FOREIGN KEY (wallet_id) REFERENCES public.wallets (id) ON DELETE SET NULL;

ALTER TABLE public.transactions 
  DROP CONSTRAINT IF EXISTS transactions_to_wallet_id_fkey;

ALTER TABLE public.transactions 
  ADD CONSTRAINT transactions_to_wallet_id_fkey 
  FOREIGN KEY (to_wallet_id) REFERENCES public.wallets (id) ON DELETE SET NULL;


-- 2. WALLETS: Add ON DELETE CASCADE to user_id & Drop redundant unique key
ALTER TABLE public.wallets 
  DROP CONSTRAINT IF EXISTS wallets_user_id_fkey;

ALTER TABLE public.wallets 
  ADD CONSTRAINT wallets_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;

ALTER TABLE public.wallets 
  DROP CONSTRAINT IF EXISTS wallets_user_id_name_key;


-- 3. CATEGORIES: Add ON DELETE CASCADE to user_id & cashflow_nature column
ALTER TABLE public.categories 
  DROP CONSTRAINT IF EXISTS categories_user_id_fkey;

ALTER TABLE public.categories 
  ADD CONSTRAINT categories_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;

ALTER TABLE public.categories 
  ADD COLUMN IF NOT EXISTS cashflow_nature text null;


-- 4. BILLS: Add ON DELETE CASCADE to user_id & non-negative amount check
ALTER TABLE public.bills 
  DROP CONSTRAINT IF EXISTS bills_user_id_fkey;

ALTER TABLE public.bills 
  ADD CONSTRAINT bills_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;

ALTER TABLE public.bills 
  DROP CONSTRAINT IF EXISTS bills_amount_check;

ALTER TABLE public.bills 
  ADD CONSTRAINT bills_amount_check 
  CHECK (amount IS NULL OR amount >= 0);


-- 5. HOLDINGS: Drop redundant duplicate unique constraint
ALTER TABLE public.holdings 
  DROP CONSTRAINT IF EXISTS uq_holdings_user_symbol_constraint;


-- 6. USER_BUDGETS: Add unique constraint on (user_id, month)
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_budgets_user_month 
  ON public.user_budgets USING btree (user_id, COALESCE(month, 'global'));

COMMIT;
