import { useState, useMemo, useEffect, useRef } from "react";
import {
  RefreshCw,
  Plus,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Search,
  TrendingUp,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { BottomSheet } from "../ui/BottomSheet";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { IconRenderer } from "../ui/IconRenderer";
import { MonochromeIconPickerModal } from "../ui/MonochromeIconPickerModal";
import { AssetDetailSheet } from "./AssetDetailSheet";
import { StakingYieldModal } from "./StakingYieldModal";
import { autoSuggestIcon } from "../../lib/iconRegistry";
import { formatLiveAmountInput } from "../../lib/utils";
import { triggerHaptic } from "../../lib/haptics";
import { useToast } from "../../contexts/ToastContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import { usePrivacy } from "../../contexts/PrivacyContext";
import {
  useWallets,
  saveWalletClassification,
  resolveWalletClassification,
} from "../../hooks/useWallets";
import { useWalletBalances } from "../../hooks/useWalletBalances";
import { useAuth } from "../../contexts/AuthContext";
import { useAllTransactions } from "../../hooks/useTransactions";
import {
  auditUsdtReconciliation,
  applyUsdtReconciliation,
  dismissReconciliationTxIds,
} from "../../lib/holdingSyncEngine";
import {
  fetchUsdtPriceInIDR,
  fetchCryptoPriceInIDR,
  fetchStockPriceInIDR,
  getSavedHoldings,
  getSavedUsdtPref,
  getStandardUsdtHoldingId,
  saveUsdtPref,
  upsertHolding,
  deleteHolding,
  calculateHoldingValuation,
  calculatePortfolioSummary,
  fetchHoldingsFromSupabase,
  refreshAllPortfolioPrices,
  USD_IDR_ESTIMATE,
} from "../../lib/marketPriceService";
import type { InvestmentHolding, AssetType } from "../../lib/types";
import type { UsdtValuationPref } from "../../lib/marketPriceService";
import {
  PRESET_ASSETS,
  getPresetName,
  getPresetSymbol,
  type PresetAsset,
  type PresetCategory,
} from "../../lib/assetPresets";

function parseCleanNumber(val: string): number {
  if (!val) return 0;
  const s = val.trim();
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");

  if (lastDot !== -1 && lastComma !== -1) {
    if (lastComma > lastDot) {
      return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
    } else {
      return parseFloat(s.replace(/,/g, "")) || 0;
    }
  } else if (lastComma !== -1) {
    const commaCount = (s.match(/,/g) || []).length;
    if (commaCount > 1) {
      return parseFloat(s.replace(/,/g, "")) || 0;
    }
    return parseFloat(s.replace(",", ".")) || 0;
  } else if (lastDot !== -1) {
    const dotCount = (s.match(/\./g) || []).length;
    if (dotCount > 1) {
      return parseFloat(s.replace(/\./g, "")) || 0;
    }
    return parseFloat(s) || 0;
  }
  return parseFloat(s) || 0;
}

function formatHoldingPrice(
  val: number | string | null | undefined,
  currency: "IDR" | "USD",
): string {
  if (val === null || val === undefined || val === "") return "";
  const num = typeof val === "number" ? val : parseCleanNumber(String(val));
  if (num <= 0) return "";
  const { display } = formatLiveAmountInput(
    String(num),
    currency === "IDR",
    currency === "USD",
    currency === "USD" ? 4 : 0,
  );
  return display;
}

const getTypeLabel = (type: string, isIndonesian: boolean): string => {
  const labels: Record<string, { en: string; id: string }> = {
    all: { en: "All", id: "Semua" },
    fixed_asset: { en: "Fixed Asset", id: "Aset Tetap" },
    stock: { en: "Stocks", id: "Saham" },
    crypto: { en: "Crypto", id: "Kripto" },
    gold: { en: "Gold", id: "Emas" },
    mutual_fund: { en: "Funds", id: "Reksadana" },
    bond: { en: "Bonds", id: "Obligasi" },
  };
  const item = labels[type];
  if (!item) return type.replace("_", " ");
  return isIndonesian ? item.id : item.en;
};

interface AssetValuationSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AssetValuationSheet({
  isOpen,
  onClose,
}: AssetValuationSheetProps) {
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const { showToast } = useToast();
  const { isIndonesian } = useLanguage();
  const { formatWithPreferred, currencyMeta } = useCurrency();
  const { isStealthMode } = usePrivacy();
  const { data: wallets = [], refetch: refetchWallets } = useWallets();
  const { balancesByName } = useWalletBalances();
  const [editingHoldingId, setEditingHoldingId] = useState<string | null>(null);

  // Find crypto wallet
  const cryptoWallet = useMemo(() => {
    return (
      wallets.find(
        (w) =>
          w.name.trim().toLowerCase() === "crypto" ||
          w.name.trim().toLowerCase() === "usdt",
      ) || null
    );
  }, [wallets]);

  const { user } = useAuth();

  // Current recorded capital in app
  const recordedCryptoBalance = useMemo(() => {
    if (!cryptoWallet) return 0;
    return balancesByName[cryptoWallet.name.toLowerCase()] || 0;
  }, [cryptoWallet, balancesByName]);

  // USDT Valuation State (Scoped to current user)
  const [usdtPref, setUsdtPref] = useState<UsdtValuationPref>(() =>
    getSavedUsdtPref(user?.id),
  );
  const [holdings, setHoldings] = useState<InvestmentHolding[]>(() =>
    getSavedHoldings(user?.id),
  );

  // Sync state when user changes
  useEffect(() => {
    setUsdtPref(getSavedUsdtPref(user?.id));
    setHoldings(getSavedHoldings(user?.id));
    if (user?.id && user.id !== "guest_local_user") {
      fetchHoldingsFromSupabase(user.id).then((cloudHoldings) => {
        setHoldings(cloudHoldings);
        setUsdtPref(getSavedUsdtPref(user.id));
      });
    }
  }, [user?.id]);

  // Automatically refresh live USDT rate and sync cloud holdings upon sheet open
  useEffect(() => {
    if (!isOpen) return;
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
            setUsdtPref((prev) => ({ ...prev, rate: usdtRate }));
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
  }, [isOpen, user?.id]);

  // Check if crypto wallet is classified as liquid cash
  const isCryptoLiquid = useMemo(() => {
    if (!cryptoWallet) return false;
    const currentClass = resolveWalletClassification(cryptoWallet);
    return currentClass === "liquid";
  }, [cryptoWallet]);

  // Live Rate Fetching State
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [dismissedReconciliation, setDismissedReconciliation] = useState(false);

  const { data: allTxs = [] } = useAllTransactions();

  // Audit discrepancy between transactions and USDT units
  const reconciliationAudit = useMemo(() => {
    return auditUsdtReconciliation(allTxs, wallets, user?.id);
  }, [allTxs, wallets, user?.id]);

  // Handle applying reconciliation
  const handleApplyReconciliation = () => {
    if (!reconciliationAudit.hasDiscrepancy) return;
    triggerHaptic("medium");
    const res = applyUsdtReconciliation(reconciliationAudit, user?.id);
    setUsdtPref((prev) => ({ ...prev, units: res.updatedUnits }));
    setDismissedReconciliation(true);
    showToast(
      isIndonesian
        ? `Unit USDT disinkronkan ke ${res.updatedUnits} USDT`
        : `USDT holding synced to ${res.updatedUnits} USDT`,
      "update",
      () => {},
    );
  };

  // Staking Yield Quick Modal State
  const [isStakingModalOpen, setIsStakingModalOpen] = useState(false);

  // ── Add Holding: Two-Phase Flow ──────────────────────────────────────────────
  const [addPhase, setAddPhase] = useState<0 | 1 | 2>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [presetCategory, setPresetCategory] = useState<PresetCategory>("all");
  const [formSymbol, setFormSymbol] = useState("");
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<AssetType>("stock");
  const [formCurrency, setFormCurrency] = useState<"IDR" | "USD">("IDR");
  const [formPlatform, setFormPlatform] = useState<string>("");
  const [formUnits, setFormUnits] = useState("1");
  const [formBuyPrice, setFormBuyPrice] = useState("");
  const [formCurrentPrice, setFormCurrentPrice] = useState("");
  const [selectedDetailHolding, setSelectedDetailHolding] =
    useState<InvestmentHolding | null>(null);
  const [isFetchingCurrentPrice, setIsFetchingCurrentPrice] = useState(false);
  const [formIcon, setFormIcon] = useState("TrendingUp");
  const [hasCustomPickedAssetIcon, setHasCustomPickedAssetIcon] =
    useState(false);
  const [isAssetIconPickerOpen, setIsAssetIconPickerOpen] = useState(false);
  const [formPurchaseDate, setFormPurchaseDate] = useState<string>(() =>
    format(new Date(), "yyyy-MM-dd"),
  );
  const searchInputRef = useRef<HTMLInputElement>(null);


  const openAssetPicker = () => {
    triggerHaptic("light");
    setSearchQuery("");
    setPresetCategory("all");
    setAddPhase(1);
  };

  const handleSelectPreset = async (preset: PresetAsset) => {
    triggerHaptic("medium");
    const selectedSymbol = getPresetSymbol(preset, isIndonesian);
    const selectedName = getPresetName(preset, isIndonesian);
    setFormSymbol(selectedSymbol);
    setFormName(selectedName);
    setFormType(preset.type);
    setFormIcon(preset.icon || "TrendingUp");
    setFormCurrency(preset.suggestedCurrency || "IDR");
    setFormPlatform("");
    setFormUnits(preset.type === "fixed_asset" ? "1" : "");
    setFormBuyPrice("");
    setFormCurrentPrice("");
    setFormPurchaseDate(new Date().toISOString().split("T")[0]);
    setAddPhase(2);

    if (preset.type !== "fixed_asset") {
      setIsFetchingCurrentPrice(true);
      try {
        let livePrice: number | null = null;
        if (preset.type === "crypto") {
          livePrice = await fetchCryptoPriceInIDR(preset.symbol);
        } else if (preset.type === "stock") {
          livePrice = await fetchStockPriceInIDR(preset.symbol);
        }
        if (livePrice && livePrice > 0) {
          if (preset.suggestedCurrency === "USD" && usdtPref.rate > 0) {
            const usdPrice = parseFloat((livePrice / usdtPref.rate).toFixed(2));
            setFormCurrentPrice(formatHoldingPrice(usdPrice, "USD"));
            setFormBuyPrice(formatHoldingPrice(usdPrice, "USD"));
          } else {
            setFormCurrentPrice(formatHoldingPrice(livePrice, "IDR"));
            setFormBuyPrice(formatHoldingPrice(livePrice, "IDR"));
          }
        }
      } catch {
        // fallback silently
      } finally {
        setIsFetchingCurrentPrice(false);
      }
    }
  };

  const handleCustomAssetEntry = (type: AssetType = "fixed_asset") => {
    triggerHaptic("medium");
    setFormType(type);
    setFormSymbol(
      type === "fixed_asset"
        ? `FIXED-${Date.now().toString().slice(-4)}`
        : searchQuery.trim().toUpperCase() || "CUSTOM",
    );
    setFormName(searchQuery.trim() || "");
    setFormCurrency("IDR");
    setFormPlatform("");
    setFormIcon(type === "fixed_asset" ? "Building2" : "TrendingUp");
    setFormUnits(type === "fixed_asset" ? "1" : "");
    setFormBuyPrice("");
    setFormCurrentPrice("");
    setFormPurchaseDate(new Date().toISOString().split("T")[0]);
    setAddPhase(2);
  };

  const closeAddFlow = () => {
    setAddPhase(0);
    setSearchQuery("");
    setFormIcon("TrendingUp");
    setHasCustomPickedAssetIcon(false);
    setEditingHoldingId(null);
    setFormPlatform("");
    setFormCurrency("IDR");
    setFormPurchaseDate(format(new Date(), "yyyy-MM-dd"));
  };

  const filteredPresets = useMemo(() => {
    return PRESET_ASSETS.filter((preset) => {
      const matchCategory =
        presetCategory === "all" || preset.category === presetCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchQuery =
        !q ||
        preset.symbol.toLowerCase().includes(q) ||
        (preset.symbolId && preset.symbolId.toLowerCase().includes(q)) ||
        preset.name.toLowerCase().includes(q) ||
        (preset.nameId && preset.nameId.toLowerCase().includes(q));
      return matchCategory && matchQuery;
    });
  }, [searchQuery, presetCategory]);

  // Calculations for USDT
  const usdtMarketValue = Math.round(usdtPref.units * usdtPref.rate);
  const usdtCostBasis =
    usdtPref.units > 0 ? usdtPref.costBasis || recordedCryptoBalance : 0;
  const usdtFloatingPnL =
    usdtPref.units > 0 ? usdtMarketValue - usdtCostBasis : 0;
  const usdtFloatingPnLPct =
    usdtCostBasis > 0 ? (usdtFloatingPnL / usdtCostBasis) * 100 : 0;

  const suggestedUsdtUnits = useMemo(() => {
    return usdtPref.rate > 0
      ? Math.round((recordedCryptoBalance / usdtPref.rate) * 100) / 100
      : 0;
  }, [recordedCryptoBalance, usdtPref.rate]);

  // Split holdings
  const otherHoldingsSummary = useMemo(() => {
    const nonUsdtHoldings = holdings.filter(
      (h) => h.symbol?.toUpperCase() !== "USDT",
    );
    return calculatePortfolioSummary(nonUsdtHoldings);
  }, [holdings]);

  const liquidHoldings = useMemo(() => {
    return holdings.filter(
      (h) =>
        h.symbol?.toUpperCase() !== "USDT" && h.asset_type !== "fixed_asset",
    );
  }, [holdings]);

  const fixedHoldings = useMemo(() => {
    return holdings.filter(
      (h) =>
        h.symbol?.toUpperCase() !== "USDT" && h.asset_type === "fixed_asset",
    );
  }, [holdings]);

  // Subtotals
  const liquidSubtotal = useMemo(() => {
    const liquidSummary = calculatePortfolioSummary(liquidHoldings);
    const totalMarketValue = usdtMarketValue + liquidSummary.totalMarketValue;
    const totalCostBasis = usdtCostBasis + liquidSummary.totalCostBasis;
    const floatingPnL = totalMarketValue - totalCostBasis;
    const floatingPnLPct =
      totalCostBasis > 0 ? (floatingPnL / totalCostBasis) * 100 : 0;
    const count =
      (usdtPref.units > 0 || recordedCryptoBalance > 0 ? 1 : 0) +
      liquidHoldings.length;
    return {
      totalMarketValue,
      totalCostBasis,
      floatingPnL,
      floatingPnLPct,
      count,
    };
  }, [
    liquidHoldings,
    usdtMarketValue,
    usdtCostBasis,
    usdtPref.units,
    recordedCryptoBalance,
  ]);

  const fixedSubtotal = useMemo(() => {
    const fixedSummary = calculatePortfolioSummary(fixedHoldings);
    return {
      totalMarketValue: fixedSummary.totalMarketValue,
      totalCostBasis: fixedSummary.totalCostBasis,
      floatingPnL: fixedSummary.totalFloatingPnL,
      floatingPnLPct: fixedSummary.totalFloatingPnLPct,
      count: fixedHoldings.length,
    };
  }, [fixedHoldings]);

  const openUsdtDetail = () => {
    triggerHaptic("light");
    const existingUsdt = holdings.find(
      (h) => h.symbol?.toUpperCase() === "USDT" || h.id.startsWith("usdt-"),
    );
    const usdtHolding: InvestmentHolding = {
      id: existingUsdt?.id || getStandardUsdtHoldingId(user?.id),
      symbol: "USDT",
      name: "Tether USD",
      asset_type: "crypto",
      units:
        usdtPref.units > 0
          ? usdtPref.units
          : existingUsdt?.units || suggestedUsdtUnits,
      avg_buy_price:
        usdtPref.units > 0
          ? Math.round(usdtCostBasis / usdtPref.units)
          : existingUsdt?.avg_buy_price || usdtPref.rate,
      current_price: usdtPref.rate,
      currency: "IDR",
      icon: "Coins",
      activities:
        existingUsdt?.activities && existingUsdt.activities.length > 0
          ? existingUsdt.activities
          : undefined,
    };
    setSelectedDetailHolding(usdtHolding);
  };

  // Grand totals
  const totalCostBasis = usdtCostBasis + otherHoldingsSummary.totalCostBasis;
  const totalMarketValuation =
    usdtMarketValue + otherHoldingsSummary.totalMarketValue;
  const totalFloatingProfit = totalMarketValuation - totalCostBasis;
  const totalFloatingProfitPct =
    totalCostBasis > 0 ? (totalFloatingProfit / totalCostBasis) * 100 : 0;

  const handleToggleCryptoLiquid = () => {
    triggerHaptic("medium");
    if (!cryptoWallet) {
      showToast(
        isIndonesian
          ? "Akun kripto tidak ditemukan"
          : "Crypto account not found",
        "delete",
        () => {},
      );
      return;
    }
    const nextClass = isCryptoLiquid ? "investment" : "liquid";
    saveWalletClassification(cryptoWallet.id, nextClass);
    saveWalletClassification(cryptoWallet.name, nextClass);
    refetchWallets();
    showToast(
      nextClass === "liquid"
        ? isIndonesian
          ? "Kripto dihitung sebagai Kas Likuid"
          : "Crypto included in Liquid Cash"
        : isIndonesian
          ? "Kripto diklasifikasikan sebagai Aset Investasi"
          : "Crypto classified as Investment Asset",
      "update",
      () => {},
    );
  };

  const handleFetchLiveRate = async () => {
    triggerHaptic("light");
    setIsFetchingRate(true);
    try {
      const rate = await fetchUsdtPriceInIDR();
      if (rate && rate > 5000 && rate < 50000) {
        const nextPref = { ...usdtPref, rate };
        setUsdtPref(nextPref);
        saveUsdtPref(nextPref, user?.id);
        showToast(
          isIndonesian
            ? `Kurs live diperbarui: ${formatWithPreferred(rate)}/USDT`
            : `Live rate updated: ${formatWithPreferred(rate)}/USDT`,
          "add",
          () => {},
        );
      } else {
        showToast(
          isIndonesian
            ? "Gagal memperbarui kurs live"
            : "Failed to fetch live rate",
          "delete",
          () => {},
        );
      }
    } catch {
      showToast(
        isIndonesian
          ? "Gagal memperbarui kurs live"
          : "Failed to fetch live rate",
        "delete",
        () => {},
      );
    } finally {
      setIsFetchingRate(false);
    }
  };

  const handleSaveNewHolding = () => {
    if (!formName.trim()) {
      showToast(
        isIndonesian ? "Masukkan nama aset" : "Asset name is required",
        "delete",
        () => {},
      );
      return;
    }

    const units = formType === "fixed_asset" ? 1 : parseCleanNumber(formUnits);
    const rawBuy = parseCleanNumber(formBuyPrice);
    const rawCurrent = parseCleanNumber(formCurrentPrice) || rawBuy;

    if (isNaN(units) || units <= 0 || isNaN(rawBuy) || rawBuy <= 0) {
      showToast(
        isIndonesian
          ? "Masukkan nominal yang valid"
          : "Please enter valid amounts",
        "delete",
        () => {},
      );
      return;
    }

    const liveRate = usdtPref.rate > 0 ? usdtPref.rate : 16000;
    const buyPrice = formCurrency === "USD" ? rawBuy * liveRate : rawBuy;
    const currentPrice =
      formCurrency === "USD" ? rawCurrent * liveRate : rawCurrent;

    const symbol =
      formSymbol.trim() ||
      (formType === "fixed_asset"
        ? "ASSET"
        : formName.slice(0, 5).toUpperCase());

    if (symbol.toUpperCase() === "USDT") {
      const updatedPref: UsdtValuationPref = {
        units,
        costBasis: buyPrice * units,
        rate: currentPrice || usdtPref.rate,
      };
      setUsdtPref(updatedPref);
      saveUsdtPref(updatedPref, user?.id);
      closeAddFlow();
      triggerHaptic("medium");
      showToast(
        isIndonesian
          ? "Holding USDT berhasil disimpan"
          : "USDT holding saved successfully",
        "add",
        () => {},
      );
      return;
    }

    const newH: InvestmentHolding = {
      id: editingHoldingId || `h_${Date.now()}`,
      symbol: symbol.toUpperCase(),
      name: formName.trim(),
      asset_type: formType,
      units,
      avg_buy_price: buyPrice,
      current_price: currentPrice,
      currency: formCurrency,
      last_price_updated_at: new Date().toISOString(),
      icon: formIcon,
      purchase_date: formPurchaseDate || undefined,
      notes: formPlatform ? `Platform: ${formPlatform}` : undefined,
    };

    const updated = upsertHolding(newH, user?.id);
    setHoldings(updated);
    closeAddFlow();
    triggerHaptic("medium");
    showToast(
      isIndonesian ? "Aset berhasil disimpan" : "Asset saved successfully",
      "add",
      () => {},
    );
  };

  const handleStartEditHolding = (h: InvestmentHolding) => {
    triggerHaptic("light");
    setEditingHoldingId(h.id);
    setFormSymbol(h.symbol);
    setFormName(h.name);
    setFormType(h.asset_type);
    setFormUnits(String(h.units));
    const isUsd = h.currency === "USD";
    const liveRate = usdtPref.rate > 0 ? usdtPref.rate : 16000;
    setFormCurrency(isUsd ? "USD" : "IDR");
    setFormBuyPrice(
      formatHoldingPrice(
        isUsd ? parseFloat((h.avg_buy_price / liveRate).toFixed(2)) : h.avg_buy_price,
        isUsd ? "USD" : "IDR",
      ),
    );
    setFormCurrentPrice(
      formatHoldingPrice(
        isUsd
          ? parseFloat(
              ((h.current_price || h.avg_buy_price) / liveRate).toFixed(2),
            )
          : h.current_price || h.avg_buy_price,
        isUsd ? "USD" : "IDR",
      ),
    );
    setFormIcon(h.icon || getDefaultAssetIconName(h.asset_type));
    setFormPlatform(
      h.notes?.startsWith("Platform: ")
        ? h.notes.replace("Platform: ", "")
        : "",
    );
    setFormPurchaseDate(h.purchase_date || "");
    setAddPhase(2);
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
      isIndonesian ? `${name} berhasil dihapus` : `${name} removed`,
      "delete",
      () => {},
    );
  };

  const getDefaultAssetIconName = (type: AssetType): string => {
    switch (type) {
      case "fixed_asset":
        return "Building2";
      case "crypto":
        return "Coins";
      case "gold":
        return "Landmark";
      case "mutual_fund":
        return "TrendingUp";
      case "bond":
        return "ShieldCheck";
      default:
        return "TrendingUp";
    }
  };

  // Materials
  const controlBg = isDark
    ? "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)"
    : "linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.72) 100%)";

  const controlBorder = isDark
    ? "1px solid rgba(255,255,255,0.09)"
    : "1px solid rgba(0,0,0,0.065)";

  const controlShadow = isDark
    ? "inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 7px rgba(0,0,0,0.22)"
    : "inset 0 1px 0 #ffffff, 0 2px 6px rgba(30,35,50,0.04)";

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div
        className="px-5 pt-2 space-y-4 max-w-xl mx-auto"
        style={{
          paddingBottom:
            "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 32px)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-white/90 animate-pulse" />
            <div>
              <h3 className="text-[17px] font-semibold tracking-tight text-[var(--text-primary)] leading-tight">
                {isIndonesian ? "Valuasi Portofolio" : "Asset Valuation"}
              </h3>
              <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                {isIndonesian
                  ? "Kalkulasi laba/rugi pasar & aset berwujud secara langsung"
                  : "Live market valuation & unrealized portfolio P&L"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isIndonesian ? "Tutup" : "Close"}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90 cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            style={{
              background: controlBg,
              border: controlBorder,
              boxShadow: controlShadow,
            }}
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        {/* 1. Grand Apple Hero Valuation Card (Physical Liquid Glass) */}
        <div
          className="relative rounded-3xl p-5 overflow-hidden transition-all"
          style={{
            background: isDark
              ? "linear-gradient(145deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.025) 100%)"
              : "linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(246,247,250,0.9) 100%)",
            border: isDark
              ? "1px solid rgba(255,255,255,0.13)"
              : "1px solid rgba(0,0,0,0.08)",
            boxShadow: isDark
              ? "0 18px 44px -12px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.18)"
              : "0 12px 30px -8px rgba(0,0,0,0.06), inset 0 1px 0 #ffffff",
          }}
        >
          {/* Top Specular Rim Reflection */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-[6%] right-[6%] top-[1px] h-[1.5px] rounded-full"
            style={{
              background: isDark
                ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), rgba(255,255,255,0.45), rgba(255,255,255,0.25), transparent)"
                : "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), rgba(255,255,255,1), rgba(255,255,255,0.8), transparent)",
            }}
          />

          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              {isIndonesian ? "Total Nilai Bersih" : "Total Net Valuation"}
            </span>

            {/* Apple Luxury Monochrome P&L Badge */}
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11.5px] font-semibold shrink-0 select-none"
              style={{
                background:
                  totalFloatingProfit >= 0
                    ? isDark
                      ? "#ffffff"
                      : "#18181b"
                    : isDark
                      ? "rgba(255,255,255,0.1)"
                      : "rgba(0,0,0,0.07)",
                color:
                  totalFloatingProfit >= 0
                    ? isDark
                      ? "#000000"
                      : "#ffffff"
                    : "var(--text-primary)",
                boxShadow: isDark
                  ? "0 2px 8px rgba(0,0,0,0.3)"
                  : "0 2px 6px rgba(0,0,0,0.06)",
              }}
            >
              {totalFloatingProfit >= 0 ? (
                <ArrowUpRight size={13} strokeWidth={2.5} />
              ) : (
                <ArrowDownRight size={13} strokeWidth={2.5} />
              )}
              <span className="">
                {totalFloatingProfit >= 0 ? "+" : ""}
                {formatWithPreferred(totalFloatingProfit)} (
                {totalFloatingProfitPct >= 0 ? "+" : ""}
                {totalFloatingProfitPct.toFixed(2)}%)
              </span>
            </div>
          </div>

          <p className="amount text-[32px] sm:text-[36px] font-semibold tracking-tight text-[var(--text-primary)] leading-none my-1">
            {isStealthMode
              ? `${currencyMeta?.symbol || "Rp"} ••••••••`
              : formatWithPreferred(totalMarketValuation)}
          </p>

          <div className="flex items-center justify-between pt-3 mt-3 border-t border-[var(--glass-border)]/40 text-[11.5px]">
            <span className="text-[var(--text-tertiary)]">
              {isIndonesian ? "Modal Pokok: " : "Cost Basis: "}
              <strong className="font-semibold text-[var(--text-secondary)] ">
                {formatWithPreferred(totalCostBasis)}
              </strong>
            </span>
            <span className="text-[var(--text-tertiary)]">
              {isIndonesian ? "Kurs USDT: " : "Live USD: "}
              <strong className=" font-semibold text-[var(--text-secondary)]">
                {formatWithPreferred(usdtPref.rate)}
              </strong>
            </span>
          </div>
        </div>

        {/* Quick Link Banner if USDT wallet has balance but units are 0 */}
        {usdtPref.units <= 0 && recordedCryptoBalance > 0 && (
          <div
            className="p-3.5 rounded-2xl flex items-center justify-between gap-3 transition-all"
            style={{
              background: controlBg,
              border: controlBorder,
              boxShadow: controlShadow,
            }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "var(--glass-fill)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                <Coins size={16} className="text-[var(--text-primary)]" />
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
                  {isIndonesian
                    ? "Saldo Brankas USDT Ditemukan"
                    : "USDT Wallet Balance Detected"}
                </p>
                <p className="text-[11px] text-[var(--text-tertiary)]  truncate">
                  {isStealthMode
                    ? `${currencyMeta?.symbol || "Rp"} ••••••••`
                    : formatWithPreferred(recordedCryptoBalance)}{" "}
                  (~{suggestedUsdtUnits} USDT)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                triggerHaptic("medium");
                const updated = {
                  units: suggestedUsdtUnits,
                  rate: usdtPref.rate,
                  costBasis: recordedCryptoBalance,
                };
                setUsdtPref(updated);
                saveUsdtPref(updated, user?.id);
                showToast(
                  isIndonesian
                    ? `Berhasil menghubungkan ${suggestedUsdtUnits} USDT ke portofolio`
                    : `Linked ${suggestedUsdtUnits} USDT to portfolio`,
                  "add",
                  () => {},
                );
              }}
              className="px-3.5 py-1.5 rounded-full text-[11px] font-semibold shrink-0 active:scale-95 transition-all cursor-pointer"
              style={{
                background: isDark ? "#ffffff" : "#18181b",
                color: isDark ? "#000000" : "#ffffff",
              }}
            >
              {isIndonesian ? "Hubungkan Unit" : "Link Units"}
            </button>
          </div>
        )}

        {/* 2. Unified Asset Deck Header & Actions */}
        <div className="flex items-center justify-between px-1 pt-1">
          <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            {isIndonesian ? "Daftar Kepemilikan" : "Holdings Deck"} (
            {(usdtPref.units > 0 || recordedCryptoBalance > 0 ? 1 : 0) +
              holdings.length}
            )
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFetchLiveRate}
              disabled={isFetchingRate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold active:scale-95 cursor-pointer transition-all"
              style={{
                background: controlBg,
                border: controlBorder,
                boxShadow: controlShadow,
                color: "var(--text-secondary)",
              }}
              title={
                isIndonesian ? "Perbarui kurs langsung" : "Refresh live FX"
              }
            >
              <RefreshCw
                size={11}
                className={isFetchingRate ? "animate-spin" : ""}
              />
              <span>
                {isFetchingRate
                  ? isIndonesian
                    ? "Memuat..."
                    : "Fetching..."
                  : isIndonesian
                    ? "Kurs Live"
                    : "Live FX"}
              </span>
            </button>
            {addPhase === 0 && (
              <button
                type="button"
                onClick={openAssetPicker}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-semibold active:scale-95 cursor-pointer transition-all shadow-sm"
                style={{
                  background: isDark ? "#ffffff" : "#18181b",
                  color: isDark ? "#000000" : "#ffffff",
                }}
              >
                <Plus size={12} strokeWidth={2.5} />
                <span>{isIndonesian ? "Tambah Aset" : "Add Asset"}</span>
              </button>
            )}
          </div>
        </div>

        {/* 3. Holdings Deck Sections */}
        <div className="space-y-4">
          {/* A. Liquid Market Portfolios Section */}
          {liquidSubtotal.count > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5">
                  <TrendingUp
                    size={13}
                    strokeWidth={2}
                    className="text-[var(--text-secondary)]"
                  />
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    {isIndonesian ? "Portofolio Likuid" : "Liquid Portfolios"}
                  </h4>
                  <span className="text-[10px]  px-2 py-0.5 rounded-full bg-white/[0.06] text-[var(--text-tertiary)] border border-[var(--glass-border)]">
                    {liquidSubtotal.count}
                  </span>
                </div>
                <span className="text-[12px]  font-semibold text-[var(--text-primary)]">
                  {isStealthMode
                    ? `${currencyMeta?.symbol || "Rp"} ••••••••`
                    : formatWithPreferred(liquidSubtotal.totalMarketValue)}
                </span>
              </div>

              {/* Core USDT Holding Row with Quick Toggle */}
              {(usdtPref.units > 0 || recordedCryptoBalance > 0) && (
                <div
                  className="p-3.5 rounded-2xl space-y-3 transition-all"
                  style={{
                    background: controlBg,
                    border: controlBorder,
                    boxShadow: controlShadow,
                  }}
                >
                  <div
                    onClick={openUsdtDetail}
                    className="flex items-center justify-between gap-2.5 cursor-pointer active:scale-[0.99] transition-transform select-none"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          background: isDark
                            ? "rgba(255, 255, 255, 0.08)"
                            : "rgba(0, 0, 0, 0.05)",
                          border: isDark
                            ? "1px solid rgba(255, 255, 255, 0.12)"
                            : "1px solid rgba(0, 0, 0, 0.08)",
                        }}
                      >
                        <Coins
                          size={18}
                          className="text-[var(--text-primary)]"
                        />
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold  text-[12.5px] tracking-wide block leading-none text-[var(--text-primary)]">
                          USDT
                        </span>
                        <p className="text-[11px] font-medium truncate mt-1 leading-tight text-[var(--text-tertiary)]">
                          {usdtPref.units > 0
                            ? "Tether USD"
                            : isIndonesian
                              ? `Akun terhubung · ${suggestedUsdtUnits} USDT`
                              : `Account linked · ${suggestedUsdtUnits} USDT`}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[14px] font-semibold amount leading-none block whitespace-nowrap text-[var(--text-primary)] ">
                        {isStealthMode
                          ? `${currencyMeta?.symbol || "Rp"} ••••••••`
                          : usdtPref.units > 0
                            ? formatWithPreferred(usdtMarketValue)
                            : `~${formatWithPreferred(recordedCryptoBalance)}`}
                      </span>
                      <span className="text-[10.5px] font-semibold mt-1 inline-block whitespace-nowrap  text-[var(--text-secondary)]">
                        {usdtPref.units > 0
                          ? `${usdtFloatingPnL >= 0 ? "+" : ""}${formatWithPreferred(usdtFloatingPnL)} (${usdtFloatingPnLPct >= 0 ? "+" : ""}${usdtFloatingPnLPct.toFixed(1)}%)`
                          : isIndonesian
                            ? `Ketuk untuk kalibrasi (${suggestedUsdtUnits} USDT)`
                            : `Tap to calibrate (${suggestedUsdtUnits} USDT)`}
                      </span>
                    </div>
                  </div>

                  {/* Auto-Reconciliation Alert Banner (Monochrome Apple Style) */}
                  {reconciliationAudit.hasDiscrepancy &&
                    !dismissedReconciliation && (
                      <div
                        className="p-3 rounded-xl space-y-2 border transition-all"
                        style={{
                          background: isDark
                            ? "rgba(255, 255, 255, 0.04)"
                            : "rgba(0, 0, 0, 0.03)",
                          borderColor: isDark
                            ? "rgba(255, 255, 255, 0.12)"
                            : "rgba(0, 0, 0, 0.08)",
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <Sparkles
                                size={13}
                                className="text-[var(--text-primary)]"
                              />
                              <span className="text-[11px] font-semibold tracking-tight text-[var(--text-primary)]">
                                {isIndonesian
                                  ? "Sinkronisasi Transfer P2P Terbaru"
                                  : "Recent P2P Transfer Sync"}
                              </span>
                            </div>
                            <p className="text-[10.5px] leading-tight text-[var(--text-secondary)]">
                              {isIndonesian
                                ? `Penarikan P2P terbaru (${reconciliationAudit.unreconciledTxs[0]?.date || "18 Sep"} · ${formatWithPreferred(reconciliationAudit.unreconciledTxs[0]?.amount || 89624)}) belum dikurangkan dari unit kepemilikan.`
                                : `Recent P2P withdrawal (${reconciliationAudit.unreconciledTxs[0]?.date || "Sep 18"} · ${formatWithPreferred(reconciliationAudit.unreconciledTxs[0]?.amount || 89624)}) has not been deducted from holding units yet.`}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setDismissedReconciliation(true);
                              const txIds = reconciliationAudit.unreconciledTxs
                                .map((t) => t.id)
                                .filter(Boolean);
                              if (txIds.length > 0) {
                                dismissReconciliationTxIds(txIds, user?.id);
                                dismissReconciliationTxIds(txIds, undefined);
                              }
                            }}
                            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-0.5 transition-colors cursor-pointer"
                            title={isIndonesian ? "Tutup" : "Dismiss"}
                          >
                            <X size={12} strokeWidth={2} />
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-[11px]  pt-1 border-t border-[var(--glass-border)]/40">
                          <span className="text-[var(--text-tertiary)]">
                            {isIndonesian ? "Saat Ini:" : "Current:"}{" "}
                            <span className="text-[var(--text-primary)] font-semibold">
                              {reconciliationAudit.currentUnits} USDT
                            </span>
                          </span>
                          <span className="text-[var(--text-primary)] font-semibold">
                            {isIndonesian ? "→ Rekonsiliasi:" : "→ Reconcile:"}{" "}
                            {reconciliationAudit.suggestedReconciledUnits} USDT
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={handleApplyReconciliation}
                          className="w-full py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                          style={{
                            background: isDark ? "#ffffff" : "#18181b",
                            color: isDark ? "#000000" : "#ffffff",
                          }}
                        >
                          <CheckCircle2 size={12} strokeWidth={2} />
                          <span>
                            {isIndonesian
                              ? `Sesuaikan ke ${reconciliationAudit.suggestedReconciledUnits} USDT`
                              : `Adjust to ${reconciliationAudit.suggestedReconciledUnits} USDT`}
                          </span>
                        </button>
                      </div>
                    )}

                  {/* Quick Actions & Liquid Cash Switch */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--glass-border)]/40">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        setIsStakingModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold active:scale-95 cursor-pointer transition-all"
                      style={{
                        background: isDark
                          ? "rgba(255, 255, 255, 0.08)"
                          : "rgba(0, 0, 0, 0.05)",
                        border: "1px solid var(--glass-border)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <Plus size={12} strokeWidth={2} />
                      <span>
                        {isIndonesian ? "Imbal Hasil Staking" : "Staking Yield"}
                      </span>
                    </button>

                    <div
                      onClick={handleToggleCryptoLiquid}
                      className="flex items-center gap-2 cursor-pointer select-none active:scale-95 transition-transform"
                      title={
                        isIndonesian
                          ? "Alihkan USDT sebagai kas likuid operasional"
                          : "Toggle counting USDT as liquid operating cash"
                      }
                    >
                      <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
                        {isIndonesian
                          ? isCryptoLiquid
                            ? "Kas Likuid: Aktif"
                            : "Kas Likuid: Nonaktif"
                          : isCryptoLiquid
                            ? "Liquid Cash: On"
                            : "Liquid Cash: Off"}
                      </span>
                      <div onClick={(e) => e.stopPropagation()}>
                        <ToggleSwitch
                          checked={isCryptoLiquid}
                          onChange={handleToggleCryptoLiquid}
                          size="sm"
                          ariaLabel="Toggle USDT as liquid operating cash"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Liquid Holdings (Crypto, Stocks, Gold, Mutual Funds, Bonds) */}
              {liquidHoldings.map((h) => {
                const val = calculateHoldingValuation(h);
                return (
                  <div
                    key={h.id}
                    onClick={() => {
                      triggerHaptic("light");
                      setSelectedDetailHolding(h);
                    }}
                    className="p-3.5 rounded-2xl flex items-center justify-between gap-2.5 cursor-pointer active:scale-[0.99] transition-all select-none"
                    style={{
                      background: controlBg,
                      border: controlBorder,
                      boxShadow: controlShadow,
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          background: isDark
                            ? "rgba(255, 255, 255, 0.08)"
                            : "rgba(0, 0, 0, 0.05)",
                          border: isDark
                            ? "1px solid rgba(255, 255, 255, 0.12)"
                            : "1px solid rgba(0, 0, 0, 0.08)",
                        }}
                      >
                        <IconRenderer
                          icon={h.icon || getDefaultAssetIconName(h.asset_type)}
                          size="w-4.5 h-4.5"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold  text-[12.5px] tracking-wide block leading-none text-[var(--text-primary)]">
                            {h.symbol}
                          </span>
                          <span className="text-[9.5px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/[0.06] text-[var(--text-tertiary)] border border-[var(--glass-border)]">
                            {getTypeLabel(h.asset_type, isIndonesian)}
                          </span>
                        </div>
                        <p className="text-[11px] font-medium truncate mt-1 leading-tight text-[var(--text-tertiary)]">
                          {h.name}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[14px] font-semibold amount leading-none block whitespace-nowrap text-[var(--text-primary)] ">
                        {isStealthMode
                          ? `${currencyMeta?.symbol || "Rp"} ••••••••`
                          : formatWithPreferred(val.marketValue)}
                      </span>
                      <span className="text-[10.5px] font-semibold mt-1 inline-block whitespace-nowrap text-[var(--text-secondary)]">
                        {isStealthMode ? (
                          "••••••••"
                        ) : (
                          <>
                            {val.floatingPnL >= 0 ? "+" : ""}
                            {formatWithPreferred(val.floatingPnL)} (
                            {val.floatingPnLPct >= 0 ? "+" : ""}
                            {val.floatingPnLPct.toFixed(1)}%)
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* B. Fixed & Tangible Assets Section */}
          {fixedHoldings.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck
                    size={13}
                    strokeWidth={2}
                    className="text-[var(--text-secondary)]"
                  />
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    {isIndonesian
                      ? "Aset Tetap & Berwujud"
                      : "Fixed & Tangible Assets"}
                  </h4>
                  <span className="text-[10px]  px-2 py-0.5 rounded-full bg-white/[0.06] text-[var(--text-tertiary)] border border-[var(--glass-border)]">
                    {fixedHoldings.length}
                  </span>
                </div>
                <span className="text-[12px] font-semibold text-[var(--text-primary)]">
                  {isStealthMode
                    ? `${currencyMeta?.symbol || "Rp"} ••••••••`
                    : formatWithPreferred(fixedSubtotal.totalMarketValue)}
                </span>
              </div>

              {fixedHoldings.map((h) => {
                const val = calculateHoldingValuation(h);
                return (
                  <div
                    key={h.id}
                    onClick={() => {
                      triggerHaptic("light");
                      setSelectedDetailHolding(h);
                    }}
                    className="p-3.5 rounded-2xl flex items-center justify-between gap-2.5 cursor-pointer active:scale-[0.99] transition-all select-none"
                    style={{
                      background: controlBg,
                      border: controlBorder,
                      boxShadow: controlShadow,
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          background: isDark
                            ? "rgba(255, 255, 255, 0.08)"
                            : "rgba(0, 0, 0, 0.05)",
                          border: isDark
                            ? "1px solid rgba(255, 255, 255, 0.12)"
                            : "1px solid rgba(0, 0, 0, 0.08)",
                        }}
                      >
                        <IconRenderer
                          icon={h.icon || getDefaultAssetIconName(h.asset_type)}
                          size="w-4.5 h-4.5"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold  text-[12.5px] tracking-wide block leading-none text-[var(--text-primary)]">
                            {h.symbol}
                          </span>
                          <span className="text-[9.5px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/[0.06] text-[var(--text-tertiary)] border border-[var(--glass-border)]">
                            {getTypeLabel(h.asset_type, isIndonesian)}
                          </span>
                        </div>
                        <p className="text-[11px] font-medium truncate mt-1 leading-tight text-[var(--text-tertiary)]">
                          {h.name}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[14px] font-semibold amount leading-none block whitespace-nowrap text-[var(--text-primary)] ">
                        {isStealthMode
                          ? `${currencyMeta?.symbol || "Rp"} ••••••••`
                          : formatWithPreferred(val.marketValue)}
                      </span>
                      <span className="text-[10.5px] font-semibold mt-1 inline-block whitespace-nowrap text-[var(--text-secondary)]">
                        {isStealthMode ? (
                          "••••••••"
                        ) : (
                          <>
                            {val.floatingPnL >= 0 ? "+" : ""}
                            {formatWithPreferred(val.floatingPnL)} (
                            {val.floatingPnLPct >= 0 ? "+" : ""}
                            {val.floatingPnLPct.toFixed(1)}%)
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {liquidSubtotal.count === 0 && fixedHoldings.length === 0 && (
            <div className="py-10 px-4 text-center rounded-3xl border border-dashed border-[var(--glass-border)] bg-white/[0.01] space-y-2.5">
              <div className="w-11 h-11 rounded-2xl mx-auto flex items-center justify-center bg-white/[0.05] border border-[var(--glass-border)] text-[var(--text-tertiary)]">
                <Coins size={20} strokeWidth={1.5} />
              </div>
              <p className="text-[13.5px] font-semibold text-[var(--text-primary)]">
                {isIndonesian
                  ? "Belum Ada Aset yang Dilacak"
                  : "No Asset Holdings Tracked"}
              </p>
              <p className="text-[11.5px] text-[var(--text-tertiary)] max-w-[260px] mx-auto leading-relaxed">
                {isIndonesian
                  ? "Portofolio saat ini kosong. Ketuk '+ Tambah Aset' di atas untuk melacak USDT, saham, reksadana, emas, atau properti."
                  : "Your portfolio is currently empty. Tap '+ Add Asset' above to track USDT, stocks, funds, gold, or property."}
              </p>
            </div>
          )}
        </div>

        {/* Done Button */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic("light");
            onClose();
          }}
          className="w-full h-11 rounded-full text-[13px] font-semibold active:scale-[0.98] transition-all cursor-pointer mt-2 shadow-sm"
          style={{
            background: isDark ? "#ffffff" : "#18181b",
            color: isDark ? "#000000" : "#ffffff",
          }}
        >
          {isIndonesian ? "Selesai" : "Done"}
        </button>
      </div>

      {/* Universal Monochrome Icon Picker Modal for Assets */}
      <MonochromeIconPickerModal
        isOpen={isAssetIconPickerOpen}
        onClose={() => setIsAssetIconPickerOpen(false)}
        selectedIcon={formIcon}
        onSelectIcon={(iconName) => {
          setFormIcon(iconName);
          setHasCustomPickedAssetIcon(true);
        }}
        title={isIndonesian ? "Pilih Ikon Aset" : "Choose Asset Icon"}
      />

      {/* Modern Asset Detail Sheet */}
      <AssetDetailSheet
        isOpen={!!selectedDetailHolding}
        onClose={() => setSelectedDetailHolding(null)}
        holding={selectedDetailHolding}
        onHoldingUpdated={() => {
          const freshHoldings = getSavedHoldings(user?.id);
          setHoldings(freshHoldings);
          const freshUsdt = getSavedUsdtPref(user?.id);
          setUsdtPref(freshUsdt);
          if (user?.id && user.id !== "guest_local_user") {
            fetchHoldingsFromSupabase(user.id).then(setHoldings);
          }
          if (selectedDetailHolding) {
            if (selectedDetailHolding.symbol?.toUpperCase() === "USDT") {
              const freshMatchingUsdt = freshHoldings.find(
                (h) =>
                  h.symbol?.toUpperCase() === "USDT" ||
                  h.id.startsWith("usdt-"),
              );
              setSelectedDetailHolding({
                ...selectedDetailHolding,
                units: freshUsdt.units,
                avg_buy_price:
                  freshUsdt.units > 0
                    ? Math.round(freshUsdt.costBasis / freshUsdt.units)
                    : freshUsdt.rate,
                current_price: freshUsdt.rate,
                activities:
                  freshMatchingUsdt?.activities ||
                  selectedDetailHolding.activities,
              });
            } else {
              const refreshed = freshHoldings.find(
                (x) => x.id === selectedDetailHolding.id,
              );
              if (refreshed) setSelectedDetailHolding(refreshed);
            }
          }
        }}
        onDeleteHolding={(id, name) => {
          handleDeleteHolding(id, name);
          setSelectedDetailHolding(null);
        }}
        onStartEditHolding={(h) => {
          setSelectedDetailHolding(null);
          handleStartEditHolding(h);
        }}
      />

      {/* Staking Yield Logger Modal */}
      <StakingYieldModal
        isOpen={isStakingModalOpen}
        onClose={() => setIsStakingModalOpen(false)}
        holdingSymbol="USDT"
        holdingUnits={usdtPref.units}
        liveRate={usdtPref.rate || USD_IDR_ESTIMATE}
        wallets={wallets}
        holdings={holdings}
        defaultWalletId={cryptoWallet?.id}
        userId={user?.id}
        onSuccess={() => {
          const freshUsdt = getSavedUsdtPref(user?.id);
          setUsdtPref(freshUsdt);
        }}
      />

      {/* ── Preset Picker Sheet (Phase 1) ─────────────────────────────────── */}
      <BottomSheet
        isOpen={addPhase === 1}
        onClose={closeAddFlow}
        title={
          isIndonesian ? "Pilih Aset Investasi" : "Select Investment Asset"
        }
      >
        <div className="p-5 space-y-4 select-none max-w-lg mx-auto">
          {/* Search Bar */}
          <div
            className="flex items-center gap-2.5 px-3.5 h-11 rounded-2xl border transition-all"
            style={{
              background: controlBg,
              border: controlBorder,
              boxShadow: controlShadow,
            }}
          >
            <Search
              size={15}
              className="text-[var(--text-tertiary)] shrink-0"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isIndonesian
                  ? "Cari simbol atau nama (BTC, AAPL, BBCA, Emas)..."
                  : "Search symbol or name (BTC, AAPL, BBCA, Gold)..."
              }
              className="flex-1 bg-transparent text-[13px] outline-none font-medium text-[var(--text-primary)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category Chips Carousel */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {(
              [
                { key: "all", label: isIndonesian ? "Semua" : "All" },
                { key: "crypto", label: "Crypto" },
                {
                  key: "stock_us",
                  label: isIndonesian ? "Saham AS" : "US Stocks",
                },
                {
                  key: "stock_id",
                  label: isIndonesian ? "Saham IDX" : "IDX Stocks",
                },
                {
                  key: "index",
                  label: isIndonesian ? "Indeks" : "Indices",
                },
                { key: "gold", label: isIndonesian ? "Emas" : "Gold" },
                {
                  key: "mutual_fund",
                  label: isIndonesian ? "Reksa Dana" : "Mutual Funds",
                },
                {
                  key: "fixed_asset",
                  label: isIndonesian ? "Aset Fisik" : "Fixed Assets",
                },
              ] as const
            ).map((cat) => {
              const isActive = presetCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setPresetCategory(cat.key);
                  }}
                  className="px-3.5 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer select-none"
                  style={{
                    background: isActive
                      ? isDark
                        ? "#ffffff"
                        : "#18181b"
                      : controlBg,
                    color: isActive
                      ? isDark
                        ? "#000000"
                        : "#ffffff"
                      : "var(--text-tertiary)",
                    border: isActive
                      ? isDark
                        ? "1px solid #ffffff"
                        : "1px solid #18181b"
                      : controlBorder,
                  }}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Presets List */}
          <div className="space-y-2 pr-0.5">
            {filteredPresets.map((preset) => (
              <button
                key={preset.symbol}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className="w-full p-3 rounded-2xl flex items-center justify-between active:scale-[0.99] transition-all cursor-pointer text-left"
                style={{
                  background: controlBg,
                  border: controlBorder,
                  boxShadow: controlShadow,
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: isDark
                        ? "rgba(255, 255, 255, 0.08)"
                        : "rgba(0, 0, 0, 0.05)",
                      border: isDark
                        ? "1px solid rgba(255, 255, 255, 0.12)"
                        : "1px solid rgba(0, 0, 0, 0.08)",
                    }}
                  >
                    <IconRenderer
                      icon={preset.icon || "TrendingUp"}
                      size="w-4.5 h-4.5"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-[13px] text-[var(--text-primary)] ">
                        {getPresetSymbol(preset, isIndonesian)}
                      </span>
                      {preset.suggestedCurrency && (
                        <span className="text-[9.5px] px-2 py-0.5 rounded-full font-semibold bg-white/[0.06] text-[var(--text-secondary)] border border-[var(--glass-border)]">
                          {preset.suggestedCurrency}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[var(--text-tertiary)] truncate block mt-0.5">
                      {getPresetName(preset, isIndonesian)}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-white/[0.06] text-[var(--text-tertiary)] border border-[var(--glass-border)]">
                  {getTypeLabel(preset.type, isIndonesian)}
                </span>
              </button>
            ))}

            {filteredPresets.length === 0 && (
              <p className="text-center text-[12px] text-[var(--text-tertiary)] py-8">
                {isIndonesian
                  ? "Tidak ada preset yang cocok"
                  : "No presets matched your search"}
              </p>
            )}
          </div>

          {/* Quick Custom Actions */}
          <div className="pt-3 border-t border-[var(--glass-border)]/40 space-y-2">
            <p className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider px-1">
              {isIndonesian ? "Aset Kustom / Lainnya" : "Custom Assets"}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleCustomAssetEntry("fixed_asset")}
                className="flex-1 py-2.5 px-3 rounded-2xl text-[11.5px] font-semibold active:scale-95 transition-all cursor-pointer text-center"
                style={{
                  background: controlBg,
                  border: controlBorder,
                  color: "var(--text-secondary)",
                }}
              >
                {isIndonesian ? "+ Properti / Fisik" : "+ Fixed Asset"}
              </button>
              <button
                type="button"
                onClick={() => handleCustomAssetEntry("stock")}
                className="flex-1 py-2.5 px-3 rounded-2xl text-[11.5px] font-semibold active:scale-95 transition-all cursor-pointer text-center"
                style={{
                  background: controlBg,
                  border: controlBorder,
                  color: "var(--text-secondary)",
                }}
              >
                {isIndonesian ? "+ Saham / Kripto Kustom" : "+ Custom Asset"}
              </button>
            </div>
          </div>
        </div>
      </BottomSheet>

      {/* ── Asset Details Form Sheet (Phase 2) ────────────────────────────── */}
      <BottomSheet
        isOpen={addPhase === 2}
        onClose={closeAddFlow}
        title={formName || (isIndonesian ? "Detail Aset" : "Asset Details")}
      >
        <div className="p-5 space-y-4 select-none relative max-w-lg mx-auto">
          {/* Currency Toggle */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-1 block">
              {isIndonesian ? "Mata Uang Input" : "Input Currency"}
            </label>
            <div
              className="flex items-center gap-1 p-1 rounded-full transition-all"
              style={{
                background: controlBg,
                border: controlBorder,
                boxShadow: controlShadow,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setFormCurrency("IDR");
                }}
                className="flex-1 py-1.5 rounded-full text-[12px] font-semibold transition-all cursor-pointer"
                style={{
                  background:
                    formCurrency === "IDR"
                      ? isDark
                        ? "#ffffff"
                        : "#18181b"
                      : "transparent",
                  color:
                    formCurrency === "IDR"
                      ? isDark
                        ? "#000000"
                        : "#ffffff"
                      : "var(--text-tertiary)",
                  boxShadow:
                    formCurrency === "IDR"
                      ? "0 2px 6px rgba(0,0,0,0.2)"
                      : "none",
                }}
              >
                IDR (Rp)
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setFormCurrency("USD");
                }}
                className="flex-1 py-1.5 rounded-full text-[12px] font-semibold transition-all cursor-pointer"
                style={{
                  background:
                    formCurrency === "USD"
                      ? isDark
                        ? "#ffffff"
                        : "#18181b"
                      : "transparent",
                  color:
                    formCurrency === "USD"
                      ? isDark
                        ? "#000000"
                        : "#ffffff"
                      : "var(--text-tertiary)",
                  boxShadow:
                    formCurrency === "USD"
                      ? "0 2px 6px rgba(0,0,0,0.2)"
                      : "none",
                }}
              >
                USD ($)
              </button>
            </div>
          </div>

          {/* Inputs: Symbol & Name */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block mb-1 px-1">
                {isIndonesian ? "Simbol" : "Symbol"}
              </label>
              <input
                type="text"
                value={formSymbol}
                onChange={(e) => setFormSymbol(e.target.value.toUpperCase())}
                placeholder="BTC"
                className="w-full h-11 px-3.5 rounded-2xl text-[13px] font-semibold outline-none uppercase "
                style={{
                  background: controlBg,
                  border: controlBorder,
                  boxShadow: controlShadow,
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block mb-1 px-1">
                {isIndonesian ? "Nama Aset" : "Asset Name"}
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormName(val);
                  if (!hasCustomPickedAssetIcon) {
                    const suggested = autoSuggestIcon(val);
                    if (suggested) setFormIcon(suggested);
                  }
                }}
                placeholder="Bitcoin / Apple"
                className="w-full h-11 px-3.5 rounded-2xl text-[13px] font-semibold outline-none"
                style={{
                  background: controlBg,
                  border: controlBorder,
                  boxShadow: controlShadow,
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </div>

          {/* Platform Tag Selector */}
          <div className="space-y-1.5">
            <label className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block px-1">
              {isIndonesian ? "Platform / Kustodian" : "Platform / Custodian"}
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                "Binance",
                "Indodax",
                "Ajaib",
                "Stockbit",
                "Bibit",
                "Bank",
                "Fisik/Brankas",
              ].map((plat) => {
                const isSelected = formPlatform === plat;
                return (
                  <button
                    key={plat}
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setFormPlatform(isSelected ? "" : plat);
                    }}
                    className="px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer select-none active:scale-95"
                    style={{
                      background: isSelected
                        ? isDark
                          ? "#ffffff"
                          : "#18181b"
                        : controlBg,
                      color: isSelected
                        ? isDark
                          ? "#000000"
                          : "#ffffff"
                        : "var(--text-tertiary)",
                      border: isSelected
                        ? isDark
                          ? "1px solid #ffffff"
                          : "1px solid #18181b"
                        : controlBorder,
                    }}
                  >
                    {plat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Units & Buy Price */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block mb-1 px-1">
                {isIndonesian ? "Jumlah Unit" : "Units / Quantity"}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={formUnits}
                onChange={(e) =>
                  setFormUnits(
                    e.target.value.replace(",", ".").replace(/[^0-9.]/g, ""),
                  )
                }
                placeholder="100"
                className="w-full h-11 px-3.5 rounded-2xl text-[13px] font-semibold outline-none "
                style={{
                  background: controlBg,
                  border: controlBorder,
                  boxShadow: controlShadow,
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div>
              <label className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block mb-1 px-1 truncate">
                {isIndonesian
                  ? `Harga Beli (${formCurrency})`
                  : `Buy Price (${formCurrency})`}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={formBuyPrice}
                onChange={(e) => {
                  const { display } = formatLiveAmountInput(
                    e.target.value,
                    formCurrency === "IDR",
                    formCurrency === "USD",
                    4,
                  );
                  setFormBuyPrice(display);
                }}
                placeholder={formCurrency === "USD" ? "$0.00" : "Rp 0"}
                className="w-full h-11 px-3.5 rounded-2xl text-[13px] font-semibold outline-none "
                style={{
                  background: controlBg,
                  border: controlBorder,
                  boxShadow: controlShadow,
                  color: "var(--text-primary)",
                }}
              />
              {formCurrency === "USD" && formBuyPrice && (
                <p className="text-[10px] text-[var(--text-tertiary)]  mt-1 px-1">
                  ≈{" "}
                  {formatWithPreferred(
                    parseCleanNumber(formBuyPrice) * usdtPref.rate,
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Market Price */}
          <div>
            <label className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block mb-1 px-1">
              {isIndonesian
                ? `Harga Pasar (${formCurrency})`
                : `Market Price (${formCurrency})`}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={formCurrentPrice}
              onChange={(e) => {
                const { display } = formatLiveAmountInput(
                  e.target.value,
                  formCurrency === "IDR",
                  formCurrency === "USD",
                  4,
                );
                setFormCurrentPrice(display);
              }}
              placeholder={
                isFetchingCurrentPrice
                  ? isIndonesian
                    ? "Mengambil harga..."
                    : "Fetching price..."
                  : formCurrency === "USD"
                    ? "$0.00"
                    : "Rp 0"
              }
              className="w-full h-11 px-3.5 rounded-2xl text-[13px] font-semibold outline-none "
              style={{
                background: controlBg,
                border: controlBorder,
                boxShadow: controlShadow,
                color: "var(--text-primary)",
              }}
            />
            {formCurrency === "USD" && formCurrentPrice && (
              <p className="text-[10px] text-[var(--text-tertiary)]  mt-1 px-1">
                ≈{" "}
                {formatWithPreferred(
                  parseCleanNumber(formCurrentPrice) * usdtPref.rate,
                )}
              </p>
            )}
          </div>

          {/* Bottom Actions */}
          <div className="flex gap-2.5 pt-3">
            <button
              type="button"
              onClick={closeAddFlow}
              className="flex-1 h-11 rounded-full text-[12.5px] font-semibold transition-all cursor-pointer active:scale-95"
              style={{
                background: controlBg,
                border: controlBorder,
                color: "var(--text-secondary)",
              }}
            >
              {isIndonesian ? "Batal" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={handleSaveNewHolding}
              className="flex-1 h-11 rounded-full text-[13px] font-semibold active:scale-95 transition-all cursor-pointer shadow-sm"
              style={{
                background: isDark ? "#ffffff" : "#18181b",
                color: isDark ? "#000000" : "#ffffff",
              }}
            >
              {editingHoldingId
                ? isIndonesian
                  ? "Perbarui Aset"
                  : "Update Holding"
                : isIndonesian
                  ? "Simpan Aset"
                  : "Save Holding"}
            </button>
          </div>
        </div>
      </BottomSheet>
    </BottomSheet>
  );
}
