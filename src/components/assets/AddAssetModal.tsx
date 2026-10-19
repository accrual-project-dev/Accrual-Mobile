import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  X,
  Search,
  Loader2,
  Building2,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Wallet as WalletIcon,
  AlertCircle,
  RefreshCw,
  FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { IconRenderer } from "../ui/IconRenderer";
import {
  PRESET_ASSETS,
  getPresetName,
  getPresetSymbol,
  type PresetAsset,
  type PresetCategory,
} from "../../lib/assetPresets";
import {
  fetchCryptoQuote,
  fetchStockQuote,
  fetchGoldQuote,
  getSavedHoldings,
  type UsdtValuationPref,
} from "../../lib/marketPriceService";
import type { InvestmentHolding, AssetType } from "../../lib/types";
import { formatLiveAmountInput } from "../../lib/utils";
import { triggerHaptic } from "../../lib/haptics";
import { useToast } from "../../contexts/ToastContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import { useWallets } from "../../hooks/useWallets";
import { useWalletBalances } from "../../hooks/useWalletBalances";
import { useAddTransaction } from "../../hooks/useTransactions";

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
    valas: { en: "FX / Valas", id: "Valas" },
  };
  const item = labels[type];
  if (!item) return type.replace("_", " ");
  return isIndonesian ? item.id : item.en;
};

export interface AddAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveHolding: (holding: InvestmentHolding) => void;
  onSaveUsdtPref: (pref: UsdtValuationPref) => void;
  usdtRate: number;
  userId?: string;
  initialPreset?: PresetAsset | null;
  editingHolding?: InvestmentHolding | null;
}

export function AddAssetModal({
  isOpen,
  onClose,
  onSaveHolding,
  onSaveUsdtPref,
  usdtRate,
  userId,
  initialPreset,
  editingHolding,
}: AddAssetModalProps) {
  const { showToast } = useToast();
  const { isIndonesian } = useLanguage();
  const { formatWithPreferred } = useCurrency();
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Phase: 1 = Preset Picker & Search, 2 = Asset Details Form
  const [phase, setPhase] = useState<1 | 2>(1);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [presetCategory, setPresetCategory] = useState<PresetCategory>("all");

  // Form Fields
  const [formSymbol, setFormSymbol] = useState("");
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<AssetType>("crypto");
  const [formCurrency, setFormCurrency] = useState<"IDR" | "USD">("USD");
  const [formPlatform, setFormPlatform] = useState("");
  const [isCustomBrokerInput, setIsCustomBrokerInput] = useState(false);
  const [customBrokerText, setCustomBrokerText] = useState("");
  const [formIcon, setFormIcon] = useState("Coins");
  const [formUnits, setFormUnits] = useState("");
  const [formBuyPrice, setFormBuyPrice] = useState("");
  const [formCurrentPrice, setFormCurrentPrice] = useState("");
  const [priceMode, setPriceMode] = useState<"live" | "custom">("live");
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [formPurchaseDate, setFormPurchaseDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );

  // Smart Depreciation State
  const [isDepreciationEnabled, setIsDepreciationEnabled] = useState(false);
  const [rateDirection, setRateDirection] = useState<"appreciation" | "depreciation">("depreciation");
  const [annualRate, setAnnualRate] = useState("15");

  // Wallet Funding Source State
  const { data: wallets = [] } = useWallets();
  const { balancesById } = useWalletBalances();
  const addTx = useAddTransaction();
  const [isDeductFromWallet, setIsDeductFromWallet] = useState(false);
  const [selectedDeductWalletId, setSelectedDeductWalletId] = useState<string>("");

  const fundingWallets = useMemo(() => {
    return wallets.filter(
      (w) => w.classification !== "credit" && w.classification !== "loan",
    );
  }, [wallets]);

  useEffect(() => {
    if (!selectedDeductWalletId && fundingWallets.length > 0) {
      setSelectedDeductWalletId(fundingWallets[0].id);
    }
  }, [fundingWallets, selectedDeductWalletId]);

  // Handle ESC key to dismiss modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const lastQuoteRef = useRef<{ usd?: number; idr?: number; timestamp: number } | null>(null);

  // Dedicated Live Quote Fetcher
  const fetchLiveQuote = useCallback(
    async (
      symbolToFetch: string,
      typeToFetch: AssetType,
      targetCurrency: "IDR" | "USD",
      forceRefresh = false,
      applyToBuyPrice = false,
    ) => {
      const clean = symbolToFetch.trim();
      if (!clean) return;
      setIsFetchingPrice(true);
      try {
        let quoteUSD: number | null = null;
        let quoteIDR: number | null = null;

        if (typeToFetch === "crypto") {
          const res = await fetchCryptoQuote(clean, forceRefresh);
          if (res) {
            quoteUSD = res.usd;
            quoteIDR = res.idr;
          }
        } else if (typeToFetch === "stock") {
          const res = await fetchStockQuote(clean, forceRefresh, targetCurrency === "IDR");
          if (res) {
            quoteUSD = res.usd ?? null;
            quoteIDR = res.idr;
          }
        } else if (typeToFetch === "gold") {
          const res = await fetchGoldQuote(forceRefresh);
          if (res) {
            quoteIDR = res.pricePerGramIDR;
            const rate = usdtRate > 0 ? usdtRate : 16415;
            quoteUSD = parseFloat((quoteIDR / rate).toFixed(2));
          }
        }

        if (quoteUSD || quoteIDR) {
          lastQuoteRef.current = {
            usd: quoteUSD ?? undefined,
            idr: quoteIDR ?? undefined,
            timestamp: Date.now(),
          };

          const effectiveRate = usdtRate > 0 ? usdtRate : 16415;
          let displayVal = "";

          if (targetCurrency === "USD") {
            let numVal = 0;
            if (quoteUSD && quoteUSD > 0) {
              numVal = quoteUSD;
            } else if (quoteIDR && quoteIDR > 0 && effectiveRate > 0) {
              numVal = parseFloat((quoteIDR / effectiveRate).toFixed(4));
            }
            displayVal = formatHoldingPrice(numVal, "USD");
          } else {
            // IDR
            let numVal = 0;
            if (quoteIDR && quoteIDR > 0) {
              numVal = Math.round(quoteIDR);
            } else if (quoteUSD && quoteUSD > 0 && effectiveRate > 0) {
              numVal = Math.round(quoteUSD * effectiveRate);
            }
            displayVal = formatHoldingPrice(numVal, "IDR");
          }

          if (displayVal) {
            setFormCurrentPrice(displayVal);
            if (applyToBuyPrice) {
              setFormBuyPrice(displayVal);
            }
          }
        }
      } catch (err) {
        console.warn("[AddAssetModal] Error fetching live quote:", err);
      } finally {
        setIsFetchingPrice(false);
      }
    },
    [usdtRate],
  );

  // Smart Currency Conversion Handler
  const handleCurrencyChange = useCallback(
    (newCurrency: "IDR" | "USD") => {
      if (newCurrency === formCurrency) return;
      triggerHaptic("light");
      const oldCurrency = formCurrency;
      setFormCurrency(newCurrency);

      const rate = usdtRate > 0 ? usdtRate : 16415;

      // 1. Convert or re-apply current price
      if (priceMode === "live" && lastQuoteRef.current) {
        if (newCurrency === "USD") {
          let numVal = 0;
          if (lastQuoteRef.current.usd && lastQuoteRef.current.usd > 0) {
            numVal = lastQuoteRef.current.usd;
          } else if (lastQuoteRef.current.idr && rate > 0) {
            numVal = parseFloat((lastQuoteRef.current.idr / rate).toFixed(4));
          }
          setFormCurrentPrice(formatHoldingPrice(numVal, "USD"));
        } else {
          // Switch to IDR
          let numVal = 0;
          if (lastQuoteRef.current.idr && lastQuoteRef.current.idr > 0) {
            numVal = Math.round(lastQuoteRef.current.idr);
          } else if (lastQuoteRef.current.usd && rate > 0) {
            numVal = Math.round(lastQuoteRef.current.usd * rate);
          }
          setFormCurrentPrice(formatHoldingPrice(numVal, "IDR"));
        }
      } else {
        const curPriceNum = parseCleanNumber(formCurrentPrice);
        if (curPriceNum > 0) {
          if (newCurrency === "USD" && oldCurrency === "IDR") {
            const numVal = parseFloat((curPriceNum / rate).toFixed(4));
            setFormCurrentPrice(formatHoldingPrice(numVal, "USD"));
          } else if (newCurrency === "IDR" && oldCurrency === "USD") {
            const numVal = Math.round(curPriceNum * rate);
            setFormCurrentPrice(formatHoldingPrice(numVal, "IDR"));
          }
        }
      }

      // 2. Convert buy price proportionally if filled
      const buyPriceNum = parseCleanNumber(formBuyPrice);
      if (buyPriceNum > 0) {
        if (newCurrency === "USD" && oldCurrency === "IDR") {
          const numVal = parseFloat((buyPriceNum / rate).toFixed(4));
          setFormBuyPrice(formatHoldingPrice(numVal, "USD"));
        } else if (newCurrency === "IDR" && oldCurrency === "USD") {
          const numVal = Math.round(buyPriceNum * rate);
          setFormBuyPrice(formatHoldingPrice(numVal, "IDR"));
        }
      }
    },
    [formCurrency, priceMode, formCurrentPrice, formBuyPrice, usdtRate],
  );

  // Select Preset Handler
  const handleSelectPreset = useCallback(
    async (preset: PresetAsset) => {
      triggerHaptic("light");
      const selectedSymbol = getPresetSymbol(preset, isIndonesian);
      const selectedName = getPresetName(preset, isIndonesian);
      setFormSymbol(selectedSymbol);
      setFormName(selectedName);
      setFormType(preset.type);
      const curr = preset.suggestedCurrency || "IDR";
      setFormCurrency(curr);
      setFormPlatform("");
      setIsCustomBrokerInput(false);
      setCustomBrokerText("");
      setFormIcon(preset.icon || "TrendingUp");
      setFormUnits(preset.type === "bond" ? "1" : "");
      setFormPurchaseDate(new Date().toISOString().split("T")[0]);

      if (preset.type === "mutual_fund") {
        setPriceMode("custom");
        setIsDepreciationEnabled(true);
        const fundRates: Record<string, string> = {
          "RD-PASAR-UANG": "5.0",
          "RD-PENDAPATAN-TETAP": "7.0",
          "RD-CAMPURAN": "9.0",
          "RD-SAHAM": "11.0",
          "RD-SYARIAH": "7.5",
          "RD-TERPROTEKSI": "6.8",
          "RD-GLOBAL-USD": "8.5",
          "ETF-IDX30": "10.0",
          MMF: "5.0",
          FIF: "7.0",
          BALF: "9.0",
          EQF: "11.0",
          "ISLAMIC-FUND": "7.5",
          "PROTECTED-FUND": "6.8",
          "OFFSHORE-USD": "8.5",
        };
        setAnnualRate(
          fundRates[selectedSymbol] ||
            fundRates[preset.symbol] ||
            "6.0",
        );
        setFormBuyPrice(formatHoldingPrice(1000, curr));
        setFormCurrentPrice(formatHoldingPrice(1000, curr));
      } else if (preset.type === "bond") {
        setPriceMode("custom");
        setIsDepreciationEnabled(true);
        const bondRates: Record<string, string> = {
          ORI: "6.4",
          SBR: "6.5",
          SR: "6.4",
          FR: "6.8",
          PBS: "6.6",
          INDON: "5.2",
        };
        setAnnualRate(
          bondRates[selectedSymbol] ||
            bondRates[preset.symbol] ||
            "6.5",
        );
        const defaultBondPriceNum = curr === "USD" ? 1000 : 1000000;
        const defaultBondPrice = formatHoldingPrice(defaultBondPriceNum, curr);
        setFormBuyPrice(defaultBondPrice);
        setFormCurrentPrice(defaultBondPrice);
      } else if (preset.type === "fixed_asset") {
        setPriceMode("custom");
        const isAppreciating =
          preset.symbol === "LAND" ||
          preset.symbol === "PROPERTY" ||
          preset.symbol === "METALS" ||
          preset.symbol === "ART";
        setIsDepreciationEnabled(true);
        setRateDirection(isAppreciating ? "appreciation" : "depreciation");
        setAnnualRate(
          preset.symbol === "LAND"
            ? "8"
            : preset.symbol === "PROPERTY"
              ? "6"
              : preset.symbol === "METALS"
                ? "7"
                : preset.symbol === "ART"
                  ? "5"
                  : preset.symbol === "VEHICLE" || preset.symbol === "MOTORCYCLE"
                    ? "12"
                    : preset.symbol === "LAPTOP" ||
                        preset.symbol === "SMARTPHONE" ||
                        preset.symbol === "ELECTRONICS"
                      ? "18"
                      : preset.symbol === "WATCH" || preset.symbol === "JEWELRY"
                        ? "5"
                        : "10",
        );
        setFormBuyPrice("");
        setFormCurrentPrice("");
      } else {
        setPriceMode("live");
        setIsDepreciationEnabled(false);
        setFormBuyPrice("");
        setFormCurrentPrice("");
        await fetchLiveQuote(preset.symbol, preset.type, curr, true, true);
      }
      setPhase(2);
    },
    [fetchLiveQuote, isIndonesian],
  );

  // Reset or initialize on open / change
  useEffect(() => {
    if (!isOpen) return;
    setIsDeductFromWallet(false);

    if (editingHolding) {
      setPhase(2);
      setFormSymbol(editingHolding.symbol || "");
      setFormName(editingHolding.name || "");
      setFormType(editingHolding.asset_type || "crypto");
      const holdingCurr = (editingHolding.currency as "IDR" | "USD") || "IDR";
      setFormCurrency(holdingCurr);
      setFormUnits(String(editingHolding.units || ""));
      const displayBuy =
        holdingCurr === "USD" && editingHolding.native_price
          ? editingHolding.native_price
          : holdingCurr === "USD" && editingHolding.avg_buy_price > 10000 && usdtRate > 0
            ? editingHolding.avg_buy_price / usdtRate
            : editingHolding.avg_buy_price;
      const displayCurrent =
        holdingCurr === "USD" && editingHolding.current_price > 10000 && usdtRate > 0
          ? editingHolding.current_price / usdtRate
          : editingHolding.current_price;
      setFormBuyPrice(formatHoldingPrice(displayBuy, holdingCurr));
      setFormCurrentPrice(formatHoldingPrice(displayCurrent, holdingCurr));
      setFormIcon(editingHolding.icon || "Coins");
      setPriceMode(editingHolding.is_custom_price ? "custom" : "live");
      setFormPurchaseDate(
        editingHolding.purchase_date || new Date().toISOString().split("T")[0],
      );

      const platMatch = (editingHolding.notes || "").match(
        /Platform:\s*([^;]+)/i,
      );
      if (platMatch && platMatch[1]) {
        const plat = platMatch[1].trim();
        setFormPlatform(plat);
        setCustomBrokerText(plat);
      } else {
        setFormPlatform("");
      }

      if (editingHolding.annual_rate && editingHolding.annual_rate !== 0) {
        setIsDepreciationEnabled(true);
        setRateDirection(editingHolding.annual_rate >= 0 ? "appreciation" : "depreciation");
        setAnnualRate(String(Math.abs(editingHolding.annual_rate)));
      } else {
        setIsDepreciationEnabled(false);
      }
    } else if (initialPreset) {
      handleSelectPreset(initialPreset);
    } else {
      setPhase(1);
      setSearchQuery("");
      setPresetCategory("all");
    }
  }, [isOpen, editingHolding, initialPreset, handleSelectPreset]);


  // Filter Presets
  const filteredPresets = useMemo(() => {
    return PRESET_ASSETS.filter((item) => {
      const matchCat =
        presetCategory === "all" || item.category === presetCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        q === "" ||
        item.symbol.toLowerCase().includes(q) ||
        (item.symbolId && item.symbolId.toLowerCase().includes(q)) ||
        item.name.toLowerCase().includes(q) ||
        (item.nameId && item.nameId.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [presetCategory, searchQuery]);

  // Auto-detect depreciation based on name / symbol
  const checkDepreciationHeuristic = (name: string, type: AssetType) => {
    const s = name.toLowerCase();
    const isPhysicalDepreciable =
      type === "fixed_asset" ||
      s.includes("macbook") ||
      s.includes("laptop") ||
      s.includes("iphone") ||
      s.includes("mobil") ||
      s.includes("motor") ||
      s.includes("kendaraan") ||
      s.includes("gadget") ||
      s.includes("kamera") ||
      s.includes("elektronik");

    if (isPhysicalDepreciable && !isDepreciationEnabled) {
      setIsDepreciationEnabled(true);
      setAnnualRate("15");
    }
  };

  // Custom Asset Entry
  const handleCustomAssetEntry = (type: AssetType) => {
    triggerHaptic("medium");
    setFormSymbol(
      type === "fixed_asset"
        ? `FIXED-${Date.now().toString().slice(-4)}`
        : type === "bond"
          ? `BOND-${Date.now().toString().slice(-4)}`
          : searchQuery.trim().toUpperCase() || "",
    );
    setFormName(searchQuery.trim() || "");
    setFormType(type);
    setFormCurrency("IDR");
    setFormPlatform("");
    setIsCustomBrokerInput(false);
    setCustomBrokerText("");
    setFormIcon(type === "fixed_asset" ? "Building2" : type === "bond" ? "FileText" : "TrendingUp");
    setFormUnits(type === "bond" ? "1" : type === "fixed_asset" ? "1" : "");
    const defaultCustomPrice = type === "bond" ? formatHoldingPrice(1000000, "IDR") : "";
    setFormBuyPrice(defaultCustomPrice);
    setFormCurrentPrice(defaultCustomPrice);
    setPriceMode("custom");
    setIsDepreciationEnabled(type === "fixed_asset" || type === "bond" || type === "mutual_fund");
    setAnnualRate(type === "fixed_asset" ? "10" : type === "bond" ? "6.4" : "6.0");
    setFormPurchaseDate(new Date().toISOString().split("T")[0]);
    checkDepreciationHeuristic(searchQuery.trim(), type);
    setPhase(2);
  };

  // Real-time valuation and PnL calculation
  const { totalMarketValue, unrealizedDelta, unrealizedPct } = useMemo(() => {
    const units = parseCleanNumber(formUnits);
    const buy = parseCleanNumber(formBuyPrice);
    const current = parseCleanNumber(formCurrentPrice) || buy;

    const totalVal = units * current;
    const totalCost = units * buy;
    const delta = totalVal - totalCost;
    const pct = totalCost > 0 ? (delta / totalCost) * 100 : 0;

    return {
      totalMarketValue: totalVal,
      unrealizedDelta: delta,
      unrealizedPct: pct,
    };
  }, [formUnits, formBuyPrice, formCurrentPrice]);

  // Fat-Finger Price Deviation Detection (> 5x or < 0.2x)
  const priceDeviation = useMemo(() => {
    const rawBuy = parseCleanNumber(formBuyPrice);
    const rawCurrent = parseCleanNumber(formCurrentPrice);
    if (rawBuy <= 0 || rawCurrent <= 0) return null;

    const ratio = rawBuy / rawCurrent;
    if (ratio >= 5) {
      const pct = Math.round((ratio - 1) * 100);
      return {
        type: "high",
        label: `+${pct.toLocaleString()}%`,
      };
    }
    if (ratio <= 0.2) {
      const pct = Math.round((1 - ratio) * 100);
      return {
        type: "low",
        label: `-${pct}%`,
      };
    }
    return null;
  }, [formBuyPrice, formCurrentPrice]);

  // Handle Save
  const handleSave = async () => {
    const units = parseCleanNumber(formUnits);
    const rawBuy = parseCleanNumber(formBuyPrice);
    const rawCurrent = parseCleanNumber(formCurrentPrice) || rawBuy;

    if (!formName.trim()) {
      showToast(
        isIndonesian ? "Masukkan nama aset" : "Please enter asset name",
        "delete",
        () => {},
      );
      return;
    }

    if (isNaN(units) || units <= 0 || isNaN(rawBuy) || rawBuy <= 0) {
      showToast(
        isIndonesian
          ? "Masukkan unit dan harga beli yang valid"
          : "Please enter valid units and buy price",
        "delete",
        () => {},
      );
      return;
    }

    triggerHaptic("medium");

    const isUSD = formCurrency === "USD";
    const liveRate = usdtRate > 0 ? usdtRate : 16415;
    const baseBuyPrice = isUSD ? Math.round(rawBuy * liveRate) : rawBuy;
    const baseCurrentPrice = isUSD
      ? Math.round(rawCurrent * liveRate)
      : rawCurrent;

    const symbol =
      formSymbol.trim().toUpperCase() ||
      (formType === "fixed_asset"
        ? "ASSET"
        : formName.slice(0, 5).toUpperCase());

    const finalPlatform = isCustomBrokerInput
      ? customBrokerText.trim()
      : formPlatform.trim();

    const parsedRate = parseFloat(annualRate);
    const signedRate =
      isDepreciationEnabled && !isNaN(parsedRate) && parsedRate > 0
        ? formType === "fixed_asset"
          ? rateDirection === "depreciation"
            ? -Math.abs(parsedRate)
            : Math.abs(parsedRate)
          : Math.abs(parsedRate)
        : undefined;

    // Deduct from wallet if requested
    if (!editingHolding && isDeductFromWallet && selectedDeductWalletId) {
      try {
        const totalOutlay = baseBuyPrice * units;
        if (totalOutlay > 0) {
          const now = new Date();
          const timeStr = now.toTimeString().slice(0, 8);
          const occurredOnWithTime = formPurchaseDate
            ? `${formPurchaseDate}T${timeStr}`
            : now.toISOString();

          await addTx.mutateAsync({
            amount: totalOutlay,
            type: "expense",
            wallet_id: selectedDeductWalletId,
            category_id: null,
            occurred_on: occurredOnWithTime,
            note: isIndonesian
              ? `Pembelian Aset: ${formName.trim()} (${units} ${symbol})`
              : `Asset Purchase: ${formName.trim()} (${units} ${symbol})`,
          });
        }
      } catch (err) {
        console.warn("[AddAssetModal] Error debiting source wallet:", err);
      }
    }

    // Special USDT Holding
    if (symbol === "USDT") {
      const updatedPref: UsdtValuationPref = {
        units,
        costBasis: baseBuyPrice * units,
        rate: baseCurrentPrice || usdtRate,
      };
      onSaveUsdtPref(updatedPref);
      showToast(
        isIndonesian
          ? "Holding USDT berhasil disimpan"
          : "USDT holding saved successfully",
        "add",
        () => {},
      );
      onClose();
      return;
    }

    let finalSymbol = symbol;
    if (formType === "fixed_asset" && !editingHolding) {
      const currentHoldings = getSavedHoldings(userId);
      if (currentHoldings.some((h) => h.symbol?.toUpperCase() === finalSymbol.toUpperCase())) {
        finalSymbol = `${finalSymbol}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
      }
    }

    const newH: InvestmentHolding = {
      ...(editingHolding || {}),
      id: editingHolding?.id || `h_${Date.now()}`,
      user_id: userId,
      symbol: finalSymbol,
      name: formName.trim(),
      asset_type: formType,
      units,
      avg_buy_price: baseBuyPrice,
      current_price: baseCurrentPrice,
      currency: formCurrency,
      native_price: isUSD ? rawCurrent : undefined,
      native_currency: isUSD ? "USD" : undefined,
      notes: finalPlatform ? `Platform: ${finalPlatform}` : undefined,
      last_price_updated_at: new Date().toISOString(),
      icon: formIcon,
      annual_rate: signedRate,
      purchase_date: formPurchaseDate || undefined,
      is_custom_price: priceMode === "custom",
      custom_price: priceMode === "custom" ? baseCurrentPrice : undefined,
      price_source: priceMode === "custom" ? "manual" : "live",
    };

    onSaveHolding(newH);
    showToast(
      `${newH.name} ${
        editingHolding
          ? isIndonesian
            ? "berhasil diperbarui"
            : "updated successfully"
          : isIndonesian
            ? "berhasil disimpan"
            : "saved successfully"
      }`,
      "add",
      () => {},
    );
    onClose();
  };

  if (!isOpen) return null;

  // ── Authentic Frosted Liquid Glass Materials (from liquidglass.md) ──────
  const sheetBg = isDark
    ? "linear-gradient(180deg, rgba(28,28,34,0.90) 0%, rgba(18,18,22,0.95) 35%, rgba(10,10,14,0.98) 100%)"
    : "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(246,247,250,0.97) 45%, rgba(238,240,245,0.99) 100%)";

  const sheetBorder = isDark
    ? "1px solid rgba(255,255,255,0.14)"
    : "1px solid rgba(0,0,0,0.08)";

  const controlBg = isDark
    ? "linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.035) 100%)"
    : "linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(255, 255, 255, 0.72) 100%)";

  const controlBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.085)"
    : "1px solid rgba(0, 0, 0, 0.065)";

  const controlShadow = isDark
    ? "inset 0 1px 0 rgba(255, 255, 255, 0.085), 0 2px 6px rgba(0, 0, 0, 0.22)"
    : "inset 0 1px 0 #ffffff, 0 1px 3px rgba(30, 35, 50, 0.035)";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end">
          {/* Backdrop: Jernih & Blur Ringan */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-[3px] transition-all"
          />

          {/* ===============================================================
              FROSTED LIQUID GLASS BOTTOM SHEET (DOCKED TO BOTTOM)
          =============================================================== */}
          <motion.div
            initial={{ y: "100%", opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{
              type: "spring",
              damping: 32,
              stiffness: 380,
              mass: 0.8,
            }}
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 w-full max-w-lg mx-auto rounded-t-[32px] sm:rounded-t-[36px] overflow-hidden flex flex-col max-h-[92dvh] transition-all"
            style={{
              background: sheetBg,
              borderTop: sheetBorder,
              borderLeft: sheetBorder,
              borderRight: sheetBorder,
              boxShadow: isDark
                ? "0 -20px 60px -10px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.3)"
                : "0 -16px 40px -8px rgba(31,36,48,0.14), inset 0 1px 0 #ffffff",
              backdropFilter: "blur(32px) saturate(190%)",
              WebkitBackdropFilter: "blur(32px) saturate(190%)",
            }}
          >
            {/* Top Specular Rim Reflection (Pantulan Kaca Asli) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-[8%] right-[8%] top-[1px] h-[2px] rounded-full"
              style={{
                background: isDark
                  ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.30), rgba(255,255,255,0.60), rgba(255,255,255,0.30), transparent)"
                  : "linear-gradient(90deg, transparent, rgba(255,255,255,0.85), rgba(255,255,255,1), rgba(255,255,255,0.85), transparent)",
              }}
            />

            {/* Ambient Radial Diffusion Glow (Seperti pada Foto Referensi) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-[340px] h-[120px] rounded-full blur-[50px] opacity-25"
              style={{
                background: isDark
                  ? "rgba(255,255,255,0.14)"
                  : "rgba(255,255,255,0.8)",
              }}
            />

            {/* Drag Handle Indicator */}
            <div className="w-10 h-1 rounded-full bg-white/25 mx-auto mt-3 mb-1 shrink-0" />

            {/* ── Top Header ────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-6 pt-1 pb-2.5 shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-white/90 animate-pulse" />
                <div>
                  <h3 className="text-[16.5px] font-semibold tracking-tight text-[var(--text-primary)] leading-tight">
                    {phase === 1
                      ? isIndonesian
                        ? "Pilih Aset Investasi"
                        : "Select Investment Asset"
                      : editingHolding
                        ? isIndonesian
                          ? "Perbarui Aset"
                          : "Update Asset Holding"
                        : formName
                          ? `${formName} (${formSymbol})`
                          : isIndonesian
                            ? "Konfigurasi Aset"
                            : "Asset Details"}
                  </h3>
                  <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                    {phase === 1
                      ? isIndonesian
                        ? "Cari preset saham, kripto, emas, atau aset fisik"
                        : "Discover stock, crypto, gold, or physical holdings"
                      : isIndonesian
                        ? "Atur nilai perolehan, harga pasar, dan kustodian"
                        : "Configure cost basis, market price, and custody"}
                  </p>
                </div>
              </div>

              {/* Close Button */}
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
                <X size={14} strokeWidth={2} />
              </button>
            </div>

            {/* =============================================================
                PHASE 1: PRESET DISCOVERY & SELECTION (MINIMALIS & MODERN)
               ============================================================= */}
            {phase === 1 && (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* 1. STICKY TOP CONTROLS (SEARCH, FILTERS, & CUSTOM ASSETS) */}
                <div className="px-6 space-y-2.5 shrink-0 pb-2">
                  {/* Search Bar (Kompak & Modern) */}
                  <div
                    className="flex items-center gap-2.5 px-3.5 h-10 rounded-2xl transition-all"
                    style={{
                      background: controlBg,
                      border: controlBorder,
                      boxShadow: controlShadow,
                    }}
                  >
                    <Search
                      size={14}
                      className="text-[var(--text-tertiary)] shrink-0"
                    />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={
                        isIndonesian
                          ? "Cari simbol atau nama aset (BTC, AAPL, BBCA)..."
                          : "Search symbol or name (BTC, AAPL, BBCA)..."
                      }
                      className="flex-1 bg-transparent text-[12.5px] outline-none font-medium text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Category Filter Pills (Compact Horizontal Scroll) */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                    {(
                      [
                        { key: "all", label: isIndonesian ? "Semua" : "All" },
                        { key: "crypto", label: "Crypto" },
                        {
                          key: "valas",
                          label: isIndonesian ? "Valas" : "FX / Valas",
                        },
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
                          key: "bond",
                          label: isIndonesian ? "Obligasi" : "Bonds",
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
                          className="px-3 py-1 rounded-full text-[10.5px] font-semibold whitespace-nowrap transition-all cursor-pointer select-none active:scale-95 shrink-0"
                          style={
                            isActive
                              ? {
                                  background: isDark ? "#ffffff" : "#18181b",
                                  color: isDark ? "#000000" : "#ffffff",
                                  boxShadow: isDark
                                    ? "0 2px 8px rgba(0, 0, 0, 0.35), inset 0 1px 0 #ffffff"
                                    : "0 2px 6px rgba(0, 0, 0, 0.15)",
                                }
                              : {
                                  background: controlBg,
                                  border: controlBorder,
                                  boxShadow: controlShadow,
                                  color: "var(--text-tertiary)",
                                }
                          }
                        >
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* 2. CUSTOM ASSET ACTION PILLS (Ramping & Sleek) */}
                  <div className="flex gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleCustomAssetEntry("fixed_asset")}
                      className="flex-1 h-8 rounded-xl text-[10.5px] font-semibold active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      style={{
                        background: controlBg,
                        border: controlBorder,
                        boxShadow: controlShadow,
                        color: "var(--text-secondary)",
                      }}
                    >
                      <Building2 size={12} strokeWidth={1.75} />
                      <span>
                        {isIndonesian ? "+ Properti" : "+ Property"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCustomAssetEntry("bond")}
                      className="flex-1 h-8 rounded-xl text-[10.5px] font-semibold active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      style={{
                        background: controlBg,
                        border: controlBorder,
                        boxShadow: controlShadow,
                        color: "var(--text-secondary)",
                      }}
                    >
                      <FileText size={12} strokeWidth={1.75} />
                      <span>
                        {isIndonesian ? "+ Obligasi" : "+ Bond"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCustomAssetEntry("stock")}
                      className="flex-1 h-8 rounded-xl text-[10.5px] font-semibold active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      style={{
                        background: controlBg,
                        border: controlBorder,
                        boxShadow: controlShadow,
                        color: "var(--text-secondary)",
                      }}
                    >
                      <TrendingUp size={12} strokeWidth={1.75} />
                      <span>
                        {isIndonesian ? "+ Kustom" : "+ Custom"}
                      </span>
                    </button>
                  </div>
                </div>

                {/* 3. MINIMALIST ASSET ROW DECK (LEBIH RAMBING ~50px, APPLE STYLE) */}
                <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-6 space-y-1.5 py-1">
                  {filteredPresets.map((preset) => (
                    <button
                      key={preset.symbol}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className="w-full h-[50px] px-3 rounded-2xl flex items-center justify-between active:scale-[0.985] transition-all cursor-pointer text-left select-none group"
                      style={{
                        background: controlBg,
                        border: controlBorder,
                        boxShadow: controlShadow,
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Minimalist 32px Squircle Icon */}
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            background: isDark
                              ? "rgba(255, 255, 255, 0.06)"
                              : "rgba(0, 0, 0, 0.04)",
                            border: isDark
                              ? "1px solid rgba(255, 255, 255, 0.10)"
                              : "1px solid rgba(0, 0, 0, 0.07)",
                          }}
                        >
                          <IconRenderer
                            icon={preset.icon || "TrendingUp"}
                            size="w-4 h-4"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 leading-none">
                            <span className="font-semibold text-[12.5px] text-[var(--text-primary)] ">
                              {getPresetSymbol(preset, isIndonesian)}
                            </span>
                            {preset.suggestedCurrency && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded  font-medium bg-white/[0.05] text-[var(--text-secondary)] border border-[var(--glass-border)]">
                                {preset.suggestedCurrency}
                              </span>
                            )}
                          </div>
                          <span className="text-[10.5px] text-[var(--text-tertiary)] truncate block mt-1 leading-none">
                            {getPresetName(preset, isIndonesian)}
                          </span>
                        </div>
                      </div>

                      {/* Right Tag: Slim & Understated */}
                      <span className="text-[9px] uppercase  font-medium px-2 py-0.5 rounded-full bg-white/[0.04] text-[var(--text-tertiary)] border border-[var(--glass-border)] shrink-0 ml-1">
                        {getTypeLabel(preset.type, isIndonesian)}
                      </span>
                    </button>
                  ))}

                  {filteredPresets.length === 0 && (
                    <div className="py-12 text-center space-y-1">
                      <p className="text-[13px] font-semibold text-[var(--text-secondary)]">
                        {isIndonesian
                          ? "Tidak ada preset yang cocok"
                          : "No presets matched your search"}
                      </p>
                      <p className="text-[11px] text-[var(--text-tertiary)]">
                        {isIndonesian
                          ? "Gunakan tombol kustom di atas untuk input mandiri."
                          : "Use the custom buttons above to add manually."}
                      </p>
                    </div>
                  )}
                </div>

                {/* 4. BOTTOM ACTION (BATAL) */}
                <div
                  className="px-6 pt-2 pb-4 shrink-0"
                  style={{
                    paddingBottom:
                      "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)",
                  }}
                >
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full h-10 rounded-full text-[12.5px] font-semibold active:scale-95 transition-all cursor-pointer text-center"
                    style={{
                      background: controlBg,
                      border: controlBorder,
                      color: "var(--text-secondary)",
                    }}
                  >
                    {isIndonesian ? "Batal" : "Cancel"}
                  </button>
                </div>
              </div>
            )}

            {/* =============================================================
                PHASE 2: ASSET DETAILS & SMART CONFIGURATION (COMPACT)
               ============================================================= */}
            {phase === 2 && (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Form Body Scrollable */}
                <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-6 space-y-3 py-1">
                  {/* Hero Strip: Symbol, Name, Icon & Currency Switcher */}
                  <div
                    className="p-3 rounded-2xl flex items-center justify-between gap-3"
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
                          background: isDark
                            ? "rgba(255, 255, 255, 0.08)"
                            : "rgba(0, 0, 0, 0.05)",
                          border: isDark
                            ? "1px solid rgba(255, 255, 255, 0.12)"
                            : "1px solid rgba(0, 0, 0, 0.08)",
                        }}
                      >
                        <IconRenderer icon={formIcon} size="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 leading-none">
                          <span className="font-bold text-[13.5px] text-[var(--text-primary)] ">
                            {formSymbol || "ASSET"}
                          </span>
                          <span className="text-[9px] uppercase font-semibold px-2 py-0.5 rounded-full bg-white/[0.06] text-[var(--text-tertiary)] border border-[var(--glass-border)]">
                            {getTypeLabel(formType, isIndonesian)}
                          </span>
                        </div>
                        <span className="text-[11px] text-[var(--text-secondary)] font-medium truncate block mt-1 leading-none">
                          {formName ||
                            (isIndonesian ? "Aset Baru" : "New Holding")}
                        </span>
                      </div>
                    </div>

                    {/* Currency Selector Pill */}
                    <div
                      className="flex items-center p-0.5 rounded-full shrink-0"
                      style={{
                        background: isDark
                          ? "rgba(255, 255, 255, 0.06)"
                          : "rgba(0, 0, 0, 0.05)",
                        border: "1px solid var(--glass-border)",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleCurrencyChange("IDR")}
                        className={`px-3 py-1 rounded-full text-[10.5px] font-semibold transition-all cursor-pointer ${
                          formCurrency === "IDR"
                            ? isDark
                              ? "bg-white text-black shadow-xs"
                              : "bg-black text-white shadow-xs"
                            : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        IDR
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCurrencyChange("USD")}
                        className={`px-3 py-1 rounded-full text-[10.5px] font-semibold transition-all cursor-pointer ${
                          formCurrency === "USD"
                            ? isDark
                              ? "bg-white text-black shadow-xs"
                              : "bg-black text-white shadow-xs"
                            : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        USD
                      </button>
                    </div>
                  </div>

                  {/* Quantity & Buy Price */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block mb-1 px-1">
                        {isIndonesian ? "Jumlah Unit" : "Units / Quantity"}
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formUnits}
                        onChange={(e) => {
                          const { display } = formatLiveAmountInput(
                            e.target.value,
                            isIndonesian,
                            true,
                            8,
                          );
                          setFormUnits(display);
                        }}
                        placeholder="1.00"
                        className="w-full h-10 px-3.5 rounded-2xl text-[13px]  font-semibold outline-none transition-all"
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
                          : `Avg Buy Price (${formCurrency})`}
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
                        className="w-full h-10 px-3.5 rounded-2xl text-[13px]  font-semibold outline-none transition-all"
                        style={{
                          background: controlBg,
                          border: controlBorder,
                          boxShadow: controlShadow,
                          color: "var(--text-primary)",
                        }}
                      />
                      {formCurrency === "USD" && formBuyPrice && (
                        <p className="text-[9.5px] text-[var(--text-tertiary)]  mt-0.5 px-1">
                          ≈{" "}
                          {formatWithPreferred(
                            parseCleanNumber(formBuyPrice) * usdtRate,
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Fat-Finger Price Deviation Guard */}
                  <AnimatePresence>
                    {priceDeviation && (
                      <motion.div
                        initial={{ opacity: 0, y: -4, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: "auto" }}
                        exit={{ opacity: 0, y: -4, height: 0 }}
                        transition={{ duration: 0.16 }}
                        className="p-2.5 px-3 rounded-2xl flex items-center gap-2 select-none overflow-hidden"
                        style={{
                          background: controlBg,
                          border: controlBorder,
                          boxShadow: controlShadow,
                        }}
                      >
                        <AlertCircle
                          size={14}
                          strokeWidth={1.75}
                          className="shrink-0 text-[var(--text-secondary)]"
                        />
                        <p className="text-[11px] font-medium text-[var(--text-secondary)] leading-snug">
                          {isIndonesian
                            ? `Harga beli menyimpang drastis dari harga pasar (${priceDeviation.label})`
                            : `Buy price deviates significantly from market price (${priceDeviation.label})`}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Market Price with Live API vs Custom Toggle */}
                  <div
                    className="p-3 rounded-2xl space-y-2 transition-all"
                    style={{
                      background: controlBg,
                      border: controlBorder,
                      boxShadow: controlShadow,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 px-0.5">
                        <label className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1.5">
                          <span>
                            {isIndonesian
                              ? `Harga Pasar (${formCurrency})`
                              : `Market Price (${formCurrency})`}
                          </span>
                        </label>
                        {isFetchingPrice && (
                          <Loader2 className="w-3 h-3 animate-spin text-[var(--text-tertiary)]" />
                        )}
                        {!isFetchingPrice && priceMode === "live" && (
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic("light");
                              fetchLiveQuote(formSymbol, formType, formCurrency, true, false);
                            }}
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] active:scale-90 transition-all cursor-pointer bg-white/[0.04] border border-[var(--glass-border)]"
                            title={isIndonesian ? "Perbarui harga" : "Refresh price"}
                          >
                            <RefreshCw size={10} strokeWidth={1.8} />
                          </button>
                        )}
                      </div>

                      {/* Segmented Pill: Live vs Custom */}
                      <div
                        className="flex items-center p-0.5 rounded-full border text-[9.5px]"
                        style={{
                          background: isDark
                            ? "rgba(255,255,255,0.06)"
                            : "rgba(0,0,0,0.04)",
                          borderColor: "var(--glass-border)",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic("light");
                            setPriceMode("live");
                            const cur = parseCleanNumber(formCurrentPrice);
                            if (cur <= 0) {
                              fetchLiveQuote(formSymbol, formType, formCurrency, true, false);
                            }
                          }}
                          className={`px-2 py-0.5 rounded-full transition-all cursor-pointer font-semibold ${
                            priceMode === "live"
                              ? isDark
                                ? "bg-white text-black"
                                : "bg-black text-white"
                              : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                          }`}
                        >
                          Live
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic("light");
                            setPriceMode("custom");
                          }}
                          className={`px-2 py-0.5 rounded-full transition-all cursor-pointer font-semibold ${
                            priceMode === "custom"
                              ? isDark
                                ? "bg-white text-black"
                                : "bg-black text-white"
                              : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                          }`}
                        >
                          {isIndonesian ? "Kustom" : "Custom"}
                        </button>
                      </div>
                    </div>

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
                        setPriceMode("custom");
                      }}
                      placeholder={
                        isFetchingPrice
                          ? isIndonesian
                            ? "Mengambil harga..."
                            : "Fetching price..."
                          : formCurrency === "USD"
                            ? "$0.00"
                            : "Rp 0"
                      }
                      className="w-full h-10 px-3.5 rounded-2xl text-[13px]  font-semibold outline-none transition-all"
                      style={{
                        background: isDark
                          ? "rgba(255, 255, 255, 0.05)"
                          : "rgba(0, 0, 0, 0.03)",
                        border: isDark
                          ? "1px solid rgba(255, 255, 255, 0.08)"
                          : "1px solid rgba(0, 0, 0, 0.06)",
                        color: "var(--text-primary)",
                      }}
                    />

                    {!isFetchingPrice && priceMode === "live" && !formCurrentPrice && (
                      <p className="text-[10px] text-[var(--text-tertiary)] px-1 leading-snug">
                        {isIndonesian
                          ? "Harga live belum termuat. Ketuk ikon segarkan di atas atau pilih mode Kustom."
                          : "Live quote not loaded. Tap refresh above or switch to Custom mode."}
                      </p>
                    )}

                    {formCurrency === "USD" && formCurrentPrice && (
                      <p className="text-[9.5px] text-[var(--text-tertiary)]  px-1">
                        ≈{" "}
                        {formatWithPreferred(
                          parseCleanNumber(formCurrentPrice) * usdtRate,
                        )}
                      </p>
                    )}
                  </div>

                  {/* Smart Depreciation Setting */}
                  <div
                    className="p-3 rounded-2xl space-y-2 transition-all"
                    style={{
                      background: controlBg,
                      border: controlBorder,
                      boxShadow: controlShadow,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[11.5px] font-semibold text-[var(--text-primary)] block leading-tight">
                          {formType === "fixed_asset"
                            ? rateDirection === "depreciation"
                              ? isIndonesian
                                ? "Penyusutan Nilai Aset (Depresiasi)"
                                : "Asset Depreciation"
                              : isIndonesian
                                ? "Apresiasi Nilai Aset (Pertumbuhan)"
                                : "Asset Appreciation"
                            : formType === "bond"
                              ? isIndonesian
                                ? "Kupon Bunga Obligasi / SBN"
                                : "Bond / Sovereign Coupon"
                              : isIndonesian
                                ? "Estimasi Imbal Hasil Tahunan"
                                : "Estimated Annual Yield"}
                        </span>
                        <span className="text-[9.5px] text-[var(--text-tertiary)] leading-tight mt-0.5 block">
                          {formType === "fixed_asset"
                            ? isIndonesian
                              ? "Penyusutan gadget/kendaraan atau apresiasi properti/tanah seiring waktu"
                              : "Depreciation for vehicles/gadgets or appreciation for real estate over time"
                            : formType === "bond"
                              ? isIndonesian
                                ? "Akumulasi kupon bunga tahunan berjalan sejak tanggal pembelian"
                                : "Accrue annual coupon yield over time from purchase date"
                              : isIndonesian
                                ? "Pertumbuhan nilai portofolio berdasarkan proyeksi imbal hasil tahunan"
                                : "Portfolio valuation growth based on annual yield projection"}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic("light");
                          setIsDepreciationEnabled((prev) => !prev);
                        }}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center shrink-0 ${
                          isDepreciationEnabled
                            ? isDark
                              ? "bg-white"
                              : "bg-black"
                            : "bg-white/20"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full transition-transform transform shadow-sm ${
                            isDepreciationEnabled
                              ? isDark
                                ? "translate-x-4 bg-black"
                                : "translate-x-4 bg-white"
                              : "translate-x-0 bg-white"
                          }`}
                        />
                      </button>
                    </div>

                    {isDepreciationEnabled && (
                      <div className="pt-2 border-t border-[var(--glass-border)]/40 space-y-2 animate-in fade-in duration-150">
                        {formType === "fixed_asset" && (
                          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-white/[0.04] border border-[var(--glass-border)]">
                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic("light");
                                setRateDirection("appreciation");
                              }}
                              className={`py-1 rounded-lg text-[10.5px] font-semibold transition-all cursor-pointer select-none text-center ${
                                rateDirection === "appreciation"
                                  ? isDark
                                    ? "bg-white text-black shadow-sm"
                                    : "bg-black text-white shadow-sm"
                                  : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                              }`}
                            >
                              {isIndonesian ? "Apresiasi (+)" : "Appreciation (+)"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                triggerHaptic("light");
                                setRateDirection("depreciation");
                              }}
                              className={`py-1 rounded-lg text-[10.5px] font-semibold transition-all cursor-pointer select-none text-center ${
                                rateDirection === "depreciation"
                                  ? isDark
                                    ? "bg-white text-black shadow-sm"
                                    : "bg-black text-white shadow-sm"
                                  : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                              }`}
                            >
                              {isIndonesian ? "Penyusutan (-)" : "Depreciation (-)"}
                            </button>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[10px] ">
                          <span className="text-[var(--text-tertiary)]">
                            {formType === "fixed_asset"
                              ? rateDirection === "depreciation"
                                ? isIndonesian
                                  ? "Laju Penyusutan Tahunan:"
                                  : "Annual Depreciation Rate:"
                                : isIndonesian
                                  ? "Laju Apresiasi Tahunan:"
                                  : "Annual Appreciation Rate:"
                              : formType === "bond"
                                ? isIndonesian
                                  ? "Kupon Bunga Tahunan:"
                                  : "Annual Coupon Rate:"
                                : isIndonesian
                                  ? "Estimasi Imbal Hasil Tahunan:"
                                  : "Estimated Annual Yield:"}
                          </span>
                          <span className="font-bold text-[var(--text-primary)]">
                            {formType === "fixed_asset"
                              ? rateDirection === "depreciation"
                                ? `-${annualRate}%`
                                : `+${annualRate}%`
                              : `+${annualRate}%`}{" "}
                            / {isIndonesian ? "tahun" : "yr"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {(formType === "fixed_asset"
                            ? rateDirection === "depreciation"
                              ? ["10", "15", "20", "25"]
                              : ["5", "8", "10", "12"]
                            : formType === "bond"
                              ? ["5.5", "6.0", "6.4", "6.8"]
                              : ["5.0", "7.0", "9.0", "12.0"]
                          ).map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => {
                                triggerHaptic("light");
                                setAnnualRate(r);
                              }}
                              className="flex-1 py-1 rounded-xl text-[10.5px] font-semibold transition-all cursor-pointer select-none"
                              style={{
                                background:
                                  annualRate === r
                                    ? isDark
                                      ? "#ffffff"
                                      : "#18181b"
                                    : isDark
                                      ? "rgba(255,255,255,0.06)"
                                      : "rgba(0,0,0,0.04)",
                                color:
                                  annualRate === r
                                    ? isDark
                                      ? "#000000"
                                      : "#ffffff"
                                    : "var(--text-secondary)",
                                border:
                                  annualRate === r
                                    ? isDark
                                      ? "1px solid #ffffff"
                                      : "1px solid #18181b"
                                    : "1px solid var(--glass-border)",
                              }}
                            >
                              {formType === "fixed_asset"
                                ? rateDirection === "depreciation"
                                  ? `-${r}%`
                                  : `+${r}%`
                                : `+${r}%`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Platform / Custodian Tag Carousel */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1">
                        <Building2 size={12} strokeWidth={1.75} />
                        <span>
                          {isIndonesian
                            ? "Platform / Kustodian"
                            : "Platform / Custodian"}
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic("light");
                          setIsCustomBrokerInput((prev) => !prev);
                        }}
                        className="text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline cursor-pointer transition-colors"
                      >
                        {isCustomBrokerInput
                          ? isIndonesian
                            ? "Pilih Preset"
                            : "Choose Preset"
                          : isIndonesian
                            ? "+ Ketik Kustom"
                            : "+ Type Custom"}
                      </button>
                    </div>

                    {!isCustomBrokerInput ? (
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                        {[
                          "Binance",
                          "Indodax",
                          "Ajaib",
                          "Stockbit",
                          "Bibit",
                          "Bank",
                          "Fisik/Brankas",
                          "Ledger",
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
                              className="px-3 py-1 rounded-full text-[10.5px] font-semibold transition-all cursor-pointer shrink-0 select-none active:scale-95"
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
                                boxShadow: isSelected
                                  ? "0 2px 8px rgba(0,0,0,0.35)"
                                  : controlShadow,
                              }}
                            >
                              {plat}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={customBrokerText}
                        onChange={(e) => setCustomBrokerText(e.target.value)}
                        placeholder={
                          isIndonesian
                            ? "Ketik nama sekuritas, exchange, atau brankas..."
                            : "Type brokerage, exchange, or custody name..."
                        }
                        className="w-full h-10 px-3.5 rounded-2xl text-[12px] font-semibold outline-none transition-all"
                        style={{
                          background: controlBg,
                          border: controlBorder,
                          boxShadow: controlShadow,
                          color: "var(--text-primary)",
                        }}
                      />
                    )}
                  </div>

                  {/* Funding Source Deduction Toggle */}
                  {!editingHolding && (
                    <div
                      className="p-3.5 rounded-2xl transition-all space-y-3"
                      style={{
                        background: isDeductFromWallet
                          ? isDark
                            ? "rgba(255,255,255,0.06)"
                            : "rgba(0,0,0,0.04)"
                          : controlBg,
                        border: isDeductFromWallet
                          ? isDark
                            ? "1px solid rgba(255,255,255,0.14)"
                            : "1px solid rgba(0,0,0,0.1)"
                          : controlBorder,
                        boxShadow: controlShadow,
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                            style={{
                              background: isDark
                                ? "rgba(255,255,255,0.08)"
                                : "rgba(0,0,0,0.05)",
                              border: "1px solid var(--glass-border)",
                            }}
                          >
                            <WalletIcon
                              size={14}
                              className="text-[var(--text-primary)]"
                              strokeWidth={1.75}
                            />
                          </div>
                          <div>
                            <span className="text-[13px] font-semibold text-[var(--text-primary)] block leading-tight">
                              {isIndonesian
                                ? "Potong dari Akun Kas / RDN"
                                : "Deduct from Cash / Brokerage Account"}
                            </span>
                            <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 leading-snug">
                              {isIndonesian
                                ? "Catat transaksi mutasi otomatis agar saldo kas berkurang sesuai nominal modal beli"
                                : "Automatically record expense transaction to debit source account"}
                            </p>
                          </div>
                        </div>

                        {/* Apple iOS Style Toggle Switch */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isDeductFromWallet}
                          onClick={() => {
                            triggerHaptic("light");
                            setIsDeductFromWallet((prev) => !prev);
                          }}
                          className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                            isDeductFromWallet
                              ? isDark
                                ? "bg-white"
                                : "bg-black"
                              : isDark
                                ? "bg-white/20"
                                : "bg-black/20"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full shadow-md ring-0 transition duration-200 ease-in-out mt-0.5 ${
                              isDeductFromWallet
                                ? isDark
                                  ? "translate-x-5 bg-black"
                                  : "translate-x-5 bg-white"
                                : "translate-x-0.5 bg-white"
                            }`}
                          />
                        </button>
                      </div>

                      {/* Wallet selector when toggle is enabled */}
                      {isDeductFromWallet && (
                        <div className="pt-2 border-t border-[var(--glass-border)] space-y-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
                            {isIndonesian
                              ? "Pilih Akun Sumber Dana"
                              : "Select Source Account"}
                          </span>
                          {fundingWallets.length === 0 ? (
                            <p className="text-[11px] text-[var(--text-tertiary)] italic">
                              {isIndonesian
                                ? "Tidak ada rekening kas yang tersedia"
                                : "No cash accounts available"}
                            </p>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              {fundingWallets.map((w) => {
                                const isSelected = selectedDeductWalletId === w.id;
                                const bal = balancesById[w.id] ?? 0;
                                return (
                                  <button
                                    key={w.id}
                                    type="button"
                                    onClick={() => {
                                      triggerHaptic("light");
                                      setSelectedDeductWalletId(w.id);
                                    }}
                                    className={`p-2.5 rounded-xl text-left transition-all cursor-pointer flex flex-col justify-between ${
                                      isSelected
                                        ? isDark
                                          ? "bg-white/12 border border-white/25 shadow-sm"
                                          : "bg-black/10 border border-black/20 shadow-sm"
                                        : "bg-white/[0.03] border border-[var(--glass-border)] opacity-70 hover:opacity-100"
                                    }`}
                                  >
                                    <span className="text-[12px] font-semibold text-[var(--text-primary)] truncate block">
                                      {w.name}
                                    </span>
                                    <span className="text-[10.5px]  text-[var(--text-secondary)] mt-1">
                                      {formatWithPreferred(bal)}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Live Position Valuation Hero Card Preview */}
                  {parseCleanNumber(formUnits) > 0 &&
                    parseCleanNumber(formBuyPrice) > 0 && (
                      <div
                        className="p-3.5 rounded-2xl space-y-2 transition-all"
                        style={{
                          background: isDark
                            ? "linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)"
                            : "linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(246,247,250,0.9) 100%)",
                          border: isDark
                            ? "1px solid rgba(255,255,255,0.12)"
                            : "1px solid rgba(0,0,0,0.08)",
                          boxShadow: isDark
                            ? "0 14px 36px -10px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.16)"
                            : "0 10px 24px -6px rgba(0,0,0,0.06), inset 0 1px 0 #ffffff",
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
                              {isIndonesian
                                ? "Total Nilai Pasar"
                                : "Total Market Value"}
                            </span>
                            <span className="text-[16px] font-bold text-[var(--text-primary)] ">
                              {formCurrency === "USD"
                                ? `$${totalMarketValue.toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}`
                                : formatWithPreferred(totalMarketValue)}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
                              {isIndonesian
                                ? "Laba/Rugi Mengambang"
                                : "Unrealized PnL"}
                            </span>
                            <div
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold  mt-0.5"
                              style={{
                                background:
                                  unrealizedDelta >= 0
                                    ? isDark
                                      ? "#ffffff"
                                      : "#18181b"
                                    : isDark
                                      ? "rgba(255,255,255,0.1)"
                                      : "rgba(0,0,0,0.08)",
                                color:
                                  unrealizedDelta >= 0
                                    ? isDark
                                      ? "#000000"
                                      : "#ffffff"
                                    : "var(--text-primary)",
                              }}
                            >
                              {unrealizedDelta >= 0 ? (
                                <ArrowUpRight size={11} strokeWidth={2.5} />
                              ) : (
                                <ArrowDownRight size={11} strokeWidth={2.5} />
                              )}
                              <span>
                                {unrealizedDelta >= 0 ? "+ " : "- "}
                                {formCurrency === "USD"
                                  ? `$${Math.abs(
                                      unrealizedDelta,
                                    ).toLocaleString("en-US", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}`
                                  : formatWithPreferred(
                                      Math.abs(unrealizedDelta),
                                    )}{" "}
                                ({unrealizedDelta >= 0 ? "+" : ""}
                                {unrealizedPct.toFixed(2)}%)
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                </div>

                {/* Bottom Action Buttons Dock */}
                <div
                  className="px-6 pt-2 pb-4 shrink-0 flex items-center gap-3 border-t border-[var(--glass-border)]/40"
                  style={{
                    paddingBottom:
                      "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)",
                  }}
                >
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 h-10 rounded-full text-[12px] font-semibold active:scale-95 transition-all cursor-pointer text-center"
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
                    onClick={handleSave}
                    className="flex-[2] h-10 rounded-full text-[12.5px] font-semibold active:scale-95 transition-all cursor-pointer text-center shadow-sm"
                    style={{
                      background: isDark ? "#ffffff" : "#18181b",
                      color: isDark ? "#000000" : "#ffffff",
                    }}
                  >
                    {editingHolding
                      ? isIndonesian
                        ? "Perbarui Aset"
                        : "Update Holding"
                      : isIndonesian
                        ? "Simpan Aset"
                        : "Save Holding"}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
