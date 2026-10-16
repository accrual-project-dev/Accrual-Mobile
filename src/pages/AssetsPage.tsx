// ======================================================================
// TROUVAILLE ASSETS & PORTFOLIO VALUATION PAGE (RESOLUSI 2)
// The Silicon Valley Wealth Bento:
// [1] Hero Net Valuation (Compact)
// [2] Bento Matrix 2x2 (Inflow Velocity, Liquid Runway, Dominance, 3-Tier Liquidity)
// [3] Monthly Capital Deployment Bar Chart (shadcn/ui minimal)
// [4] Enhanced Holdings Deck with Inline Dominance Progress Bars
// [5] Collapsible Advanced Portfolio Analytics Accordion
// [6] Standard BottomSheet for Preset Picker & Asset Details
// Strictly ZERO DUMMY DATA: All telemetry computed directly from real user state
// Strictly Non-Mixed Localization (100% Pure English / Indonesian)
// ======================================================================

import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  RefreshCw,
  Sparkles,
  Sun,
  Moon,
  Settings,
  Coins,
  TrendingUp,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatHoldingUnits } from "../lib/utils";
import { triggerHaptic } from "../lib/haptics";
import { useToast } from "../contexts/ToastContext";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";
import { usePrivacy } from "../contexts/PrivacyContext";
import { useCurrency } from "../contexts/CurrencyContext";
import { useAuth } from "../contexts/AuthContext";
import { useWallets, resolveWalletClassification } from "../hooks/useWallets";
import { useWalletBalances } from "../hooks/useWalletBalances";
import { useAllTransactions } from "../hooks/useTransactions";
import {
  getSavedHoldings,
  getSavedUsdtPref,
  getStandardUsdtHoldingId,
  saveUsdtPref,
  deleteHolding,
  calculateHoldingValuation,
  fetchHoldingsFromSupabase,
  refreshAllPortfolioPrices,
  type UsdtValuationPref,
} from "../lib/marketPriceService";
import {
  auditUsdtReconciliation,
  applyUsdtReconciliation,
  dismissReconciliationTxIds,
  bridgeCryptoAccountToHolding,
} from "../lib/holdingSyncEngine";
import {
  ExecutiveWalletCard,
  PortfolioIntelligenceDeck,
  UnifiedCapitalAllocationCard,
  PortfolioHoldingsDeck,
  WealthHistoryTrajectoryCard,
  WealthTacticalInsightsDeck,
  AssetsModalsContainer,
  CashAccountDetailSheet,
  type BalanceSheetRange,
  type MetricDrillDownData,
} from "../components/assets";
import {
  calculateAssetTrend,
  getIncludeReceivableInLiquid,
} from "../lib/financialMath";
import { startOfMonth } from "date-fns";
import type { Wallet, InvestmentHolding } from "../lib/types";
import { WalletManagementSheets } from "../components/settings/WalletManagementSheets";
import {
  type PresetAsset,
  type PresetCategory,
} from "../lib/assetPresets";

export type { PresetCategory, PresetAsset, BalanceSheetRange };

export function AssetsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme !== "light";
  const { showToast } = useToast();
  const { isIndonesian } = useLanguage();
  const { isStealthMode, toggleStealthMode } = usePrivacy();
  const { formatWithPreferred } = useCurrency();
  const [bsRange, setBsRange] = useState<BalanceSheetRange>("7D");

  const { data: wallets = [] } = useWallets();
  const { balancesById } = useWalletBalances();
  const { data: allTxs = [] } = useAllTransactions();

  // USDT State
  const [usdtPref, setUsdtPref] = useState<UsdtValuationPref>(() =>
    getSavedUsdtPref(user?.id),
  );

  // Other Holdings State
  const [holdings, setHoldings] = useState<InvestmentHolding[]>(() =>
    getSavedHoldings(user?.id),
  );

  // Modals & Sheets State
  const [selectedDetailHolding, setSelectedDetailHolding] =
    useState<InvestmentHolding | null>(null);
  const [selectedCashWallet, setSelectedCashWallet] = useState<Wallet | null>(null);
  const [isStakingModalOpen, setIsStakingModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dismissedReconciliation, setDismissedReconciliation] = useState(() => {
    try {
      const stored =
        localStorage.getItem(`trouvaille_dismissed_recon_${user?.id || "guest"}`) ||
        localStorage.getItem("trouvaille_dismissed_recon_guest");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Date.now() - Number(parsed.timestamp || 0) < 30 * 24 * 60 * 60 * 1000) {
          return true;
        }
      }
    } catch {}
    return false;
  });

  // Sync dismissal state as soon as user auth session finishes loading
  useEffect(() => {
    try {
      const stored =
        localStorage.getItem(`trouvaille_dismissed_recon_${user?.id || "guest"}`) ||
        localStorage.getItem("trouvaille_dismissed_recon_guest");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Date.now() - Number(parsed.timestamp || 0) < 30 * 24 * 60 * 60 * 1000) {
          setDismissedReconciliation(true);
        }
      }
    } catch {}
  }, [user?.id]);

  const [reconDismissDir, setReconDismissDir] = useState(1);

  const handleDismissReconciliation = (direction = 1) => {
    triggerHaptic("light");
    setReconDismissDir(direction);
    setDismissedReconciliation(true);

    const txIds = reconciliationAudit.unreconciledTxs
      .map((t) => t.id)
      .filter(Boolean);
    if (txIds.length > 0) {
      dismissReconciliationTxIds(txIds, user?.id);
      dismissReconciliationTxIds(txIds, undefined);
    }

    try {
      const payload = JSON.stringify({
        timestamp: Date.now(),
        unreconciledCount: reconciliationAudit.unreconciledTxs.length,
        dismissedTxIds: txIds,
      });
      localStorage.setItem(`trouvaille_dismissed_recon_${user?.id || "guest"}`, payload);
      localStorage.setItem("trouvaille_dismissed_recon_guest", payload);
    } catch {}
  };

  // Consolidated Balance Sheet Drawer & Metric Drill Down State
  const [isConsolidatedDrawerOpen, setIsConsolidatedDrawerOpen] =
    useState(false);
  const [selectedMetricDrillDown, setSelectedMetricDrillDown] =
    useState<MetricDrillDownData | null>(null);

  // Add Asset Modal State
  const [isAddAssetModalOpen, setIsAddAssetModalOpen] = useState(false);
  // Convert Wallet to Asset State
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  // Direct Wallet Editing Modal State
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [isWalletManagementOpen, setIsWalletManagementOpen] = useState(false);

  // Initial Sync from Supabase & live rates
  useEffect(() => {
    let isMounted = true;
    if (user?.id && user.id !== "guest_local_user") {
      fetchHoldingsFromSupabase(user.id).then((cloudHoldings) => {
        if (isMounted) {
          setHoldings(cloudHoldings);
          setUsdtPref(getSavedUsdtPref(user.id));
        }
      });
    }
    refreshAllPortfolioPrices(user?.id)
      .then(({ usdtRate, updatedHoldings }) => {
        if (isMounted) {
          if (usdtRate > 5000 && usdtRate < 50000) {
            setUsdtPref((prev: UsdtValuationPref) => ({
              ...prev,
              rate: usdtRate,
            }));
          }
          if (updatedHoldings && updatedHoldings.length > 0) {
            setHoldings(updatedHoldings);
          }
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  // Zero-Destruction Linked Custodial Bridge:
  // Automatically convert/bridge imported USDT or Crypto account into an active USDT holding
  useEffect(() => {
    if (wallets.length === 0) return;
    const bridged = bridgeCryptoAccountToHolding(wallets, allTxs, user?.id);
    if (bridged) {
      setHoldings(getSavedHoldings(user?.id));
      setUsdtPref(getSavedUsdtPref(user?.id));
    }
  }, [wallets, allTxs, user?.id]);

  // Manual Refresh action
  const handleRefreshPrices = async () => {
    triggerHaptic("medium");
    setIsRefreshing(true);
    try {
      const res = await refreshAllPortfolioPrices(user?.id);
      if (res.usdtRate > 0) {
        setUsdtPref((prev: UsdtValuationPref) => ({
          ...prev,
          rate: res.usdtRate,
        }));
      }
      if (res.updatedHoldings && res.updatedHoldings.length > 0) {
        setHoldings(res.updatedHoldings);
      }
      showToast(
        isIndonesian
          ? "Harga portofolio berhasil diperbarui"
          : "Portfolio prices refreshed",
        "update",
        () => {},
      );
    } catch {
      showToast(
        isIndonesian
          ? "Gagal memperbarui harga live"
          : "Failed to refresh live prices",
        "delete",
        () => {},
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  // Find all crypto wallets to avoid single-instance assumption
  const allCryptoWallets = useMemo(() => {
    return wallets.filter(
      (w) =>
        w.name.toLowerCase().includes("usdt") ||
        w.name.toLowerCase().includes("crypto") ||
        w.name.toLowerCase().includes("tether") ||
        w.name.toLowerCase().includes("binance") ||
        w.name.toLowerCase().includes("bybit") ||
        w.name.toLowerCase().includes("indodax") ||
        w.name.toLowerCase().includes("tokocrypto"),
    );
  }, [wallets]);

  const allCryptoWalletIds = useMemo(
    () => new Set(allCryptoWallets.map((w) => w.id)),
    [allCryptoWallets],
  );

  const cryptoWallet = allCryptoWallets[0] || null;

  const usdtHolding = useMemo(
    () => holdings.find((h) => h.symbol?.toUpperCase() === "USDT"),
    [holdings],
  );
  const usdtUnits = usdtHolding?.units || usdtPref.units || 0;
  const usdtRate = usdtHolding?.current_price || usdtPref.rate || 16300;

  // Unlinked legacy crypto wallet detection
  const unlinkedCryptoWallet = useMemo(() => {
    if (usdtUnits > 0) return null;
    return (
      allCryptoWallets.find(
        (w) => (balancesById[w.id] ?? Number(w.balance || 0)) > 0,
      ) || null
    );
  }, [allCryptoWallets, usdtUnits, balancesById]);

  const recordedCryptoBalance = cryptoWallet
    ? (balancesById[cryptoWallet.id] ?? Number(cryptoWallet.balance || 0))
    : 0;
  const suggestedUsdtUnits =
    usdtRate > 0
      ? parseFloat((recordedCryptoBalance / usdtRate).toFixed(2))
      : 0;

  // Split holdings: Liquid vs Fixed
  const liquidHoldings = useMemo(
    () => holdings.filter((h) => h.asset_type !== "fixed_asset"),
    [holdings],
  );
  const fixedHoldings = useMemo(
    () => holdings.filter((h) => h.asset_type === "fixed_asset"),
    [holdings],
  );

  const usdtCostBasis =
    usdtHolding?.avg_buy_price && usdtUnits > 0
      ? Math.round(usdtUnits * usdtHolding.avg_buy_price)
      : usdtPref.costBasis && usdtPref.costBasis > 0
        ? usdtPref.costBasis
        : recordedCryptoBalance;
  const usdtMarketValue =
    usdtUnits > 0 ? Math.round(usdtUnits * usdtRate) : recordedCryptoBalance;
  const usdtFloatingPnL = usdtMarketValue - usdtCostBasis;
  const usdtFloatingPnLPct =
    usdtCostBasis > 0 ? (usdtFloatingPnL / usdtCostBasis) * 100 : 0;

  // ── Executive Balance Sheet & 4-Pillar Capital Breakdown ──────────
  // RDN / Broker Uninvested Cash (accounts classified as investment but not crypto)
  const brokerRdnCash = useMemo(() => {
    return wallets
      .filter(
        (w) =>
          (w.classification === "investment" ||
            w.name.toLowerCase().includes("rdn") ||
            w.name.toLowerCase().includes("ajaib") ||
            w.name.toLowerCase().includes("stockbit") ||
            w.name.toLowerCase().includes("bibit") ||
            w.name.toLowerCase().includes("pluang")) &&
          !allCryptoWalletIds.has(w.id),
      )
      .reduce((sum, w) => sum + Math.max(0, balancesById[w.id] ?? 0), 0);
  }, [wallets, allCryptoWalletIds, balancesById]);

  // Check whether user's crypto/USDT wallet is classified as investment
  const isCryptoClassifiedAsInvestment = useMemo(() => {
    if (allCryptoWallets.length > 0) {
      return allCryptoWallets.some(
        (w) => resolveWalletClassification(w) === "investment",
      );
    }
    return true;
  }, [allCryptoWallets]);

  const [receivablePrefTick, setReceivablePrefTick] = useState(0);

  useEffect(() => {
    const handlePref = () => setReceivablePrefTick((t) => t + 1);
    window.addEventListener("trouvaille:receivable-liquid-pref-changed", handlePref);
    return () => window.removeEventListener("trouvaille:receivable-liquid-pref-changed", handlePref);
  }, []);

  // Pillar 1: Liquid & Current Assets (Operating Cash, RDN Uninvested Cash, and USDT Reserve if liquid)
  const liquidWalletCash = useMemo(() => {
    const includeReceivable = getIncludeReceivableInLiquid();
    return wallets
      .filter(
        (w) =>
          w.classification !== "credit" &&
          w.classification !== "loan" &&
          w.classification !== "investment" &&
          (includeReceivable || w.classification !== "receivable") &&
          !allCryptoWalletIds.has(w.id),
      )
      .reduce((sum, w) => sum + Math.max(0, balancesById[w.id] ?? 0), 0);
  }, [wallets, allCryptoWalletIds, balancesById, receivablePrefTick]);

  // Trailing / current month monthly burn for tactical liquidity calculations
  const computedMonthlyBurn = useMemo(() => {
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const thisMonthExpenses = allTxs
      .filter((t) => t.type === "expense" && t.occurred_on.startsWith(currentMonthPrefix))
      .reduce((sum, t) => sum + Math.max(0, Number(t.amount || 0)), 0);

    if (thisMonthExpenses > 0) return thisMonthExpenses;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const trailingExpenses = allTxs
      .filter((t) => t.type === "expense" && new Date(t.occurred_on) >= thirtyDaysAgo)
      .reduce((sum, t) => sum + Math.max(0, Number(t.amount || 0)), 0);

    return trailingExpenses;
  }, [allTxs]);

  const liquidUsdtValue = isCryptoClassifiedAsInvestment ? 0 : usdtMarketValue;
  const liquidAssetsTotal = liquidWalletCash + brokerRdnCash + liquidUsdtValue;

  // Pillar 2: Market & Growth Assets (Equities, Growth Crypto, Mutual Funds, and USDT if classified as investment)
  const investmentUsdtValue = isCryptoClassifiedAsInvestment ? usdtMarketValue : 0;
  const growthAssetsTotal = useMemo(() => {
    return (
      liquidHoldings
        .filter(
          (h) =>
            h.symbol?.toUpperCase() !== "USDT" &&
            (h.asset_type === "stock" ||
              h.asset_type === "crypto" ||
              h.asset_type === "mutual_fund" ||
              h.asset_type === "bond"),
        )
        .reduce(
          (sum, h) => sum + h.units * (h.current_price || h.avg_buy_price),
          0,
        ) + investmentUsdtValue
    );
  }, [liquidHoldings, investmentUsdtValue]);

  // Pillar 3: Fixed & Tangible Assets (Property, Physical Gold, Vehicles)
  const fixedAssetsTotal = useMemo(() => {
    const fixedTangibles = fixedHoldings.reduce((sum, h) => {
      const v = calculateHoldingValuation(h);
      return sum + v.marketValue;
    }, 0);
    const physicalGold = liquidHoldings
      .filter((h) => h.asset_type === "gold")
      .reduce(
        (sum, h) => sum + h.units * (h.current_price || h.avg_buy_price),
        0,
      );
    return fixedTangibles + physicalGold;
  }, [fixedHoldings, liquidHoldings]);

  // Pillar 4: Total Liabilities & Obligations (Credit Cards, PayLater, Loans, Overdrafts)
  const liabilitiesTotal = useMemo(() => {
    return wallets
      .filter(
        (w) =>
          w.classification === "credit" ||
          w.classification === "loan" ||
          (balancesById[w.id] ?? 0) < 0,
      )
      .reduce((sum, w) => {
        const bal = balancesById[w.id] ?? 0;
        return (
          sum +
          Math.abs(
            bal < 0
              ? bal
              : w.classification === "credit" || w.classification === "loan"
                ? bal
                : 0,
          )
        );
      }, 0);
  }, [wallets, balancesById]);

  // Balance Sheet Totals & Solvency Metrics
  const totalGrossAssets =
    liquidAssetsTotal + growthAssetsTotal + fixedAssetsTotal;
  const netWorth = totalGrossAssets - liabilitiesTotal;
  const debtToAssetRatio =
    totalGrossAssets > 0 ? (liabilitiesTotal / totalGrossAssets) * 100 : 0;
  const solvencyScore = Math.max(
    0,
    Math.min(100, Math.round(100 - debtToAssetRatio)),
  );

  const liquidPct =
    totalGrossAssets > 0 ? (liquidAssetsTotal / totalGrossAssets) * 100 : 0;
  const growthPct =
    totalGrossAssets > 0 ? (growthAssetsTotal / totalGrossAssets) * 100 : 0;
  const fixedPct =
    totalGrossAssets > 0 ? (fixedAssetsTotal / totalGrossAssets) * 100 : 0;


  const capitalDeployment = useMemo(() => {
    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    return allTxs
      .filter(
        (tx) =>
          tx.occurred_on &&
          new Date(tx.occurred_on) >= thisMonthStart &&
          (tx.categories?.name?.toLowerCase().includes("invest") ||
            tx.note?.toLowerCase().includes("invest") ||
            tx.type === "transfer"),
      )
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  }, [allTxs]);

  const assetTrend = useMemo(() => {
    return calculateAssetTrend(allTxs, netWorth, bsRange);
  }, [allTxs, netWorth, bsRange]);

  const chartPeak = useMemo(() => {
    if (!assetTrend.chartData || assetTrend.chartData.length === 0)
      return netWorth;
    return Math.max(...assetTrend.chartData.map((d) => d.balance));
  }, [assetTrend.chartData, netWorth]);

  const chartTrough = useMemo(() => {
    if (!assetTrend.chartData || assetTrend.chartData.length === 0)
      return netWorth;
    return Math.min(...assetTrend.chartData.map((d) => d.balance));
  }, [assetTrend.chartData, netWorth]);

  const bsRangeLabels: Record<BalanceSheetRange, string> = {
    "1D": isIndonesian ? "Hari Ini" : "Today",
    "7D": isIndonesian ? "7 Hari" : "7 Days",
    "1M": isIndonesian ? "1 Bulan" : "1 Month",
    "3M": isIndonesian ? "3 Bulan" : "3 Months",
    "6M": isIndonesian ? "6 Bulan" : "6 Months",
    "1Y": isIndonesian ? "1 Tahun" : "1 Year",
    ALL: isIndonesian ? "Semua Waktu" : "All Time",
  };

  // Reconciliation Audit
  const reconciliationAudit = useMemo(() => {
    return auditUsdtReconciliation(allTxs, wallets, user?.id);
  }, [allTxs, wallets, user?.id]);

  const handleApplyReconciliation = () => {
    if (!reconciliationAudit.hasDiscrepancy) return;
    triggerHaptic("medium");
    const res = applyUsdtReconciliation(reconciliationAudit, user?.id);
    setUsdtPref((prev: UsdtValuationPref) => ({
      ...prev,
      units: res.updatedUnits,
    }));
    setDismissedReconciliation(true);

    const txIds = reconciliationAudit.unreconciledTxs
      .map((t) => t.id)
      .filter(Boolean);
    if (txIds.length > 0) {
      dismissReconciliationTxIds(txIds, user?.id);
      dismissReconciliationTxIds(txIds, undefined);
    }

    try {
      const payload = JSON.stringify({
        timestamp: Date.now(),
        unreconciledCount: 0,
        dismissedTxIds: txIds,
      });
      localStorage.setItem(`trouvaille_dismissed_recon_${user?.id || "guest"}`, payload);
      localStorage.setItem("trouvaille_dismissed_recon_guest", payload);
    } catch {}
    showToast(
      isIndonesian
        ? `Holding disinkronkan ke ${res.updatedUnits} USDT`
        : `Holding synced to ${res.updatedUnits} USDT`,
      "update",
      () => {},
    );
  };

  // Open USDT in Detail Sheet
  const openUsdtDetail = () => {
    triggerHaptic("light");
    const existingUsdt = holdings.find(
      (h) => h.symbol?.toUpperCase() === "USDT" || h.id.startsWith("usdt-"),
    );
    const targetUsdtHolding: InvestmentHolding = {
      id: existingUsdt?.id || getStandardUsdtHoldingId(user?.id),
      wallet_id: existingUsdt?.wallet_id || cryptoWallet?.id,
      symbol: "USDT",
      name: "Tether USD",
      asset_type: "crypto",
      units: usdtUnits > 0 ? usdtUnits : suggestedUsdtUnits,
      avg_buy_price:
        existingUsdt?.avg_buy_price && existingUsdt.avg_buy_price > 0
          ? existingUsdt.avg_buy_price
          : usdtUnits > 0
            ? Math.round(usdtCostBasis / usdtUnits)
            : usdtRate,
      current_price:
        existingUsdt?.is_custom_price && existingUsdt.custom_price
          ? existingUsdt.custom_price
          : usdtRate,
      currency: "IDR",
      icon: "Coins",
      activities:
        existingUsdt?.activities && existingUsdt.activities.length > 0
          ? existingUsdt.activities
          : undefined,
      is_custom_price: existingUsdt?.is_custom_price,
      custom_price: existingUsdt?.custom_price,
    };
    setSelectedDetailHolding(targetUsdtHolding);
  };

  // Open any Holding in Detail Sheet
  const handleOpenHoldingDetail = (h: InvestmentHolding) => {
    triggerHaptic("light");
    setSelectedDetailHolding(h);
  };

  // 6 Metric Drill Down Openers (Interactive Half Cards)
  const openLiquidDetail = () => {
    triggerHaptic("light");
    const items: any[] = [];
    if (!isCryptoClassifiedAsInvestment && (usdtMarketValue > 0 || usdtPref.units > 0)) {
      items.push({
        label: "Tether USD (USDT)",
        sublabel: `${formatHoldingUnits(usdtPref.units)} USDT · @${formatWithPreferred(usdtPref.rate)}`,
        amount: usdtMarketValue,
        detail: isIndonesian
          ? "Stablecoin cadangan di akun"
          : "Stablecoin reserve",
        onClick: () => {
          setSelectedMetricDrillDown(null);
          openUsdtDetail();
        },
      });
    }
    wallets
      .filter(
        (w) =>
          (balancesById[w.id] ?? 0) > 0 &&
          w.classification !== "credit" &&
          w.classification !== "loan" &&
          !allCryptoWalletIds.has(w.id),
      )
      .forEach((w) => {
        const isRdn =
          w.classification === "investment" ||
          w.name.toLowerCase().includes("rdn") ||
          w.name.toLowerCase().includes("ajaib") ||
          w.name.toLowerCase().includes("stockbit") ||
          w.name.toLowerCase().includes("bibit") ||
          w.name.toLowerCase().includes("pluang");
        items.push({
          label: w.name,
          sublabel: isRdn
            ? isIndonesian
              ? "Kas RDN / Kustodi Broker"
              : "Uninvested Broker Cash"
            : isIndonesian
              ? "Kas & Rekening Operasional"
              : "Cash & Bank Account",
          amount: balancesById[w.id] ?? 0,
          detail: "IDR",
        });
      });

    setSelectedMetricDrillDown({
      title: isIndonesian
        ? "Aset Lancar & Kas (Tier 1)"
        : "Liquid & Current Assets (Tier 1)",
      badge: `${liquidPct.toFixed(1)}% ${isIndonesian ? "Alokasi" : "Allocation"}`,
      icon: "Wallet",
      amount: liquidAssetsTotal,
      narrative: isIndonesian
        ? "Aset likuid adalah modal yang dapat dicairkan seketika dalam < 24 jam tanpa penalti pasar. Cadangan ini menjaga stabilitas arus kas dan ketahanan dana darurat."
        : "Liquid assets can be accessed immediately within 24h without capital loss penalty, maintaining operational liquidity.",
      items,
      ctaLabel: isIndonesian
        ? "Buka Neraca Lengkap"
        : "View Full Balance Sheet",
      onCta: () => {
        setSelectedMetricDrillDown(null);
        setIsConsolidatedDrawerOpen(true);
      },
    });
  };

  const openGrowthDetail = () => {
    triggerHaptic("light");
    const growthHoldings = liquidHoldings.filter(
      (h) =>
        h.asset_type === "stock" ||
        (h.asset_type === "crypto" && h.symbol?.toUpperCase() !== "USDT") ||
        h.asset_type === "mutual_fund" ||
        h.asset_type === "bond",
    );
    const items = growthHoldings.map((h) => {
      const val = calculateHoldingValuation(h);
      return {
        label: `${h.name} (${h.symbol})`,
        sublabel: `${formatHoldingUnits(h.units)} ${h.symbol} · ${h.asset_type.toUpperCase().replace("_", " ")}`,
        amount: val.marketValue,
        detail: `${val.floatingPnLPct >= 0 ? "+" : ""}${val.floatingPnLPct.toFixed(1)}% PnL`,
        onClick: () => {
          setSelectedMetricDrillDown(null);
          handleOpenHoldingDetail(h);
        },
      };
    });

    if (isCryptoClassifiedAsInvestment && (usdtMarketValue > 0 || usdtPref.units > 0)) {
      items.unshift({
        label: "Tether USD (USDT)",
        sublabel: `${formatHoldingUnits(usdtPref.units)} USDT · @${formatWithPreferred(usdtPref.rate)}`,
        amount: usdtMarketValue,
        detail: isIndonesian
          ? "Portofolio kripto/investasi"
          : "Crypto investment portfolio",
        onClick: () => {
          setSelectedMetricDrillDown(null);
          openUsdtDetail();
        },
      });
    }

    setSelectedMetricDrillDown({
      title: isIndonesian
        ? "Pasar & Pertumbuhan (Tier 2)"
        : "Market & Growth Assets (Tier 2)",
      badge: `${growthPct.toFixed(1)}% ${isIndonesian ? "Alokasi" : "Allocation"}`,
      icon: "TrendingUp",
      amount: growthAssetsTotal,
      narrative: isIndonesian
        ? growthHoldings.length === 0
          ? "Tier 2 ditujukan untuk instrumen bertumbuh berimbal hasil tinggi seperti saham, reksa dana, dan kripto. Belum ada instrumen pasar terdaftar."
          : `Terdapat ${growthHoldings.length} aset pasar aktif untuk pertumbuhan modal jangka panjang di atas inflasi.`
        : growthHoldings.length === 0
          ? "Tier 2 is intended for high-growth instruments such as equities, mutual funds, and crypto. No market instruments registered yet."
          : `There are ${growthHoldings.length} active market assets for long-term capital growth outperforming inflation.`,
      items,
      ctaLabel: isIndonesian ? "Tambah Aset Pasar" : "Add Market Asset",
      onCta: () => {
        setSelectedMetricDrillDown(null);
        setIsAddAssetModalOpen(true);
      },
    });
  };

  const openFixedDetail = () => {
    triggerHaptic("light");
    const items: any[] = [];
    liquidHoldings
      .filter((h) => h.asset_type === "gold")
      .forEach((h) => {
        const val = calculateHoldingValuation(h);
        items.push({
          label: `${h.name} (${h.symbol})`,
          sublabel: `${formatHoldingUnits(h.units)} gram · ${isIndonesian ? "Logam Mulia" : "Precious Metal"}`,
          amount: val.marketValue,
          detail: formatWithPreferred(val.marketValue),
          onClick: () => {
            setSelectedMetricDrillDown(null);
            handleOpenHoldingDetail(h);
          },
        });
      });
    fixedHoldings.forEach((h) => {
      const val = calculateHoldingValuation(h);
      items.push({
        label: h.name,
        sublabel: h.asset_type.toUpperCase().replace("_", " "),
        amount: val.marketValue,
        detail: formatWithPreferred(val.marketValue),
        onClick: () => {
          setSelectedMetricDrillDown(null);
          handleOpenHoldingDetail(h);
        },
      });
    });

    setSelectedMetricDrillDown({
      title: isIndonesian
        ? "Aset Tetap & Riil (Tier 3)"
        : "Fixed & Tangibles (Tier 3)",
      badge: `${fixedPct.toFixed(1)}% ${isIndonesian ? "Alokasi" : "Allocation"}`,
      icon: "Landmark",
      amount: fixedAssetsTotal,
      narrative: isIndonesian
        ? items.length === 0
          ? "Tier 3 mencakup aset riil fisik berwujud seperti Emas Batangan Antam/UBS, properti, dan kendaraan bermotor sebagai penyimpan nilai fisik jangka panjang."
          : `Terdapat ${items.length} kepemilikan aset riil fisik sebagai pelindung kekayaan dari depresiasi nilai mata uang.`
        : items.length === 0
          ? "Tier 3 covers physical hard assets such as physical gold, property, and vehicles as long-term stores of value."
          : `There are ${items.length} physical tangible holdings serving as generational wealth protection against currency depreciation.`,
      items,
      ctaLabel: isIndonesian ? "Catat Aset Riil" : "Record Tangible Asset",
      onCta: () => {
        setSelectedMetricDrillDown(null);
        setIsAddAssetModalOpen(true);
      },
    });
  };

  const openDebtDetail = () => {
    triggerHaptic("light");
    const debtWallets = wallets.filter(
      (w) =>
        w.classification === "credit" ||
        w.classification === "loan" ||
        (balancesById[w.id] ?? 0) < 0,
    );
    const items = debtWallets.map((w) => {
      const bal = balancesById[w.id] ?? 0;
      const debtAmt = Math.abs(
        bal < 0
          ? bal
          : w.classification === "credit" || w.classification === "loan"
            ? bal
            : 0,
      );
      return {
        label: w.name,
        sublabel: (w.classification || "debt").toUpperCase(),
        amount: debtAmt,
        detail: isIndonesian ? "Kewajiban aktif" : "Active liability",
      };
    });

    setSelectedMetricDrillDown({
      title: isIndonesian
        ? "Liabilitas & Kewajiban Utang"
        : "Liabilities & Debt Obligations",
      badge: `${debtToAssetRatio.toFixed(1)}% ${isIndonesian ? "Rasio Utang" : "Debt-to-Asset"}`,
      icon: "ShieldAlert",
      amount: liabilitiesTotal,
      narrative: isIndonesian
        ? liabilitiesTotal === 0
          ? "Neraca keuangan Anda bebas utang. Rasio utang terhadap aset (D/A) adalah 0.0%, memberikan fleksibilitas penuh terhadap arus kas bulanan."
          : `Total kewajiban tercatat sebesar ${formatWithPreferred(liabilitiesTotal)}. Rasio D/A Anda adalah ${debtToAssetRatio.toFixed(1)}% (batas aman < 30%).`
        : liabilitiesTotal === 0
          ? "Your balance sheet is debt-free. Your debt-to-asset (D/A) ratio is 0.0%, providing complete flexibility for your monthly cash flow."
          : `Total recorded liabilities are ${formatWithPreferred(liabilitiesTotal)}. Your D/A ratio is ${debtToAssetRatio.toFixed(1)}% (safe threshold < 30%).`,
      items,
      ctaLabel: isIndonesian ? "Buka Neraca Lengkap" : "View Balance Sheet",
      onCta: () => {
        setSelectedMetricDrillDown(null);
        setIsConsolidatedDrawerOpen(true);
      },
    });
  };


  const handleDeleteHolding = (id: string, name: string) => {
    triggerHaptic("heavy");
    if (id.startsWith("usdt-") || id === "usdt-core-holding") {
      const cleared: UsdtValuationPref = {
        units: 0,
        costBasis: 0,
        rate: usdtPref.rate,
      };
      setUsdtPref(cleared);
      saveUsdtPref(cleared, user?.id);
      showToast(
        isIndonesian ? "Holding USDT dihapus" : "USDT holding removed",
        "delete",
        () => {},
      );
      return;
    }
    const updated = deleteHolding(id, user?.id);
    setHoldings(updated);
    showToast(
      `${name} ${isIndonesian ? "dihapus" : "removed"}`,
      "delete",
      () => {},
    );
  };

  // User's active holdings list (excluding USDT since Core USDT has its own primary hero row), sorted by market value
  const displayHoldings = useMemo(() => {
    return holdings
      .filter((h) => h.symbol?.toUpperCase() !== "USDT")
      .map((h) => ({
        ...h,
        valuation: calculateHoldingValuation(h),
      }))
      .sort((a, b) => b.valuation.marketValue - a.valuation.marketValue);
  }, [holdings]);

  return (
    <div
      className="min-h-screen select-none pb-36 pt-[calc(env(safe-area-inset-top,0px)+12px)] px-4 max-w-lg sm:max-w-xl mx-auto space-y-4"
      style={{
        background: "var(--bg-base)",
        color: "var(--text-primary)",
        fontFamily: "'Urbanist', sans-serif",
      }}
    >
      {/* ── 1. Header Bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text-primary)]">
            {isIndonesian ? "Neraca Keuangan" : "Executive Balance Sheet"}
          </h1>
          <p className="text-[12px] text-[var(--text-tertiary)] font-medium">
            {isIndonesian
              ? "Matriks solvabilitas & struktur modal lengkap"
              : "Solvency matrix & capital breakdown"}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              toggleTheme();
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center glass-surface border border-[var(--glass-border)] active:scale-95 transition-transform cursor-pointer select-none"
            title={
              theme === "light"
                ? isIndonesian
                  ? "Beralih ke Mode Gelap"
                  : "Switch to Dark Mode"
                : isIndonesian
                  ? "Beralih ke Mode Terang"
                  : "Switch to Light Mode"
            }
            aria-label="Toggle Theme"
          >
            {theme === "light" ? (
              <Moon
                size={14}
                strokeWidth={1.75}
                style={{ color: "var(--text-primary)" }}
              />
            ) : (
              <Sun
                size={14}
                strokeWidth={1.75}
                style={{ color: "var(--text-primary)" }}
              />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              navigate("/settings");
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center glass-surface border border-[var(--glass-border)] active:scale-95 transition-transform cursor-pointer"
            title={isIndonesian ? "Pengaturan" : "Settings"}
            aria-label="Settings"
          >
            <Settings
              size={14}
              strokeWidth={1.75}
              style={{ color: "var(--text-primary)" }}
            />
          </button>
        </div>
      </div>

      {/* ── 2. Executive Balance Sheet Statement Hero Wallet Card ── */}
      <ExecutiveWalletCard
        netWorth={netWorth}
        totalGrossAssets={totalGrossAssets}
        liabilitiesTotal={liabilitiesTotal}
        solvencyScore={solvencyScore}
        isStealthMode={isStealthMode}
        toggleStealthMode={toggleStealthMode}
        isIndonesian={isIndonesian}
        isDark={isDark}
        wallets={wallets}
        balancesById={balancesById}
        holdings={holdings}
        usdtRate={usdtPref.rate}
        usdtUnits={usdtPref.units}
        onDetailAsset={(item) => {
          triggerHaptic("light");
          if (typeof item === "object" && item !== null) {
            const isWalletObject =
              !("asset_type" in item) &&
              (wallets.some((w) => w.id === (item as any).id) || "icon" in item || "classification" in item);
            if (isWalletObject) {
              setSelectedCashWallet(item as Wallet);
              return;
            }
            setSelectedDetailHolding(item as InvestmentHolding);
          } else if (
            item === "card-usdt" ||
            (typeof item === "string" && item.includes("usdt"))
          ) {
            openUsdtDetail();
          } else if (item === "card-equity") {
            setIsConsolidatedDrawerOpen(true);
          } else {
            const matchedWallet = wallets.find(
              (w) => w.id === item || `card-${w.id}` === item,
            );
            if (matchedWallet) {
              setSelectedCashWallet(matchedWallet);
              return;
            }
            const found = holdings.find(
              (h) => h.id === item || `card-${h.id}` === item,
            );
            if (found) {
              setSelectedDetailHolding(found);
            } else {
              openUsdtDetail();
            }
          }
        }}
        userName={
          user?.user_metadata?.full_name ||
          user?.user_metadata?.name ||
          user?.email?.split("@")[0] ||
          (isIndonesian ? "Anggota Accrual" : "Accrual Member")
        }
      />

      {/* ── Relocated Minimalist Quick Action Bar (Compact) ────────────────── */}
      <div className="grid grid-cols-3 gap-1.5">
        {/* 1. Refresh Prices */}
        <button
          type="button"
          onClick={handleRefreshPrices}
          disabled={isRefreshing}
          className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-[10.5px] font-medium active:scale-[0.98] transition-transform cursor-pointer h-7.5"
          style={{
            background: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.03)",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
            color: "var(--text-secondary)",
          }}
        >
          <RefreshCw
            size={11.5}
            strokeWidth={2}
            className={isRefreshing ? "animate-spin" : ""}
          />
          <span className="truncate">
            {isIndonesian ? "Perbarui" : "Refresh"}
          </span>
        </button>

        {/* 2. Passive Yield & Dividends */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic("light");
            setIsStakingModalOpen(true);
          }}
          className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-[10.5px] font-medium active:scale-[0.98] transition-transform cursor-pointer h-7.5"
          style={{
            background: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.03)",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
            color: "var(--text-secondary)",
          }}
        >
          <TrendingUp size={12} strokeWidth={1.75} />
          <span className="truncate">
            {isIndonesian ? "Imbal Hasil" : "Yield"}
          </span>
        </button>

        {/* 3. Add Asset */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic("medium");
            setIsAddAssetModalOpen(true);
          }}
          className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-[10.5px] font-semibold active:scale-[0.98] transition-transform cursor-pointer h-7.5"
          style={{
            background: isDark ? "#FFFFFF" : "#18181B",
            color: isDark ? "#0A0A0B" : "#FFFFFF",
          }}
        >
          <Plus size={12} strokeWidth={2.5} />
          <span className="truncate">
            {isIndonesian ? "Tambah Aset" : "Add Asset"}
          </span>
        </button>
      </div>

      {/* ── 3. Auto-Reconciliation Alert Banner (Swipe to dismiss or tap X) ── */}
      <AnimatePresence>
        {reconciliationAudit.hasDiscrepancy && !dismissedReconciliation && (
          <motion.div
            layout
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              x: reconDismissDir > 0 ? 280 : -280,
              height: 0,
              marginTop: 0,
              marginBottom: 0,
              paddingTop: 0,
              paddingBottom: 0,
              transition: { duration: 0.22, ease: "easeOut" },
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.65}
            onDragEnd={(_e, info) => {
              if (Math.abs(info.offset.x) > 50 || Math.abs(info.velocity.x) > 300) {
                handleDismissReconciliation(info.offset.x > 0 ? 1 : -1);
              }
            }}
            className="p-3.5 rounded-3xl flex items-center justify-between gap-3 cursor-grab active:cursor-grabbing select-none"
            style={{
              background: isDark
                ? "linear-gradient(160deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.015) 100%)"
                : "linear-gradient(160deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 247, 250, 0.90) 100%)",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
              boxShadow: isDark
                ? "0 18px 44px -10px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.12)"
                : "0 10px 30px -8px rgba(31, 36, 48, 0.06), inset 0 1px 0 #ffffff",
              backdropFilter: "blur(24px) saturate(180%)",
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              touchAction: "pan-y",
            }}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
                }}
              >
                <Sparkles size={14} className="text-[var(--text-primary)]" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <p className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
                  {isIndonesian
                    ? "Sinkronisasi Mutasi Aset Investasi Terdeteksi"
                    : "Investment Discrepancy Detected"}
                </p>
                <p className="text-[10.5px] text-[var(--text-secondary)] leading-tight">
                  {isIndonesian
                    ? `Transaksi mutasi (${formatWithPreferred(reconciliationAudit.unreconciledTxs[0]?.amount || 0)}) belum tercermin pada unit holding.`
                    : `A transfer of ${formatWithPreferred(reconciliationAudit.unreconciledTxs[0]?.amount || 0)} has not yet been reflected in holding units.`}
                </p>
                <p className="text-[9.5px] text-[var(--text-tertiary)] flex items-center gap-1 pt-0.5">
                  <span>{isIndonesian ? "Geser ke samping untuk menutup" : "Swipe sideways to dismiss"}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleApplyReconciliation}
                className="px-3 py-1.5 rounded-xl text-[11px] font-semibold shrink-0 active:scale-95 transition-transform cursor-pointer"
                style={{
                  background: isDark ? "#FFFFFF" : "#18181B",
                  color: isDark ? "#0A0A0B" : "#FFFFFF",
                }}
              >
                {isIndonesian ? "Sinkronkan" : "Sync Now"}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDismissReconciliation(1);
                }}
                className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] active:scale-90 transition-transform cursor-pointer"
                title={isIndonesian ? "Tutup notifikasi" : "Dismiss notification"}
                aria-label="Dismiss"
              >
                <X size={13} strokeWidth={2} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Unlinked Legacy Crypto Wallet Smart Banner ── */}
      {unlinkedCryptoWallet && (
        <div
          className="p-3.5 rounded-3xl flex items-center justify-between gap-3 animate-in fade-in"
          style={{
            background: isDark
              ? "linear-gradient(160deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.015) 100%)"
              : "linear-gradient(160deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 247, 250, 0.90) 100%)",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
            boxShadow: isDark
              ? "0 18px 44px -10px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.12)"
              : "0 10px 30px -8px rgba(31, 36, 48, 0.06), inset 0 1px 0 #ffffff",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
          }}
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
              }}
            >
              <Coins size={14} className="text-[var(--text-primary)]" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <p className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
                {isIndonesian
                  ? `Dompet '${unlinkedCryptoWallet.name}' Terdeteksi`
                  : `Detected '${unlinkedCryptoWallet.name}' Wallet`}
              </p>
              <p className="text-[10.5px] text-[var(--text-secondary)] leading-tight">
                {isIndonesian
                  ? `Saldo ${formatWithPreferred(balancesById[unlinkedCryptoWallet.id] ?? Number(unlinkedCryptoWallet.balance || 0))} belum ditautkan sebagai unit holding aset.`
                  : `Balance ${formatWithPreferred(balancesById[unlinkedCryptoWallet.id] ?? Number(unlinkedCryptoWallet.balance || 0))} is not yet linked as holding units.`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic("medium");
              setIsConvertModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl text-[11px] font-semibold shrink-0 active:scale-95 transition-transform cursor-pointer"
            style={{
              background: isDark ? "#FFFFFF" : "#18181B",
              color: isDark ? "#0A0A0B" : "#FFFFFF",
            }}
          >
            {isIndonesian ? "Tautkan Aset" : "Link Asset"}
          </button>
        </div>
      )}

      {/* ── 4. Unified Capital Allocation & Balance Sheet Bento Card (With Bar Chart, Legend & Axis) ── */}
      <UnifiedCapitalAllocationCard
        liquidAssetsTotal={liquidAssetsTotal}
        growthAssetsTotal={growthAssetsTotal}
        fixedAssetsTotal={fixedAssetsTotal}
        liabilitiesTotal={liabilitiesTotal}
        totalGrossAssets={totalGrossAssets}
        netWorth={netWorth}
        solvencyScore={solvencyScore}
        debtToAssetRatio={debtToAssetRatio}
        liquidPct={liquidPct}
        growthPct={growthPct}
        fixedPct={fixedPct}
        capitalDeployment={capitalDeployment}
        isStealthMode={isStealthMode}
        isIndonesian={isIndonesian}
        isDark={isDark}
        onOpenLiquidDetail={openLiquidDetail}
        onOpenGrowthDetail={openGrowthDetail}
        onOpenFixedDetail={openFixedDetail}
        onOpenDebtDetail={openDebtDetail}
        onOpenConsolidatedDrawer={() => {
          triggerHaptic("light");
          setIsConsolidatedDrawerOpen(true);
        }}
      />

      {/* ── 5. Portfolio Health & Risk Intelligence Deck (Performance & Risk) ── */}
      <PortfolioIntelligenceDeck
        holdings={holdings}
        wallets={wallets}
        netWorth={netWorth}
      />

      {/* ── 6. Wealth History Card — Quiet Wealth × Liquid Island ── */}
      <WealthHistoryTrajectoryCard
        netWorth={netWorth}
        assetTrend={assetTrend}
        bsRange={bsRange}
        onChangeRange={setBsRange}
        bsRangeLabels={bsRangeLabels}
        chartPeak={chartPeak}
        chartTrough={chartTrough}
        capitalDeployment={capitalDeployment}
        isStealthMode={isStealthMode}
        onToggleStealthMode={toggleStealthMode}
        isIndonesian={isIndonesian}
        isDark={isDark}
      />

      {/* ── 7. Live Holdings Workstation Deck (Web Parity Ergonomics) ── */}
      <PortfolioHoldingsDeck
        holdings={holdings}
        displayHoldings={displayHoldings}
        usdtPref={usdtPref}
        recordedCryptoBalance={recordedCryptoBalance}
        suggestedUsdtUnits={suggestedUsdtUnits}
        usdtMarketValue={usdtMarketValue}
        usdtFloatingPnLPct={usdtFloatingPnLPct}
        totalGrossAssets={totalGrossAssets}
        isStealthMode={isStealthMode}
        isIndonesian={isIndonesian}
        onOpenAddAsset={() => setIsAddAssetModalOpen(true)}
        onOpenUsdtDetail={openUsdtDetail}
        onOpenHoldingDetail={handleOpenHoldingDetail}
        onOpenConsolidatedDrawer={() => setIsConsolidatedDrawerOpen(true)}
      />

      {/* ── 8. Wealth Intelligence & Actionable Insights Deck (Pinned at Bottom) ── */}
      <WealthTacticalInsightsDeck
        holdings={holdings}
        wallets={wallets}
        netWorth={netWorth}
        totalLiabilities={liabilitiesTotal}
        monthlyBurnRate={computedMonthlyBurn}
      />

      {/* ── 9. Modals, Drawers & Drill-Down Sheets Container ── */}
      <AssetsModalsContainer
        userId={user?.id}
        isAddAssetModalOpen={isAddAssetModalOpen}
        onCloseAddAssetModal={() => setIsAddAssetModalOpen(false)}
        isConvertModalOpen={isConvertModalOpen}
        onCloseConvertModal={() => setIsConvertModalOpen(false)}
        unlinkedCryptoWallet={unlinkedCryptoWallet}
        selectedDetailHolding={selectedDetailHolding}
        onSelectDetailHolding={setSelectedDetailHolding}
        onDeleteHolding={handleDeleteHolding}
        isStakingModalOpen={isStakingModalOpen}
        onCloseStakingModal={() => setIsStakingModalOpen(false)}
        isConsolidatedDrawerOpen={isConsolidatedDrawerOpen}
        onCloseConsolidatedDrawer={() => setIsConsolidatedDrawerOpen(false)}
        selectedMetricDrillDown={selectedMetricDrillDown}
        onCloseMetricDrillDown={() => setSelectedMetricDrillDown(null)}
        holdings={holdings}
        onHoldingsChange={setHoldings}
        usdtPref={usdtPref}
        onUsdtPrefChange={setUsdtPref}
        usdtUnits={usdtUnits}
        usdtRate={usdtRate}
        usdtCostBasis={usdtCostBasis}
        usdtMarketValue={usdtMarketValue}
        usdtFloatingPnLPct={usdtFloatingPnLPct}
        suggestedUsdtUnits={suggestedUsdtUnits}
        recordedCryptoBalance={recordedCryptoBalance}
        netWorth={netWorth}
        totalGrossAssets={totalGrossAssets}
        liabilitiesTotal={liabilitiesTotal}
        liquidAssetsTotal={liquidAssetsTotal}
        growthAssetsTotal={growthAssetsTotal}
        fixedAssetsTotal={fixedAssetsTotal}
        wallets={wallets}
        balancesById={balancesById}
        liquidHoldings={liquidHoldings}
        fixedHoldings={fixedHoldings}
        onOpenUsdtDetail={openUsdtDetail}
        onOpenHoldingDetail={handleOpenHoldingDetail}
        isStealthMode={isStealthMode}
        isIndonesian={isIndonesian}
        isDark={isDark}
      />

      {/* ── 9. Dedicated Cash Account Detail Sheet ── */}
      <CashAccountDetailSheet
        isOpen={!!selectedCashWallet}
        onClose={() => setSelectedCashWallet(null)}
        wallet={selectedCashWallet}
        onEditWallet={(w) => {
          setEditingWallet(w);
          setIsWalletManagementOpen(true);
        }}
      />

      {/* ── 10. Direct Wallet Management Sheet for Account Card Detail ── */}
      <WalletManagementSheets
        isOpen={isWalletManagementOpen}
        onClose={() => {
          setIsWalletManagementOpen(false);
          setEditingWallet(null);
        }}
        initialWalletToEdit={editingWallet}
      />
    </div>
  );
}
