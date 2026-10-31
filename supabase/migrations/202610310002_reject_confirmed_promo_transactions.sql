create schema if not exists accrual_recovery;
revoke all on schema accrual_recovery from public, anon, authenticated;
create table if not exists accrual_recovery.transaction_quarantine (
 transaction_id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 original_row jsonb not null, reason text not null,
 archived_at timestamptz not null default now()
);
alter table accrual_recovery.transaction_quarantine enable row level security;
revoke all on accrual_recovery.transaction_quarantine from public, anon, authenticated;
create or replace function public.reject_confirmed_promo_transactions()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if (new.note ilike '%kak masih bisa klaim%' and new.note ilike '%shopeepay%')
 or (new.note ilike '%DANA - DANA - DANA%' and new.note ilike '%siap-siap dapetin%') then
 raise exception using errcode='23514', message='Promotional notification is not a financial transaction';
 end if;
 return new;
end $$;
revoke all on function public.reject_confirmed_promo_transactions() from public,anon,authenticated;
create trigger reject_confirmed_promo_transactions before insert or update on public.transactions
for each row execute function public.reject_confirmed_promo_transactions();
