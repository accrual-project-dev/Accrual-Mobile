import { useState, useMemo, useEffect } from "react";
import {
  X,
  Coins,
  Landmark,
  ShieldCheck,
  Building2,
  ArrowRight,
  PieChart,
  Calendar as CalendarIcon,
  Sparkles,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassSelect, type GlassSelectOption } from "../ui/GlassSelect";
import {
  formatHoldingUnits,
  formatLiveAmountInput,
} from "../../lib/utils";
import { triggerHaptic } from "../../lib/haptics";
import { useToast } from "../../contexts/ToastContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import { useAddTransaction } from "../../hooks/useTransactions";
import { useCategories } from "../../hooks/useCategories";
import {
  recordHoldingActivity,
  upsertHolding,
  getStandardUsdtHoldingId,
} from "../../lib/marketPriceService";
import { format, subDays } from "date-fns";
import type { Wallet, InvestmentHolding } from "../../lib/types";

export type YieldInstrumentType =
  | "daily_bank"
  | "bond_coupon"
  | "dividend"
  | "deposit"
  | "crypto_staking";

export type StakingYieldFrequency = "daily" | "monthly" | "yearly";

interface StakingYieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  holdingSymbol?: string;
  holdingUnits: number;
  liveRate: number;
  wallets: Wallet[];
  holdings?: InvestmentHolding[];
  defaultWalletId?: string;
  userId?: string;
  onSuccess?: () => void;
}

export function StakingYieldModal({
  isOpen,
  onClose,
  holdingSymbol = "USDT",
  holdingUnits,
  liveRate,
  wallets,
  holdings = [],
  defaultWalletId: _defaultWalletId,
  userId,
  onSuccess,
}: StakingYieldModalProps) {
  const { showToast } = useToast();
  const { isIndonesian } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const addTx = useAddTransaction();
  const { data: categories = [] } = useCategories();
  const { formatWithPreferred } = useCurrency();

  const effectiveRate = liveRate > 0 ? liveRate : 16415;
  const availableUnits = holdingUnits > 0 ? holdingUnits : 0;

  // ESC key dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // ── Instrument Type Selector ──────────────────────────────────────────────
  const [instrumentType, setInstrumentType] =
    useState<YieldInstrumentType>("daily_bank");

  // ── Active Lifecycle Tab: 1 = Projection/Setup, 2 = Claim/Record ──────────
  const [activeTab, setActiveTab] = useState<"overview" | "claim">("overview");

  // ── Default Bank Wallet ───────────────────────────────────────────────────
  const defaultBankWallet = useMemo(() => {
    return (
      wallets.find((w) => {
        const n = (w.name || "").toLowerCase();
        return (
          n.includes("seabank") ||
          n.includes("krom") ||
          n.includes("saqu") ||
          n.includes("jago") ||
          n.includes("neo")
        );
      }) ||
      wallets.find(
        (w) =>
          w.classification !== "credit" &&
          w.classification !== "loan" &&
          w.classification !== "investment",
      ) ||
      wallets[0]
    );
  }, [wallets]);

  // ── 1. Daily Bank Interest State ──────────────────────────────────────────
  const [selectedBankWalletId, setSelectedBankWalletId] = useState<string>(
    defaultBankWallet?.id || "",
  );
  const [bankApyInput, setBankApyInput] = useState<string>("3.75");
  const [customBankPrincipal, setCustomBankPrincipal] = useState<string>("");

  // ── 2. Government Bond / SBN Coupon State ─────────────────────────────────
  const bondHoldings = useMemo(() => {
    return holdings.filter((h) => h.asset_type === "bond");
  }, [holdings]);

  const [selectedBondSymbol, setSelectedBondSymbol] = useState<string>(() => {
    return bondHoldings[0]?.symbol || "ORI025";
  });
  const [bondPrincipalInput, setBondPrincipalInput] = useState<string>(() => {
    const defaultBond = bondHoldings[0];
    if (defaultBond && defaultBond.units > 0) {
      const total = defaultBond.units * (defaultBond.current_price || 1000000);
      return total.toLocaleString("id-ID");
    }
    return "50.000.000";
  });
  const [bondCouponRateInput, setBondCouponRateInput] = useState<string>(() => {
    const defaultBond = bondHoldings[0];
    if (defaultBond?.annual_rate) {
      return String(Math.abs(defaultBond.annual_rate));
    }
    return "6.4";
  });
  const [bondPayoutWalletId, setBondPayoutWalletId] = useState<string>(
    defaultBankWallet?.id || "",
  );

  // ── 3. Stock Dividend State ───────────────────────────────────────────────
  const stockHoldings = useMemo(() => {
    return holdings.filter(
      (h) => h.asset_type === "stock" || h.asset_type === "mutual_fund",
    );
  }, [holdings]);

  const [selectedStockSymbol, setSelectedStockSymbol] = useState<string>(
    stockHoldings[0]?.symbol || "BBCA",
  );
  const [dividendAmountInput, setDividendAmountInput] =
    useState<string>("350.000");
  const [dividendPayoutWalletId, setDividendPayoutWalletId] = useState<string>(
    defaultBankWallet?.id || "",
  );

  // ── 4. Bank Term Deposit State ────────────────────────────────────────────
  const [depositPrincipalInput, setDepositPrincipalInput] =
    useState<string>("10.000.000");
  const [depositApyInput, setDepositApyInput] = useState<string>("6.5");
  const [depositTenorMonths, setDepositTenorMonths] = useState<number>(3);
  const [depositPayoutWalletId, setDepositPayoutWalletId] = useState<string>(
    defaultBankWallet?.id || "",
  );

  // ── 5. Multi-Crypto Staking State ─────────────────────────────────────────
  const cryptoHoldings = useMemo(() => {
    const list = holdings.filter(
      (h) => h.asset_type === "crypto" || h.symbol?.toUpperCase() === "USDT",
    );
    if (!list.some((h) => h.symbol?.toUpperCase() === "USDT")) {
      list.unshift({
        id: "usdt-virtual",
        symbol: "USDT",
        name: "Tether USD",
        asset_type: "crypto",
        units: availableUnits,
        avg_buy_price: effectiveRate,
        current_price: effectiveRate,
      });
    }
    return list;
  }, [holdings, availableUnits, effectiveRate]);

  const [selectedCryptoSymbol, setSelectedCryptoSymbol] = useState<string>(
    (holdingSymbol || "USDT").toUpperCase(),
  );

  const activeCryptoHolding = useMemo(() => {
    return (
      cryptoHoldings.find(
        (h) => h.symbol?.toUpperCase() === selectedCryptoSymbol.toUpperCase(),
      ) || cryptoHoldings[0]
    );
  }, [cryptoHoldings, selectedCryptoSymbol]);

  const effectiveCryptoUnits = Number(activeCryptoHolding?.units || 0);
  const effectiveCryptoPrice =
    Number(activeCryptoHolding?.current_price || 0) > 0
      ? Number(activeCryptoHolding.current_price)
      : selectedCryptoSymbol.toUpperCase() === "USDT"
        ? effectiveRate
        : 1000000;

  const [customStakedUnits, setCustomStakedUnits] = useState<string>(
    effectiveCryptoUnits > 0 ? String(effectiveCryptoUnits) : "1000",
  );
  const [cryptoApyInput, setCryptoApyInput] = useState<string>("8.5");
  const [isAutoCompound, setIsAutoCompound] = useState<boolean>(true);
  const [cryptoPayoutWalletId, setCryptoPayoutWalletId] = useState<string>(
    defaultBankWallet?.id || "",
  );

  // Sync customStakedUnits when selectedCryptoSymbol changes
  useEffect(() => {
    if (activeCryptoHolding && activeCryptoHolding.units > 0) {
      setCustomStakedUnits(String(activeCryptoHolding.units));
    } else {
      setCustomStakedUnits("1000");
    }
  }, [activeCryptoHolding]);

  // ── Claim & Transaction Form State (Full ISO Timestamp) ───────────────────
  const [claimDate, setClaimDate] = useState<string>(() =>
    format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
  );
  const [isYesterdayDate, setIsYesterdayDate] = useState(false);
  const [claimNote, setClaimNote] = useState<string>("");

  // Target wallet resolution
  const activeBankWallet = useMemo(() => {
    return (
      wallets.find((w) => w.id === selectedBankWalletId) || defaultBankWallet
    );
  }, [wallets, selectedBankWalletId, defaultBankWallet]);

  const activeBankBalance = Number(activeBankWallet?.balance || 0);

  const effectiveBankPrincipal = useMemo(() => {
    if (customBankPrincipal.trim()) {
      const clean = customBankPrincipal.replace(/\D/g, "");
      const val = parseInt(clean, 10);
      return isNaN(val) ? 0 : val;
    }
    return activeBankBalance > 0 ? activeBankBalance : 10000000;
  }, [customBankPrincipal, activeBankBalance]);

  const effectiveBankApy = useMemo(() => {
    const parsed = parseFloat(bankApyInput.replace(/,/g, "."));
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }, [bankApyInput]);

  // 1. Bank Interest Calculations
  const bankProjections = useMemo(() => {
    const annual = effectiveBankPrincipal * (effectiveBankApy / 100);
    const dailyGross = annual / 365;
    const monthlyGross = annual / 12;
    // Pajak bunga bank 20% jika saldo > Rp 7.500.000
    const taxRate = effectiveBankPrincipal > 7500000 ? 0.2 : 0;
    return {
      daily: Math.round(dailyGross * (1 - taxRate)),
      monthly: Math.round(monthlyGross * (1 - taxRate)),
      yearly: Math.round(annual * (1 - taxRate)),
      isTaxed: taxRate > 0,
    };
  }, [effectiveBankPrincipal, effectiveBankApy]);

  // 2. SBN Coupon Calculations (PPh Final 10%)
  const effectiveBondPrincipal = useMemo(() => {
    const clean = bondPrincipalInput.replace(/\D/g, "");
    const val = parseInt(clean, 10);
    return isNaN(val) ? 0 : val;
  }, [bondPrincipalInput]);

  const effectiveBondCouponRate = useMemo(() => {
    const parsed = parseFloat(bondCouponRateInput.replace(/,/g, "."));
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }, [bondCouponRateInput]);

  const bondProjections = useMemo(() => {
    const annualGross = effectiveBondPrincipal * (effectiveBondCouponRate / 100);
    const monthlyGross = annualGross / 12;
    const taxRate = 0.1; // PPh Final 10% untuk SBN & Obligasi Negara
    const taxMonthly = monthlyGross * taxRate;
    const taxAnnual = annualGross * taxRate;
    return {
      monthlyGross: Math.round(monthlyGross),
      monthlyNet: Math.round(monthlyGross - taxMonthly),
      annualGross: Math.round(annualGross),
      annualNet: Math.round(annualGross - taxAnnual),
      taxMonthly: Math.round(taxMonthly),
      taxAnnual: Math.round(taxAnnual),
    };
  }, [effectiveBondPrincipal, effectiveBondCouponRate]);

  // 3. Crypto Staking Calculations
  const effectiveStakedUnits = useMemo(() => {
    const parsed = parseFloat(customStakedUnits.replace(/,/g, "."));
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }, [customStakedUnits]);

  const effectiveCryptoApy = useMemo(() => {
    const parsed = parseFloat(cryptoApyInput.replace(/,/g, "."));
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }, [cryptoApyInput]);

  const cryptoProjections = useMemo(() => {
    const annualUnits = effectiveStakedUnits * (effectiveCryptoApy / 100);
    const dailyUnits = annualUnits / 365;
    const monthlyUnits = annualUnits / 12;

    return {
      daily: {
        units: Number(dailyUnits.toFixed(4)),
        idr: Math.round(dailyUnits * effectiveCryptoPrice),
      },
      monthly: {
        units: Number(monthlyUnits.toFixed(4)),
        idr: Math.round(monthlyUnits * effectiveCryptoPrice),
      },
      yearly: {
        units: Number(annualUnits.toFixed(4)),
        idr: Math.round(annualUnits * effectiveCryptoPrice),
      },
    };
  }, [effectiveStakedUnits, effectiveCryptoApy, effectiveCryptoPrice]);

  // 4. Term Deposit Calculations
  const effectiveDepositPrincipal = useMemo(() => {
    const clean = depositPrincipalInput.replace(/\D/g, "");
    const val = parseInt(clean, 10);
    return isNaN(val) ? 0 : val;
  }, [depositPrincipalInput]);

  const effectiveDepositApy = useMemo(() => {
    const parsed = parseFloat(depositApyInput.replace(/,/g, "."));
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }, [depositApyInput]);

  const depositProjections = useMemo(() => {
    const annual = effectiveDepositPrincipal * (effectiveDepositApy / 100);
    const monthly = annual / 12;
    const atMaturity = (annual / 12) * depositTenorMonths;
    const taxRate = effectiveDepositPrincipal > 7500000 ? 0.2 : 0;
    return {
      monthlyNet: Math.round(monthly * (1 - taxRate)),
      maturityNet: Math.round(atMaturity * (1 - taxRate)),
    };
  }, [effectiveDepositPrincipal, effectiveDepositApy, depositTenorMonths]);

  // Wallet options for selects
  const walletOptions: GlassSelectOption[] = useMemo(() => {
    return wallets.map((w) => ({
      value: w.id,
      label: w.name,
      sublabel: `${w.classification || "wallet"} · ${formatWithPreferred(Number(w.balance || 0))}`,
      icon: w.icon,
    }));
  }, [wallets]);

  // ── Execution Handlers ──────────────────────────────────────────────────
  const handleExecuteRecordYield = () => {
    triggerHaptic("medium");

    const incomeCat =
      categories.find(
        (c) =>
          c.type === "income" &&
          (c.name.toLowerCase().includes("invest") ||
            c.name.toLowerCase().includes("passive") ||
            c.name.toLowerCase().includes("yield") ||
            c.name.toLowerCase().includes("bunga")),
      ) || categories.find((c) => c.type === "income");

    // Ensure full ISO timestamp
    const fullIsoOccurredOn = claimDate.includes("T")
      ? claimDate
      : `${claimDate}T12:00:00`;

    if (instrumentType === "daily_bank") {
      const amount = bankProjections.daily;
      if (amount <= 0) {
        showToast(
          isIndonesian
            ? "Nominal bunga tidak valid"
            : "Invalid interest amount",
          "delete",
          () => {},
        );
        return;
      }
      const note =
        claimNote.trim() ||
        `${isIndonesian ? "Bunga Harian" : "Daily Interest"} ${activeBankWallet?.name || "SeaBank"} (+${formatWithPreferred(amount)})`;

      addTx.mutate({
        wallet_id: selectedBankWalletId || activeBankWallet?.id,
        category_id: incomeCat?.id || null,
        type: "income",
        amount,
        occurred_on: fullIsoOccurredOn,
        note,
      });

      showToast(
        isIndonesian
          ? `Bunga harian ${formatWithPreferred(amount)} berhasil dicatat ke ${activeBankWallet?.name || "bank"}`
          : `Daily interest ${formatWithPreferred(amount)} recorded to ${activeBankWallet?.name || "bank"}`,
        "add",
        () => {},
      );
    } else if (instrumentType === "bond_coupon") {
      const amount = bondProjections.monthlyNet;
      if (amount <= 0) {
        showToast(
          isIndonesian
            ? "Nominal kupon tidak valid"
            : "Invalid coupon amount",
          "delete",
          () => {},
        );
        return;
      }
      const note =
        claimNote.trim() ||
        `${isIndonesian ? "Kupon SBN" : "SBN Coupon"} ${selectedBondSymbol} (+${formatWithPreferred(amount)})`;

      addTx.mutate({
        wallet_id: bondPayoutWalletId || selectedBankWalletId,
        category_id: incomeCat?.id || null,
        type: "income",
        amount,
        occurred_on: fullIsoOccurredOn,
        note,
      });

      showToast(
        isIndonesian
          ? `Kupon SBN ${selectedBondSymbol} sebesar ${formatWithPreferred(amount)} berhasil dicatat`
          : `SBN coupon of ${formatWithPreferred(amount)} for ${selectedBondSymbol} recorded`,
        "add",
        () => {},
      );
    } else if (instrumentType === "dividend") {
      const clean = dividendAmountInput.replace(/\D/g, "");
      const amount = parseInt(clean, 10);
      if (isNaN(amount) || amount <= 0) {
        showToast(
          isIndonesian
            ? "Nominal dividen tidak valid"
            : "Invalid dividend amount",
          "delete",
          () => {},
        );
        return;
      }
      const note =
        claimNote.trim() ||
        `${isIndonesian ? "Dividen Saham" : "Stock Dividend"} ${selectedStockSymbol} (+${formatWithPreferred(amount)})`;

      addTx.mutate({
        wallet_id: dividendPayoutWalletId || selectedBankWalletId,
        category_id: incomeCat?.id || null,
        type: "income",
        amount,
        occurred_on: fullIsoOccurredOn,
        note,
      });

      showToast(
        isIndonesian
          ? `Dividen ${selectedStockSymbol} sebesar ${formatWithPreferred(amount)} berhasil dicatat`
          : `Dividend of ${formatWithPreferred(amount)} for ${selectedStockSymbol} recorded`,
        "add",
        () => {},
      );
    } else if (instrumentType === "deposit") {
      const amount = depositProjections.monthlyNet;
      if (amount <= 0) {
        showToast(
          isIndonesian ? "Nominal imbal hasil tidak valid" : "Invalid amount",
          "delete",
          () => {},
        );
        return;
      }
      const note =
        claimNote.trim() ||
        `${isIndonesian ? "Bunga Deposito" : "Deposit Interest"} (+${formatWithPreferred(amount)})`;

      addTx.mutate({
        wallet_id: depositPayoutWalletId || selectedBankWalletId,
        category_id: incomeCat?.id || null,
        type: "income",
        amount,
        occurred_on: fullIsoOccurredOn,
        note,
      });

      showToast(
        isIndonesian
          ? `Bunga deposito ${formatWithPreferred(amount)} berhasil dicatat`
          : `Deposit interest ${formatWithPreferred(amount)} recorded`,
        "add",
        () => {},
      );
    } else {
      // 5. Crypto Staking
      const unitsToClaim =
        cryptoProjections.daily.units > 0
          ? cryptoProjections.daily.units
          : 0.23;
      const idrAmount = Math.round(unitsToClaim * effectiveCryptoPrice);
      const targetSymbol = selectedCryptoSymbol.toUpperCase();

      if (unitsToClaim <= 0 || idrAmount <= 0) {
        showToast(
          isIndonesian
            ? "Nominal imbal hasil tidak valid"
            : "Invalid yield amount",
          "delete",
          () => {},
        );
        return;
      }

      const defaultNote = isIndonesian
        ? `Imbal Hasil Staking ${targetSymbol} (+${unitsToClaim} ${targetSymbol} · ${
            isAutoCompound ? "Bunga Majemuk" : "Pencairan Kas"
          })`
        : `Staking Yield ${targetSymbol} (+${unitsToClaim} ${targetSymbol} · ${
            isAutoCompound ? "Auto-Compound" : "Cash Payout"
          })`;
      const finalNote = claimNote.trim() || defaultNote;

      if (!isAutoCompound) {
        // Mode: Cash Payout (Disbursed to fiat/bank account)
        addTx.mutate({
          wallet_id: cryptoPayoutWalletId || selectedBankWalletId,
          category_id: incomeCat?.id || null,
          type: "income",
          amount: idrAmount,
          occurred_on: fullIsoOccurredOn,
          note: finalNote,
        });

        showToast(
          isIndonesian
            ? `Pencairan yield +${unitsToClaim} ${targetSymbol} (${formatWithPreferred(idrAmount)}) berhasil dicatat`
            : `Yield payout +${unitsToClaim} ${targetSymbol} (${formatWithPreferred(idrAmount)}) recorded`,
          "add",
          () => {},
        );
      } else {
        // Mode: Auto-Compound (Reinvested directly into coin balance)
        const targetHolding = (holdings || []).find(
          (h) => h.symbol?.toUpperCase() === targetSymbol,
        );
        let targetHoldingId = targetHolding?.id;

        if (!targetHoldingId) {
          if (targetSymbol === "USDT") {
            targetHoldingId = getStandardUsdtHoldingId(userId);
          } else {
            targetHoldingId = `holding-${targetSymbol.toLowerCase()}-${Date.now()}`;
            upsertHolding(
              {
                id: targetHoldingId,
                user_id: userId,
                symbol: targetSymbol,
                name: targetSymbol,
                asset_type: "crypto",
                units: 0,
                avg_buy_price: effectiveCryptoPrice,
                current_price: effectiveCryptoPrice,
                currency: "IDR",
                icon: "Coins",
                activities: [],
              },
              userId,
            );
          }
        }

        // 1. Record holding activity ONCE directly to the holding
        recordHoldingActivity(
          targetHoldingId,
          {
            type: "buy",
            units: unitsToClaim,
            price_per_unit: effectiveCryptoPrice,
            total_amount: idrAmount,
            date: fullIsoOccurredOn.split("T")[0],
            note: finalNote,
          },
          userId,
        );

        // 2. Record income transaction in the ledger so user sees it in cashflow & reports
        addTx.mutate({
          wallet_id: null,
          category_id: incomeCat?.id || null,
          type: "income",
          amount: idrAmount,
          occurred_on: fullIsoOccurredOn,
          note: finalNote,
        });

        showToast(
          isIndonesian
            ? `Bunga majemuk +${unitsToClaim} ${targetSymbol} (+${formatWithPreferred(idrAmount)}) berhasil ditambahkan ke saldo aset`
            : `Auto-compounded +${unitsToClaim} ${targetSymbol} (+${formatWithPreferred(idrAmount)}) to asset holdings`,
          "add",
          () => {},
        );
      }
    }

    if (onSuccess) onSuccess();
    onClose();
  };

  // ── Materials ───────────────────────────────────────────────────────────
  const sheetOuterBg = isDark
    ? "linear-gradient(180deg, rgba(28,28,33,0.96) 0%, rgba(18,18,22,0.98) 35%, rgba(10,10,14,0.99) 100%)"
    : "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(246,247,250,0.98) 45%, rgba(238,240,245,0.99) 100%)";

  const sheetOuterBorder = isDark
    ? "1px solid rgba(255,255,255,0.12)"
    : "1px solid rgba(0,0,0,0.08)";

  const controlBg = isDark
    ? "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)"
    : "linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.70) 100%)";

  const controlBorder = isDark
    ? "1px solid rgba(255,255,255,0.09)"
    : "1px solid rgba(0,0,0,0.065)";

  const controlShadow = isDark
    ? "inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 6px rgba(0,0,0,0.2)"
    : "inset 0 1px 0 #ffffff, 0 2px 5px rgba(30,35,50,0.04)";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-all"
          />

          {/* Bottom Sheet Surface */}
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
            className="relative z-10 w-full max-w-lg mx-auto rounded-t-[32px] sm:rounded-t-[36px] overflow-hidden flex flex-col max-h-[90dvh] transition-all"
            style={{
              background: sheetOuterBg,
              borderTop: sheetOuterBorder,
              borderLeft: sheetOuterBorder,
              borderRight: sheetOuterBorder,
              boxShadow: isDark
                ? "0 -16px 48px -8px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.18)"
                : "0 -12px 36px -6px rgba(0,0,0,0.12), inset 0 1px 0 #ffffff",
              backdropFilter: "blur(30px) saturate(180%)",
              WebkitBackdropFilter: "blur(30px) saturate(180%)",
            }}
          >
            {/* Top Specular Rim Reflection */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-[8%] right-[8%] top-[1px] h-[2px] rounded-full"
              style={{
                background: isDark
                  ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.28), rgba(255,255,255,0.45), rgba(255,255,255,0.28), transparent)"
                  : "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), rgba(255,255,255,1), rgba(255,255,255,0.8), transparent)",
              }}
            />

            {/* Drag Handle Indicator */}
            <div className="w-11 h-1.5 rounded-full bg-white/25 mx-auto mt-3 mb-1 shrink-0" />

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-2 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-white/90 animate-pulse" />
                <div>
                  <h3 className="text-[17px] font-semibold tracking-tight text-[var(--text-primary)] leading-tight">
                    {isIndonesian
                      ? "Imbal Hasil & Pendapatan Pasif"
                      : "Yield & Passive Income"}
                  </h3>
                  <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                    {isIndonesian
                      ? "Bunga harian bank, kupon SBN, dividen, deposito & staking"
                      : "Daily bank yield, bond coupons, dividends, deposit & staking"}
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
                <X size={15} strokeWidth={2} />
              </button>
            </div>

            {/* ── 2. Instrument Type Tabs (5 Pillars: Bank, SBN, Dividen, Deposito, Staking) ── */}
            <div className="px-6 shrink-0">
              <div
                className="grid grid-cols-5 gap-1 p-1 rounded-2xl mb-3.5 transition-all"
                style={{
                  background: isDark
                    ? "rgba(255, 255, 255, 0.05)"
                    : "rgba(0, 0, 0, 0.04)",
                  border: isDark
                    ? "1px solid rgba(255, 255, 255, 0.08)"
                    : "1px solid rgba(0, 0, 0, 0.06)",
                }}
              >
                {[
                  {
                    id: "daily_bank" as YieldInstrumentType,
                    label: isIndonesian ? "Bank" : "Bank",
                    icon: Landmark,
                  },
                  {
                    id: "bond_coupon" as YieldInstrumentType,
                    label: isIndonesian ? "SBN" : "Bonds",
                    icon: ShieldCheck,
                  },
                  {
                    id: "dividend" as YieldInstrumentType,
                    label: isIndonesian ? "Dividen" : "Dividends",
                    icon: PieChart,
                  },
                  {
                    id: "deposit" as YieldInstrumentType,
                    label: isIndonesian ? "Deposito" : "Deposit",
                    icon: Building2,
                  },
                  {
                    id: "crypto_staking" as YieldInstrumentType,
                    label: isIndonesian ? "Staking" : "Staking",
                    icon: Coins,
                  },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = instrumentType === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        setInstrumentType(tab.id);
                      }}
                      className="flex flex-col items-center justify-center py-2 px-0.5 rounded-xl text-[10px] font-semibold transition-all cursor-pointer select-none"
                      style={{
                        background: isActive
                          ? isDark
                            ? "#ffffff"
                            : "#18181b"
                          : "transparent",
                        color: isActive
                          ? isDark
                            ? "#000000"
                            : "#ffffff"
                          : "var(--text-tertiary)",
                        boxShadow: isActive
                          ? isDark
                            ? "0 3px 10px rgba(0, 0, 0, 0.35), inset 0 1px 0 #ffffff"
                            : "0 3px 8px rgba(0, 0, 0, 0.16)"
                          : "none",
                      }}
                    >
                      <Icon
                        size={15}
                        className="mb-1 shrink-0"
                        strokeWidth={isActive ? 2.2 : 1.75}
                      />
                      <span className="leading-tight text-center truncate max-w-full">
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* ── 3. Lifecycle Tab Bar (Simulasi vs Catat Pemasukan) ────────── */}
              <div
                className="flex p-1 rounded-full mb-4 transition-all"
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
                    setActiveTab("overview");
                  }}
                  className="flex-1 py-1.5 rounded-full text-[11.5px] font-semibold transition-all cursor-pointer"
                  style={{
                    background:
                      activeTab === "overview"
                        ? isDark
                          ? "rgba(255,255,255,0.12)"
                          : "#ffffff"
                        : "transparent",
                    color:
                      activeTab === "overview"
                        ? "var(--text-primary)"
                        : "var(--text-tertiary)",
                    boxShadow:
                      activeTab === "overview"
                        ? isDark
                          ? "0 2px 6px rgba(0,0,0,0.3)"
                          : "0 2px 6px rgba(0,0,0,0.06)"
                        : "none",
                  }}
                >
                  {isIndonesian
                    ? "1. Simulasi & Proyeksi"
                    : "1. Setup & Projection"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setActiveTab("claim");
                  }}
                  className="flex-1 py-1.5 rounded-full text-[11.5px] font-semibold transition-all cursor-pointer"
                  style={{
                    background:
                      activeTab === "claim"
                        ? isDark
                          ? "rgba(255,255,255,0.12)"
                          : "#ffffff"
                        : "transparent",
                    color:
                      activeTab === "claim"
                        ? "var(--text-primary)"
                        : "var(--text-tertiary)",
                    boxShadow:
                      activeTab === "claim"
                        ? isDark
                          ? "0 2px 6px rgba(0,0,0,0.3)"
                          : "0 2px 6px rgba(0,0,0,0.06)"
                        : "none",
                  }}
                >
                  {isIndonesian
                    ? "2. Catat Penghasilan Masuk"
                    : "2. Record Income"}
                </button>
              </div>
            </div>

            {/* ── 4. Main Scrollable Form Body ─────────────────────────────── */}
            <div
              className="flex-1 overflow-y-auto no-scrollbar px-6 space-y-4"
              style={{
                paddingBottom:
                  "max(calc(env(safe-area-inset-bottom, 0px) + 24px), 36px)",
              }}
            >
              {/* TAB 1: OVERVIEW & SIMULATION */}
              {activeTab === "overview" && (
                <div className="space-y-4">
                  {/* Case A: Daily Bank Interest */}
                  {instrumentType === "daily_bank" && (
                    <div className="space-y-3.5">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-1">
                          {isIndonesian
                            ? "Pilih Rekening Tabungan"
                            : "Select Bank Account"}
                        </label>
                        <GlassSelect
                          value={selectedBankWalletId}
                          onChange={(v) => setSelectedBankWalletId(v)}
                          options={walletOptions}
                          placeholder={
                            isIndonesian ? "Pilih dompet bank" : "Choose wallet"
                          }
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-1">
                            {isIndonesian
                              ? "Saldo Pokok (Rp)"
                              : "Principal (Rp)"}
                          </label>
                          <input
                            type="text"
                            value={
                              customBankPrincipal ||
                              (activeBankBalance > 0
                                ? activeBankBalance.toLocaleString(
                                    isIndonesian ? "id-ID" : "en-US",
                                  )
                                : "")
                            }
                            onChange={(e) => {
                              const formatted = formatLiveAmountInput(
                                e.target.value,
                                isIndonesian,
                              );
                              setCustomBankPrincipal(formatted.display);
                            }}
                            placeholder="Contoh: 25.000.000"
                            className="w-full h-11 px-3.5 rounded-2xl text-[13px] font-semibold text-[var(--text-primary)] outline-none transition-all"
                            style={{
                              background: controlBg,
                              border: controlBorder,
                              boxShadow: controlShadow,
                            }}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-1">
                            {isIndonesian ? "Bunga p.a. (%)" : "Annual APY (%)"}
                          </label>
                          <input
                            type="text"
                            value={bankApyInput}
                            onChange={(e) => setBankApyInput(e.target.value)}
                            placeholder="3.75"
                            className="w-full h-11 px-3.5 rounded-2xl text-[13px] font-semibold text-[var(--text-primary)] outline-none transition-all "
                            style={{
                              background: controlBg,
                              border: controlBorder,
                              boxShadow: controlShadow,
                            }}
                          />
                        </div>
                      </div>

                      {/* Yield Hero Card */}
                      <div
                        className="p-4 rounded-3xl space-y-3"
                        style={{
                          background: controlBg,
                          border: controlBorder,
                          boxShadow: controlShadow,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[var(--text-tertiary)] text-[11px]">
                            <Sparkles size={12} className="text-zinc-400" />
                            <span>
                              {isIndonesian
                                ? "Estimasi Bunga Harian (Besok)"
                                : "Estimated Daily Payout"}
                            </span>
                          </div>
                          <span className="text-[16px] font-bold text-[var(--text-primary)] amount ">
                            +{formatWithPreferred(bankProjections.daily)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-[var(--glass-border)]/40">
                          <div>
                            <span className="text-[10.5px] text-[var(--text-tertiary)] block">
                              {isIndonesian
                                ? "Estimasi per Bulan"
                                : "Monthly Yield"}
                            </span>
                            <span className="text-[13px] font-semibold text-[var(--text-secondary)] amount ">
                              +{formatWithPreferred(bankProjections.monthly)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10.5px] text-[var(--text-tertiary)] block">
                              {isIndonesian
                                ? "Estimasi per Tahun"
                                : "Annual Yield"}
                            </span>
                            <span className="text-[13px] font-semibold text-[var(--text-secondary)] amount ">
                              +{formatWithPreferred(bankProjections.yearly)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Case B: Government Bond / SBN Coupon */}
                  {instrumentType === "bond_coupon" && (
                    <div className="space-y-3.5">
                      {/* Bond chips if user holds any bonds */}
                      {bondHoldings.length > 0 && (
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-1">
                            {isIndonesian ? "Aset Portofolio SBN" : "Portfolio Bond Holdings"}
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {bondHoldings.map((b) => (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() => {
                                  triggerHaptic("light");
                                  setSelectedBondSymbol(b.symbol);
                                  const total = b.units * (b.current_price || 1000000);
                                  setBondPrincipalInput(total.toLocaleString("id-ID"));
                                  if (b.annual_rate) {
                                    setBondCouponRateInput(String(Math.abs(b.annual_rate)));
                                  }
                                }}
                                className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all cursor-pointer select-none flex items-center gap-1 ${
                                  selectedBondSymbol === b.symbol
                                    ? isDark
                                      ? "bg-white text-black"
                                      : "bg-black text-white"
                                    : "bg-white/[0.05] text-[var(--text-secondary)] border border-[var(--glass-border)]"
                                }`}
                              >
                                {selectedBondSymbol === b.symbol && <Check size={11} strokeWidth={2.5} />}
                                <span>{b.symbol}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-1">
                          {isIndonesian ? "Seri / Kode SBN" : "Bond Series / Code"}
                        </label>
                        <input
                          type="text"
                          value={selectedBondSymbol}
                          onChange={(e) => setSelectedBondSymbol(e.target.value.toUpperCase())}
                          placeholder="Contoh: ORI025, SR020, FR0098"
                          className="w-full h-11 px-3.5 rounded-2xl text-[13px] font-semibold text-[var(--text-primary)] outline-none uppercase"
                          style={{
                            background: controlBg,
                            border: controlBorder,
                            boxShadow: controlShadow,
                          }}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-1">
                            {isIndonesian ? "Pokok Investasi (Rp)" : "Principal (Rp)"}
                          </label>
                          <input
                            type="text"
                            value={bondPrincipalInput}
                            onChange={(e) => {
                              const formatted = formatLiveAmountInput(e.target.value, isIndonesian);
                              setBondPrincipalInput(formatted.display);
                            }}
                            placeholder="50.000.000"
                            className="w-full h-11 px-3.5 rounded-2xl text-[13px] font-semibold text-[var(--text-primary)] outline-none"
                            style={{
                              background: controlBg,
                              border: controlBorder,
                              boxShadow: controlShadow,
                            }}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-1">
                            {isIndonesian ? "Kupon p.a. (%)" : "Coupon Rate (%)"}
                          </label>
                          <input
                            type="text"
                            value={bondCouponRateInput}
                            onChange={(e) => setBondCouponRateInput(e.target.value)}
                            placeholder="6.4"
                            className="w-full h-11 px-3.5 rounded-2xl text-[13px] font-semibold text-[var(--text-primary)] outline-none"
                            style={{
                              background: controlBg,
                              border: controlBorder,
                              boxShadow: controlShadow,
                            }}
                          />
                        </div>
                      </div>

                      {/* Yield Hero Card for SBN */}
                      <div
                        className="p-4 rounded-3xl space-y-3"
                        style={{
                          background: controlBg,
                          border: controlBorder,
                          boxShadow: controlShadow,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[var(--text-tertiary)] text-[11px]">
                            <Sparkles size={12} className="text-zinc-400" />
                            <span>
                              {isIndonesian
                                ? "Estimasi Kupon Bulanan Bersih"
                                : "Net Monthly Coupon"}
                            </span>
                          </div>
                          <span className="text-[16px] font-bold text-[var(--text-primary)] amount">
                            +{formatWithPreferred(bondProjections.monthlyNet)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-[var(--glass-border)]/40 text-[11px]">
                          <div>
                            <span className="text-[10px] text-[var(--text-tertiary)] block">
                              {isIndonesian ? "Kupon Bersih / Tahun" : "Net Annual Coupon"}
                            </span>
                            <span className="font-semibold text-[var(--text-secondary)] amount">
                              +{formatWithPreferred(bondProjections.annualNet)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-[var(--text-tertiary)] block">
                              {isIndonesian ? "Pajak PPh Final (10%)" : "Final Tax (10%)"}
                            </span>
                            <span className="font-semibold text-[var(--text-tertiary)] amount">
                              -{formatWithPreferred(bondProjections.taxMonthly)} / {isIndonesian ? "bln" : "mo"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-1">
                          {isIndonesian
                            ? "Rekening Pencairan Kupon"
                            : "Coupon Destination Account"}
                        </label>
                        <GlassSelect
                          value={bondPayoutWalletId}
                          onChange={(v) => setBondPayoutWalletId(v)}
                          options={walletOptions}
                          placeholder={
                            isIndonesian ? "Pilih rekening penerima" : "Choose wallet"
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* Case C: Stock Dividend */}
                  {instrumentType === "dividend" && (
                    <div className="space-y-3.5">
                      {/* Stock chips if user holds stocks */}
                      {stockHoldings.length > 0 && (
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-1">
                            {isIndonesian ? "Saham Portofolio" : "Portfolio Stocks"}
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {stockHoldings.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                  triggerHaptic("light");
                                  setSelectedStockSymbol(s.symbol);
                                }}
                                className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all cursor-pointer select-none flex items-center gap-1 ${
                                  selectedStockSymbol === s.symbol
                                    ? isDark
                                      ? "bg-white text-black"
                                      : "bg-black text-white"
                                    : "bg-white/[0.05] text-[var(--text-secondary)] border border-[var(--glass-border)]"
                                }`}
                              >
                                {selectedStockSymbol === s.symbol && <Check size={11} strokeWidth={2.5} />}
                                <span>{s.symbol}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-1">
                          {isIndonesian
                            ? "Kode Saham / Emiten"
                            : "Stock Symbol"}
                        </label>
                        <input
                          type="text"
                          value={selectedStockSymbol}
                          onChange={(e) =>
                            setSelectedStockSymbol(e.target.value.toUpperCase())
                          }
                          placeholder="Contoh: BBCA, BBRI, ASII"
                          className="w-full h-11 px-3.5 rounded-2xl text-[13px] font-semibold text-[var(--text-primary)] outline-none uppercase "
                          style={{
                            background: controlBg,
                            border: controlBorder,
                            boxShadow: controlShadow,
                          }}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-1">
                          {isIndonesian
                            ? "Nominal Dividen Bersih (Rp)"
                            : "Net Dividend Amount (Rp)"}
                        </label>
                        <input
                          type="text"
                          value={dividendAmountInput}
                          onChange={(e) => {
                            const formatted = formatLiveAmountInput(
                              e.target.value,
                              isIndonesian,
                            );
                            setDividendAmountInput(formatted.display);
                          }}
                          placeholder="Contoh: 350.000"
                          className="w-full h-11 px-3.5 rounded-2xl text-[15px] font-bold text-[var(--text-primary)] amount  outline-none"
                          style={{
                            background: controlBg,
                            border: controlBorder,
                            boxShadow: controlShadow,
                          }}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-1">
                          {isIndonesian
                            ? "Rekening Pencairan (RDN / Bank)"
                            : "Payout Destination Account"}
                        </label>
                        <GlassSelect
                          value={dividendPayoutWalletId}
                          onChange={(v) => setDividendPayoutWalletId(v)}
                          options={walletOptions}
                          placeholder={
                            isIndonesian ? "Pilih RDN / Bank" : "Choose wallet"
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* Case D: Term Deposit */}
                  {instrumentType === "deposit" && (
                    <div className="space-y-3.5">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-1">
                          {isIndonesian
                            ? "Nominal Pokok Deposito"
                            : "Deposit Principal"}
                        </label>
                        <input
                          type="text"
                          value={depositPrincipalInput}
                          onChange={(e) => {
                            const formatted = formatLiveAmountInput(
                              e.target.value,
                              isIndonesian,
                            );
                            setDepositPrincipalInput(formatted.display);
                          }}
                          placeholder="Contoh: 10.000.000"
                          className="w-full h-11 px-3.5 rounded-2xl text-[13px] font-semibold text-[var(--text-primary)] outline-none"
                          style={{
                            background: controlBg,
                            border: controlBorder,
                            boxShadow: controlShadow,
                          }}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-1">
                            {isIndonesian
                              ? "Bunga p.a. (%)"
                              : "Interest p.a. (%)"}
                          </label>
                          <input
                            type="text"
                            value={depositApyInput}
                            onChange={(e) => setDepositApyInput(e.target.value)}
                            placeholder="6.5"
                            className="w-full h-11 px-3.5 rounded-2xl text-[13px] font-semibold text-[var(--text-primary)] outline-none "
                            style={{
                              background: controlBg,
                              border: controlBorder,
                              boxShadow: controlShadow,
                            }}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-1">
                            {isIndonesian ? "Tenor (Bulan)" : "Tenor (Months)"}
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={36}
                            value={depositTenorMonths}
                            onChange={(e) =>
                              setDepositTenorMonths(
                                parseInt(e.target.value, 10) || 1,
                              )
                            }
                            className="w-full h-11 px-3.5 rounded-2xl text-[13px] font-semibold text-[var(--text-primary)] outline-none "
                            style={{
                              background: controlBg,
                              border: controlBorder,
                              boxShadow: controlShadow,
                            }}
                          />
                        </div>
                      </div>

                      {/* Yield Hero Card */}
                      <div
                        className="p-4 rounded-3xl space-y-2.5"
                        style={{
                          background: controlBg,
                          border: controlBorder,
                          boxShadow: controlShadow,
                        }}
                      >
                        <div className="flex items-center justify-between text-[11.5px]">
                          <span className="text-[var(--text-tertiary)]">
                            {isIndonesian ? "Bunga per Bulan" : "Monthly Yield"}
                          </span>
                          <span className="font-semibold text-[var(--text-primary)] amount ">
                            +{formatWithPreferred(depositProjections.monthlyNet)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11.5px] pt-2 border-t border-[var(--glass-border)]/40">
                          <span className="text-[var(--text-tertiary)]">
                            {isIndonesian
                              ? "Total Saat Jatuh Tempo"
                              : "Total at Maturity"}
                          </span>
                          <span className="font-bold text-[var(--text-primary)] amount ">
                            +{formatWithPreferred(depositProjections.maturityNet)}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-1">
                          {isIndonesian
                            ? "Rekening Pencairan Deposito"
                            : "Payout Destination Account"}
                        </label>
                        <GlassSelect
                          value={depositPayoutWalletId}
                          onChange={(v) => setDepositPayoutWalletId(v)}
                          options={walletOptions}
                          placeholder={
                            isIndonesian
                              ? "Pilih dompet pencairan"
                              : "Choose wallet"
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* Case E: Multi-Crypto Staking */}
                  {instrumentType === "crypto_staking" && (
                    <div className="space-y-3.5">
                      {/* Crypto asset chips */}
                      {cryptoHoldings.length > 0 && (
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-1">
                            {isIndonesian ? "Aset Kripto yang Di-stake" : "Staked Crypto Asset"}
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {cryptoHoldings.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  triggerHaptic("light");
                                  setSelectedCryptoSymbol(c.symbol);
                                }}
                                className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all cursor-pointer select-none flex items-center gap-1 ${
                                  selectedCryptoSymbol === c.symbol
                                    ? isDark
                                      ? "bg-white text-black"
                                      : "bg-black text-white"
                                    : "bg-white/[0.05] text-[var(--text-secondary)] border border-[var(--glass-border)]"
                                }`}
                              >
                                {selectedCryptoSymbol === c.symbol && <Check size={11} strokeWidth={2.5} />}
                                <span>{c.symbol}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between px-1 text-[11px]">
                          <span className="font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                            {isIndonesian
                              ? `Pokok Staking ${selectedCryptoSymbol}`
                              : `Staked ${selectedCryptoSymbol}`}
                          </span>
                          <span className=" text-[var(--text-tertiary)] opacity-80">
                            {isIndonesian ? "Tersedia: " : "Available: "}
                            {formatHoldingUnits(effectiveCryptoUnits)} {selectedCryptoSymbol}
                          </span>
                        </div>
                        <input
                          type="text"
                          value={customStakedUnits}
                          onChange={(e) => setCustomStakedUnits(e.target.value)}
                          placeholder="1000"
                          className="w-full h-11 px-3.5 rounded-2xl text-[13px] font-semibold text-[var(--text-primary)] outline-none "
                          style={{
                            background: controlBg,
                            border: controlBorder,
                            boxShadow: controlShadow,
                          }}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-1">
                          {isIndonesian
                            ? "Estimasi APY (%)"
                            : "Estimated APY (%)"}
                        </label>
                        <input
                          type="text"
                          value={cryptoApyInput}
                          onChange={(e) => setCryptoApyInput(e.target.value)}
                          placeholder="8.5"
                          className="w-full h-11 px-3.5 rounded-2xl text-[13px] font-semibold text-[var(--text-primary)] outline-none "
                          style={{
                            background: controlBg,
                            border: controlBorder,
                            boxShadow: controlShadow,
                          }}
                        />
                      </div>

                      {/* Yield Hero Card for Crypto */}
                      <div
                        className="p-4 rounded-3xl space-y-2.5"
                        style={{
                          background: controlBg,
                          border: controlBorder,
                          boxShadow: controlShadow,
                        }}
                      >
                        <div className="flex items-center justify-between text-[11.5px]">
                          <span className="text-[var(--text-tertiary)]">
                            {isIndonesian ? "Imbal Hasil Harian" : "Daily Yield"}
                          </span>
                          <span className="font-bold text-[var(--text-primary)] amount">
                            +{cryptoProjections.daily.units} {selectedCryptoSymbol}{" "}
                            <span className="text-[10px] text-[var(--text-tertiary)] font-normal">
                              (+{formatWithPreferred(cryptoProjections.daily.idr)})
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11.5px] pt-2 border-t border-[var(--glass-border)]/40">
                          <span className="text-[var(--text-tertiary)]">
                            {isIndonesian ? "Imbal Hasil per Tahun" : "Annual Yield"}
                          </span>
                          <span className="font-semibold text-[var(--text-secondary)] amount">
                            +{cryptoProjections.yearly.units} {selectedCryptoSymbol}{" "}
                            <span className="text-[10px] text-[var(--text-tertiary)] font-normal">
                              (+{formatWithPreferred(cryptoProjections.yearly.idr)})
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Mode: Auto-Compound vs Cash Payout */}
                      <div className="grid grid-cols-2 gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic("light");
                            setIsAutoCompound(true);
                          }}
                          className="p-3 rounded-2xl text-left transition-all cursor-pointer active:scale-[0.98]"
                          style={{
                            background: isAutoCompound
                              ? isDark
                                ? "#ffffff"
                                : "#18181b"
                              : controlBg,
                            color: isAutoCompound
                              ? isDark
                                ? "#000000"
                                : "#ffffff"
                              : "var(--text-tertiary)",
                            border: isAutoCompound
                              ? isDark
                                ? "1px solid #ffffff"
                                : "1px solid #18181b"
                              : controlBorder,
                            boxShadow: isAutoCompound
                              ? "0 3px 10px rgba(0,0,0,0.25)"
                              : controlShadow,
                          }}
                        >
                          <span className="text-[11.5px] font-bold block">
                            {isIndonesian ? "Bunga Majemuk" : "Auto-Compound"}
                          </span>
                          <span className="text-[10px] opacity-80 mt-0.5 block">
                            {isIndonesian
                              ? "Bunga menambah saldo koin"
                              : "Yield reinvested into coins"}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic("light");
                            setIsAutoCompound(false);
                          }}
                          className="p-3 rounded-2xl text-left transition-all cursor-pointer active:scale-[0.98]"
                          style={{
                            background: !isAutoCompound
                              ? isDark
                                ? "#ffffff"
                                : "#18181b"
                              : controlBg,
                            color: !isAutoCompound
                              ? isDark
                                ? "#000000"
                                : "#ffffff"
                              : "var(--text-tertiary)",
                            border: !isAutoCompound
                              ? isDark
                                ? "1px solid #ffffff"
                                : "1px solid #18181b"
                              : controlBorder,
                            boxShadow: !isAutoCompound
                              ? "0 3px 10px rgba(0,0,0,0.25)"
                              : controlShadow,
                          }}
                        >
                          <span className="text-[11.5px] font-bold block">
                            {isIndonesian ? "Pencairan Kas" : "Cash Payout"}
                          </span>
                          <span className="text-[10px] opacity-80 mt-0.5 block">
                            {isIndonesian
                              ? "Cairkan ke rekening kas"
                              : "Payout to cash wallet"}
                          </span>
                        </button>
                      </div>

                      {!isAutoCompound && (
                        <div className="space-y-1.5 pt-1">
                          <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-1">
                            {isIndonesian
                              ? "Rekening Pencairan Kas"
                              : "Payout Destination Wallet"}
                          </label>
                          <GlassSelect
                            value={cryptoPayoutWalletId}
                            onChange={(v) => setCryptoPayoutWalletId(v)}
                            options={walletOptions}
                            placeholder={
                              isIndonesian
                                ? "Pilih dompet kas"
                                : "Choose wallet"
                            }
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action: Next Step */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        setActiveTab("claim");
                      }}
                      className="w-full h-12 rounded-full font-semibold text-[13px] flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98] select-none"
                      style={{
                        background: isDark
                          ? "linear-gradient(180deg, #ffffff 0%, #ececf0 100%)"
                          : "linear-gradient(180deg, #18181b 0%, #09090b 100%)",
                        color: isDark ? "#000000" : "#ffffff",
                        boxShadow: isDark
                          ? "0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 #ffffff"
                          : "0 4px 14px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
                      }}
                    >
                      <span>
                        {isIndonesian
                          ? "Lanjut ke Pencatatan"
                          : "Proceed to Record"}
                      </span>
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: CLAIM & RECORD TRANSACTION */}
              {activeTab === "claim" && (
                <div className="space-y-4">
                  {/* Target Date Selector */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-1">
                      {isIndonesian ? "Tanggal Transaksi" : "Transaction Date"}
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic("light");
                          setIsYesterdayDate(false);
                          setClaimDate(format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"));
                        }}
                        className="h-10 px-4 rounded-full text-[12px] font-semibold transition-all cursor-pointer select-none active:scale-[0.96] flex items-center justify-center gap-1.5"
                        style={{
                          background: !isYesterdayDate
                            ? isDark
                              ? "#ffffff"
                              : "#18181b"
                            : controlBg,
                          color: !isYesterdayDate
                            ? isDark
                              ? "#000000"
                              : "#ffffff"
                            : "var(--text-tertiary)",
                          border: !isYesterdayDate
                            ? isDark
                              ? "1px solid #ffffff"
                              : "1px solid #18181b"
                            : controlBorder,
                          boxShadow: !isYesterdayDate
                            ? "0 3px 10px rgba(0,0,0,0.25)"
                            : controlShadow,
                        }}
                      >
                        <CalendarIcon size={13} />
                        <span>{isIndonesian ? "Hari Ini" : "Today"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic("light");
                          setIsYesterdayDate(true);
                          setClaimDate(
                            format(subDays(new Date(), 1), "yyyy-MM-dd'T'HH:mm:ss"),
                          );
                        }}
                        className="h-10 px-4 rounded-full text-[12px] font-semibold transition-all cursor-pointer select-none active:scale-[0.96] flex items-center justify-center gap-1.5"
                        style={{
                          background: isYesterdayDate
                            ? isDark
                              ? "#ffffff"
                              : "#18181b"
                            : controlBg,
                          color: isYesterdayDate
                            ? isDark
                              ? "#000000"
                              : "#ffffff"
                            : "var(--text-tertiary)",
                          border: isYesterdayDate
                            ? isDark
                              ? "1px solid #ffffff"
                              : "1px solid #18181b"
                            : controlBorder,
                          boxShadow: isYesterdayDate
                            ? "0 3px 10px rgba(0,0,0,0.25)"
                            : controlShadow,
                        }}
                      >
                        <CalendarIcon size={13} />
                        <span>{isIndonesian ? "Kemarin" : "Yesterday"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Note / Memo Input */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-1">
                      {isIndonesian ? "Catatan Memo" : "Memo Note"}
                    </label>
                    <input
                      type="text"
                      value={claimNote}
                      onChange={(e) => setClaimNote(e.target.value)}
                      placeholder={
                        instrumentType === "daily_bank"
                          ? isIndonesian
                            ? "Contoh: Bunga Harian SeaBank"
                            : "e.g. Daily Interest SeaBank"
                          : instrumentType === "bond_coupon"
                            ? `${isIndonesian ? "Contoh: Kupon SBN" : "e.g. SBN Coupon"} ${selectedBondSymbol}`
                            : instrumentType === "dividend"
                              ? `${isIndonesian ? "Contoh: Dividen Saham" : "e.g. Stock Dividend"} ${selectedStockSymbol}`
                              : isIndonesian
                                ? "Catatan transaksi..."
                                : "Transaction note..."
                      }
                      className="w-full h-11 px-4 rounded-2xl text-[13px] text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-tertiary)]"
                      style={{
                        background: controlBg,
                        border: controlBorder,
                        boxShadow: controlShadow,
                      }}
                    />
                  </div>

                  {/* Confirm Submit Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleExecuteRecordYield}
                      className="w-full h-12 rounded-full font-semibold text-[13px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer select-none"
                      style={{
                        background: isDark
                          ? "linear-gradient(180deg, #ffffff 0%, #ececf0 100%)"
                          : "linear-gradient(180deg, #18181b 0%, #09090b 100%)",
                        color: isDark ? "#000000" : "#ffffff",
                        boxShadow: isDark
                          ? "0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 #ffffff"
                          : "0 4px 14px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
                      }}
                    >
                      <ShieldCheck size={16} strokeWidth={2.2} />
                      <span>
                        {isIndonesian
                          ? "Konfirmasi & Catat Pemasukan"
                          : "Confirm & Record Income"}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
