// ======================================================================
// TROUVAILLE CORE DOMAIN TYPES & INTERFACES
// Centralized type definitions for accounts, ledger, assets, and forecasting
// ======================================================================

export type TransactionType = "income" | "expense" | "transfer" | "adjustment";
export type RepeatRule = "none" | "weekly" | "monthly" | "yearly";

export type AccountClassification =
  | "liquid"
  | "investment"
  | "fixed_asset"
  | "receivable"
  | "credit"
  | "loan";

export type AssetType =
  | "stock"
  | "crypto"
  | "mutual_fund"
  | "gold"
  | "bond"
  | "fixed_asset";

export interface HoldingActivity {
  id: string;
  holding_id: string;
  type: "buy" | "sell" | "initial";
  date: string; // YYYY-MM-DD
  units: number;
  price_per_unit: number;
  total_amount: number;
  note?: string;
  created_at?: string;
}

export interface InvestmentHolding {
  id: string;
  user_id?: string;
  wallet_id?: string;
  symbol: string;
  name: string;
  asset_type: AssetType;
  units: number;
  avg_buy_price: number;
  current_price: number;
  currency?: string;
  native_price?: number;
  native_currency?: string;
  change_24h_pct?: number;
  price_source?: string;
  last_price_updated_at?: string;
  notes?: string;
  icon?: string;
  annual_rate?: number; // Estimated annual appreciation (+) or depreciation (-) rate in percent
  purchase_date?: string; // YYYY-MM-DD
  activities?: HoldingActivity[];
  is_custom_price?: boolean;
  custom_price?: number;
}

export type CashflowNature = "operating" | "investing" | "financing";

export interface Category {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  type: TransactionType;
  is_default: boolean;
  created_at: string;
  budget_amount?: number | null;
  cashflow_nature?: CashflowNature;
}

export interface Wallet {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  created_at: string;
  classification?: AccountClassification;
  balance?: number;
}

export type LedgerMemberRole = "owner" | "editor" | "viewer";
export type LedgerMemberStatus = "active" | "pending";

export interface LedgerMember {
  id: string;
  ledger_id: string;
  user_id: string;
  role: LedgerMemberRole;
  status?: LedgerMemberStatus;
  display_name?: string | null;
  email?: string | null;
  joined_at: string;
}

export interface FinancialLedger {
  id: string;
  user_id?: string;
  name: string;
  description: string;
  icon: string;
  currency?: string;
  is_default?: boolean;
  isDefault?: boolean;
  created_at?: string;
  tag?: string;
  is_shared?: boolean;
  invite_code?: string | null;
  role?: LedgerMemberRole;
  member_status?: LedgerMemberStatus;
  members?: LedgerMember[];
}

export type FinancialDomain = FinancialLedger;

export interface Transaction {
  id: string;
  user_id: string;
  category_id: string | null;
  wallet_id: string | null;
  to_wallet_id: string | null;
  type: TransactionType;
  amount: number;
  note: string | null;
  occurred_on: string;
  created_at: string;
  categories?: Category | null;
  space_id?: string | null;
  ledger_id?: string | null;
  created_by_name?: string | null;
  created_by_user_id?: string | null;
}

export interface Bill {
  id: string;
  user_id: string;
  title: string;
  amount: number | null;
  due_date: string;
  repeat_rule: RepeatRule;
  is_paid: boolean;
  note: string | null;
  created_at: string;
  category_id?: string | null;
  wallet_id?: string | null;
}

export interface Goal {
  id: string;
  user_id?: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  icon?: string;
  color?: string;
  targetDate?: string;
  target_amount?: number;
  current_amount?: number;
  target_date?: string | null;
  created_at?: string;
}

export interface UserBudget {
  id: string;
  user_id: string;
  target_amount: number;
  month?: string | null;
  updated_at?: string;
}

export interface UserShortcut {
  id: string;
  user_id: string;
  title: string;
  amount: number;
  type: TransactionType;
  category_id?: string | null;
  wallet_id?: string | null;
  note?: string | null;
  created_at?: string;
}

export * from "./debt";
