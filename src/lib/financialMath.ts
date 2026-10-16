import {
  addMonths,
  format,
  parseISO,
  startOfYear,
  subMonths,
  subDays,
} from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { Transaction, Category, Wallet, Bill, AccountClassification } from "./types";
import { formatRupiah } from "./utils";

export type BudgetRiskLevel = "SAFE" | "WATCH" | "AT RISK";

export interface AccountBalanceItem {
  id: string;
  name: string;
  icon: string;
  balance: number;
  inflow: number;
  outflow: number;
  classification?: AccountClassification;
}

export interface WalletBalancesResult {
  walletMap: Map<string, AccountBalanceItem>;
  balancesById: Record<string, number>;
  balancesByName: Record<string, number>;
  allAccounts: AccountBalanceItem[];
  positiveAccounts: AccountBalanceItem[];
  zeroAccounts: AccountBalanceItem[];
  totalAssets: number;
  netWorth: number;
  // Bifocal Liquidity segmentation
  liquidAccounts: AccountBalanceItem[];
  liquidCapital: number;
  liquidNetPosition: number;
  receivableAccounts: AccountBalanceItem[];
  receivableCapital: number;
  marketAccounts: AccountBalanceItem[];
  marketAssets: number;
  fixedAssetAccounts: AccountBalanceItem[];
  fixedAssets: number;
  creditAccounts: AccountBalanceItem[];
  loanAccounts: AccountBalanceItem[];
  totalLiabilities: number;
}

export const RECEIVABLE_IN_LIQUID_STORAGE_KEY = "trouvaille_include_receivable_in_liquid";

export function getIncludeReceivableInLiquid(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const val = localStorage.getItem(RECEIVABLE_IN_LIQUID_STORAGE_KEY);
    return val === null ? true : val === "true";
  } catch {
    return true;
  }
}

export function setIncludeReceivableInLiquid(val: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RECEIVABLE_IN_LIQUID_STORAGE_KEY, String(val));
    window.dispatchEvent(
      new CustomEvent("trouvaille:receivable-liquid-pref-changed", {
        detail: { includeReceivableInLiquid: val },
      }),
    );
  } catch {}
}

export interface AssetTrendResult {
  currentBalance: number;
  chartData: { label: string; balance: number }[];
  diff: number;
  percent: number;
  highBalance: number;
  lowBalance: number;
  periodInflow: number;
  periodOutflow: number;
}

export interface MonthAggregates {
  year: number;
  month: number;
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  savingsRate: number;
  txCount: number;
  avgExpense: number;
  categoryTotals: Record<string, { total: number; count: number }>;
}

export interface CategoryMoMShift {
  categoryId: string;
  name: string;
  emoji: string;
  currentTotal: number;
  previousTotal: number;
  deltaAmount: number;
  pctChange: number;
  isIncrease: boolean;
  contributors: Array<{ note: string; amount: number; count: number }>;
}

export interface ActionCenterInsight {
  type:
    | "budget_risk"
    | "spending_pace"
    | "projected_overrun"
    | "category_spike"
    | "safety_buffer"
    | "healthy";
  title: string;
  subtitle: string;
  badge: string;
  actionLabel: string;
  actionType:
    | "statistics"
    | "budget"
    | "bills"
    | "transactions"
    | "category_detail";
  actionParam?: string;
  drillDownDetails?: {
    headline: string;
    explanation: string;
    bulletPoints: string[];
  };
}

export interface CategoryBaseline {
  categoryId: string;
  name: string;
  emoji: string;
  medianMonthlyTotal: number;
  typicalMonthlyRange: [number, number];
  medianTxSize: number;
  typicalTxRange: [number, number];
  monthlyFrequency: number;
  currentMonthTotal: number;
  currentStatus: "below_range" | "within_range" | "above_range";
  deviationPct: number;
}

export interface PersonalBaselineResult {
  status: "insufficient" | "early" | "stable";
  confidence: "low" | "moderate" | "high";
  historicalMonthsCount: number;
  message?: string;
  medianExpense: number;
  meanExpense: number;
  typicalExpenseRange: [number, number];
  medianIncome: number;
  typicalIncomeRange: [number, number];
  medianNetCashflow: number;
  typicalNetCashflowRange: [number, number];
  medianTxSize: number;
  monthlyTxFrequency: number;
  currentMonthExpense: number;
  currentMonthStatus: "below_range" | "within_range" | "above_range";
  currentMonthDelta: number;
  currentMonthDeviationPct: number;
  categoryBaselines: CategoryBaseline[];
}

export interface BehavioralPattern {
  id: string;
  type:
    | "day_of_week"
    | "category_concentration"
    | "spending_timing"
    | "ticket_size";
  title: string;
  subtitle: string;
  badge: string;
  evidence: string;
  metricValue: number;
}

export interface LongitudinalMonthPoint {
  monthKey: string;
  label: string;
  year: number;
  month: number;
  income: number;
  expense: number;
  netCashflow: number;
  savingsRate: number;
  txCount: number;
  avgTxSize: number;
}

export interface LongitudinalTimelineResult {
  range: "3M" | "6M" | "12M" | "ALL";
  points: LongitudinalMonthPoint[];
  trajectoryInterpretation: string;
  trendDirection: "increasing" | "decreasing" | "stable";
  averageMonthlyExpense: number;
  averageMonthlyIncome: number;
  totalNetGrowth: number;
}

// ==========================================
// PHASE III: CASHFLOW INTELLIGENCE & STRUCTURE INTERFACES
// ==========================================

export type RecurringFrequency =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "yearly";
export type RecurringConfidence = "strong" | "moderate" | "insufficient";
export type RecurringStatus = "detected" | "confirmed" | "ignored" | "inactive";

export interface DetectedRecurringItem {
  id: string;
  title: string;
  normalizedMerchant: string;
  categoryId: string | null;
  categoryName: string;
  categoryEmoji: string;
  walletId: string | null;
  type: "expense" | "income";
  frequency: RecurringFrequency;
  typicalAmount: number;
  amountRange: [number, number];
  confidence: RecurringConfidence;
  occurrencesCount: number;
  lastOccurrenceDate: string;
  nextExpectedDate: string;
  status: RecurringStatus;
  matchingTransactionIds: string[];
  explanation: string;
}

export type ExpenseClassification =
  | "fixed"
  | "variable"
  | "discretionary"
  | "unclassified";

export interface ExpenseStructureCategoryItem {
  categoryId: string;
  name: string;
  emoji: string;
  classification: ExpenseClassification;
  amount: number;
  percentage: number;
  isUserOverridden?: boolean;
}

export interface ExpenseStructureResult {
  totalExpense: number;
  fixedAmount: number;
  fixedPercentage: number;
  variableAmount: number;
  variablePercentage: number;
  discretionaryAmount: number;
  discretionaryPercentage: number;
  unclassifiedAmount: number;
  unclassifiedPercentage: number;
  committedAmount: number;
  flexibleAmount: number;
  committedPercentage: number;
  flexiblePercentage: number;
  items: ExpenseStructureCategoryItem[];
  reconciliationCheck: boolean;
}

export interface CashflowCalendarDayPoint {
  date: string;
  dayLabel: string;
  dayOfMonth: number;
  isToday: boolean;
  isPast: boolean;
  knownInflow: number;
  knownInflowItems: Array<{ title: string; amount: number }>;
  knownOutflow: number;
  knownOutflowItems: Array<{ title: string; amount: number; isBill: boolean }>;
  netDailyCashflow: number;
  projectedBalance: number;
}

export interface CashflowFloorResult {
  lowestBalance: number;
  lowestBalanceDate: string;
  daysUntilLowest: number;
  currentBalance: number;
  netProjectedChange: number;
  forecastDaysCount: number;
  dailyPoints: CashflowCalendarDayPoint[];
  upcomingCommitmentsTotal: number;
  upcomingInflowsTotal: number;
}

export interface LiquidityHorizonResult {
  status: "sufficient" | "insufficient";
  liquidAssets: number;
  liquidAccounts: Array<{ name: string; balance: number; icon: string }>;
  typicalMonthlyOutflow: number;
  typicalCommittedOutflow: number;
  totalCoverageMonths: number;
  committedCoverageMonths: number;
  coverageText: string;
  committedCoverageText: string;
  resilienceTier:
    | "CRITICAL"
    | "LOW"
    | "MODERATE"
    | "HEALTHY"
    | "STRONG"
    | "EXCEPTIONAL";
  explanation: string;
}

export interface GoalPlanningResult {
  goalId: string;
  goalTitle: string;
  targetAmount: number;
  currentAmount: number;
  remainingAmount: number;
  targetDate?: string;
  remainingMonths: number;
  requiredMonthlyContribution: number;
  historicalRetainedCash: number;
  trajectoryStatus: "ON TRACK" | "BEHIND TARGET" | "AHEAD OF TARGET";
  trajectoryExplanation: string;
}

export type WhatIfScenarioType =
  | "expense_cut"
  | "income_boost"
  | "expense_change_pct"
  | "saving_plan";

export interface WhatIfScenarioResult {
  type: WhatIfScenarioType;
  currentAnnualRetainedCash: number;
  adjustedAnnualRetainedCash: number;
  annualDifference: number;
  monthlyDifference: number;
  adjustedMonthlyIncome: number;
  adjustedMonthlyExpense: number;
  suggestedMonthlySavings: number;
  remainingFreeCashAfterSavings: number;
  isOvercommitted: boolean;
}

export interface GoalScenarioResult {
  monthlyContribution: number;
  remainingAmount: number;
  monthsToTarget: number;
  yearsToTarget: number;
  extraMonths: number;
  projectedCompletionLabel: string;
  projectedCompletionDate: string | null;
  isAlreadyCompleted: boolean;
  isFeasible: boolean;
}

export interface MonthlyFinancialReviewData {
  monthName: string;
  year: number;
  overview: {
    income: number;
    expense: number;
    netCashflow: number;
    savingsRate: number;
    txCount: number;
    avgTransaction: number;
  };
  whatChanged: Array<{
    label: string;
    changeText: string;
    isUp: boolean;
    isNeutral?: boolean;
  }>;
  whatWentWell: string[];
  whatNeedsAttention: string[];
  nextMonthBaseline: string;
  baselineComparison?: {
    typicalRangeText: string;
    statusText: string;
    isAboveRange: boolean;
  };
}

const OPENING_BALANCE_PATTERNS = [
  "saldo awal",
  "opening balance",
  "initial balance",
];

const NON_LIQUID_WALLET_NAMES = new Set([
  "crypto",
  "saham",
  "liabilities",
  "usdt",
  "tether",
  "btc",
  "bitcoin",
  "eth",
  "ethereum",
  "binance",
  "tokocrypto",
  "indodax",
  "bybit",
  "okx",
]);

export function isOpeningBalanceTx(tx: Pick<Transaction, "note">): boolean {
  const note = tx.note?.trim().toLowerCase() || "";
  return OPENING_BALANCE_PATTERNS.some((pattern) => note.includes(pattern));
}

export function isLiquidAccountName(name: string): boolean {
  const key = name.trim().toLowerCase();
  if (!key) return false;
  return !NON_LIQUID_WALLET_NAMES.has(key) && !isFixedAssetName(key) && !isMarketInvestmentName(key);
}

export function isMarketInvestmentName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return (
    n.includes("saham") ||
    n.includes("crypto") ||
    n.includes("investasi") ||
    n.includes("reksadana") ||
    n.includes("deposito") ||
    n.includes("stock") ||
    n.includes("emas") ||
    n.includes("gold") ||
    n.includes("bibit") ||
    n.includes("ajaib") ||
    n.includes("binance") ||
    n.includes("indodax") ||
    n.includes("tokocrypto") ||
    n.includes("bybit") ||
    n.includes("okx") ||
    n.includes("usdt") ||
    n.includes("tether") ||
    n.includes("btc") ||
    n.includes("bitcoin") ||
    n.includes("eth") ||
    n.includes("ethereum") ||
    n.includes("solana")
  );
}

export function isFixedAssetName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return (
    n.includes("rumah") ||
    n.includes("tanah") ||
    n.includes("apartemen") ||
    n.includes("properti") ||
    n.includes("property") ||
    n.includes("real estate") ||
    n.includes("mobil") ||
    n.includes("motor") ||
    n.includes("kendaraan") ||
    n.includes("vehicle")
  );
}

export function isCreditOrDebtName(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (
    n.includes("piutang") ||
    n.includes("receivable") ||
    n.includes("pinjaman teman")
  ) {
    return false;
  }
  return (
    n.includes("credit") ||
    n.includes("kredit") ||
    n.includes("kartu kredit") ||
    n.includes("paylater") ||
    n.includes("cicilan") ||
    n.includes("cc") ||
    n.includes("spaylater") ||
    n.includes("gopaylater") ||
    n.includes("hutang") ||
    n.includes("utang") ||
    n.includes("pinjaman") ||
    n.includes("pinjol") ||
    n.includes("loan") ||
    n.includes("kpr") ||
    n.includes("liabilities")
  );
}

export function getFallbackWalletIcon(name: string): string {
  if (!name) return "/icons/Budgets/Cash.png";
  const n = name.trim().toLowerCase();
  if (n === "bca") return "/icons/Budgets/BCA.png";
  if (n === "bri") return "/icons/Budgets/BRI.png";
  if (n === "mandiri") return "/icons/Budgets/Mandiri.png";
  if (n === "link" || n === "linkaja") return "/icons/Budgets/Link.png";
  if (n === "ovo") return "/icons/Budgets/Ovo.png";
  if (n === "blu") return "/icons/Budgets/BLU.png";
  if (n === "bni") return "/icons/Budgets/BNI.png";
  if (n === "cash") return "/icons/Budgets/Cash.png";
  if (n === "crypto") return "/icons/Budgets/Crypto.png";
  if (n === "dana") return "/icons/Budgets/Dana.png";
  if (n === "gopay") return "/icons/Budgets/Gopay.png";
  if (n === "jago") return "/icons/Budgets/Jago.png";
  if (n === "krom") return "/icons/Budgets/Krom.png";
  if (n === "liabilities") return "/icons/Budgets/Liabilities.png";
  if (n === "piutang") return "/icons/Budgets/Piutang.png";
  if (n === "saham") return "/icons/Budgets/Saham.png";
  if (n === "seabank") return "/icons/Budgets/Seabank.png";
  if (n === "shopeepay" || n === "shopee")
    return "/icons/Budgets/Shopeepay.png";
  if (n === "superbank") return "/icons/Budgets/Superbank.png";
  if (n === "tapcash") return "/icons/Budgets/Tapcash.png";
  return "/icons/wallet.png";
}

/**
 * Pure, deterministic calculation of all wallet balances and net worth.
 */
export function calculateWalletBalances(
  transactions: Transaction[],
  wallets: Wallet[],
  includeReceivableInLiquid?: boolean,
): WalletBalancesResult {
  const walletMap = new Map<string, AccountBalanceItem>();
  const nameToIdMap = new Map<string, string>();
  const walletIdToNameMap = new Map<string, string>();

  wallets.forEach((w) => {
    const resolvedIcon =
      !w.icon || w.icon === "/icons/wallet.png"
        ? getFallbackWalletIcon(w.name)
        : w.icon;
    walletMap.set(w.id, {
      id: w.id,
      name: w.name,
      icon: resolvedIcon,
      balance: Number((w as any).balance || (w as any).initial_balance || 0),
      classification: w.classification,
      inflow: 0,
      outflow: 0,
    });
    const lowerName = w.name.toLowerCase().trim();
    nameToIdMap.set(lowerName, w.id);
    walletIdToNameMap.set(w.id, w.name);
  });

  if (walletMap.size === 0) {
    const cashEntry = {
      id: "wallet-cash",
      name: "Cash",
      icon: "/icons/Budgets/Cash.png",
      balance: 0,
      inflow: 0,
      outflow: 0,
    };
    walletMap.set("wallet-cash", cashEntry);
    nameToIdMap.set("cash", "wallet-cash");
    walletIdToNameMap.set("wallet-cash", "Cash");
  }

  // Pre-cached default wallet for rapid fallback
  const defaultWallet = Array.from(walletMap.values())[0];

  const getWallet = (
    idOrName: string | null | undefined,
  ): AccountBalanceItem => {
    if (!idOrName) {
      return defaultWallet;
    }
    // 1. Direct ID match (highest priority, unique, O(1))
    const byId = walletMap.get(idOrName);
    if (byId) return byId;

    // 2. Name-to-ID lookup (O(1))
    const lower = idOrName.toLowerCase().trim();
    const mappedId = nameToIdMap.get(lower);
    if (mappedId) {
      const byMapped = walletMap.get(mappedId);
      if (byMapped) return byMapped;
    }

    // 3. Fallback: Create synthetic entry if genuinely unknown (memoized into map)
    const displayName = idOrName.charAt(0).toUpperCase() + idOrName.slice(1);
    const newEntry: AccountBalanceItem = {
      id: `wallet-${lower}`,
      name: displayName,
      icon: getFallbackWalletIcon(displayName),
      balance: 0,
      inflow: 0,
      outflow: 0,
    };
    walletMap.set(newEntry.id, newEntry);
    nameToIdMap.set(lower, newEntry.id);
    walletIdToNameMap.set(newEntry.id, displayName);
    return newEntry;
  };

  // Pre-compiled list of wallets for note inspection only when wallet_id is absent
  const walletsForNoteMatch = wallets.map((w) => ({
    id: w.id,
    lowerName: w.name.toLowerCase(),
  }));

  // Process all transactions deterministically in a single ultra-fast O(N) pass
  const txCount = transactions.length;
  for (let i = 0; i < txCount; i++) {
    const tx = transactions[i];
    const amt = Number(tx.amount || 0);
    if (amt <= 0) continue;

    let fromIdOrName = tx.wallet_id;
    let toIdOrName = tx.to_wallet_id;

    if (!fromIdOrName && tx.note) {
      const lowerNote = tx.note.toLowerCase();
      for (let j = 0; j < walletsForNoteMatch.length; j++) {
        if (lowerNote.includes(walletsForNoteMatch[j].lowerName)) {
          fromIdOrName = walletsForNoteMatch[j].id;
          break;
        }
      }
    }

    const fromEntry = getWallet(fromIdOrName || defaultWallet.id);
    const toEntry = getWallet(toIdOrName || defaultWallet.id);

    const isCorrection = isCorrectionTx(tx);

    if (isCorrection) {
      const isNegative = tx.note?.includes("(-)") || tx.type === "expense";
      if (isNegative) {
        fromEntry.balance -= amt;
      } else {
        fromEntry.balance += amt;
      }
    } else if (tx.type === "income") {
      fromEntry.inflow += amt;
      fromEntry.balance += amt;
    } else if (tx.type === "expense") {
      fromEntry.outflow += amt;
      fromEntry.balance -= amt;
    } else if (tx.type === "transfer") {
      // Transfer Invariant: Zero-sum between accounts
      fromEntry.outflow += amt;
      fromEntry.balance -= amt;
      toEntry.inflow += amt;
      toEntry.balance += amt;
    }
  }

  const allAccounts = Array.from(walletMap.values()).sort(
    (a, b) => b.balance - a.balance,
  );
  const positiveAccounts = allAccounts.filter((a) => a.balance > 0);
  const zeroAccounts = allAccounts.filter((a) => a.balance <= 0);
  const netWorth = allAccounts.reduce((s, a) => s + a.balance, 0);
  const shouldIncludeReceivable =
    includeReceivableInLiquid !== undefined
      ? includeReceivableInLiquid
      : getIncludeReceivableInLiquid();

  const liquidAccounts: AccountBalanceItem[] = [];
  const receivableAccounts: AccountBalanceItem[] = [];
  const marketAccounts: AccountBalanceItem[] = [];
  const fixedAssetAccounts: AccountBalanceItem[] = [];
  const creditAccounts: AccountBalanceItem[] = [];
  const loanAccounts: AccountBalanceItem[] = [];

  allAccounts.forEach((a) => {
    const cls = a.classification;
    if (cls === "fixed_asset") {
      fixedAssetAccounts.push(a);
      return;
    }
    if (cls === "investment") {
      marketAccounts.push(a);
      return;
    }
    if (cls === "credit") {
      creditAccounts.push(a);
      return;
    }
    if (cls === "loan") {
      loanAccounts.push(a);
      return;
    }
    if (cls === "receivable") {
      receivableAccounts.push(a);
      if (shouldIncludeReceivable) {
        liquidAccounts.push(a);
      }
      return;
    }

    // Check name heuristics when classification is unset or generic 'liquid' default
    const n = a.name.toLowerCase();
    if (isFixedAssetName(n)) {
      a.classification = "fixed_asset";
      fixedAssetAccounts.push(a);
    } else if (isMarketInvestmentName(n)) {
      a.classification = "investment";
      marketAccounts.push(a);
    } else if (
      n.includes("piutang") ||
      n.includes("receivable") ||
      n.includes("pinjaman teman")
    ) {
      a.classification = "receivable";
      receivableAccounts.push(a);
      if (shouldIncludeReceivable) {
        liquidAccounts.push(a);
      }
    } else if (n.includes("kpr") || n.includes("loan") || n.includes("pinjaman")) {
      a.classification = "loan";
      loanAccounts.push(a);
    } else if (isCreditOrDebtName(n) || (cls !== "liquid" && a.balance < 0)) {
      a.classification = "credit";
      creditAccounts.push(a);
    } else {
      a.classification = "liquid";
      liquidAccounts.push(a);
    }
  });

  const liquidCapital = liquidAccounts.reduce((s, a) => s + a.balance, 0);
  const receivableCapital = receivableAccounts.reduce((s, a) => s + a.balance, 0);
  const creditDebt = creditAccounts.reduce((s, a) => s + Math.abs(Math.min(0, a.balance)), 0);
  const liquidNetPosition = liquidCapital - creditDebt;
  const marketAssets = marketAccounts.reduce((s, a) => s + Math.max(0, a.balance), 0);
  const fixedAssets = fixedAssetAccounts.reduce((s, a) => s + Math.max(0, a.balance), 0);
  const totalLiabilities =
    creditDebt +
    loanAccounts.reduce((s, a) => s + Math.abs(Math.min(0, a.balance)), 0);
  const totalAssets = netWorth;
  const balancesById: Record<string, number> = {};
  const balancesByName: Record<string, number> = {};
  allAccounts.forEach((a) => {
    balancesById[a.id] = a.balance;
    balancesByName[a.name.toLowerCase()] = a.balance;
  });

  return {
    walletMap,
    balancesById,
    balancesByName,
    allAccounts,
    positiveAccounts,
    zeroAccounts,
    totalAssets,
    netWorth,
    liquidAccounts,
    liquidCapital,
    liquidNetPosition,
    receivableAccounts,
    receivableCapital,
    marketAccounts,
    marketAssets,
    fixedAssetAccounts,
    fixedAssets,
    creditAccounts,
    loanAccounts,
    totalLiabilities,
  };
}

/**
 * Pure, deterministic calculation of Apple Stocks-style Net Worth Trend.
 */
export function calculateAssetTrend(
  transactions: Transaction[],
  currentBalance: number,
  stockRange: string,
  now = new Date(),
): AssetTrendResult {
  const datedTxs = transactions.filter((t) => !!t.occurred_on);
  const dailyNet = new Map<string, number>();
  const dailyInflow = new Map<string, number>();
  const dailyOutflow = new Map<string, number>();
  const monthlyNet = new Map<string, number>();
  const monthlyInflow = new Map<string, number>();
  const monthlyOutflow = new Map<string, number>();

  const earliestDate =
    datedTxs.length > 0
      ? datedTxs.reduce(
          (min, tx) => {
            const d = tx.occurred_on.slice(0, 10);
            return d < min ? d : min;
          },
          datedTxs[0].occurred_on.slice(0, 10),
        )
      : format(now, "yyyy-MM-dd");
  const earliestMonth = new Date(`${earliestDate.slice(0, 7)}-01T00:00:00`);

  let totalNetEffect = 0;

  datedTxs.forEach((tx) => {
    const dateKey = tx.occurred_on.slice(0, 10);
    const monthKey = dateKey.slice(0, 7);

    // INTI PERBAIKAN: Abaikan transaksi buatan (Saldo Awal & Koreksi) dari pergerakan grafik
    const isArtificial = isOpeningBalanceTx(tx) || isCorrectionTx(tx);
    let netEffect = 0;
    const amt = Number(tx.amount || 0);

    if (!isArtificial) {
      if (tx.type === "income") netEffect = amt;
      else if (tx.type === "expense") netEffect = -amt;
    }

    dailyNet.set(dateKey, (dailyNet.get(dateKey) || 0) + netEffect);
    monthlyNet.set(monthKey, (monthlyNet.get(monthKey) || 0) + netEffect);
    totalNetEffect += netEffect;

    if (tx.type === "income" && !isArtificial) {
      dailyInflow.set(dateKey, (dailyInflow.get(dateKey) || 0) + amt);
      monthlyInflow.set(monthKey, (monthlyInflow.get(monthKey) || 0) + amt);
    }

    if (tx.type === "expense" && !isArtificial) {
      dailyOutflow.set(dateKey, (dailyOutflow.get(dateKey) || 0) + amt);
      monthlyOutflow.set(monthKey, (monthlyOutflow.get(monthKey) || 0) + amt);
    }
  });

  // Titik awal dirender secara dinamis berdasarkan arus kas murni
  const allTimeOpeningBalance = currentBalance - totalNetEffect;
  const chartData: { label: string; balance: number }[] = [];
  let diff = 0;
  let percent = 0;
  let periodInflow = 0;
  let periodOutflow = 0;
  let startBalance = currentBalance;

  const buildDailyRange = (days: number, labelFormat: string) => {
    const startDate = subDays(now, days - 1);
    const keys = Array.from({ length: days }, (_, index) =>
      format(subDays(now, days - 1 - index), "yyyy-MM-dd"),
    );
    const rangeNet = keys.reduce(
      (sum, key) => sum + (dailyNet.get(key) || 0),
      0,
    );
    startBalance = currentBalance - rangeNet;
    let runningBalance = startBalance;

    keys.forEach((key) => {
      periodInflow += dailyInflow.get(key) || 0;
      periodOutflow += dailyOutflow.get(key) || 0;
      runningBalance += dailyNet.get(key) || 0;
      chartData.push({
        label: format(new Date(`${key}T00:00:00`), labelFormat),
        balance: runningBalance,
      });
    });

    diff = currentBalance - startBalance;
    percent = startBalance === 0 ? 0 : (diff / Math.abs(startBalance)) * 100;
    if (chartData.length === 0) {
      chartData.push({
        label: format(startDate, labelFormat),
        balance: currentBalance,
      });
    }
  };

  const buildMonthlyRange = (
    startMonthDate: Date,
    endMonthDate: Date,
    labelFormat: string,
  ) => {
    const monthKeys: string[] = [];
    const cursor = new Date(
      startMonthDate.getFullYear(),
      startMonthDate.getMonth(),
      1,
    );
    const endCursor = new Date(
      endMonthDate.getFullYear(),
      endMonthDate.getMonth(),
      1,
    );

    while (cursor <= endCursor) {
      monthKeys.push(format(cursor, "yyyy-MM"));
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const rangeNet = monthKeys.reduce(
      (sum, key) => sum + (monthlyNet.get(key) || 0),
      0,
    );

    startBalance =
      startMonthDate.getFullYear() === earliestMonth.getFullYear() &&
      startMonthDate.getMonth() === earliestMonth.getMonth()
        ? allTimeOpeningBalance
        : currentBalance - rangeNet;

    let runningBalance = startBalance;
    monthKeys.forEach((key) => {
      periodInflow += monthlyInflow.get(key) || 0;
      periodOutflow += monthlyOutflow.get(key) || 0;
      runningBalance += monthlyNet.get(key) || 0;
      const [year, month] = key.split("-").map(Number);
      chartData.push({
        label: format(new Date(year, month - 1, 1), labelFormat),
        balance: runningBalance,
      });
    });

    diff = currentBalance - startBalance;
    percent = startBalance === 0 ? 0 : (diff / Math.abs(startBalance)) * 100;
  };

  if (stockRange === "1D") {
    const todayKey = format(now, "yyyy-MM-dd");
    const todayNet = dailyNet.get(todayKey) || 0;
    periodInflow = dailyInflow.get(todayKey) || 0;
    periodOutflow = dailyOutflow.get(todayKey) || 0;
    startBalance = currentBalance - todayNet;
    chartData.push({ label: "Open", balance: startBalance });
    chartData.push({ label: "Mid", balance: startBalance + todayNet * 0.5 });
    chartData.push({ label: "Now", balance: currentBalance });
    diff = currentBalance - startBalance;
    percent = startBalance === 0 ? 0 : (diff / Math.abs(startBalance)) * 100;
  } else if (stockRange === "1W" || stockRange === "7D") {
    buildDailyRange(7, "d");
  } else if (stockRange === "1M") {
    buildDailyRange(30, "d MMM");
  } else if (stockRange === "3M") {
    buildMonthlyRange(
      new Date(now.getFullYear(), now.getMonth() - 2, 1),
      now,
      "MMM",
    );
  } else if (stockRange === "6M") {
    buildMonthlyRange(
      new Date(now.getFullYear(), now.getMonth() - 5, 1),
      now,
      "MMM",
    );
  } else if (stockRange === "YTD") {
    buildMonthlyRange(startOfYear(now), now, "MMM");
  } else if (stockRange === "1Y") {
    buildMonthlyRange(
      new Date(now.getFullYear(), now.getMonth() - 11, 1),
      now,
      "MMM yy",
    );
  } else {
    buildMonthlyRange(earliestMonth, now, "MMM yy");
    startBalance = allTimeOpeningBalance;
    diff = currentBalance - startBalance;
    percent = startBalance === 0 ? 0 : (diff / Math.abs(startBalance)) * 100;
  }

  const balances = chartData.map((d) => d.balance);
  const highBalance = Math.max(...balances, currentBalance, startBalance);
  const lowBalance = Math.min(...balances, currentBalance, startBalance);

  return {
    currentBalance,
    chartData,
    diff,
    percent,
    highBalance,
    lowBalance,
    periodInflow,
    periodOutflow,
  };
}

export function isCorrectionTx(t: Transaction): boolean {
  return (
    t.type === "adjustment" ||
    !!t.note?.toLowerCase().includes("correction") ||
    !!t.note?.toLowerCase().includes("koreksi saldo") ||
    !!t.note?.toLowerCase().includes("balance adjustment")
  );
}

/**
 * Filter transactions for a specific month (YYYY-MM).
 */
export function getMonthTransactions(
  transactions: Transaction[],
  year: number,
  month: number,
): Transaction[] {
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  return transactions.filter(
    (t) => t.occurred_on && t.occurred_on.startsWith(monthKey),
  );
}

/**
 * Computes pure month aggregates.
 */
export function computeMonthAggregates(
  transactions: Transaction[],
  year: number,
  month: number,
): MonthAggregates {
  const monthTxs = getMonthTransactions(transactions, year, month);
  let totalIncome = 0;
  let totalExpense = 0;
  let expenseCount = 0;
  const categoryTotals: Record<string, { total: number; count: number }> = {};

  monthTxs.forEach((t) => {
    // Pastikan Saldo Awal juga diabaikan agar tidak merusak rata-rata (avgTransaction)
    if (isCorrectionTx(t) || t.type === "transfer" || isOpeningBalanceTx(t))
      return;

    const amt = Number(t.amount || 0);
    if (t.type === "income") {
      totalIncome += amt;
    } else if (t.type === "expense") {
      totalExpense += amt;
      expenseCount++;
      const catKey = t.category_id || "uncategorized";
      if (!categoryTotals[catKey]) {
        categoryTotals[catKey] = { total: 0, count: 0 };
      }
      categoryTotals[catKey].total += amt;
      categoryTotals[catKey].count++;
    }
  });

  const netCashflow = totalIncome - totalExpense;
  const savingsRate =
    totalIncome > 0 ? Math.max(0, (netCashflow / totalIncome) * 100) : 0;
  const avgExpense =
    expenseCount > 0 ? Math.round(totalExpense / expenseCount) : 0;

  return {
    year,
    month,
    totalIncome,
    totalExpense,
    netCashflow,
    savingsRate,
    txCount: expenseCount,
    avgExpense,
    categoryTotals,
  };
}

/**
 * Computes Spending Pace, Daily Average, and Month-End Projection.
 */
export function computeSpendingPace(
  totalExpense: number,
  budget: number,
  daysElapsed: number,
  totalDays: number,
) {
  const safeDaysElapsed = Math.max(1, daysElapsed);
  const expectedPace = budget > 0 ? (daysElapsed / totalDays) * budget : 0;
  const paceDiff = budget > 0 ? totalExpense - expectedPace : 0;
  const isAheadOfPace = paceDiff > 0;

  const dailyAvg = totalExpense / safeDaysElapsed;
  const projectedMonthEnd = Math.round(dailyAvg * totalDays);
  const projectedVariance = budget > 0 ? projectedMonthEnd - budget : 0;

  const consumedPct = budget > 0 ? (totalExpense / budget) * 100 : 0;
  const timePct = (daysElapsed / totalDays) * 100;

  return {
    expectedPace,
    paceDiff,
    isAheadOfPace,
    dailyAvg,
    projectedMonthEnd,
    projectedVariance,
    consumedPct,
    timePct,
  };
}

/**
 * Computes deterministic Budget Risk.
 */
export function computeBudgetRisk(
  consumedPct: number,
  timePct: number,
  budget: number,
  language: "en" | "id" = "en",
): { riskLevel: BudgetRiskLevel; reason: string } {
  const isId = language === "id";
  if (!budget || budget <= 0) {
    return {
      riskLevel: "SAFE",
      reason: isId
        ? "Batas anggaran bulanan belum dikonfigurasi."
        : "No monthly budget limit configured.",
    };
  }

  if (consumedPct >= 95 || consumedPct > timePct + 20) {
    return {
      riskLevel: "AT RISK",
      reason: isId
        ? `Anggaran telah terpakai ${consumedPct.toFixed(0)}% sementara ${timePct.toFixed(0)}% hari dalam bulan ini telah berlalu.`
        : `Budget is ${consumedPct.toFixed(0)}% consumed while ${timePct.toFixed(0)}% of the month has elapsed.`,
    };
  }
  if (consumedPct > timePct + 5) {
    return {
      riskLevel: "WATCH",
      reason: isId
        ? `Laju pengeluaran sedikit lebih cepat dibandingkan progres bulan (${timePct.toFixed(0)}%).`
        : `Spending is running slightly ahead of the ${timePct.toFixed(0)}% monthly elapsed pace.`,
    };
  }
  return {
    riskLevel: "SAFE",
    reason: isId
      ? `Laju pengeluaran (${consumedPct.toFixed(0)}%) terkendali dan sehat relatif terhadap progres bulan (${timePct.toFixed(0)}%).`
      : `Spending pace (${consumedPct.toFixed(0)}%) is healthy relative to elapsed month (${timePct.toFixed(0)}%).`,
  };
}

/**
 * Computes Category Month-over-Month shifts with contributing sub-items.
 */
export function computeCategoryMoMChanges(
  currentMonthTxs: Transaction[],
  previousMonthTxs: Transaction[],
  categories: Category[],
): CategoryMoMShift[] {
  const catMap = new Map<string, Category>();
  categories.forEach((c) => catMap.set(c.id, c));

  // Aggregate current month by category and sub-note
  const currentByCat: Record<
    string,
    { total: number; notes: Record<string, { amount: number; count: number }> }
  > = {};
  currentMonthTxs.forEach((t) => {
    if (t.type !== "expense" || isCorrectionTx(t)) return;
    const catId = t.category_id || "other";
    if (!currentByCat[catId]) currentByCat[catId] = { total: 0, notes: {} };
    const amt = Number(t.amount || 0);
    currentByCat[catId].total += amt;

    const noteKey = (t.note || "General").trim();
    if (!currentByCat[catId].notes[noteKey])
      currentByCat[catId].notes[noteKey] = { amount: 0, count: 0 };
    currentByCat[catId].notes[noteKey].amount += amt;
    currentByCat[catId].notes[noteKey].count++;
  });

  // Aggregate previous month by category
  const prevByCat: Record<string, number> = {};
  previousMonthTxs.forEach((t) => {
    if (t.type !== "expense" || isCorrectionTx(t)) return;
    const catId = t.category_id || "other";
    prevByCat[catId] = (prevByCat[catId] || 0) + Number(t.amount || 0);
  });

  const allCatIds = new Set([
    ...Object.keys(currentByCat),
    ...Object.keys(prevByCat),
  ]);
  const shifts: CategoryMoMShift[] = [];

  allCatIds.forEach((catId) => {
    const currTotal = currentByCat[catId]?.total || 0;
    const prevTotal = prevByCat[catId] || 0;
    const deltaAmount = currTotal - prevTotal;

    if (currTotal === 0 && prevTotal === 0) return;

    let pctChange = 0;
    if (prevTotal > 0) {
      pctChange = Math.round(((currTotal - prevTotal) / prevTotal) * 100);
    } else if (currTotal > 0) {
      pctChange = 100;
    }

    const catMeta = catMap.get(catId);
    const name = catMeta?.name || (catId === "other" ? "Lainnya" : "Category");
    const emoji = catMeta?.emoji || "/icons/lainnya.png";

    // Extract top contributing notes
    const notesRecord = currentByCat[catId]?.notes || {};
    const contributors = Object.entries(notesRecord)
      .map(([note, data]) => ({ note, amount: data.amount, count: data.count }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    shifts.push({
      categoryId: catId,
      name,
      emoji,
      currentTotal: currTotal,
      previousTotal: prevTotal,
      deltaAmount,
      pctChange: Math.abs(pctChange),
      isIncrease: deltaAmount > 0,
      contributors,
    });
  });

  return shifts.sort(
    (a, b) => Math.abs(b.deltaAmount) - Math.abs(a.deltaAmount),
  );
}

/**
 * Generates the single most relevant Financial Action Center Insight.
 */
export function generateActionCenterInsight(options: {
  totalExpense: number;
  budget: number;
  projectedMonthEnd: number;
  projectedVariance: number;
  budgetRisk: BudgetRiskLevel;
  isAheadOfPace: boolean;
  paceDiff: number;
  consumedPct: number;
  timePct: number;
  categoryShifts: CategoryMoMShift[];
  safeToSpend: number;
  unpaidBillsCount: number;
  language?: "en" | "id";
}): ActionCenterInsight {
  const {
    budget,
    projectedVariance,
    budgetRisk,
    isAheadOfPace,
    paceDiff,
    consumedPct,
    timePct,
    categoryShifts,
    safeToSpend,
    unpaidBillsCount,
    language,
  } = options;

  const isId = language === "id";

  // Priority 0: Clean Baseline / No Expenses Recorded Yet In Current Cycle
  if (options.totalExpense === 0) {
    return {
      type: "healthy",
      title: isId
        ? "Siklus pengeluaran siap dicatat"
        : "Expense cycle ready for recording",
      subtitle: isId
        ? "Belum ada transaksi pengeluaran. Catat pengeluaran harian untuk mengaktifkan telemetri tempo dan batas belanja."
        : "No expenses recorded yet. Log daily transactions to activate spending pace telemetry and burn projections.",
      badge: isId ? "AWAL SIKLUS" : "NEW CYCLE",
      actionLabel: isId ? "Catat transaksi" : "Record transaction",
      actionType: "transactions",
      drillDownDetails: {
        headline: isId ? "Inisialisasi Siklus Berjalan" : "Active Cycle Standby",
        explanation: isId
          ? "Sistem pengawasan modal siap memantau laju pembelanjaan harian dan mendeteksi deviasi begitu transaksi pertama Anda dicatat."
          : "The capital monitoring system is standing by to evaluate daily outflow velocity and anomaly detection upon your first transaction.",
        bulletPoints: isId
          ? [
              "Pengeluaran aktual: Rp 0",
              budget > 0 ? `Plafon anggaran: ${formatRupiah(budget)}` : "Plafon anggaran: Belum ditentukan",
              "Status telemetri: Siaga pemantauan",
            ]
          : [
              "Actual spending: Rp 0",
              budget > 0 ? `Budget limit: ${formatRupiah(budget)}` : "Budget limit: Not configured",
              "Telemetry status: Standby monitoring",
            ],
      },
    };
  }

  // Priority 1: Critical Budget Risk / Projected Overrun
  if (budget > 0 && budgetRisk === "AT RISK" && projectedVariance > 0) {
    return {
      type: "projected_overrun",
      title: isId
        ? `Proyeksi ${formatRupiah(projectedVariance)} melampaui anggaran bulanan`
        : `Projected ${formatRupiah(projectedVariance)} above monthly budget`,
      subtitle: isId
        ? `Pada laju harian saat ini, pengeluaran akan mencapai ${consumedPct.toFixed(0)}% dari batas.`
        : `At current daily run-rate, total spending will reach ${consumedPct.toFixed(0)}% of limit.`,
      badge: isId ? "RISIKO ANGGARAN" : "BUDGET RISK",
      actionLabel: isId ? "Tinjau anggaran" : "Review budget",
      actionType: "budget",
      drillDownDetails: {
        headline: isId ? "Proyeksi Pembengkakan Anggaran" : "Projected Budget Overrun",
        explanation: isId
          ? `Berdasarkan ${timePct.toFixed(0)}% hari yang telah berlalu, rata-rata belanja harian diproyeksikan melebihi pagu bulanan sebesar ${formatRupiah(projectedVariance)}.`
          : `Based on ${timePct.toFixed(0)}% of days elapsed, your average daily spending projects to exceed your monthly limit by ${formatRupiah(projectedVariance)}.`,
        bulletPoints: isId
          ? [
              `Pengeluaran saat ini: ${consumedPct.toFixed(0)}% dari batas`,
              `Bulan berjalan: ${timePct.toFixed(0)}%`,
              `Selisih proyeksi akhir bulan: +${formatRupiah(projectedVariance)}`,
            ]
          : [
              `Current spending: ${consumedPct.toFixed(0)}% of limit`,
              `Month elapsed: ${timePct.toFixed(0)}%`,
              `Projected month-end variance: +${formatRupiah(projectedVariance)}`,
            ],
      },
    };
  }

  // Priority 2: Spending Pace running significantly ahead
  if (budget > 0 && isAheadOfPace && paceDiff > 100000) {
    return {
      type: "spending_pace",
      title: isId
        ? `Laju pengeluaran ${formatRupiah(paceDiff)} lebih cepat dari tempo bulanan`
        : `Spending is running ${formatRupiah(paceDiff)} ahead of monthly pace`,
      subtitle: isId
        ? `${consumedPct.toFixed(0)}% anggaran terpakai vs ${timePct.toFixed(0)}% hari berjalan.`
        : `${consumedPct.toFixed(0)}% budget consumed vs ${timePct.toFixed(0)}% days elapsed.`,
      badge: isId ? "TEMPO BELANJA" : "SPENDING PACE",
      actionLabel: isId ? "Lihat rincian" : "View breakdown",
      actionType: "statistics",
      drillDownDetails: {
        headline: isId ? "Deviasi Tempo Belanja" : "Spending Pace Deviation",
        explanation: isId
          ? `Anda saat ini berbelanja lebih cepat dari proporsi waktu yang berjalan di bulan ini.`
          : `You are currently spending faster than the proportional time elapsed in the current month.`,
        bulletPoints: isId
          ? [
              `Ekspektasi pengeluaran saat ini: ${formatRupiah(options.totalExpense - paceDiff)}`,
              `Pengeluaran aktual: ${formatRupiah(options.totalExpense)}`,
              `Deviasi tempo: +${formatRupiah(paceDiff)}`,
            ]
          : [
              `Expected spending at this point: ${formatRupiah(options.totalExpense - paceDiff)}`,
              `Actual spending: ${formatRupiah(options.totalExpense)}`,
              `Pace variance: +${formatRupiah(paceDiff)}`,
            ],
      },
    };
  }

  // Priority 3: Significant Category Spike
  const topSpike = categoryShifts.find(
    (c) => c.isIncrease && c.deltaAmount >= 200000 && c.pctChange >= 20,
  );
  if (topSpike) {
    return {
      type: "category_spike",
      title: isId
        ? `Belanja ${topSpike.name} naik ${topSpike.pctChange}% dibanding bulan lalu`
        : `${topSpike.name} spending increased ${topSpike.pctChange}% vs last month`,
      subtitle: isId
        ? `+${formatRupiah(topSpike.deltaAmount)} lebih tinggi dari garis dasar bulan lalu.`
        : `+${formatRupiah(topSpike.deltaAmount)} higher than previous month's baseline.`,
      badge: isId ? "PERGESERAN KATEGORI" : "CATEGORY SHIFT",
      actionLabel: isId ? "Lihat kategori" : "View category",
      actionType: "category_detail",
      actionParam: topSpike.categoryId,
      drillDownDetails: {
        headline: isId ? `Pergeseran Belanja ${topSpike.name}` : `${topSpike.name} Spending Shift`,
        explanation: isId
          ? `${topSpike.name} mencatatkan lonjakan beban terbesar dibanding bulan sebelumnya.`
          : `${topSpike.name} had the largest positive expense change compared to the previous month.`,
        bulletPoints: topSpike.contributors.map(
          (c) => `${c.note}: ${formatRupiah(c.amount)} (${c.count} ${isId ? "trx" : "txs"})`,
        ),
      },
    };
  }

  // Priority 4: Tight Safe-to-Spend buffer
  if (unpaidBillsCount > 0 && safeToSpend < 300000) {
    return {
      type: "safety_buffer",
      title: isId
        ? `${unpaidBillsCount} tagihan mendatang terjadwal di siklus ini`
        : `${unpaidBillsCount} upcoming bills scheduled this cycle`,
      subtitle: isId
        ? `Bantalan belanja aman saat ini ${formatRupiah(safeToSpend)}.`
        : `Safe-to-spend buffer is currently ${formatRupiah(safeToSpend)}.`,
      badge: isId ? "BANTALAN AMAN" : "SAFETY BUFFER",
      actionLabel: isId ? "Lihat tagihan" : "View upcoming bills",
      actionType: "bills",
      drillDownDetails: {
        headline: isId ? "Bantalan Kewajiban Komitmen" : "Committed Obligations Buffer",
        explanation: isId
          ? `Tagihan rutin mendatang disisihkan dari aset likuid untuk menentukan dana bebas belanja Anda.`
          : `Upcoming recurring bills are deducted from liquid assets to determine your unencumbered spending balance.`,
        bulletPoints: isId
          ? [
              `Total komitmen mendatang: ${formatRupiah(options.safeToSpend)}`,
              `Sisa bantalan pengaman: ${formatRupiah(safeToSpend)}`,
            ]
          : [
              `Total upcoming commitments: ${formatRupiah(options.safeToSpend)}`,
              `Remaining safety buffer: ${formatRupiah(safeToSpend)}`,
            ],
      },
    };
  }

  // Priority 5: Spending without Budget Ceiling Configured
  if (budget === 0 && options.totalExpense > 0) {
    return {
      type: "healthy",
      title: isId
        ? `Pengeluaran ${formatRupiah(options.totalExpense)} belum memiliki pagu anggaran`
        : `Spending of ${formatRupiah(options.totalExpense)} has no budget limit`,
      subtitle: isId
        ? "Tetapkan batas anggaran bulanan untuk mengaktifkan sistem peringatan dini deviasi dan proyeksi akhir bulan."
        : "Set a monthly budget ceiling to unlock automated deviation alerts and month-end projections.",
      badge: isId ? "PANDUAN ANGGARAN" : "BUDGET GUIDANCE",
      actionLabel: isId ? "Atur anggaran" : "Set budget",
      actionType: "budget",
      drillDownDetails: {
        headline: isId ? "Pagu Anggaran Belum Ditetapkan" : "Unbudgeted Outflow Tracking",
        explanation: isId
          ? "Menetapkan batas anggaran bulanan melindungi rasio tabungan dan mengaktifkan deteksi dini laju pembengkakan dana."
          : "Setting a monthly budget ceiling protects your savings rate and unlocks early detection of spending velocity overruns.",
        bulletPoints: isId
          ? [
              `Pengeluaran berjalan: ${formatRupiah(options.totalExpense)}`,
              "Pagu anggaran aktif: Belum ditentukan",
              "Perlindungan deviasi: Memerlukan batas anggaran",
            ]
          : [
              `Current spending: ${formatRupiah(options.totalExpense)}`,
              "Active budget ceiling: Unset",
              "Deviation protection: Requires active budget",
            ],
      },
    };
  }

  // Priority 6: Calm on-track state (budget > 0)
  return {
    type: "healthy",
    title: isId
      ? "Pengeluaran Anda terkendali sesuai anggaran bulan ini"
      : "You're on track for this month's budget",
    subtitle: isId
      ? `${consumedPct.toFixed(0)}% terpakai dengan ${timePct.toFixed(0)}% bulan telah berjalan.`
      : `${consumedPct.toFixed(0)}% consumed with ${timePct.toFixed(0)}% of the month elapsed.`,
    badge: isId ? "SESUAI JALUR" : "ON TRACK",
    actionLabel: isId ? "Lihat statistik" : "View statistics",
    actionType: "statistics",
    drillDownDetails: {
      headline: isId ? "Ringkasan Finansial" : "Financial Summary",
      explanation: isId
        ? "Laju pengeluaran saat ini selaras dengan jadwal bulanan Anda."
        : "Current spending rate is aligned with your monthly schedule.",
      bulletPoints: isId
        ? [
            "Arus kas bersih: Terkendali",
            "Tempo pengeluaran: Seimbang",
          ]
        : [
            "Net cashflow: Controlled",
            "Spending pace: Balanced",
          ],
    },
  };
}

/**
 * Generates the Monthly Financial Review for Statistics Page.
 */
export function generateMonthlyFinancialReview(
  currentMonthTxs: Transaction[],
  previousMonthTxs: Transaction[],
  categories: Category[],
  budget: number,
  monthDate: Date,
  language?: "en" | "id",
): MonthlyFinancialReviewData {
  const isId = language === "id";
  const monthName = format(monthDate, "MMMM");
  const year = monthDate.getFullYear();
  const monthNumber = monthDate.getMonth() + 1;

  const currentAgg = computeMonthAggregates(currentMonthTxs, year, monthNumber);
  const prevAgg = computeMonthAggregates(
    previousMonthTxs,
    subMonths(monthDate, 1).getFullYear(),
    subMonths(monthDate, 1).getMonth() + 1,
  );

  const shifts = computeCategoryMoMChanges(
    currentMonthTxs,
    previousMonthTxs,
    categories,
  );

  // What Changed: Up to 3 meaningful shifts
  const whatChanged: MonthlyFinancialReviewData["whatChanged"] = [];
  shifts.slice(0, 3).forEach((s) => {
    if (s.deltaAmount === 0 && s.pctChange === 0) return;
    whatChanged.push({
      label: s.name,
      changeText: `${s.isIncrease ? "↑" : "↓"} ${s.pctChange}% (${formatRupiah(Math.abs(s.deltaAmount))})`,
      isUp: s.isIncrease,
    });
  });

  if (prevAgg.avgExpense > 0 && currentAgg.avgExpense > 0) {
    const avgDiffPct = Math.round(
      ((currentAgg.avgExpense - prevAgg.avgExpense) / prevAgg.avgExpense) * 100,
    );
    if (Math.abs(avgDiffPct) >= 5) {
      whatChanged.push({
        label: isId ? "Rata-rata Transaksi" : "Avg Transaction",
        changeText: `${avgDiffPct > 0 ? "↑" : "↓"} ${Math.abs(avgDiffPct)}%`,
        isUp: avgDiffPct > 0,
      });
    }
  }

  // What Went Well
  const whatWentWell: string[] = [];
  if (budget > 0 && currentAgg.totalExpense <= budget) {
    whatWentWell.push(
      isId
        ? `Berhasil menjaga pengeluaran dalam batas anggaran bulanan.`
        : `Maintained spending within your ${format(monthDate, "MMMM")} budget.`,
    );
  }
  if (currentAgg.savingsRate >= 20) {
    whatWentWell.push(
      isId
        ? `Mencapai rasio tabungan ${currentAgg.savingsRate.toFixed(0)}% dari total pemasukan bulanan.`
        : `Achieved a ${currentAgg.savingsRate.toFixed(0)}% savings rate from total monthly inflow.`,
    );
  }
  if (
    prevAgg.totalExpense > 0 &&
    currentAgg.totalExpense < prevAgg.totalExpense
  ) {
    const savedMoM = prevAgg.totalExpense - currentAgg.totalExpense;
    whatWentWell.push(
      isId
        ? `Total pengeluaran berkurang ${formatRupiah(savedMoM)} dibandingkan bulan lalu.`
        : `Total outflow decreased by Rp ${(savedMoM / 1000).toFixed(0)}K compared to previous month.`,
    );
  }
  if (whatWentWell.length === 0 && currentAgg.netCashflow >= 0) {
    whatWentWell.push(
      isId
        ? "Mempertahankan arus kas positif tanpa defisit di akhir bulan."
        : "Maintained positive net cashflow with zero month-end deficit.",
    );
  }

  // What Needs Attention
  const whatNeedsAttention: string[] = [];
  if (budget > 0 && currentAgg.totalExpense > budget) {
    const over = currentAgg.totalExpense - budget;
    whatNeedsAttention.push(
      isId
        ? `Pengeluaran melampaui anggaran bulanan sebesar ${formatRupiah(over)}.`
        : `Outflow exceeded monthly budget by Rp ${(over / 1000).toFixed(0)}K.`,
    );
  }
  const bigSpike = shifts.find(
    (s) => s.isIncrease && s.pctChange >= 25 && s.deltaAmount >= 200000,
  );
  if (bigSpike) {
    whatNeedsAttention.push(
      isId
        ? `Pengeluaran ${bigSpike.name} melonjak ${bigSpike.pctChange}% (+${formatRupiah(bigSpike.deltaAmount)} vs bulan lalu).`
        : `${bigSpike.name} spending grew ${bigSpike.pctChange}% (+Rp ${(bigSpike.deltaAmount / 1000).toFixed(0)}K vs previous month).`,
    );
  }
  if (currentAgg.netCashflow < 0) {
    whatNeedsAttention.push(
      isId
        ? `Defisit kas bersih sebesar ${formatRupiah(Math.abs(currentAgg.netCashflow))} (pengeluaran melebihi pemasukan).`
        : `Net deficit of Rp ${(Math.abs(currentAgg.netCashflow) / 1000).toFixed(0)}K (outflow exceeded inflow).`,
    );
  }

  // Next Month Run-Rate Baseline
  let nextMonthBaseline = isId
    ? "Trayektori pengeluaran garis dasar selaras dengan laju historis."
    : "Baseline expense trajectory aligns with historical run-rate.";
  if (currentAgg.totalExpense > 0 && budget > 0) {
    if (currentAgg.totalExpense > budget) {
      nextMonthBaseline = isId
        ? "Pada laju pengeluaran saat ini, siklus berikutnya berisiko melampaui target tanpa penyesuaian kategori."
        : "At the current spending pace, next cycle may risk remaining above target without category adjustments.";
    } else {
      nextMonthBaseline = isId
        ? "Kedisiplinan saat ini menjadi fondasi yang kokoh untuk batas pos anggaran bulan depan."
        : "Current discipline provides a strong foundation for next month's envelope limits.";
    }
  }

  return {
    monthName,
    year,
    overview: {
      income: currentAgg.totalIncome,
      expense: currentAgg.totalExpense,
      netCashflow: currentAgg.netCashflow,
      savingsRate: currentAgg.savingsRate,
      txCount: currentAgg.txCount,
      avgTransaction: currentAgg.avgExpense,
    },
    whatChanged: whatChanged.slice(0, 4),
    whatWentWell: whatWentWell.slice(0, 3),
    whatNeedsAttention: whatNeedsAttention.slice(0, 3),
    nextMonthBaseline,
  };
}

/**
 * Pure statistical helpers
 */
export function calculateMedian(numbers: number[]): number {
  if (!numbers || numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function calculateTypicalRange(numbers: number[]): [number, number] {
  if (!numbers || numbers.length === 0) return [0, 0];
  if (numbers.length === 1) return [numbers[0], numbers[0]];
  const sorted = [...numbers].sort((a, b) => a - b);
  const median = calculateMedian(sorted);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const lowerBound = Math.round(Math.max(min, median * 0.85));
  const upperBound = Math.round(Math.min(max, median * 1.15));
  return [lowerBound, upperBound];
}

/**
 * Calculates Personal Historical Baseline across completed cycles.
 */
export function calculatePersonalBaselines(
  transactions: Transaction[],
  categories: Category[] = [],
  now = new Date(),
  language: "id" | "en" = "en",
): PersonalBaselineResult {
  const currentMonthKey = format(now, "yyyy-MM");
  const currentMonthTxs = transactions.filter((t) =>
    t.occurred_on?.startsWith(currentMonthKey),
  );
  const currentAgg = computeMonthAggregates(
    currentMonthTxs,
    now.getFullYear(),
    now.getMonth() + 1,
  );
  const currentMonthExpense = currentAgg.totalExpense;

  // Map transactions by month
  const monthMap = new Map<string, Transaction[]>();
  transactions.forEach((t) => {
    if (!t.occurred_on) return;
    const mKey = t.occurred_on.slice(0, 7);
    if (!monthMap.has(mKey)) monthMap.set(mKey, []);
    monthMap.get(mKey)!.push(t);
  });

  // Filter completed historical months (excluding current month)
  const historicalMonthKeys = Array.from(monthMap.keys())
    .filter((k) => k < currentMonthKey)
    .sort();

  const historicalMonthsCount = historicalMonthKeys.length;

  if (historicalMonthsCount < 2) {
    return {
      status: "insufficient",
      confidence: "low",
      historicalMonthsCount,
      message:
        language === "id"
          ? "Kumpulkan lebih banyak riwayat transaksi untuk membentuk batas dasar pribadi Anda."
          : "Build more history to establish your personal baseline.",
      medianExpense: currentMonthExpense || 0,
      meanExpense: currentMonthExpense || 0,
      typicalExpenseRange: [currentMonthExpense, currentMonthExpense],
      medianIncome: currentAgg.totalIncome || 0,
      typicalIncomeRange: [currentAgg.totalIncome, currentAgg.totalIncome],
      medianNetCashflow: currentAgg.netCashflow || 0,
      typicalNetCashflowRange: [currentAgg.netCashflow, currentAgg.netCashflow],
      medianTxSize: currentAgg.avgExpense || 0,
      monthlyTxFrequency: currentAgg.txCount || 0,
      currentMonthExpense,
      currentMonthStatus: "within_range",
      currentMonthDelta: 0,
      currentMonthDeviationPct: 0,
      categoryBaselines: [],
    };
  }

  const confidence = historicalMonthsCount >= 4 ? "high" : "moderate";
  const status = historicalMonthsCount >= 4 ? "stable" : "early";

  // Compute monthly aggregates for all completed historical months
  const monthlyExpenses: number[] = [];
  const monthlyIncomes: number[] = [];
  const monthlyNetCashflows: number[] = [];
  const monthlyTxCounts: number[] = [];
  const allHistoricalExpenseAmounts: number[] = [];
  const categoryMonthlyMap = new Map<string, number[]>();

  historicalMonthKeys.forEach((k) => {
    const txs = monthMap.get(k)!;
    const [y, m] = k.split("-").map(Number);
    const agg = computeMonthAggregates(txs, y, m);

    monthlyExpenses.push(agg.totalExpense);
    monthlyIncomes.push(agg.totalIncome);
    monthlyNetCashflows.push(agg.netCashflow);
    monthlyTxCounts.push(agg.txCount);

    // Collect expense amounts
    txs.forEach((t) => {
      if (t.type === "expense" && !isCorrectionTx(t)) {
        const amt = Number(t.amount || 0);
        if (amt > 0) allHistoricalExpenseAmounts.push(amt);
      }
    });

    // Collect category totals
    Object.entries(agg.categoryTotals).forEach(([catId, data]) => {
      if (!categoryMonthlyMap.has(catId)) categoryMonthlyMap.set(catId, []);
      categoryMonthlyMap.get(catId)!.push(data.total);
    });
  });

  const medianExpense = calculateMedian(monthlyExpenses);
  const meanExpense = Math.round(
    monthlyExpenses.reduce((s, v) => s + v, 0) / monthlyExpenses.length,
  );
  const typicalExpenseRange = calculateTypicalRange(monthlyExpenses);

  const medianIncome = calculateMedian(monthlyIncomes);
  const typicalIncomeRange = calculateTypicalRange(monthlyIncomes);

  const medianNetCashflow = calculateMedian(monthlyNetCashflows);
  const typicalNetCashflowRange = calculateTypicalRange(monthlyNetCashflows);

  const medianTxSize = calculateMedian(allHistoricalExpenseAmounts);
  const monthlyTxFrequency = Math.round(
    monthlyTxCounts.reduce((s, v) => s + v, 0) / monthlyTxCounts.length,
  );

  // Determine current month status vs typical range
  let currentMonthStatus: "below_range" | "within_range" | "above_range" =
    "within_range";
  if (currentMonthExpense > typicalExpenseRange[1]) {
    currentMonthStatus = "above_range";
  } else if (
    currentMonthExpense < typicalExpenseRange[0] &&
    currentMonthExpense > 0
  ) {
    currentMonthStatus = "below_range";
  }

  const currentMonthDelta = currentMonthExpense - medianExpense;
  const currentMonthDeviationPct =
    medianExpense > 0
      ? Math.round((currentMonthDelta / medianExpense) * 100)
      : 0;

  // Category Baselines
  const catLookup = new Map<string, Category>();
  categories.forEach((c) => catLookup.set(c.id, c));

  const categoryBaselines: CategoryBaseline[] = [];
  categoryMonthlyMap.forEach((totals, catId) => {
    if (totals.length >= 2) {
      const medianMonthlyTotal = calculateMedian(totals);
      const typicalMonthlyRange = calculateTypicalRange(totals);

      // Category transactions for ticket size calculation
      const catTxs = transactions.filter(
        (t) =>
          (t.category_id === catId ||
            (catLookup.get(catId)?.name &&
              t.categories?.name === catLookup.get(catId)?.name)) &&
          t.type === "expense" &&
          !isCorrectionTx(t),
      );
      const catAmounts = catTxs
        .map((t) => Number(t.amount || 0))
        .filter((a) => a > 0);
      const medianCatTxSize = calculateMedian(catAmounts);
      const typicalTxRange = calculateTypicalRange(catAmounts);
      const catMonthlyFreq = Math.round(
        catTxs.length / Math.max(1, historicalMonthsCount),
      );

      const currentCatTotal = currentAgg.categoryTotals[catId]?.total || 0;
      let currentCatStatus: "below_range" | "within_range" | "above_range" =
        "within_range";
      if (currentCatTotal > typicalMonthlyRange[1]) {
        currentCatStatus = "above_range";
      } else if (
        currentCatTotal < typicalMonthlyRange[0] &&
        currentCatTotal > 0
      ) {
        currentCatStatus = "below_range";
      }

      const devPct =
        medianMonthlyTotal > 0
          ? Math.round(
              ((currentCatTotal - medianMonthlyTotal) / medianMonthlyTotal) *
                100,
            )
          : 0;
      const catMeta = catLookup.get(catId);

      categoryBaselines.push({
        categoryId: catId,
        name: catMeta?.name || "Category",
        emoji: catMeta?.emoji || "/icons/lainnya.png",
        medianMonthlyTotal,
        typicalMonthlyRange,
        medianTxSize: medianCatTxSize,
        typicalTxRange,
        monthlyFrequency: catMonthlyFreq,
        currentMonthTotal: currentCatTotal,
        currentStatus: currentCatStatus,
        deviationPct: devPct,
      });
    }
  });

  categoryBaselines.sort((a, b) => b.medianMonthlyTotal - a.medianMonthlyTotal);

  return {
    status,
    confidence,
    historicalMonthsCount,
    medianExpense,
    meanExpense,
    typicalExpenseRange,
    medianIncome,
    typicalIncomeRange,
    medianNetCashflow,
    typicalNetCashflowRange,
    medianTxSize,
    monthlyTxFrequency,
    currentMonthExpense,
    currentMonthStatus,
    currentMonthDelta,
    currentMonthDeviationPct,
    categoryBaselines,
  };
}

/**
 * Detects descriptive behavioral spending patterns with strict evidence gates.
 */
export function detectBehavioralPatterns(
  transactions: Transaction[],
  baselines: PersonalBaselineResult,
  _now = new Date(),
  language: "id" | "en" = "en",
): BehavioralPattern[] {
  const patterns: BehavioralPattern[] = [];
  if (baselines.status === "insufficient") return patterns;

  const isId = language === "id";

  const formatIdr = (n: number) => {
    if (Math.abs(n) >= 1000000)
      return `Rp ${(Math.abs(n) / 1000000).toFixed(1)}M`;
    if (Math.abs(n) >= 1000) return `Rp ${(Math.abs(n) / 1000).toFixed(0)}K`;
    return `Rp ${Math.abs(n)}`;
  };

  // 1. Day of Week Pattern (Weekend vs Weekday Daily Average)
  let weekdayTotal = 0;
  let weekdayDays = new Set<string>();
  let weekendTotal = 0;
  let weekendDays = new Set<string>();

  transactions.forEach((t) => {
    if (t.type !== "expense" || isCorrectionTx(t) || !t.occurred_on) return;
    const amt = Number(t.amount || 0);
    if (amt <= 0) return;
    const dateKey = t.occurred_on.slice(0, 10);
    const dateObj = parseISO(dateKey);
    const dayOfWeek = dateObj.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      weekendTotal += amt;
      weekendDays.add(dateKey);
    } else {
      weekdayTotal += amt;
      weekdayDays.add(dateKey);
    }
  });

  if (weekendDays.size >= 8 && weekdayDays.size >= 16) {
    const avgWeekendDay = Math.round(weekendTotal / weekendDays.size);
    const avgWeekdayDay = Math.round(weekdayTotal / weekdayDays.size);

    if (avgWeekdayDay > 0) {
      const weekendRatio = avgWeekendDay / avgWeekdayDay;
      if (weekendRatio >= 1.25) {
        patterns.push({
          id: "pattern-weekend-elevated",
          type: "day_of_week",
          title: isId
            ? "Pengeluaran akhir pekan cenderung meningkat"
            : "Weekend spending is typically elevated",
          subtitle: isId
            ? `Rata-rata belanja harian akhir pekan ${weekendRatio.toFixed(1)}× lebih tinggi dibanding hari kerja.`
            : `Weekend daily expenses average ${weekendRatio.toFixed(1)}× higher than weekdays.`,
          badge: isId ? "AKHIR PEKAN" : "DAY OF WEEK",
          evidence: isId
            ? `Rata-rata belanja harian ${formatIdr(avgWeekendDay)} di akhir pekan vs ${formatIdr(avgWeekdayDay)} di hari kerja.`
            : `Average daily spending is ${formatIdr(avgWeekendDay)} on weekends vs ${formatIdr(avgWeekdayDay)} on weekdays.`,
          metricValue: weekendRatio,
        });
      } else if (weekendRatio <= 0.75) {
        patterns.push({
          id: "pattern-weekday-elevated",
          type: "day_of_week",
          title: isId
            ? "Pengeluaran hari kerja cenderung lebih tinggi"
            : "Weekday spending is typically higher",
          subtitle: isId
            ? `Rata-rata belanja harian hari kerja ${(1 / weekendRatio).toFixed(1)}× lebih tinggi dibanding akhir pekan.`
            : `Weekday daily expenses average ${(1 / weekendRatio).toFixed(1)}× higher than weekends.`,
          badge: isId ? "HARI KERJA" : "DAY OF WEEK",
          evidence: isId
            ? `Rata-rata belanja harian ${formatIdr(avgWeekdayDay)} di hari kerja vs ${formatIdr(avgWeekendDay)} di akhir pekan.`
            : `Average daily spending is ${formatIdr(avgWeekdayDay)} on weekdays vs ${formatIdr(avgWeekendDay)} on weekends.`,
          metricValue: weekendRatio,
        });
      }
    }
  }

  // 2. Category Concentration Pattern
  if (baselines.categoryBaselines.length > 0 && baselines.medianExpense > 0) {
    const topCat = baselines.categoryBaselines[0];
    const concentrationPct = Math.round(
      (topCat.medianMonthlyTotal / baselines.medianExpense) * 100,
    );
    if (concentrationPct >= 30) {
      patterns.push({
        id: "pattern-category-concentration",
        type: "category_concentration",
        title: isId
          ? `${topCat.name} adalah alokasi pengeluaran terbesar Anda`
          : `${topCat.name} is your largest expense allocation`,
        subtitle: isId
          ? `${topCat.name} biasanya mencakup ${concentrationPct}% dari pengeluaran bulanan.`
          : `${topCat.name} typically represents ${concentrationPct}% of monthly expenses.`,
        badge: isId ? "KONSENTRASI" : "CONCENTRATION",
        evidence: isId
          ? `Alokasi tipikal ${formatIdr(topCat.medianMonthlyTotal)} dari total ${formatIdr(baselines.medianExpense)} pengeluaran bulanan.`
          : `Typical monthly allocation of ${formatIdr(topCat.medianMonthlyTotal)} out of ${formatIdr(baselines.medianExpense)} total monthly expenses.`,
        metricValue: concentrationPct,
      });
    }
  }

  // 3. Monthly Spending Timing Distribution (First 10 Days vs Rest of Month)
  let earlyMonthTotal = 0;
  let totalValidExpense = 0;

  transactions.forEach((t) => {
    if (t.type !== "expense" || isCorrectionTx(t) || !t.occurred_on) return;
    const day = Number(t.occurred_on.slice(8, 10));
    const amt = Number(t.amount || 0);
    if (!isNaN(day) && amt > 0) {
      totalValidExpense += amt;
      if (day <= 10) earlyMonthTotal += amt;
    }
  });

  if (totalValidExpense > 0) {
    const earlyPct = Math.round((earlyMonthTotal / totalValidExpense) * 100);
    if (earlyPct >= 45) {
      patterns.push({
        id: "pattern-spending-timing",
        type: "spending_timing",
        title: isId
          ? "Pola pengeluaran terkonsentrasi di awal bulan"
          : "Front-loaded monthly spending pattern",
        subtitle: isId
          ? `${earlyPct}% dari belanja bulanan biasanya terjadi dalam 10 hari pertama.`
          : `${earlyPct}% of monthly expenses typically occur during the first 10 days.`,
        badge: isId ? "TEMPO BULANAN" : "TIMING",
        evidence: isId
          ? `Komitmen awal siklus mencakup ${earlyPct}% dari seluruh arus kas keluar.`
          : `Early-cycle commitments and recurring obligations represent ${earlyPct}% of total outflow.`,
        metricValue: earlyPct,
      });
    }
  }

  // 4. Ticket Size Consistency
  if (baselines.medianTxSize > 0 && baselines.monthlyTxFrequency > 0) {
    patterns.push({
      id: "pattern-ticket-size",
      type: "ticket_size",
      title: isId
        ? `Besaran transaksi tipikal adalah ${formatIdr(baselines.medianTxSize)}`
        : `Typical expense size is ${formatIdr(baselines.medianTxSize)}`,
      subtitle: isId
        ? `Ritme pengeluaran Anda berkisar ${baselines.monthlyTxFrequency} transaksi per bulan.`
        : `Your typical rhythm is ${baselines.monthlyTxFrequency} expense transactions per month.`,
      badge: isId ? "UKURAN TIKET" : "TICKET SIZE",
      evidence: isId
        ? "Nilai median transaksi di seluruh siklus historis tercatat."
        : `Median transaction amount across completed historical cycles.`,
      metricValue: baselines.medianTxSize,
    });
  }

  return patterns;
}

/**
 * Pure longitudinal timeline aggregation and trajectory interpretation.
 */
export function calculateLongitudinalTimeline(
  transactions: Transaction[],
  range: "3M" | "6M" | "12M" | "ALL" = "6M",
  now = new Date(),
  language: "en" | "id" = "en",
): LongitudinalTimelineResult {
  const isId = language === "id";
  const datedTxs = transactions.filter((t) => !!t.occurred_on);
  const earliestMonthKey =
    datedTxs.length > 0
      ? datedTxs.reduce(
          (min, tx) =>
            tx.occurred_on.slice(0, 7) < min ? tx.occurred_on.slice(0, 7) : min,
          datedTxs[0].occurred_on.slice(0, 7),
        )
      : format(now, "yyyy-MM");
  const [earliestYear, earliestMonth] = earliestMonthKey.split("-").map(Number);
  const allTimeMonthsCount = Math.max(
    1,
    (now.getFullYear() - earliestYear) * 12 +
      (now.getMonth() + 1 - earliestMonth) +
      1,
  );
  const monthsCount =
    range === "3M"
      ? 3
      : range === "6M"
        ? 6
        : range === "12M"
          ? 12
          : allTimeMonthsCount;
  const points: LongitudinalMonthPoint[] = [];

  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = subMonths(now, i);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const agg = computeMonthAggregates(transactions, y, m);
    const mKey = `${y}-${String(m).padStart(2, "0")}`;

    points.push({
      monthKey: mKey,
      label: format(d, "MMM yy", { locale: isId ? idLocale : undefined }),
      year: y,
      month: m,
      income: agg.totalIncome,
      expense: agg.totalExpense,
      netCashflow: agg.netCashflow,
      savingsRate: agg.savingsRate,
      txCount: agg.txCount,
      avgTxSize: agg.avgExpense,
    });
  }

  const validExpensePoints = points.filter((p) => p.expense > 0);
  const averageMonthlyExpense =
    validExpensePoints.length > 0
      ? Math.round(
          validExpensePoints.reduce((s, p) => s + p.expense, 0) /
            validExpensePoints.length,
        )
      : 0;
  const validIncomePoints = points.filter((p) => p.income > 0);
  const averageMonthlyIncome =
    validIncomePoints.length > 0
      ? Math.round(
          validIncomePoints.reduce((s, p) => s + p.income, 0) /
            validIncomePoints.length,
        )
      : 0;
  const totalNetGrowth = points.reduce((s, p) => s + p.netCashflow, 0);

  // Trajectory interpretation
  let trendDirection: "increasing" | "decreasing" | "stable" = "stable";
  let trajectoryInterpretation = isId
    ? "Arus kas bulanan dan arah pengeluaran tetap stabil sepanjang periode ini."
    : "Monthly cashflow and expense trajectory have remained stable across this period.";

  if (points.length >= 4) {
    const half = Math.floor(points.length / 2);
    const firstHalfAvg = Math.round(
      points.slice(0, half).reduce((s, p) => s + p.expense, 0) / half,
    );
    const secondHalfAvg = Math.round(
      points.slice(half).reduce((s, p) => s + p.expense, 0) /
        (points.length - half),
    );

    const formatIdr = (n: number) => {
      if (Math.abs(n) >= 1000000)
        return `Rp ${(Math.abs(n) / 1000000).toFixed(1)}${isId ? " Jt" : "M"}`;
      return `Rp ${(Math.abs(n) / 1000).toFixed(0)}K`;
    };

    if (firstHalfAvg > 0 && secondHalfAvg > firstHalfAvg * 1.12) {
      trendDirection = "increasing";
      trajectoryInterpretation = isId
        ? `Rata-rata pengeluaran bulanan meningkat dari ${formatIdr(firstHalfAvg)} ke ${formatIdr(secondHalfAvg)} selama periode yang dipilih.`
        : `Average monthly expense increased from ${formatIdr(firstHalfAvg)} to ${formatIdr(secondHalfAvg)} over the selected period.`;
    } else if (firstHalfAvg > 0 && secondHalfAvg < firstHalfAvg * 0.88) {
      trendDirection = "decreasing";
      trajectoryInterpretation = isId
        ? `Rata-rata pengeluaran bulanan menurun dari ${formatIdr(firstHalfAvg)} ke ${formatIdr(secondHalfAvg)} selama periode yang dipilih.`
        : `Average monthly expense decreased from ${formatIdr(firstHalfAvg)} to ${formatIdr(secondHalfAvg)} over the selected period.`;
    } else {
      trajectoryInterpretation = isId
        ? `Rata-rata pengeluaran bulanan tetap seimbang di kisaran ${formatIdr(averageMonthlyExpense)}.`
        : `Average monthly expense has remained balanced around ${formatIdr(averageMonthlyExpense)}.`;
    }
  }

  return {
    range,
    points,
    trajectoryInterpretation,
    trendDirection,
    averageMonthlyExpense,
    averageMonthlyIncome,
    totalNetGrowth,
  };
}

/**
 * Pure goal planning and mathematical trajectory evaluation.
 */
export function calculateWhatIfScenario(options: {
  monthlyIncome: number;
  monthlyExpense: number;
  type: WhatIfScenarioType;
  value: number;
}): WhatIfScenarioResult {
  const monthlyIncome = Math.max(0, Number(options.monthlyIncome || 0));
  const monthlyExpense = Math.max(0, Number(options.monthlyExpense || 0));
  const value = Number(options.value || 0);
  const currentMonthlyRetainedCash = monthlyIncome - monthlyExpense;

  let adjustedMonthlyIncome = monthlyIncome;
  let adjustedMonthlyExpense = monthlyExpense;
  let suggestedMonthlySavings = 0;

  switch (options.type) {
    case "expense_cut":
      adjustedMonthlyExpense = Math.max(0, monthlyExpense - Math.max(0, value));
      break;
    case "income_boost":
      adjustedMonthlyIncome = monthlyIncome + Math.max(0, value);
      break;
    case "expense_change_pct":
      adjustedMonthlyExpense = Math.max(0, monthlyExpense * (1 + value / 100));
      break;
    case "saving_plan":
      suggestedMonthlySavings = Math.max(0, value);
      break;
  }

  const adjustedMonthlyRetainedCash =
    adjustedMonthlyIncome - adjustedMonthlyExpense - suggestedMonthlySavings;

  return {
    type: options.type,
    currentAnnualRetainedCash: currentMonthlyRetainedCash * 12,
    adjustedAnnualRetainedCash: adjustedMonthlyRetainedCash * 12,
    annualDifference:
      (adjustedMonthlyRetainedCash - currentMonthlyRetainedCash) * 12,
    monthlyDifference: adjustedMonthlyRetainedCash - currentMonthlyRetainedCash,
    adjustedMonthlyIncome,
    adjustedMonthlyExpense,
    suggestedMonthlySavings,
    remainingFreeCashAfterSavings: adjustedMonthlyRetainedCash,
    isOvercommitted: adjustedMonthlyRetainedCash < 0,
  };
}

export function calculateGoalScenario(
  goal: {
    targetAmount: number;
    currentAmount: number;
  },
  monthlyContribution: number,
  now = new Date(),
  language: "en" | "id" = "en",
): GoalScenarioResult {
  const isId = language === "id";
  const remainingAmount = Math.max(0, goal.targetAmount - goal.currentAmount);
  const safeContribution = Math.max(0, Number(monthlyContribution || 0));

  if (remainingAmount === 0) {
    return {
      monthlyContribution: safeContribution,
      remainingAmount: 0,
      monthsToTarget: 0,
      yearsToTarget: 0,
      extraMonths: 0,
      projectedCompletionLabel: isId ? "Sudah tercapai" : "Already completed",
      projectedCompletionDate: format(now, "yyyy-MM-dd"),
      isAlreadyCompleted: true,
      isFeasible: true,
    };
  }

  if (safeContribution <= 0) {
    return {
      monthlyContribution: safeContribution,
      remainingAmount,
      monthsToTarget: 0,
      yearsToTarget: 0,
      extraMonths: 0,
      projectedCompletionLabel: isId ? "Tentukan kontribusi bulanan" : "Set a monthly contribution",
      projectedCompletionDate: null,
      isAlreadyCompleted: false,
      isFeasible: false,
    };
  }

  const monthsToTarget = Math.ceil(remainingAmount / safeContribution);
  const completionDate = addMonths(now, monthsToTarget);

  return {
    monthlyContribution: safeContribution,
    remainingAmount,
    monthsToTarget,
    yearsToTarget: Math.floor(monthsToTarget / 12),
    extraMonths: monthsToTarget % 12,
    projectedCompletionLabel: format(completionDate, "MMMM yyyy", {
      locale: isId ? idLocale : undefined,
    }),
    projectedCompletionDate: format(completionDate, "yyyy-MM-dd"),
    isAlreadyCompleted: false,
    isFeasible: true,
  };
}

export function calculateGoalPlanning(
  goal: {
    id: string;
    title: string;
    targetAmount: number;
    currentAmount: number;
    targetDate?: string;
  },
  baselines: PersonalBaselineResult,
  now = new Date(),
  language: "en" | "id" = "en",
  formatCurrencyFn?: (amount: number) => string,
): GoalPlanningResult {
  const isId = language === "id";
  const remainingAmount = Math.max(0, goal.targetAmount - goal.currentAmount);

  let remainingMonths = 12;
  if (goal.targetDate) {
    const targetD = new Date(goal.targetDate);
    const diffMonths =
      (targetD.getFullYear() - now.getFullYear()) * 12 +
      (targetD.getMonth() - now.getMonth());
    remainingMonths = Math.max(1, diffMonths);
  }

  const requiredMonthlyContribution = Math.round(
    remainingAmount / remainingMonths,
  );
  const historicalRetainedCash =
    baselines.medianNetCashflow > 0 ? baselines.medianNetCashflow : 0;

  const fmt = formatCurrencyFn || ((n: number) => `Rp ${n.toLocaleString("id-ID")}`);

  let trajectoryStatus: "ON TRACK" | "BEHIND TARGET" | "AHEAD OF TARGET" =
    "ON TRACK";
  let trajectoryExplanation = isId
    ? `Membutuhkan sekitar ${fmt(requiredMonthlyContribution)}/bulan selama ${remainingMonths} bulan.`
    : `Requires approximately ${fmt(requiredMonthlyContribution)}/month over ${remainingMonths} months.`;

  if (goal.currentAmount >= goal.targetAmount) {
    trajectoryStatus = "AHEAD OF TARGET";
    trajectoryExplanation = isId
      ? "Target sasaran telah tercapai sepenuhnya."
      : "Target goal has been fully reached.";
  } else if (historicalRetainedCash >= requiredMonthlyContribution * 1.1) {
    trajectoryStatus = "ON TRACK";
    trajectoryExplanation = isId
      ? `Rata-rata kas ditahan historis Anda (${fmt(historicalRetainedCash)}/bln) mendukung laju ${fmt(requiredMonthlyContribution)}/bln yang diperlukan.`
      : `Your historical average retained cash (${fmt(historicalRetainedCash)}/mo) supports the required ${fmt(requiredMonthlyContribution)}/mo pace.`;
  } else if (historicalRetainedCash >= requiredMonthlyContribution * 0.8) {
    trajectoryStatus = "ON TRACK";
    trajectoryExplanation = isId
      ? `Kontribusi yang diperlukan (${fmt(requiredMonthlyContribution)}/bln) sangat selaras dengan arus kas bersih historis (${fmt(historicalRetainedCash)}/bln).`
      : `Required contribution (${fmt(requiredMonthlyContribution)}/mo) closely aligns with historical net cashflow (${fmt(historicalRetainedCash)}/mo).`;
  } else {
    trajectoryStatus = "BEHIND TARGET";
    trajectoryExplanation = isId
      ? `Target membutuhkan ${fmt(requiredMonthlyContribution)}/bulan sementara rata-rata kas ditahan historis adalah ${fmt(historicalRetainedCash)}/bulan.`
      : `Target requires ${fmt(requiredMonthlyContribution)}/month while historical average retained cash is ${fmt(historicalRetainedCash)}/month.`;
  }

  return {
    goalId: goal.id,
    goalTitle: goal.title,
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount,
    remainingAmount,
    targetDate: goal.targetDate,
    remainingMonths,
    requiredMonthlyContribution,
    historicalRetainedCash,
    trajectoryStatus,
    trajectoryExplanation,
  };
}

export interface GoalMilestone {
  percentage: number;
  targetAmount: number;
  isReached: boolean;
  projectedDate: string | null;
  monthsAway: number;
}

export interface DynamicGoalMilestonesResult {
  currentProgressPct: number;
  remainingAmount: number;
  currentVelocityMonthly: number;
  isAlreadyCompleted: boolean;
  milestones: GoalMilestone[];
  velocityPaces: {
    conservative: { monthly: number; projectedCompletion: string | null; months: number };
    current: { monthly: number; projectedCompletion: string | null; months: number };
    accelerated: { monthly: number; projectedCompletion: string | null; months: number };
  };
}

export function calculateDynamicGoalMilestones(
  goal: {
    id: string;
    title: string;
    targetAmount: number;
    currentAmount: number;
  },
  baselines: {
    medianNetCashflow: number;
    medianIncome?: number;
    medianExpense?: number;
  },
  now = new Date(),
  language: "en" | "id" = "en",
): DynamicGoalMilestonesResult {
  const isId = language === "id";
  const locale = isId ? idLocale : undefined;
  const currentAmount = Math.max(0, goal.currentAmount);
  const targetAmount = Math.max(1, goal.targetAmount);
  const remainingAmount = Math.max(0, targetAmount - currentAmount);
  const currentProgressPct = Math.min(100, Math.round((currentAmount / targetAmount) * 100));
  const isAlreadyCompleted = currentAmount >= targetAmount;

  const baselineVelocity = baselines.medianNetCashflow > 0 ? baselines.medianNetCashflow : 500000;
  const conservativeVelocity = Math.max(100000, Math.round(baselineVelocity * 0.6));
  const currentVelocity = baselineVelocity;
  const acceleratedVelocity = Math.round(baselineVelocity * 1.4);

  const getPaceResult = (monthly: number) => {
    if (isAlreadyCompleted) {
      return { monthly, projectedCompletion: format(now, "MMM yyyy", { locale }), months: 0 };
    }
    if (monthly <= 0) {
      return { monthly, projectedCompletion: null, months: 999 };
    }
    const months = Math.ceil(remainingAmount / monthly);
    const date = addMonths(now, months);
    return { monthly, projectedCompletion: format(date, "MMM yyyy", { locale }), months };
  };

  const milestones: GoalMilestone[] = [25, 50, 75, 100].map((pct) => {
    const milestoneTarget = Math.round((targetAmount * pct) / 100);
    const isReached = currentAmount >= milestoneTarget;
    if (isReached) {
      return {
        percentage: pct,
        targetAmount: milestoneTarget,
        isReached: true,
        projectedDate: isId ? "Tercapai" : "Reached",
        monthsAway: 0,
      };
    }
    const neededForMilestone = Math.max(0, milestoneTarget - currentAmount);
    const monthsAway = currentVelocity > 0 ? Math.ceil(neededForMilestone / currentVelocity) : 999;
    const projectedDate = currentVelocity > 0 ? format(addMonths(now, monthsAway), "MMM yyyy", { locale }) : null;
    return {
      percentage: pct,
      targetAmount: milestoneTarget,
      isReached: false,
      projectedDate,
      monthsAway,
    };
  });

  return {
    currentProgressPct,
    remainingAmount,
    currentVelocityMonthly: currentVelocity,
    isAlreadyCompleted,
    milestones,
    velocityPaces: {
      conservative: getPaceResult(conservativeVelocity),
      current: getPaceResult(currentVelocity),
      accelerated: getPaceResult(acceleratedVelocity),
    },
  };
}


// ==========================================
// PHASE III: CASHFLOW INTELLIGENCE & STRUCTURE IMPLEMENTATION
// ==========================================

/**
 * Normalizes merchant/note string for clustering
 */
export function normalizeMerchantTitle(
  note?: string | null,
  categoryName?: string | null,
): string {
  if (!note || note.trim().length === 0) {
    return (categoryName || "Unknown").trim().toLowerCase();
  }
  return note
    .toLowerCase()
    .replace(/[0-9/.:,#-]/g, " ")
    .replace(
      /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|bulan|bln|tagihan|iuran|bayar|tf|trf|via)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * System #1: Deterministic Recurring Transaction Detection
 */
export function detectRecurringTransactions(
  transactions: Transaction[],
  bills: Bill[] = [],
  categories: Category[] = [],
  now = new Date(),
  language: "en" | "id" = "en",
): DetectedRecurringItem[] {
  const isId = language === "id";
  const result: DetectedRecurringItem[] = [];
  const catMap = new Map<string, Category>();
  categories.forEach((c) => catMap.set(c.id, c));
  const catNameMap = new Map<string, Category>();
  categories.forEach((c) => catNameMap.set(c.name.toLowerCase().trim(), c));

  // Filter valid transactions (exclude transfers and balance corrections)
  const validTxs = transactions.filter(
    (t) =>
      t.occurred_on &&
      t.type !== "transfer" &&
      !isCorrectionTx(t) &&
      Number(t.amount) > 0,
  );

  // 1. Group by type and normalized title/category signature
  const clusters = new Map<string, Transaction[]>();
  validTxs.forEach((t) => {
    const catName =
      t.categories?.name ||
      (t.category_id ? catMap.get(t.category_id)?.name : null) ||
      "";
    const normTitle = normalizeMerchantTitle(t.note, catName);
    const key = `${t.type}:${normTitle || catName.toLowerCase()}`;

    if (!clusters.has(key)) {
      clusters.set(key, []);
    }
    clusters.get(key)!.push(t);
  });

  const billTitles = new Set(bills.map((b) => b.title.toLowerCase().trim()));

  // 2. Evaluate each cluster with >= 2 transactions
  clusters.forEach((txList, key) => {
    if (txList.length < 2) return;

    // Sort chronologically ascending
    const sorted = [...txList].sort((a, b) =>
      (a.occurred_on || "").localeCompare(b.occurred_on || ""),
    );
    const amounts = sorted.map((t) => Number(t.amount || 0));
    const medianAmt = calculateMedian(amounts);
    if (medianAmt <= 0) return;

    // Amount tolerance: At least 70% of occurrences must be within 0.70M - 1.30M
    const tolerancePassCount = amounts.filter(
      (a) => a >= medianAmt * 0.7 && a <= medianAmt * 1.3,
    ).length;
    if (tolerancePassCount / amounts.length < 0.65) return;

    // Calculate day intervals between consecutive occurrences
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const d1 = new Date(sorted[i - 1].occurred_on.slice(0, 10) + "T00:00:00Z");
      const d2 = new Date(sorted[i].occurred_on.slice(0, 10) + "T00:00:00Z");
      const diffDays = Math.round(
        (d2.getTime() - d1.getTime()) / (1000 * 3600 * 24),
      );
      if (diffDays > 0) {
        intervals.push(diffDays);
      }
    }

    if (intervals.length === 0) return;
    const medianInterval = calculateMedian(intervals);

    // Detect frequency based on median interval
    let frequency: RecurringFrequency | null = null;
    let expectedDays = 30;

    if (medianInterval >= 5 && medianInterval <= 9) {
      frequency = "weekly";
      expectedDays = 7;
    } else if (medianInterval >= 12 && medianInterval <= 17) {
      frequency = "biweekly";
      expectedDays = 14;
    } else if (medianInterval >= 25 && medianInterval <= 36) {
      frequency = "monthly";
      expectedDays = 30;
    } else if (medianInterval >= 75 && medianInterval <= 105) {
      frequency = "quarterly";
      expectedDays = 90;
    } else if (medianInterval >= 340 && medianInterval <= 390) {
      frequency = "yearly";
      expectedDays = 365;
    }

    if (!frequency) return;

    // Check interval variance
    const maxAllowedVariance = expectedDays * 0.35;
    const varianceCount = intervals.filter(
      (iv) => Math.abs(iv - expectedDays) <= maxAllowedVariance,
    ).length;
    if (varianceCount / intervals.length < 0.6) return;

    // Extract metadata
    const latestTx = sorted[sorted.length - 1];
    const catName =
      latestTx.categories?.name ||
      (latestTx.category_id ? catMap.get(latestTx.category_id)?.name : null) ||
      "Lainnya";
    const catEmoji =
      latestTx.categories?.emoji ||
      (latestTx.category_id ? catMap.get(latestTx.category_id)?.emoji : null) ||
      "/icons/lainnya.png";
    const displayTitle = latestTx.note?.trim() || catName;

    // Next expected date calculation
    const lastDate = new Date(latestTx.occurred_on.slice(0, 10) + "T00:00:00Z");
    const nextDate = new Date(
      lastDate.getTime() + expectedDays * 24 * 3600 * 1000,
    );
    const nextExpectedDate = nextDate.toISOString().slice(0, 10);

    // Check lifecycle status
    const daysSinceLast = Math.round(
      (now.getTime() - lastDate.getTime()) / (1000 * 3600 * 24),
    );
    const isAlreadyInBills =
      billTitles.has(displayTitle.toLowerCase()) ||
      billTitles.has(key.split(":")[1].toLowerCase());

    let status: RecurringStatus = "detected";
    if (isAlreadyInBills) {
      status = "confirmed";
    } else if (daysSinceLast > expectedDays * 2.2 + 10) {
      status = "inactive";
    }

    // Confidence scoring
    let confidence: RecurringConfidence = "moderate";
    if (sorted.length >= 4 && varianceCount / intervals.length >= 0.8) {
      confidence = "strong";
    } else if (sorted.length < 2) {
      confidence = "insufficient";
    }

    if (confidence === "insufficient") return;

    const minAmount = Math.min(...amounts);
    const maxAmount = Math.max(...amounts);

      const freqLabelId: Record<string, string> = {
        weekly: "mingguan",
        biweekly: "dua mingguan",
        monthly: "bulanan",
        quarterly: "triwulanan",
        yearly: "tahunan",
      };
      const freqLabel = isId ? freqLabelId[frequency] || frequency : frequency;
      const cadenceLabel = isId ? (frequency === "monthly" ? "bln" : freqLabel) : (frequency === "monthly" ? "mo" : frequency);

      result.push({
        id: `rec-${key.replace(/[^a-z0-9]/g, "-")}-${frequency}`,
        title: displayTitle,
        normalizedMerchant: key.split(":")[1],
        categoryId: latestTx.category_id || null,
        categoryName: catName,
        categoryEmoji: catEmoji,
        walletId: latestTx.wallet_id || null,
        type: latestTx.type as "expense" | "income",
        frequency,
        typicalAmount: medianAmt,
        amountRange: [minAmount, maxAmount],
        confidence,
        occurrencesCount: sorted.length,
        lastOccurrenceDate: latestTx.occurred_on.slice(0, 10),
        nextExpectedDate,
        status,
        matchingTransactionIds: sorted.map((t) => t.id),
        explanation: isId
          ? `Pola ${freqLabel} terdeteksi dari ${sorted.length} transaksi (~Rp ${medianAmt.toLocaleString("id-ID")}/${cadenceLabel}).`
          : `Recurring ${frequency} pattern observed across ${sorted.length} occurrences (~Rp ${medianAmt.toLocaleString("id-ID")}/${cadenceLabel}).`,
      });
  });

  return result.sort((a, b) => b.typicalAmount - a.typicalAmount);
}

/**
 * Standard classification mapping of Trouvaille categories
 */
export const DEFAULT_CATEGORY_STRUCTURE: Record<string, ExpenseClassification> =
  {
    // Fixed / Committed
    hunian: "fixed",
    papan: "fixed",
    asuransi: "fixed",
    pendidikan: "fixed",
    internet: "fixed",
    subscription: "fixed",
    zakat: "fixed",
    "pajak & legal": "fixed",

    // Variable (Essential Everyday)
    makanan: "variable",
    groceries: "variable",
    transportasi: "variable",
    bensin: "variable",
    parkir: "variable",
    kesehatan: "variable",
    peralatan: "variable",
    reparasi: "variable",
    laundry: "variable",
    keluarga: "variable",
    pets: "variable",
    "admin & fee": "variable",
    jasa: "variable",

    // Discretionary (Flexible Lifestyle)
    hiburan: "discretionary",
    cafe: "discretionary",
    kopi: "discretionary",
    minuman: "discretionary",
    fashion: "discretionary",
    perawatan: "discretionary",
    liburan: "discretionary",
    gadget: "discretionary",
    olahraga: "discretionary",
    hadiah: "discretionary",
    donasi: "discretionary",
    karir: "discretionary",
    kerugian: "discretionary",
  };

/**
 * System #2: Fixed / Variable / Discretionary Expense Structure Calculation
 */
export function calculateExpenseStructure(
  transactions: Transaction[],
  recurringItems: DetectedRecurringItem[] = [],
  overrides: Record<string, ExpenseClassification> = {},
  _now = new Date(),
): ExpenseStructureResult {
  const expenseTxs = transactions.filter(
    (t) => t.type === "expense" && !isCorrectionTx(t),
  );
  const totalExpense = expenseTxs.reduce(
    (s, t) => s + Number(t.amount || 0),
    0,
  );

  // Map category totals
  const catMap = new Map<
    string,
    { categoryId: string; name: string; emoji: string; amount: number }
  >();

  expenseTxs.forEach((t) => {
    const catId = t.category_id || "uncategorized";
    const name = t.categories?.name || "Lainnya";
    const emoji = t.categories?.emoji || "/icons/lainnya.png";
    const amt = Number(t.amount || 0);

    const ex = catMap.get(name.toLowerCase().trim());
    if (ex) {
      ex.amount += amt;
    } else {
      catMap.set(name.toLowerCase().trim(), {
        categoryId: catId,
        name,
        emoji,
        amount: amt,
      });
    }
  });

  const recurringCategoryNames = new Set(
    recurringItems
      .filter(
        (r) =>
          r.type === "expense" &&
          (r.status === "confirmed" || r.status === "detected"),
      )
      .map((r) => r.categoryName.toLowerCase().trim()),
  );

  const items: ExpenseStructureCategoryItem[] = [];
  let fixedAmount = 0;
  let variableAmount = 0;
  let discretionaryAmount = 0;
  let unclassifiedAmount = 0;

  catMap.forEach((data, catKey) => {
    let classification: ExpenseClassification = "unclassified";
    let isUserOverridden = false;

    if (overrides[catKey]) {
      classification = overrides[catKey];
      isUserOverridden = true;
    } else if (DEFAULT_CATEGORY_STRUCTURE[catKey]) {
      classification = DEFAULT_CATEGORY_STRUCTURE[catKey];
    } else if (recurringCategoryNames.has(catKey)) {
      classification = "fixed";
    } else {
      classification = "variable";
    }

    const pct =
      totalExpense > 0
        ? Number(((data.amount / totalExpense) * 100).toFixed(1))
        : 0;

    if (classification === "fixed") fixedAmount += data.amount;
    else if (classification === "variable") variableAmount += data.amount;
    else if (classification === "discretionary")
      discretionaryAmount += data.amount;
    else unclassifiedAmount += data.amount;

    items.push({
      categoryId: data.categoryId,
      name: data.name,
      emoji: data.emoji,
      classification,
      amount: data.amount,
      percentage: pct,
      isUserOverridden,
    });
  });

  // Mathematical invariant check
  const reconciledSum =
    fixedAmount + variableAmount + discretionaryAmount + unclassifiedAmount;
  const reconciliationCheck = reconciledSum === totalExpense;

  const fixedPct =
    totalExpense > 0
      ? Number(((fixedAmount / totalExpense) * 100).toFixed(1))
      : 0;
  const varPct =
    totalExpense > 0
      ? Number(((variableAmount / totalExpense) * 100).toFixed(1))
      : 0;
  const discPct =
    totalExpense > 0
      ? Number(((discretionaryAmount / totalExpense) * 100).toFixed(1))
      : 0;
  const unclassPct =
    totalExpense > 0
      ? Number(((unclassifiedAmount / totalExpense) * 100).toFixed(1))
      : 0;

  const committedAmount = fixedAmount;
  const flexibleAmount = variableAmount + discretionaryAmount;
  const committedPercentage = fixedPct;
  const flexiblePercentage = Number((varPct + discPct).toFixed(1));

  return {
    totalExpense,
    fixedAmount,
    fixedPercentage: fixedPct,
    variableAmount,
    variablePercentage: varPct,
    discretionaryAmount,
    discretionaryPercentage: discPct,
    unclassifiedAmount,
    unclassifiedPercentage: unclassPct,
    committedAmount,
    flexibleAmount,
    committedPercentage,
    flexiblePercentage,
    items: items.sort((a, b) => b.amount - a.amount),
    reconciliationCheck,
  };
}

/**
 * System #3: Cashflow Calendar & Cashflow Floor Calculation
 */
export function calculateCashflowFloor(
  currentLiquidBalance: number,
  bills: Bill[] = [],
  recurringItems: DetectedRecurringItem[] = [],
  horizonDays = 14,
  now = new Date(),
  language: "en" | "id" = "en",
): CashflowFloorResult {
  const isId = language === "id";
  const dailyPoints: CashflowCalendarDayPoint[] = [];
  let runningBalance = currentLiquidBalance;
  let lowestBalance = currentLiquidBalance;
  let lowestBalanceDate = now.toISOString().slice(0, 10);
  let daysUntilLowest = 0;
  let upcomingCommitmentsTotal = 0;
  let upcomingInflowsTotal = 0;

  const todayStr = now.toISOString().slice(0, 10);
  const todayTime = new Date(todayStr + "T00:00:00Z").getTime();

  // Track bills and recurring items
  const unpaidBills = bills.filter((b) => !b.is_paid && b.due_date);
  const activeRecurring = recurringItems.filter(
    (r) => r.status === "confirmed" || r.status === "detected",
  );

  const dayNamesEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayNamesId = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const monthNamesEn = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const monthNamesId = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
  ];

  for (let offset = 0; offset < horizonDays; offset++) {
    const pointDate = new Date(todayTime + offset * 24 * 3600 * 1000);
    const dateStr = pointDate.toISOString().slice(0, 10);
    const isToday = offset === 0;
    const dayOfMonth = pointDate.getUTCDate();
    const dayName = isId
      ? dayNamesId[pointDate.getUTCDay()]
      : dayNamesEn[pointDate.getUTCDay()];
    const monthName = isId
      ? monthNamesId[pointDate.getUTCMonth()]
      : monthNamesEn[pointDate.getUTCMonth()];
    const dayLabel = isId
      ? `${dayName}, ${dayOfMonth} ${monthName}`
      : `${dayName}, ${monthName} ${dayOfMonth}`;

    const knownInflowItems: Array<{ title: string; amount: number }> = [];
    const knownOutflowItems: Array<{
      title: string;
      amount: number;
      isBill: boolean;
    }> = [];

    // 1. Check unpaid bills due on dateStr
    unpaidBills.forEach((b) => {
      if (b.due_date === dateStr) {
        const amt = Number(b.amount || 0);
        knownOutflowItems.push({ title: b.title, amount: amt, isBill: true });
      }
    });

    // 2. Check recurring items expected on dateStr (avoiding duplicate titles already in bills)
    activeRecurring.forEach((r) => {
      if (
        r.nextExpectedDate === dateStr &&
        !knownOutflowItems.some(
          (o) => o.title.toLowerCase() === r.title.toLowerCase(),
        )
      ) {
        if (r.type === "expense") {
          knownOutflowItems.push({
            title: r.title,
            amount: r.typicalAmount,
            isBill: false,
          });
        } else if (r.type === "income") {
          knownInflowItems.push({ title: r.title, amount: r.typicalAmount });
        }
      }
    });

    const dayInflow = knownInflowItems.reduce((s, i) => s + i.amount, 0);
    const dayOutflow = knownOutflowItems.reduce((s, o) => s + o.amount, 0);
    const netDaily = dayInflow - dayOutflow;

    upcomingInflowsTotal += dayInflow;
    upcomingCommitmentsTotal += dayOutflow;

    runningBalance += netDaily;

    if (runningBalance < lowestBalance) {
      lowestBalance = runningBalance;
      lowestBalanceDate = dateStr;
      daysUntilLowest = offset;
    }

    dailyPoints.push({
      date: dateStr,
      dayLabel,
      dayOfMonth,
      isToday,
      isPast: false,
      knownInflow: dayInflow,
      knownInflowItems,
      knownOutflow: dayOutflow,
      knownOutflowItems,
      netDailyCashflow: netDaily,
      projectedBalance: runningBalance,
    });
  }

  const netProjectedChange = runningBalance - currentLiquidBalance;

  return {
    lowestBalance,
    lowestBalanceDate,
    daysUntilLowest,
    currentBalance: currentLiquidBalance,
    netProjectedChange,
    forecastDaysCount: horizonDays,
    dailyPoints,
    upcomingCommitmentsTotal,
    upcomingInflowsTotal,
  };
}

/**
 * System #4: Liquidity Horizon Calculation
 */
export function calculateLiquidityHorizon(
  liquidAssets: number,
  baselines: PersonalBaselineResult,
  expenseStructure?: ExpenseStructureResult,
  liquidAccounts: Array<{ name: string; balance: number; icon: string }> = [],
  language: "en" | "id" = "en",
): LiquidityHorizonResult {
  const isId = language === "id";
  if (baselines.status === "insufficient" || liquidAssets < 0) {
    return {
      status: "insufficient",
      liquidAssets: Math.max(0, liquidAssets),
      liquidAccounts,
      typicalMonthlyOutflow: 0,
      typicalCommittedOutflow: 0,
      totalCoverageMonths: 0,
      committedCoverageMonths: 0,
      coverageText: isId
        ? "Garis dasar historis belum memadai"
        : "Insufficient historical baseline",
      committedCoverageText: isId
        ? "Garis dasar historis belum memadai"
        : "Insufficient historical baseline",
      resilienceTier: "MODERATE",
      explanation: isId
        ? "Kumpulkan riwayat pengeluaran minimal selama dua siklus bulanan penuh untuk menetapkan cakupan likuiditas yang andal."
        : "Build more spending history across at least two completed monthly cycles to establish reliable liquidity coverage.",
    };
  }

  const typicalMonthlyOutflow =
    baselines.medianExpense > 0 ? baselines.medianExpense : 1;
  const typicalCommittedOutflow =
    expenseStructure && expenseStructure.fixedAmount > 0
      ? expenseStructure.fixedAmount
      : Math.max(1, Math.round(typicalMonthlyOutflow * 0.45));

  const totalCoverageMonths = Number(
    (liquidAssets / typicalMonthlyOutflow).toFixed(1),
  );
  const committedCoverageMonths = Number(
    (liquidAssets / typicalCommittedOutflow).toFixed(1),
  );

  let resilienceTier:
    | "CRITICAL"
    | "LOW"
    | "MODERATE"
    | "HEALTHY"
    | "STRONG"
    | "EXCEPTIONAL" = "HEALTHY";
  let explanation = isId
    ? `Kas likuid Anda sebesar Rp ${liquidAssets.toLocaleString("id-ID")} mencakup ${totalCoverageMonths} bulan pengeluaran tipikal.`
    : `Your current liquid cash of Rp ${liquidAssets.toLocaleString("id-ID")} covers ${totalCoverageMonths} months of typical spending.`;

  if (totalCoverageMonths < 1.0) {
    resilienceTier = "CRITICAL";
    explanation = isId
      ? `Cadangan likuid (Rp ${liquidAssets.toLocaleString("id-ID")}) menutupi kurang dari 1 bulan pengeluaran tipikal (~Rp ${typicalMonthlyOutflow.toLocaleString("id-ID")}/bln).`
      : `Liquid reserves (Rp ${liquidAssets.toLocaleString("id-ID")}) cover less than 1 month of recent typical outflows (~Rp ${typicalMonthlyOutflow.toLocaleString("id-ID")}/mo).`;
  } else if (totalCoverageMonths < 2.0) {
    resilienceTier = "LOW";
    explanation = isId
      ? `Cadangan likuid menutupi ${totalCoverageMonths} bulan pengeluaran tipikal. Disarankan untuk menambah buffer kas.`
      : `Liquid reserves cover ${totalCoverageMonths} months of typical spending. Building an additional cash buffer is recommended.`;
  } else if (totalCoverageMonths < 3.0) {
    resilienceTier = "MODERATE";
    explanation = isId
      ? `Cadangan likuid menutupi ${totalCoverageMonths} bulan pengeluaran tipikal (${committedCoverageMonths} bulan biaya komitmen tetap).`
      : `Liquid reserves cover ${totalCoverageMonths} months of typical total spending (${committedCoverageMonths} months of essential fixed costs).`;
  } else if (totalCoverageMonths < 6.0) {
    resilienceTier = "HEALTHY";
    explanation = isId
      ? `Cakupan likuiditas solid. Cadangan saat ini menopang operasional selama ${totalCoverageMonths} bulan tanpa pemasukan baru.`
      : `Solid liquidity coverage. Current reserves support ${totalCoverageMonths} months of operations without new income.`;
  } else if (totalCoverageMonths < 12.0) {
    resilienceTier = "STRONG";
    explanation = isId
      ? `Ketahanan modal tinggi. Aset likuid menutupi ${totalCoverageMonths} bulan pengeluaran tipikal.`
      : `High capital resilience. Liquid assets cover ${totalCoverageMonths} months of typical expenses.`;
  } else {
    resilienceTier = "EXCEPTIONAL";
    explanation = isId
      ? `Runway likuiditas luar biasa (${totalCoverageMonths} bulan cakupan total, ${committedCoverageMonths} bulan cakupan komitmen).`
      : `Exceptional liquidity runway (${totalCoverageMonths} months total coverage, ${committedCoverageMonths} months committed coverage).`;
  }

  return {
    status: "sufficient",
    liquidAssets,
    liquidAccounts,
    typicalMonthlyOutflow,
    typicalCommittedOutflow,
    totalCoverageMonths,
    committedCoverageMonths,
    coverageText: isId
      ? `${totalCoverageMonths} bulan pengeluaran tipikal`
      : `${totalCoverageMonths} months of typical spending`,
    committedCoverageText: isId
      ? `${committedCoverageMonths} bulan komitmen rutin esensial`
      : `${committedCoverageMonths} months of essential commitments`,
    resilienceTier,
    explanation,
  };
}

/**
 * System #5: Expense Volatility & Spending Stability Analysis
 * Measures daily spending fluctuation (standard deviation & coefficient of variation)
 * to distinguish consistent run-rates from erratic cashflow spikes.
 */
export interface ExpenseVolatilityResult {
  status: "sufficient" | "insufficient";
  stability: "STABLE" | "MODERATE" | "VOLATILE";
  score: number; // 0 to 100 stability score (100 = perfectly predictable)
  coefficientOfVariation: number;
  meanDailyExpense: number;
  standardDeviation: number;
  peakDailyExpense: number;
  peakDate: string | null;
  activeDaysCount: number;
  totalDaysInPeriod: number;
  totalExpense: number;
  reason: string;
  explanation: string;
}

export function calculateExpenseVolatility(
  transactions: Transaction[],
  now: Date = new Date(),
  language: "en" | "id" = "en",
): ExpenseVolatilityResult {
  const isId = language === "id";
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();
  const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;

  // Filter current month expenses (excluding balance corrections and transfers)
  const currentMonthExpenses = transactions.filter((t) => {
    if (t.type !== "expense") return false;
    if (isCorrectionTx(t)) return false;
    if (!t.occurred_on) return false;
    return t.occurred_on.startsWith(monthKey);
  });

  const totalDays = Math.max(1, currentDay);

  // Group by day of month (1 to currentDay)
  const dailySpendMap = new Map<string, number>();
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${monthKey}-${String(d).padStart(2, "0")}`;
    dailySpendMap.set(dateStr, 0);
  }

  let totalExpense = 0;
  let activeDaysCount = 0;

  currentMonthExpenses.forEach((t) => {
    const dateStr = t.occurred_on.slice(0, 10);
    if (dailySpendMap.has(dateStr)) {
      const amt = Number(t.amount || 0);
      dailySpendMap.set(dateStr, (dailySpendMap.get(dateStr) || 0) + amt);
    }
  });

  let peakDailyExpense = 0;
  let peakDate: string | null = null;
  const dailyAmounts: number[] = [];

  for (const [dateStr, amount] of dailySpendMap.entries()) {
    dailyAmounts.push(amount);
    totalExpense += amount;
    if (amount > 0) activeDaysCount++;
    if (amount > peakDailyExpense) {
      peakDailyExpense = amount;
      peakDate = dateStr;
    }
  }

  // Data sufficiency check: need at least 3 days elapsed and some spending
  if (totalDays < 3 || totalExpense === 0) {
    return {
      status: "insufficient",
      stability: "STABLE",
      score: 100,
      coefficientOfVariation: 0,
      meanDailyExpense: totalDays > 0 ? Math.round(totalExpense / totalDays) : 0,
      standardDeviation: 0,
      peakDailyExpense,
      peakDate,
      activeDaysCount,
      totalDaysInPeriod: totalDays,
      totalExpense,
      reason: isId
        ? "Data pengeluaran harian belum cukup untuk menghitung volatilitas."
        : "Not enough daily expense data to calculate volatility yet.",
      explanation: isId
        ? "Stabilitas pengeluaran melacak seberapa merata pengeluaran harian Anda dibandingkan dengan garis dasar normal."
        : "Spending stability tracks how evenly your daily outflows occur compared to baseline spending.",
    };
  }

  const meanDailyExpense = totalExpense / totalDays;
  const variance =
    dailyAmounts.reduce((sum, amt) => sum + Math.pow(amt - meanDailyExpense, 2), 0) /
    totalDays;
  const standardDeviation = Math.sqrt(variance);
  const cv = meanDailyExpense > 0 ? standardDeviation / meanDailyExpense : 0;

  // Normalized stability score (100 = perfectly flat run-rate, 0 = extreme single-day spike)
  const score = Math.max(
    10,
    Math.min(100, Math.round(100 / (1 + cv * 0.75))),
  );

  let stability: "STABLE" | "MODERATE" | "VOLATILE" = "STABLE";
  let reason = "";

  const peakDateFormatted = peakDate
    ? format(new Date(peakDate), isId ? "d MMM" : "MMM d", {
        locale: isId ? idLocale : undefined,
      })
    : "";

  if (cv < 0.85) {
    stability = "STABLE";
    reason = isId
      ? `Laju harian konsisten sekitar ${formatRupiah(Math.round(meanDailyExpense))}/hari dengan ayunan tak terduga yang minimal.`
      : `Consistent daily run-rate around ${formatRupiah(Math.round(meanDailyExpense))}/day with minimal unexpected swings.`;
  } else if (cv <= 1.6) {
    stability = "MODERATE";
    if (peakDailyExpense > meanDailyExpense * 2.2) {
      reason = isId
        ? `Pengeluaran harian menunjukkan variasi moderat, dengan puncak ${formatRupiah(peakDailyExpense)} pada ${peakDateFormatted}.`
        : `Daily spending shows moderate variation, with a peak of ${formatRupiah(peakDailyExpense)} on ${peakDateFormatted}.`;
    } else {
      reason = isId
        ? "Pengeluaran harian menunjukkan fluktuasi moderat antara hari sibuk dan hari tenang."
        : "Daily spending shows moderate fluctuation between busy days and quiet days.";
    }
  } else {
    stability = "VOLATILE";
    if (peakDailyExpense > meanDailyExpense * 3) {
      reason = isId
        ? `Pengeluaran harian Anda berfluktuasi lebih dari biasanya bulan ini, dipicu puncak ${formatRupiah(peakDailyExpense)} pada ${peakDateFormatted}.`
        : `Your daily spending fluctuated more than usual this month, driven by a ${formatRupiah(peakDailyExpense)} peak on ${peakDateFormatted}.`;
    } else {
      reason = isId
        ? "Pengeluaran harian Anda berfluktuasi signifikan bulan ini dengan pengeluaran besar yang tidak teratur."
        : "Your daily spending fluctuated significantly this month with irregular large outlays.";
    }
  }

  return {
    status: "sufficient",
    stability,
    score,
    coefficientOfVariation: Number(cv.toFixed(2)),
    meanDailyExpense: Math.round(meanDailyExpense),
    standardDeviation: Math.round(standardDeviation),
    peakDailyExpense,
    peakDate,
    activeDaysCount,
    totalDaysInPeriod: totalDays,
    totalExpense,
    reason,
    explanation: isId
      ? "Stabilitas pengeluaran membedakan biaya hidup dasar tinggi dari lonjakan arus kas yang tidak terduga. Pengeluaran yang stabil memungkinkan prakiraan arus kas yang akurat."
      : "Spending stability distinguishes high baseline living costs from unpredictable cashflow spikes. Stable spending allows accurate cashflow forecasting.",
  };
}

// ==========================================
// Innovation No. 6: Debt Payoff Simulator
// Snowball (Smallest Balance) vs Avalanche (Highest APR)
// ==========================================

export interface DebtItem {
  id: string;
  name: string;
  balance: number; // remaining principal in IDR
  minPayment: number; // monthly minimum required payment
  interestRate: number; // Annual Percentage Rate (APR %, e.g. 18 for 18%)
}

export interface DebtPayoffMonthlyStep {
  month: number;
  totalRemainingBalance: number;
  totalInterestPaidSoFar: number;
  paidOffDebts: string[];
}

export interface DebtStrategyResult {
  strategy: "snowball" | "avalanche";
  totalMonths: number;
  totalInterest: number;
  totalPaid: number;
  schedule: DebtPayoffMonthlyStep[];
  debtPayoffOrder: { id: string; name: string; paidMonth: number }[];
}

export interface DebtPayoffComparison {
  snowball: DebtStrategyResult;
  avalanche: DebtStrategyResult;
  interestSaved: number;
  monthsSaved: number;
  totalInitialDebt: number;
  totalMinPayment: number;
}

function simulateSingleDebtStrategy(
  debts: DebtItem[],
  extraMonthlyPayment: number,
  strategy: "snowball" | "avalanche"
): DebtStrategyResult {
  const simDebts = debts.map((d) => ({
    id: d.id,
    name: d.name,
    balance: d.balance,
    minPayment: d.minPayment,
    interestRate: d.interestRate,
    paidMonth: 0,
  }));

  const schedule: DebtPayoffMonthlyStep[] = [];
  const debtPayoffOrder: { id: string; name: string; paidMonth: number }[] = [];
  let cumulativeInterest = 0;
  let currentMonth = 0;
  const MAX_MONTHS = 360; // Cap at 30 years to avoid runaway infinite loops

  while (currentMonth < MAX_MONTHS) {
    const activeDebts = simDebts.filter((d) => d.balance > 0.01);
    if (activeDebts.length === 0) break;

    currentMonth += 1;
    const debtsPaidThisMonth: string[] = [];

    // 1. Accrue monthly interest on all active debts
    for (const debt of activeDebts) {
      const monthlyRate = debt.interestRate / 100 / 12;
      const interest = debt.balance * monthlyRate;
      debt.balance += interest;
      cumulativeInterest += interest;
    }

    // 2. Pay minimum payments first
    let availableRollover = Math.max(0, extraMonthlyPayment);

    // Sum of minimum payments of fully paid debts gets rolled over
    for (const debt of simDebts) {
      if (debt.balance <= 0.01) {
        availableRollover += debt.minPayment;
      }
    }

    for (const debt of activeDebts) {
      const payment = Math.min(debt.balance, debt.minPayment);
      debt.balance -= payment;
      // If balance was less than minPayment, remaining minPayment joins rollover pool
      if (debt.minPayment > payment) {
        availableRollover += debt.minPayment - payment;
      }
      if (debt.balance <= 0.01) {
        debt.balance = 0;
        if (!debt.paidMonth) {
          debt.paidMonth = currentMonth;
          debtPayoffOrder.push({ id: debt.id, name: debt.name, paidMonth: currentMonth });
          debtsPaidThisMonth.push(debt.name);
        }
      }
    }

    // 3. Apply rollover extra budget to prioritized target debt
    const stillActive = simDebts.filter((d) => d.balance > 0.01);
    if (stillActive.length > 0 && availableRollover > 0.01) {
      if (strategy === "snowball") {
        // Smallest remaining balance first
        stillActive.sort((a, b) => a.balance - b.balance);
      } else {
        // Highest APR interest rate first
        stillActive.sort((a, b) => b.interestRate - a.interestRate);
      }

      for (const target of stillActive) {
        if (availableRollover <= 0.01) break;
        const extraPay = Math.min(target.balance, availableRollover);
        target.balance -= extraPay;
        availableRollover -= extraPay;

        if (target.balance <= 0.01) {
          target.balance = 0;
          if (!target.paidMonth) {
            target.paidMonth = currentMonth;
            debtPayoffOrder.push({ id: target.id, name: target.name, paidMonth: currentMonth });
            debtsPaidThisMonth.push(target.name);
          }
        }
      }
    }

    const remainingSum = simDebts.reduce((sum, d) => sum + (d.balance > 0 ? d.balance : 0), 0);
    schedule.push({
      month: currentMonth,
      totalRemainingBalance: Math.round(remainingSum),
      totalInterestPaidSoFar: Math.round(cumulativeInterest),
      paidOffDebts: debtsPaidThisMonth,
    });

    if (remainingSum <= 0.01) break;
  }

  const totalInitialPrincipal = debts.reduce((sum, d) => sum + d.balance, 0);

  return {
    strategy,
    totalMonths: currentMonth,
    totalInterest: Math.round(cumulativeInterest),
    totalPaid: Math.round(totalInitialPrincipal + cumulativeInterest),
    schedule,
    debtPayoffOrder,
  };
}

export function calculateDebtPayoffSchedule(
  debts: DebtItem[],
  extraMonthlyPayment: number = 0
): DebtPayoffComparison {
  const validDebts = debts.filter((d) => d.balance > 0 && d.minPayment > 0);
  const totalInitialDebt = validDebts.reduce((sum, d) => sum + d.balance, 0);
  const totalMinPayment = validDebts.reduce((sum, d) => sum + d.minPayment, 0);

  if (validDebts.length === 0) {
    const emptyResult: DebtStrategyResult = {
      strategy: "snowball",
      totalMonths: 0,
      totalInterest: 0,
      totalPaid: 0,
      schedule: [],
      debtPayoffOrder: [],
    };
    return {
      snowball: emptyResult,
      avalanche: { ...emptyResult, strategy: "avalanche" },
      interestSaved: 0,
      monthsSaved: 0,
      totalInitialDebt: 0,
      totalMinPayment: 0,
    };
  }

  const snowball = simulateSingleDebtStrategy(validDebts, extraMonthlyPayment, "snowball");
  const avalanche = simulateSingleDebtStrategy(validDebts, extraMonthlyPayment, "avalanche");

  const interestSaved = Math.max(0, snowball.totalInterest - avalanche.totalInterest);
  const monthsSaved = Math.max(0, snowball.totalMonths - avalanche.totalMonths);

  return {
    snowball,
    avalanche,
    interestSaved,
    monthsSaved,
    totalInitialDebt: Math.round(totalInitialDebt),
    totalMinPayment: Math.round(totalMinPayment),
  };
}

export interface BudgetPeriodInterval {
  startDate: Date;
  endDate: Date;
  startDay: number;
  daysElapsed: number;
  totalDays: number;
  daysRemaining: number;
  label: string;
}

export function getBudgetPeriodInterval(
  referenceDate: Date = new Date(),
  rawStartDay: number = 1
): BudgetPeriodInterval {
  const startDay = Math.max(1, Math.min(28, Math.floor(rawStartDay || 1)));
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  const refDay = referenceDate.getDate();

  let startDate: Date;
  let endDate: Date;

  if (startDay === 1) {
    startDate = new Date(refYear, refMonth, 1, 0, 0, 0, 0);
    endDate = new Date(refYear, refMonth + 1, 0, 23, 59, 59, 999);
  } else {
    if (refDay >= startDay) {
      startDate = new Date(refYear, refMonth, startDay, 0, 0, 0, 0);
      endDate = new Date(refYear, refMonth + 1, startDay - 1, 23, 59, 59, 999);
    } else {
      startDate = new Date(refYear, refMonth - 1, startDay, 0, 0, 0, 0);
      endDate = new Date(refYear, refMonth, startDay - 1, 23, 59, 59, 999);
    }
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / msPerDay);
  
  const now = new Date();
  const targetDate = referenceDate > now ? referenceDate : now;
  const clampedTarget = new Date(
    Math.max(startDate.getTime(), Math.min(endDate.getTime(), targetDate.getTime()))
  );
  const daysElapsed = Math.max(
    1,
    Math.min(totalDays, Math.ceil((clampedTarget.getTime() - startDate.getTime()) / msPerDay))
  );
  const daysRemaining = Math.max(0, totalDays - daysElapsed);

  const startFormatted = format(startDate, "d MMM");
  const endFormatted = format(endDate, "d MMM yyyy");
  const label = `${startFormatted} – ${endFormatted}`;

  return {
    startDate,
    endDate,
    startDay,
    daysElapsed,
    totalDays,
    daysRemaining,
    label,
  };
}

export function filterTransactionsByBudgetPeriod(
  transactions: Transaction[],
  interval: BudgetPeriodInterval
): Transaction[] {
  const startMs = interval.startDate.getTime();
  const endMs = interval.endDate.getTime();

  return transactions.filter((tx) => {
    const raw = tx.occurred_on || tx.created_at;
    if (!raw) return false;
    const txTime = raw.length === 10
      ? new Date(`${raw}T12:00:00`).getTime()
      : new Date(raw).getTime();
    return !isNaN(txTime) && txTime >= startMs && txTime <= endMs;
  });
}


