import type {
  Transaction,
  Wallet,
  Category,
  AccountClassification,
  InvestmentHolding,
} from "./types";
import { resolveWalletClassification } from "../hooks/useWallets";
import { getCategoryCashflowNature } from "../hooks/useCategories";
import { isCorrectionTx, calculateWalletBalances } from "./financialMath";
import { calculateHoldingValuation } from "./marketPriceService";

// ======================================================================
// INTERFACES & ACCOUNTING TYPES
// ======================================================================

export interface BalanceSheetItem {
  id: string;
  name: string;
  icon: string;
  balance: number;
  classification: AccountClassification;
  percentageOfTotal: number;
}

export interface BalanceSheetGroup {
  title: string;
  classification: AccountClassification;
  total: number;
  items: BalanceSheetItem[];
}

export interface BalanceSheetStatement {
  // ASSETS (Aset)
  liquidAssets: BalanceSheetGroup;       // Cash, Bank, E-Wallets
  investmentAssets: BalanceSheetGroup;   // Saham, Crypto, Reksadana, Deposito
  receivableAssets: BalanceSheetGroup;   // Piutang / Pinjaman diberikan
  totalAssets: number;

  // LIABILITIES (Liabilitas)
  currentLiabilities: BalanceSheetGroup; // Kartu Kredit, PayLater, Overdrafts
  longTermLiabilities: BalanceSheetGroup;// Pinjaman, KPR, Liabilities
  totalLiabilities: number;

  // EQUITY / NET WORTH (Ekuitas)
  netWorth: number; // totalAssets - totalLiabilities

  // ACCOUNTING INVARIANT CHECK
  // Invariant: Assets === Liabilities + Equity
  isBalanced: boolean;
  discrepancy: number; // totalAssets - (totalLiabilities + netWorth)

  // Contextual Historical Metadata
  asOfDate?: string;
  uninitializedAccounts?: string[];
  isHistoricalPeriod?: boolean;
}

export interface CashFlowActivityItem {
  id: string;
  name: string;
  emoji: string;
  inflow: number;
  outflow: number;
  net: number;
  txCount: number;
}

export interface CashFlowStatement {
  periodLabel: string;
  startDate: string;
  endDate: string;

  // 1. Operating Activities (OCF)
  operatingInflow: number;
  operatingOutflow: number;
  netOperatingCashFlow: number;
  operatingItems: CashFlowActivityItem[];

  // 2. Investing Activities (ICF)
  investingInflow: number;
  investingOutflow: number;
  netInvestingCashFlow: number;
  investingItems: CashFlowActivityItem[];

  // 3. Financing Activities (FCF)
  financingInflow: number;
  financingOutflow: number;
  netFinancingCashFlow: number;
  financingItems: CashFlowActivityItem[];

  // Summary
  totalInflow: number;
  totalOutflow: number;
  netCashFlow: number; // OCF + ICF + FCF
}

export interface MaterialTransactionDisclosure {
  id: string;
  note: string;
  categoryName: string;
  amount: number;
  date: string;
  percentageOfTotalExpense: number;
}

export interface CALKReport {
  periodLabel: string;
  solvencyRunwayMonths: number;
  solvencyRunwayRating: "fortress" | "optimal" | "caution" | "critical";
  solvencyDescription: string;

  debtToAssetRatioPct: number;
  debtRating: "debt-free" | "conservative" | "moderate" | "elevated";
  debtDescription: string;

  freeCashflowRatePct: number;
  freeCashflowRating: "superior" | "healthy" | "tight" | "deficit";
  freeCashflowDescription: string;

  materialTransactions: MaterialTransactionDisclosure[];

  reconciliation: {
    assetsEqualLiabilitiesPlusEquity: boolean;
    discrepancyAmount: number;
    auditStatus: "CERTIFIED_BALANCED" | "AUDIT_WARNING";
    notes: string;
  };
}

export interface FinancialReportPackage {
  balanceSheet: BalanceSheetStatement;
  cashFlow: CashFlowStatement;
  calk: CALKReport;
}

// ======================================================================
// PURE CALCULATION: BALANCE SHEET (NERACA)
// ======================================================================

export function calculateBalanceSheet(
  wallets: Wallet[],
  transactions: Transaction[],
  allTransactions?: Transaction[],
  options: {
    endDate?: string;
    holdings?: InvestmentHolding[];
  } = {},
): BalanceSheetStatement {
  // 1. Calculate raw balances per wallet using the central calculateWalletBalances engine
  const walletBalances = calculateWalletBalances(transactions, wallets);
  const balanceMap = new Map<string, number>();

  wallets.forEach((w) => {
    const bal =
      walletBalances.balancesById[w.id] ??
      walletBalances.balancesByName[w.name.trim().toLowerCase()] ??
      0;
    balanceMap.set(w.id, bal);
  });

  // 2. Classify into balance sheet groups
  const liquidItems: BalanceSheetItem[] = [];
  const investmentItems: BalanceSheetItem[] = [];
  const receivableItems: BalanceSheetItem[] = [];
  const currentLiabilityItems: BalanceSheetItem[] = [];
  const longTermLiabilityItems: BalanceSheetItem[] = [];

  let totalLiquid = 0;
  let totalInvestment = 0;
  let totalReceivable = 0;
  let totalCurrentLiabilities = 0;
  let totalLongTermLiabilities = 0;

  wallets.forEach((w) => {
    const rawBal = balanceMap.get(w.id) || 0;
    const classification = resolveWalletClassification(w);

    if (classification === "credit") {
      const debtAmount = rawBal < 0 ? Math.abs(rawBal) : (rawBal > 0 ? rawBal : 0);
      if (debtAmount > 0) {
        currentLiabilityItems.push({
          id: w.id,
          name: w.name,
          icon: w.icon,
          balance: debtAmount,
          classification: "credit",
          percentageOfTotal: 0,
        });
        totalCurrentLiabilities += debtAmount;
      }
    } else if (classification === "loan") {
      const debtAmount = rawBal < 0 ? Math.abs(rawBal) : (rawBal > 0 ? rawBal : 0);
      if (debtAmount > 0) {
        longTermLiabilityItems.push({
          id: w.id,
          name: w.name,
          icon: w.icon,
          balance: debtAmount,
          classification: "loan",
          percentageOfTotal: 0,
        });
        totalLongTermLiabilities += debtAmount;
      }
    } else {
      // Liquid, Investment, Receivable: purely assets.
      // Deficits in liquid accounts represent operating ledger deficits, not credit loans.
      const assetBal = Math.max(0, rawBal);
      const item: BalanceSheetItem = {
        id: w.id,
        name: w.name,
        icon: w.icon,
        balance: assetBal,
        classification,
        percentageOfTotal: 0,
      };

      if (classification === "investment" || classification === "fixed_asset") {
        investmentItems.push(item);
        totalInvestment += assetBal;
      } else if (classification === "receivable") {
        receivableItems.push(item);
        totalReceivable += assetBal;
      } else {
        liquidItems.push(item);
        totalLiquid += assetBal;
      }
    }
  });

  if (options.holdings && options.holdings.length > 0) {
    options.holdings.forEach((h) => {
      if (Number(h.units || 0) <= 0) return;
      const val = calculateHoldingValuation(h);
      const holdingBal = Math.max(0, val.marketValue);
      if (holdingBal > 0) {
        investmentItems.push({
          id: h.id,
          name: `${h.name}${h.symbol ? ` (${h.symbol})` : ""}`,
          icon: h.icon || "TrendingUp",
          balance: holdingBal,
          classification: "investment",
          percentageOfTotal: 0,
        });
        totalInvestment += holdingBal;
      }
    });
  }

  const totalAssets = totalLiquid + totalInvestment + totalReceivable;
  const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;
  const netWorth = totalAssets - totalLiabilities;

  liquidItems.forEach((it) => {
    it.percentageOfTotal = totalAssets > 0 ? (it.balance / totalAssets) * 100 : 0;
  });
  investmentItems.forEach((it) => {
    it.percentageOfTotal = totalAssets > 0 ? (it.balance / totalAssets) * 100 : 0;
  });
  receivableItems.forEach((it) => {
    it.percentageOfTotal = totalAssets > 0 ? (it.balance / totalAssets) * 100 : 0;
  });
  currentLiabilityItems.forEach((it) => {
    it.percentageOfTotal =
      totalLiabilities > 0 ? (it.balance / totalLiabilities) * 100 : 0;
  });
  longTermLiabilityItems.forEach((it) => {
    it.percentageOfTotal =
      totalLiabilities > 0 ? (it.balance / totalLiabilities) * 100 : 0;
  });

  liquidItems.sort((a, b) => b.balance - a.balance);
  investmentItems.sort((a, b) => b.balance - a.balance);
  receivableItems.sort((a, b) => b.balance - a.balance);
  currentLiabilityItems.sort((a, b) => b.balance - a.balance);
  longTermLiabilityItems.sort((a, b) => b.balance - a.balance);

  const discrepancy = totalAssets - (totalLiabilities + netWorth);
  const isBalanced = Math.abs(discrepancy) < 0.001;

  const uninitializedAccounts: string[] = [];
  const endStr = options.endDate ? options.endDate.slice(0, 10) : "";
  const isHistorical = !!endStr && endStr < new Date().toISOString().slice(0, 10);

  if (isHistorical && allTransactions && allTransactions.length > 0) {
    wallets.forEach((w) => {
      const balAtEnd = balanceMap.get(w.id) || 0;
      if (balAtEnd === 0) {
        const hasLaterTx = allTransactions.some((tx) => {
          const tDate = (tx.occurred_on || tx.created_at || "").slice(0, 10);
          return (
            tDate > endStr &&
            (tx.wallet_id === w.id ||
              tx.to_wallet_id === w.id ||
              (tx.note && tx.note.toLowerCase().includes(w.name.toLowerCase())))
          );
        });
        if (hasLaterTx) {
          uninitializedAccounts.push(w.name);
        }
      }
    });
  }

  return {
    liquidAssets: {
      title: "Liquid Assets (Cash & Bank)",
      classification: "liquid",
      total: totalLiquid,
      items: liquidItems,
    },
    investmentAssets: {
      title: "Investment Assets (Marketable Securities)",
      classification: "investment",
      total: totalInvestment,
      items: investmentItems,
    },
    receivableAssets: {
      title: "Receivables (Lent Capital)",
      classification: "receivable",
      total: totalReceivable,
      items: receivableItems,
    },
    totalAssets,

    currentLiabilities: {
      title: "Current Liabilities (Credit & Short-Term)",
      classification: "credit",
      total: totalCurrentLiabilities,
      items: currentLiabilityItems,
    },
    longTermLiabilities: {
      title: "Long-Term Liabilities (Loans & Obligations)",
      classification: "loan",
      total: totalLongTermLiabilities,
      items: longTermLiabilityItems,
    },
    totalLiabilities,

    netWorth,
    isBalanced,
    discrepancy,
    asOfDate: options.endDate,
    uninitializedAccounts,
    isHistoricalPeriod: isHistorical,
  };
}

// ======================================================================
// PURE CALCULATION: STATEMENT OF CASH FLOWS (LAPORAN ARUS KAS)
// ======================================================================

export function calculateCashFlowStatement(
  transactions: Transaction[],
  categories: Category[],
  _wallets: Wallet[],
  options: {
    startDate?: string;
    endDate?: string;
    periodLabel?: string;
  } = {},
): CashFlowStatement {
  const { startDate, endDate, periodLabel = "Custom Period" } = options;

  const periodTxs = transactions.filter((tx) => {
    if (!tx.occurred_on) return false;
    if (startDate && tx.occurred_on < startDate) return false;
    if (endDate && tx.occurred_on > endDate) return false;
    return true;
  });

  const catMap = new Map<string, Category>();
  categories.forEach((c) => catMap.set(c.id, c));

  const operatingItemMap = new Map<string, CashFlowActivityItem>();
  const investingItemMap = new Map<string, CashFlowActivityItem>();
  const financingItemMap = new Map<string, CashFlowActivityItem>();

  let opIn = 0;
  let opOut = 0;
  let invIn = 0;
  let invOut = 0;
  let finIn = 0;
  let finOut = 0;

  periodTxs.forEach((tx) => {
    const amt = Number(tx.amount || 0);
    if (amt <= 0) return;

    if (tx.type === "transfer") return;

    const isCorrection = isCorrectionTx(tx);
    const cat = tx.category_id ? catMap.get(tx.category_id) : tx.categories;
    const catName = cat?.name || "Uncategorized";
    const catEmoji = cat?.emoji || "/icons/lainnya.png";

    const nature = getCategoryCashflowNature(catName, cat?.cashflow_nature);

    const targetMap =
      nature === "investing"
        ? investingItemMap
        : nature === "financing"
          ? financingItemMap
          : operatingItemMap;

    const itemKey = catName.toLowerCase();
    const existing = targetMap.get(itemKey) || {
      id: cat?.id || itemKey,
      name: catName,
      emoji: catEmoji,
      inflow: 0,
      outflow: 0,
      net: 0,
      txCount: 0,
    };

    if (isCorrection) {
      const isNegative = tx.note?.includes("(-)") || tx.type === "expense";
      if (isNegative) {
        existing.outflow += amt;
        if (nature === "investing") invOut += amt;
        else if (nature === "financing") finOut += amt;
        else opOut += amt;
      } else {
        existing.inflow += amt;
        if (nature === "investing") invIn += amt;
        else if (nature === "financing") finIn += amt;
        else opIn += amt;
      }
    } else if (tx.type === "income") {
      existing.inflow += amt;
      if (nature === "investing") invIn += amt;
      else if (nature === "financing") finIn += amt;
      else opIn += amt;
    } else if (tx.type === "expense") {
      existing.outflow += amt;
      if (nature === "investing") invOut += amt;
      else if (nature === "financing") finOut += amt;
      else opOut += amt;
    }

    existing.net = existing.inflow - existing.outflow;
    existing.txCount += 1;
    targetMap.set(itemKey, existing);
  });

  const operatingItems = Array.from(operatingItemMap.values()).sort(
    (a, b) => Math.abs(b.net) - Math.abs(a.net),
  );
  const investingItems = Array.from(investingItemMap.values()).sort(
    (a, b) => Math.abs(b.net) - Math.abs(a.net),
  );
  const financingItems = Array.from(financingItemMap.values()).sort(
    (a, b) => Math.abs(b.net) - Math.abs(a.net),
  );

  const netOperatingCashFlow = opIn - opOut;
  const netInvestingCashFlow = invIn - invOut;
  const netFinancingCashFlow = finIn - finOut;

  const totalInflow = opIn + invIn + finIn;
  const totalOutflow = opOut + invOut + finOut;
  const netCashFlow =
    netOperatingCashFlow + netInvestingCashFlow + netFinancingCashFlow;

  return {
    periodLabel,
    startDate: startDate || "",
    endDate: endDate || "",

    operatingInflow: opIn,
    operatingOutflow: opOut,
    netOperatingCashFlow,
    operatingItems,

    investingInflow: invIn,
    investingOutflow: invOut,
    netInvestingCashFlow,
    investingItems,

    financingInflow: finIn,
    financingOutflow: finOut,
    netFinancingCashFlow,
    financingItems,

    totalInflow,
    totalOutflow,
    netCashFlow,
  };
}

// ======================================================================
// PURE CALCULATION: CALK (CATATAN ATAS LAPORAN KEUANGAN)
// ======================================================================

export function calculateCALKReport(
  balanceSheet: BalanceSheetStatement,
  cashFlow: CashFlowStatement,
  periodTransactions: Transaction[],
  categories: Category[],
  options: {
    periodLabel?: string;
  } = {},
): CALKReport {
  const { periodLabel = "Selected Period" } = options;

  // 1. Solvency & Liquidity Runway
  const monthlyExpense =
    cashFlow.operatingOutflow > 0 ? cashFlow.operatingOutflow : 1;
  const solvencyRunwayMonths =
    balanceSheet.liquidAssets.total > 0
      ? Number((balanceSheet.liquidAssets.total / monthlyExpense).toFixed(1))
      : 0;

  let solvencyRunwayRating: CALKReport["solvencyRunwayRating"] = "caution";
  let solvencyDescription = "";

  if (solvencyRunwayMonths >= 6) {
    solvencyRunwayRating = "fortress";
    solvencyDescription = `Fortress liquidity: Your cash buffer covers ${solvencyRunwayMonths} months of current operating expenses without requiring any income.`;
  } else if (solvencyRunwayMonths >= 3) {
    solvencyRunwayRating = "optimal";
    solvencyDescription = `Healthy liquidity: Your cash reserve sustains ${solvencyRunwayMonths} months of living expenses, satisfying the recommended 3-6 month safety threshold.`;
  } else if (solvencyRunwayMonths >= 1) {
    solvencyRunwayRating = "caution";
    solvencyDescription = `Tight reserve: Your cash runway is ${solvencyRunwayMonths} months. Consider building a stronger cash cushion to withstand unexpected shocks.`;
  } else {
    solvencyRunwayRating = "critical";
    solvencyDescription = `Critical liquidity: Cash runway is under 1 month (${solvencyRunwayMonths} mo). Immediate allocation towards liquid emergency reserves is recommended.`;
  }

  // 2. Debt-to-Asset Ratio (DAR)
  const debtToAssetRatioPct =
    balanceSheet.totalAssets > 0
      ? Number(
          (
            (balanceSheet.totalLiabilities / balanceSheet.totalAssets) *
            100
          ).toFixed(1),
        )
      : balanceSheet.totalLiabilities > 0
        ? 100
        : 0;

  let debtRating: CALKReport["debtRating"] = "conservative";
  let debtDescription = "";

  if (balanceSheet.totalLiabilities === 0) {
    debtRating = "debt-free";
    debtDescription =
      "Pure balance sheet: Zero outstanding liabilities recorded. All assets represent 100% unencumbered equity.";
  } else if (debtToAssetRatioPct < 20) {
    debtRating = "conservative";
    debtDescription = `Conservative leverage: Liabilities constitute only ${debtToAssetRatioPct}% of total assets, maintaining safe solvency boundaries.`;
  } else if (debtToAssetRatioPct <= 40) {
    debtRating = "moderate";
    debtDescription = `Moderate leverage: Debt stands at ${debtToAssetRatioPct}% of total asset value. Debt servicing should be monitored.`;
  } else {
    debtRating = "elevated";
    debtDescription = `Elevated debt: Liabilities account for ${debtToAssetRatioPct}% of assets. Prioritize debt reduction to safeguard net worth.`;
  }

  // 3. Operating Free Cash Flow Rate
  const freeCashflowRatePct =
    cashFlow.totalInflow > 0
      ? Number(
          ((cashFlow.netOperatingCashFlow / cashFlow.totalInflow) * 100).toFixed(
            1,
          ),
        )
      : 0;

  let freeCashflowRating: CALKReport["freeCashflowRating"] = "healthy";
  let freeCashflowDescription = "";

  if (freeCashflowRatePct >= 30) {
    freeCashflowRating = "superior";
    freeCashflowDescription = `Superior savings pace: You retain ${freeCashflowRatePct}% of total inflow as surplus operating cash flow.`;
  } else if (freeCashflowRatePct >= 15) {
    freeCashflowRating = "healthy";
    freeCashflowDescription = `Healthy accumulation: Retained cash rate stands at ${freeCashflowRatePct}%, fostering steady equity growth.`;
  } else if (freeCashflowRatePct >= 0) {
    freeCashflowRating = "tight";
    freeCashflowDescription = `Tight margin: Surplus generation is ${freeCashflowRatePct}%. Discretionary outflow reduction will boost savings momentum.`;
  } else {
    freeCashflowRating = "deficit";
    freeCashflowDescription = `Operating deficit: Operating outflows exceeded total period inflow by ${Math.abs(freeCashflowRatePct)}%.`;
  }

  // 4. Material / Outlier Transactions Disclosure
  const catMap = new Map<string, string>();
  categories.forEach((c) => catMap.set(c.id, c.name));

  const totalExpenseAmt = cashFlow.totalOutflow;
  const materialTransactions: MaterialTransactionDisclosure[] = [];

  if (totalExpenseAmt > 0) {
    periodTransactions
      .filter((tx) => tx.type === "expense" && Number(tx.amount || 0) > 0)
      .forEach((tx) => {
        const amt = Number(tx.amount || 0);
        const pct = (amt / totalExpenseAmt) * 100;
        if (pct >= 5) {
          const catName =
            (tx.category_id ? catMap.get(tx.category_id) : tx.categories?.name) ||
            "General Expense";
          materialTransactions.push({
            id: tx.id,
            note: tx.note || catName,
            categoryName: catName,
            amount: amt,
            date: tx.occurred_on,
            percentageOfTotalExpense: Number(pct.toFixed(1)),
          });
        }
      });
  }

  materialTransactions.sort((a, b) => b.amount - a.amount);

  // 5. Accounting Reconciliation Status
  const auditStatus = balanceSheet.isBalanced
    ? "CERTIFIED_BALANCED"
    : "AUDIT_WARNING";
  const uninitializedNote = balanceSheet.uninitializedAccounts?.length
    ? `\n\nHistorical Period Note: ${balanceSheet.uninitializedAccounts.length} account(s) (${balanceSheet.uninitializedAccounts.slice(0, 4).join(", ")}${balanceSheet.uninitializedAccounts.length > 4 ? "..." : ""}) reflect a 0 balance as of this closing date because their first recorded ledger transactions occurred in a subsequent period.`
    : "";
  const notes =
    (balanceSheet.isBalanced
      ? "All balance sheet line items reconcile with zero discrepancy against total recorded assets under standard accounting principles."
      : `Attention: An unexplained discrepancy of ${Math.abs(balanceSheet.discrepancy)} was detected between Total Assets and Liabilities + Equity.`) +
    uninitializedNote;

  return {
    periodLabel,
    solvencyRunwayMonths,
    solvencyRunwayRating,
    solvencyDescription,

    debtToAssetRatioPct,
    debtRating,
    debtDescription,

    freeCashflowRatePct,
    freeCashflowRating,
    freeCashflowDescription,

    materialTransactions,

    reconciliation: {
      assetsEqualLiabilitiesPlusEquity: balanceSheet.isBalanced,
      discrepancyAmount: balanceSheet.discrepancy,
      auditStatus,
      notes,
    },
  };
}

// ======================================================================
// COMPREHENSIVE FACADE
// ======================================================================

export function generateFinancialReportPackage(
  wallets: Wallet[],
  transactions: Transaction[],
  categories: Category[],
  options: {
    startDate?: string;
    endDate?: string;
    periodLabel?: string;
    allTransactions?: Transaction[];
    holdings?: InvestmentHolding[];
  } = {},
): FinancialReportPackage {
  // Balance Sheet reflects cumulative financial position as of the end of the period
  let balanceSheetTxs = options.allTransactions || transactions;
  if (options.allTransactions && options.endDate) {
    const endStr = options.endDate.slice(0, 10);
    balanceSheetTxs = options.allTransactions.filter((tx) => {
      const txDate = (tx.occurred_on || tx.created_at || "").slice(0, 10);
      return txDate <= endStr;
    });
  }

  const balanceSheet = calculateBalanceSheet(
    wallets,
    balanceSheetTxs,
    options.allTransactions,
    options,
  );
  const cashFlow = calculateCashFlowStatement(
    transactions,
    categories,
    wallets,
    options,
  );
  const calk = calculateCALKReport(
    balanceSheet,
    cashFlow,
    transactions,
    categories,
    options,
  );

  return {
    balanceSheet,
    cashFlow,
    calk,
  };
}
