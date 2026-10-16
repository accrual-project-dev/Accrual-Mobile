# Trouvaille Supabase Database Schema Specification
**Canonical Reference Document · Production Cloud Schema**
*Last Synchronized: 16 October 2026*

This document serves as the absolute single source of truth for the Trouvaille production database hosted on Supabase (PostgreSQL 15+).

---

## 1. Overview of Core Entities

The Trouvaille architecture organizes personal financial data into 12 core tables:

```mermaid
erDiagram
    users ||--o{ wallets : "owns"
    users ||--o{ ledgers : "owns"
    users ||--o{ ledger_members : "participates"
    users ||--o{ categories : "owns"
    users ||--o{ transactions : "records"
    users ||--o{ holdings : "holds"
    users ||--o{ bills : "schedules"
    users ||--o{ goals : "targets"
    users ||--o{ user_budgets : "allocates"
    users ||--o{ user_shortcuts : "configures"
    users ||--o{ user_subscriptions : "subscribes"
    users ||--o{ user_monthly_quotas : "tracks quota"

    ledgers ||--o{ ledger_members : "has members"
    wallets ||--o{ transactions : "originates"
    wallets ||--o{ transactions : "receives (transfer)"
    wallets ||--o{ holdings : "funds"
    wallets ||--o{ bills : "debits"
    categories ||--o{ transactions : "classifies"
    categories ||--o{ user_shortcuts : "presets"
    wallets ||--o{ user_shortcuts : "presets"
```

---

## 2. Table Specifications & DDL

### 1. `public.wallets` (Accounts & Liquid Vaults)
Stores cash accounts, bank accounts, and e-wallets.

```sql
create table public.wallets (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  name text not null,
  icon text not null,
  created_at timestamp with time zone null default now(),
  classification text null default 'liquid'::text,
  constraint wallets_pkey primary key (id),
  constraint wallets_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_wallets_user_id on public.wallets using btree (user_id) TABLESPACE pg_default;

create unique INDEX IF not exists uq_wallets_user_name on public.wallets using btree (
  user_id,
  lower(TRIM(both from name))
) TABLESPACE pg_default;
```

---

### 2. `public.categories` (Spending & Income Categories)
Stores user-customizable income and expense categories with icon/emoji mappings and optional cashflow classification.

```sql
create table public.categories (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null default auth.uid (),
  name text not null,
  emoji text not null,
  type text not null,
  is_default boolean null default false,
  created_at timestamp with time zone null default now(),
  budget_amount numeric null,
  cashflow_nature text null,
  constraint categories_pkey primary key (id),
  constraint categories_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint categories_type_check check (
    (
      type = any (
        array['income'::text, 'expense'::text, 'transfer'::text]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_categories_user_id on public.categories using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_categories_user_budget on public.categories using btree (user_id, budget_amount) TABLESPACE pg_default
where
  (budget_amount is not null);

create unique INDEX IF not exists uq_categories_user_type_name on public.categories using btree (
  user_id,
  type,
  lower(TRIM(both from name))
) TABLESPACE pg_default;
```

---

### 3. `public.ledgers` (Multi-Ledger Spaces)
Supports segregation of personal, business, joint, and project accounts.

```sql
create table public.ledgers (
  id text not null,
  user_id uuid not null,
  name text not null,
  description text null,
  icon text null default 'BookOpen'::text,
  currency text null default 'IDR'::text,
  is_default boolean null default false,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  is_shared boolean null default false,
  invite_code text null,
  constraint ledgers_pkey primary key (id),
  constraint ledgers_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_ledgers_user_id on public.ledgers using btree (user_id, created_at) TABLESPACE pg_default;

create index IF not exists idx_ledgers_invite_code on public.ledgers using btree (upper(invite_code)) TABLESPACE pg_default
where
  (invite_code is not null);
```

---

### 4. `public.ledger_members` (Collaborators in Shared Ledgers)
Manages shared ledger permissions, roles, and invitation states.

```sql
create table public.ledger_members (
  id uuid not null default gen_random_uuid (),
  ledger_id text not null,
  user_id uuid not null,
  role text not null default 'editor'::text,
  display_name text null,
  email text null,
  joined_at timestamp with time zone null default now(),
  status text not null default 'active'::text,
  constraint ledger_members_pkey primary key (id),
  constraint uq_ledger_member unique (ledger_id, user_id),
  constraint ledger_members_ledger_id_fkey foreign KEY (ledger_id) references ledgers (id) on delete CASCADE,
  constraint ledger_members_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint ledger_members_role_check check (
    (
      role = any (
        array['owner'::text, 'editor'::text, 'viewer'::text]
      )
    )
  ),
  constraint ledger_members_status_check check (
    (
      status = any (array['active'::text, 'pending'::text])
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_ledger_members_user_id on public.ledger_members using btree (user_id) TABLESPACE pg_default;
create index IF not exists idx_ledger_members_ledger_id on public.ledger_members using btree (ledger_id) TABLESPACE pg_default;
create index IF not exists idx_ledger_members_ledger_user on public.ledger_members using btree (ledger_id, user_id) TABLESPACE pg_default;
create index IF not exists idx_ledger_members_status on public.ledger_members using btree (ledger_id, status) TABLESPACE pg_default;
```

---

### 5. `public.transactions` (Financial Journal Entries)
Ledger-partitioned financial transaction records preserving full ISO timestamps.

```sql
create table public.transactions (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null default auth.uid (),
  category_id uuid null,
  type text not null,
  amount numeric(14, 2) not null,
  note text null,
  occurred_on timestamp with time zone not null default now(),
  created_at timestamp with time zone null default now(),
  wallet_id uuid null,
  to_wallet_id uuid null,
  ledger_id text null default 'personal'::text,
  created_by_name text null,
  created_by_user_id uuid null,
  constraint transactions_pkey primary key (id),
  constraint transactions_category_id_fkey foreign KEY (category_id) references categories (id) on delete set null,
  constraint transactions_wallet_id_fkey foreign KEY (wallet_id) references wallets (id) on delete set null,
  constraint transactions_to_wallet_id_fkey foreign KEY (to_wallet_id) references wallets (id) on delete set null,
  constraint transactions_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint transactions_type_check check (
    (
      type = any (
        array['income'::text, 'expense'::text, 'transfer'::text]
      )
    )
  ),
  constraint transactions_amount_check check ((amount > (0)::numeric)),
  constraint check_occurred_on_reasonable_year check (
    (
      (occurred_on >= '2000-01-01 00:00:00+00'::timestamp with time zone)
      and (occurred_on <= '2100-12-31 23:59:59+00'::timestamp with time zone)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_transactions_category_id on public.transactions using btree (category_id) TABLESPACE pg_default;
create index IF not exists idx_transactions_wallet_id on public.transactions using btree (wallet_id) TABLESPACE pg_default;
create index IF not exists idx_transactions_to_wallet_id on public.transactions using btree (to_wallet_id) TABLESPACE pg_default;
create index IF not exists idx_transactions_user_occurred_created on public.transactions using btree (user_id, occurred_on desc, created_at desc) TABLESPACE pg_default;
create index IF not exists idx_transactions_user_type_date on public.transactions using btree (user_id, type, occurred_on desc) TABLESPACE pg_default;
create index IF not exists idx_transactions_user_ledger_date on public.transactions using btree (user_id, ledger_id, occurred_on desc) TABLESPACE pg_default;
create index IF not exists idx_transactions_ledger_id on public.transactions using btree (ledger_id) TABLESPACE pg_default;
create index IF not exists idx_transactions_created_by_user_id on public.transactions using btree (created_by_user_id) TABLESPACE pg_default;
```

---

### 6. `public.holdings` (Investment & Net Worth Portfolio)
Tracks digital assets, crypto (BTC, USDT), stocks, gold, and fixed assets displayed on Executive Balance Sheet & Wallet Cards.

```sql
create table public.holdings (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  symbol text not null,
  name text not null,
  asset_type text not null default 'crypto'::text,
  units numeric not null default 0,
  avg_buy_price numeric not null default 0,
  current_price numeric not null default 0,
  currency text null default 'IDR'::text,
  notes text null,
  icon text null default 'TrendingUp'::text,
  annual_rate numeric null,
  purchase_date date null,
  wallet_id uuid null,
  last_price_updated_at timestamp with time zone null default now(),
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  native_currency text null default 'IDR'::text,
  native_price numeric null,
  change_24h_pct numeric null default 0,
  price_source text null default 'manual'::text,
  constraint holdings_pkey primary key (id),
  constraint holdings_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint holdings_wallet_id_fkey foreign KEY (wallet_id) references wallets (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_holdings_user_id on public.holdings using btree (user_id) TABLESPACE pg_default;
create index IF not exists idx_holdings_asset_type on public.holdings using btree (user_id, asset_type) TABLESPACE pg_default;
create index IF not exists idx_holdings_wallet_id on public.holdings using btree (wallet_id) TABLESPACE pg_default;
create unique INDEX IF not exists uq_holdings_user_symbol on public.holdings using btree (user_id, symbol) TABLESPACE pg_default;
```

---

### 7. `public.bills` (Recurring Subscriptions & Obligations)
Tracks recurring obligations, loans, and subscriptions.

```sql
create table public.bills (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null default auth.uid (),
  title text not null,
  amount numeric(14, 2) null,
  due_date date not null,
  repeat_rule text not null default 'none'::text,
  is_paid boolean null default false,
  note text null,
  created_at timestamp with time zone null default now(),
  wallet_id uuid null,
  category_id uuid null,
  constraint bills_pkey primary key (id),
  constraint bills_category_id_fkey foreign KEY (category_id) references categories (id) on delete set null,
  constraint bills_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint bills_wallet_id_fkey foreign KEY (wallet_id) references wallets (id) on delete set null,
  constraint bills_amount_check check (amount is null or amount >= 0),
  constraint bills_repeat_rule_check check (
    (
      repeat_rule = any (
        array[
          'none'::text,
          'weekly'::text,
          'monthly'::text,
          'yearly'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_bills_user_due_date on public.bills using btree (user_id, due_date) TABLESPACE pg_default;
create index IF not exists idx_bills_wallet_id on public.bills using btree (wallet_id) TABLESPACE pg_default;
create index IF not exists idx_bills_category_id on public.bills using btree (category_id) TABLESPACE pg_default;
```

---

### 8. `public.goals` (Savings Goals & Milestones)
Monitors target savings and financial milestone accumulation.

```sql
create table public.goals (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  title text not null,
  target_amount numeric not null default 0,
  current_amount numeric not null default 0,
  icon text null,
  color text null,
  target_date text null,
  created_at timestamp with time zone null default now(),
  constraint goals_pkey primary key (id),
  constraint goals_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_goals_user_id on public.goals using btree (user_id) TABLESPACE pg_default;
```

---

### 9. `public.user_budgets` (Monthly Budget Thresholds)
Persists monthly spending limits per user.

```sql
create table public.user_budgets (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  target_amount numeric not null default 0,
  month text null,
  updated_at timestamp with time zone null default now(),
  constraint user_budgets_pkey primary key (id),
  constraint user_budgets_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create unique INDEX IF not exists uq_user_budgets_user_month on public.user_budgets using btree (
  user_id,
  coalesce(month, 'global')
) TABLESPACE pg_default;
```

---

### 10. `public.user_shortcuts` (Quick Add Presets)
User-defined quick transaction macros with predefined amount, category, and wallet.

```sql
create table public.user_shortcuts (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  title text not null,
  amount numeric not null default 0,
  type text not null,
  category_id uuid null,
  wallet_id uuid null,
  note text null,
  created_at timestamp with time zone null default now(),
  constraint user_shortcuts_pkey primary key (id),
  constraint user_shortcuts_category_id_fkey foreign KEY (category_id) references categories (id) on delete set null,
  constraint user_shortcuts_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint user_shortcuts_wallet_id_fkey foreign KEY (wallet_id) references wallets (id) on delete set null,
  constraint user_shortcuts_type_check check (
    (
      type = any (
        array['expense'::text, 'income'::text, 'transfer'::text]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_user_shortcuts_user_id on public.user_shortcuts using btree (user_id) TABLESPACE pg_default;
create index IF not exists idx_user_shortcuts_category_id on public.user_shortcuts using btree (category_id) TABLESPACE pg_default;
create index IF not exists idx_user_shortcuts_wallet_id on public.user_shortcuts using btree (wallet_id) TABLESPACE pg_default;
```

---

### 11. `public.user_subscriptions` (Monetization & Entitlements)
Tracks subscription tiers, lifecycle status, store receipts, and expiry dates.

```sql
create table public.user_subscriptions (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  tier public.subscription_tier_enum not null default 'free'::subscription_tier_enum,
  status public.subscription_status_enum not null default 'active'::subscription_status_enum,
  plan_id text null,
  store text null,
  original_transaction_id text null,
  trial_start_at timestamp with time zone null,
  trial_end_at timestamp with time zone null,
  current_period_start timestamp with time zone null,
  current_period_end timestamp with time zone null,
  is_lifetime boolean not null default false,
  raw_payload jsonb null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone ('utc'::text, now()),
  constraint user_subscriptions_pkey primary key (id),
  constraint uq_user_subscriptions_user unique (user_id),
  constraint user_subscriptions_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_user_subscriptions_user_tier on public.user_subscriptions using btree (user_id, tier, status) TABLESPACE pg_default;
```

---

### 12. `public.user_monthly_quotas` (Feature Gating & Limits)
Maintains rolling monthly usage metrics for free tier thresholds (OCR slip imports, luxury report exports).

```sql
create table public.user_monthly_quotas (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  billing_period text not null,
  ocr_import_count integer not null default 0,
  luxury_export_count integer not null default 0,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone ('utc'::text, now()),
  constraint user_monthly_quotas_pkey primary key (id),
  constraint uq_user_monthly_quotas_period unique (user_id, billing_period),
  constraint user_monthly_quotas_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_user_monthly_quotas_lookup on public.user_monthly_quotas using btree (user_id, billing_period) TABLESPACE pg_default;
```
