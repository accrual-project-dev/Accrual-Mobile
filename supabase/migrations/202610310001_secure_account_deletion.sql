-- Only a verified server may finalize account deletion after Apple revocation.
REVOKE ALL ON FUNCTION public.delete_user_account() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := p_user_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing account identity';
  END IF;

  -- Accrual currently stores only application assets in Storage. Refuse to
  -- delete identities with owned files until physical cleanup is implemented.
  IF EXISTS (SELECT 1 FROM storage.objects WHERE owner = v_user_id) THEN
    RAISE EXCEPTION 'Owned storage files must be removed before account deletion';
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


REVOKE ALL ON FUNCTION public.delete_user_account(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO service_role;
