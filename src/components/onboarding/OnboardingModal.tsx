import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Banknote,
  Landmark,
  Smartphone,
  TrendingUp,
  Globe,
  Coins,
  X,
  Zap,
  ChevronRight,
  Search,
} from "lucide-react";
import { triggerHaptic, triggerSuccessHaptic } from "../../lib/haptics";
import { DEFAULT_HOME_WIDGETS } from "../../lib/widgetLayoutTypes";
import {
  applyPresetToWidgets,
  loadStoredWidgets,
  STORAGE_KEY,
} from "../../lib/widgetLayoutEngine";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  useCurrency,
  CURRENCY_METADATA,
  type SupportedCurrency,
} from "../../contexts/CurrencyContext";
import { BottomSheet } from "../ui/BottomSheet";
import { seedOnboardingWallets } from "../../hooks/useWallets";
import type { OnboardingWalletChoice } from "../../hooks/useWallets";
import {
  ArchetypeCardSelector,
  getArchetypeItems,
} from "./ArchetypeCardSelector";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { generateUUID } from "../../hooks/useTransactions";
import { getDefaultCategories } from "../../hooks/useCategories";
import { formatLiveAmountInput } from "../../lib/utils";
import type { Category } from "../../lib/types";

async function seedOnboardingCategories(
  userId: string | undefined,
  currency: string,
  isIndo: boolean,
  qc: QueryClient,
) {
  const categoryDefs = getDefaultCategories({ currency, isIndo });
  const isGuest = !userId || userId === "guest_local_user";

  const fullCategories: Category[] = categoryDefs.map((c) => ({
    id: generateUUID(),
    user_id: isGuest ? "guest_local_user" : userId,
    name: c.name,
    emoji: c.emoji,
    type: c.type,
    is_default: true,
    created_at: new Date().toISOString(),
  }));

  try {
    localStorage.setItem(
      "TROUVAILLE_CATEGORIES_BACKUP_V1",
      JSON.stringify(fullCategories),
    );
  } catch {}

  if (!isGuest && userId) {
    try {
      const { data: existingCats } = await supabase
        .from("categories")
        .select("id, name, type")
        .eq("user_id", userId);

      // If user already has categories in cloud, NEVER inject default categories
      if (existingCats && existingCats.length > 0) {
        return;
      }

      await supabase.from("categories").insert(
        fullCategories.map((c) => ({
          id: c.id,
          user_id: userId,
          name: c.name,
          emoji: c.emoji,
          type: c.type,
          is_default: true,
        })),
      );
    } catch (e) {
      console.warn("[seedOnboardingCategories] Cloud insertion warning:", e);
    }
  }

  qc.setQueryData(
    ["categories", isGuest ? "guest_local_user" : userId, null],
    fullCategories,
  );
  qc.setQueryData(
    ["categories", isGuest ? "guest_local_user" : userId, "expense"],
    fullCategories.filter((c) => c.type === "expense"),
  );
  qc.setQueryData(
    ["categories", isGuest ? "guest_local_user" : userId, "income"],
    fullCategories.filter((c) => c.type === "income"),
  );
}

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

type FocusKey = "expenses" | "budget" | "domain" | "wealth" | "complete";

interface AccountOption {
  id: string;
  nameEn: string;
  nameId: string;
  subEn: string;
  subId: string;
  icon: any;
  iconName: string;
  classification: "liquid" | "investment";
  region: "local" | "global";
}

const ACCOUNT_OPTIONS: AccountOption[] = [
  {
    id: "cash",
    nameEn: "Physical Cash",
    nameId: "Uang Tunai",
    subEn: "Physical wallet",
    subId: "Dompet fisik",
    icon: Banknote,
    iconName: "Banknote",
    classification: "liquid",
    region: "local",
  },
  {
    id: "bca",
    nameEn: "BCA",
    nameId: "BCA",
    subEn: "Primary bank",
    subId: "Rekening utama",
    icon: Landmark,
    iconName: "Landmark",
    classification: "liquid",
    region: "local",
  },
  {
    id: "mandiri",
    nameEn: "Mandiri / BNI",
    nameId: "Mandiri / BNI",
    subEn: "Payroll & transfers",
    subId: "Rekening operasional",
    icon: Landmark,
    iconName: "Landmark",
    classification: "liquid",
    region: "local",
  },
  {
    id: "jago",
    nameEn: "Jago / SeaBank",
    nameId: "Jago / SeaBank",
    subEn: "Digital pockets",
    subId: "Bank digital",
    icon: Landmark,
    iconName: "Landmark",
    classification: "liquid",
    region: "local",
  },
  {
    id: "gopay",
    nameEn: "GoPay",
    nameId: "GoPay",
    subEn: "Everyday outlays",
    subId: "Dompet digital",
    icon: Smartphone,
    iconName: "Smartphone",
    classification: "liquid",
    region: "local",
  },
  {
    id: "dana_ovo",
    nameEn: "DANA / OVO",
    nameId: "DANA / OVO",
    subEn: "Digital wallet",
    subId: "Dompet digital",
    icon: Smartphone,
    iconName: "Smartphone",
    classification: "liquid",
    region: "local",
  },
  {
    id: "saham_idx",
    nameEn: "IDX Stocks",
    nameId: "Saham IDX",
    subEn: "Capital market",
    subId: "Pasar modal",
    icon: TrendingUp,
    iconName: "TrendingUp",
    classification: "investment",
    region: "local",
  },
  {
    id: "wise",
    nameEn: "Wise",
    nameId: "Wise",
    subEn: "Multi-currency",
    subId: "Saldo valuta asing",
    icon: Globe,
    iconName: "Globe",
    classification: "liquid",
    region: "global",
  },
  {
    id: "paypal",
    nameEn: "PayPal",
    nameId: "PayPal",
    subEn: "Global earnings",
    subId: "Pembayaran global",
    icon: Smartphone,
    iconName: "Smartphone",
    classification: "liquid",
    region: "global",
  },
  {
    id: "revolut",
    nameEn: "Revolut",
    nameId: "Revolut",
    subEn: "Travel & cards",
    subId: "Kartu debit global",
    icon: Globe,
    iconName: "Globe",
    classification: "liquid",
    region: "global",
  },
  {
    id: "global_broker",
    nameEn: "Global Broker",
    nameId: "Sekuritas Global",
    subEn: "US Equities & ETFs",
    subId: "Saham global & ETF",
    icon: TrendingUp,
    iconName: "TrendingUp",
    classification: "investment",
    region: "global",
  },
  {
    id: "crypto_vault",
    nameEn: "Crypto / USDT",
    nameId: "Kripto / USDT",
    subEn: "Digital assets",
    subId: "Aset kripto",
    icon: Coins,
    iconName: "Coins",
    classification: "investment",
    region: "global",
  },
];

export function OnboardingModal({ isOpen, onComplete }: OnboardingModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { language, setLanguage, isIndonesian } = useLanguage();
  const [step, setStep] = useState<number>(1);

  // Step 1: Identity & Preset
  const [selectedFocus, setSelectedFocus] = useState<FocusKey>("expenses");
  const [userName, setUserName] = useState<string>(() => {
    return (
      user?.user_metadata?.display_name || user?.email?.split("@")[0] || ""
    );
  });
  const [presetMode, setPresetMode] = useState<"default" | "custom">("default");

  // Step 3: Accounts
  const [accountRegionTab, setAccountRegionTab] = useState<"local" | "global">(
    "local",
  );
  const [selectedAccounts, setSelectedAccounts] = useState<
    Record<string, boolean>
  >({
    cash: true,
    bca: true,
    gopay: true,
    mandiri: false,
    jago: false,
    dana_ovo: false,
    saham_idx: false,
    wise: false,
    paypal: false,
    revolut: false,
    global_broker: false,
    crypto_vault: false,
  });

  // Step 4: Balance
  const [startingBalance, setStartingBalance] = useState<number>(0);
  const [startingBalanceDisplay, setStartingBalanceDisplay] =
    useState<string>("");

  // Step 5: Routine
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(true);
  const [reminderHour, setReminderHour] = useState<number>(20);

  // Currency
  const { preferredCurrency, setPreferredCurrency, convertToIdr } =
    useCurrency();
  const [selectedCurrency, setSelectedCurrency] = useState<SupportedCurrency>(
    () => preferredCurrency || "IDR",
  );
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const [currencySearch, setCurrencySearch] = useState("");

  const activeCurrencyMeta =
    CURRENCY_METADATA[selectedCurrency] || CURRENCY_METADATA.IDR;

  const filteredCurrencies = useMemo(() => {
    const list = Object.values(CURRENCY_METADATA);
    if (!currencySearch.trim()) return list;
    const q = currencySearch.toLowerCase().trim();
    return list.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q) ||
        c.countryCode.toLowerCase().includes(q),
    );
  }, [currencySearch]);

  const quickIncrements = useMemo(() => {
    if (selectedCurrency === "IDR") return [250000, 500000, 1000000, 5000000];
    if (selectedCurrency === "JPY") return [5000, 10000, 50000, 100000];
    if (
      ["USD", "EUR", "SGD", "GBP", "AUD", "USDT"].includes(selectedCurrency)
    ) {
      return [100, 500, 1000, 5000];
    }
    return [500, 1000, 5000, 10000];
  }, [selectedCurrency]);

  const handleSelectCurrency = (curr: SupportedCurrency) => {
    triggerHaptic("medium");
    setSelectedCurrency(curr);
    if (curr !== "IDR") {
      setAccountRegionTab("global");
      setSelectedAccounts((prev) => ({
        ...prev,
        cash: true,
        wise: true,
        paypal: true,
        bca: false,
        gopay: false,
      }));
    } else {
      setAccountRegionTab("local");
      setSelectedAccounts((prev) => ({
        ...prev,
        cash: true,
        bca: true,
        gopay: true,
        wise: false,
        paypal: false,
      }));
    }
    setCurrencyPickerOpen(false);
  };

  const getCuratedWallets = (
    curr: SupportedCurrency,
    isIndo: boolean,
  ): OnboardingWalletChoice[] => {
    if (curr === "IDR") {
      return [
        {
          name: isIndo ? "Uang Tunai" : "Physical Cash",
          icon: "Banknote",
          classification: "liquid",
        },
        {
          name: "BCA",
          icon: "Landmark",
          classification: "liquid",
        },
        {
          name: "GoPay",
          icon: "Smartphone",
          classification: "liquid",
        },
      ];
    }
    return [
      {
        name: isIndo ? "Uang Tunai" : "Physical Cash",
        icon: "Banknote",
        classification: "liquid",
      },
      {
        name: isIndo ? "Rekening Utama" : "Main Bank Account",
        icon: "Landmark",
        classification: "liquid",
      },
      {
        name: isIndo ? "Dompet Digital Wise" : "Wise Digital Wallet",
        icon: "Globe",
        classification: "liquid",
      },
    ];
  };

  if (!isOpen) return null;

  const archetypeItems = getArchetypeItems(isIndonesian);
  const currentFocus =
    archetypeItems.find((f) => f.key === selectedFocus) || archetypeItems[0]!;

  const handleToggleAccount = (id: string) => {
    triggerHaptic("light");
    setSelectedAccounts((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleQuickAddBalance = (amount: number) => {
    triggerHaptic("medium");
    setStartingBalance((prev) => {
      const next = Number((prev + amount).toFixed(activeCurrencyMeta.decimals));
      const { formatted } = formatLiveAmountInput(
        String(next),
        isIndonesian && activeCurrencyMeta.decimals === 0,
        activeCurrencyMeta.decimals > 0,
        activeCurrencyMeta.decimals,
      );
      setStartingBalanceDisplay(formatted);
      return next;
    });
  };

  const handleClearBalance = () => {
    triggerHaptic("light");
    setStartingBalance(0);
    setStartingBalanceDisplay("");
  };

  const handleQuickStart = async () => {
    triggerSuccessHaptic();

    const standardWallets: OnboardingWalletChoice[] = getCuratedWallets(
      selectedCurrency,
      isIndonesian,
    );

    try {
      await seedOnboardingWallets(
        user?.id,
        standardWallets,
        undefined,
        isIndonesian,
      );
    } catch (err) {
      console.warn("[OnboardingModal] Failed quick seeding wallets:", err);
    }

    try {
      await seedOnboardingCategories(
        user?.id,
        selectedCurrency,
        isIndonesian,
        queryClient,
      );
    } catch (err) {
      console.warn("[OnboardingModal] Failed quick seeding categories:", err);
    }

    try {
      setPreferredCurrency(selectedCurrency);
      localStorage.setItem("trouvaille_preferred_currency", selectedCurrency);
    } catch (e) {
      console.warn("[OnboardingModal] Failed setting preferred currency:", e);
    }

    try {
      const stored = loadStoredWidgets(
        localStorage.getItem(STORAGE_KEY),
        DEFAULT_HOME_WIDGETS,
      );
      const updated = applyPresetToWidgets(stored, "minimal");
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn("[OnboardingModal] Failed setting widgets:", e);
    }

    try {
      localStorage.setItem("trouvaille_streak_reminder_enabled", "true");
      localStorage.setItem("trouvaille_streak_reminder_hour", "20");
    } catch {}

    if (userName.trim()) {
      try {
        localStorage.setItem("trouvaille_user_name", userName.trim());
      } catch {}
    }

    try {
      localStorage.setItem("trouvaille_preset_mode", "default");
      localStorage.setItem("trouvaille_onboarding_focus", "expenses");
      localStorage.setItem("trouvaille_onboarded", "true");
      localStorage.setItem("trouvaille_tour_pending", "true");
    } catch {}

    onComplete();
  };

  const handleNextStep = () => {
    triggerHaptic("medium");
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      if (presetMode === "default") {
        if (selectedCurrency === "IDR") {
          setSelectedAccounts({
            cash: true,
            bca: true,
            gopay: true,
            mandiri: false,
            jago: false,
            dana_ovo: false,
            saham_idx: false,
            wise: false,
            paypal: false,
            revolut: false,
            global_broker: false,
            crypto_vault: false,
          });
        } else {
          setSelectedAccounts({
            cash: true,
            bca: false,
            gopay: false,
            mandiri: false,
            jago: false,
            dana_ovo: false,
            saham_idx: false,
            wise: true,
            paypal: true,
            revolut: false,
            global_broker: false,
            crypto_vault: false,
          });
        }
        setStep(4);
      } else {
        setStep(3);
      }
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      setStep(5);
    } else {
      handleComplete();
    }
  };

  const handlePrevStep = () => {
    triggerHaptic("light");
    if (step === 4 && presetMode === "default") {
      setStep(2);
    } else if (step > 1) {
      setStep((prev) => prev - 1);
    }
  };

  const handleComplete = async () => {
    triggerSuccessHaptic();

    let chosenAccountConfigs: OnboardingWalletChoice[];
    if (presetMode === "default") {
      chosenAccountConfigs = getCuratedWallets(selectedCurrency, isIndonesian);
    } else {
      chosenAccountConfigs = ACCOUNT_OPTIONS.filter(
        (acc) => selectedAccounts[acc.id],
      ).map((acc) => ({
        name: isIndonesian ? acc.nameId : acc.nameEn,
        icon: acc.iconName,
        classification: acc.classification,
      }));
    }

    if (chosenAccountConfigs.length === 0) {
      chosenAccountConfigs.push({
        name: isIndonesian ? "Akun Utama" : "Main Account",
        icon: "Wallet",
        classification: "liquid",
      });
    }

    const convertedStartingBalance =
      startingBalance > 0
        ? Math.round(convertToIdr(startingBalance, selectedCurrency))
        : undefined;

    try {
      await seedOnboardingWallets(
        user?.id,
        chosenAccountConfigs,
        convertedStartingBalance,
        isIndonesian,
      );
    } catch (err) {
      console.warn("[OnboardingModal] Failed to seed wallets:", err);
    }

    try {
      await seedOnboardingCategories(
        user?.id,
        selectedCurrency,
        isIndonesian,
        queryClient,
      );
    } catch (err) {
      console.warn("[OnboardingModal] Failed seeding categories:", err);
    }

    try {
      setPreferredCurrency(selectedCurrency);
      localStorage.setItem("trouvaille_preferred_currency", selectedCurrency);
    } catch (e) {
      console.warn("[OnboardingModal] Failed setting preferred currency:", e);
    }

    try {
      const stored = loadStoredWidgets(
        localStorage.getItem(STORAGE_KEY),
        DEFAULT_HOME_WIDGETS,
      );
      const updated = applyPresetToWidgets(stored, currentFocus.widgetPreset);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn("[OnboardingModal] Failed to write widget preset:", e);
    }

    if (
      reminderEnabled &&
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      try {
        await Notification.requestPermission();
      } catch {}
    }

    try {
      localStorage.setItem(
        "trouvaille_streak_reminder_enabled",
        String(reminderEnabled),
      );
      localStorage.setItem(
        "trouvaille_streak_reminder_hour",
        String(reminderHour),
      );
    } catch {}

    if (userName.trim()) {
      try {
        localStorage.setItem("trouvaille_user_name", userName.trim());
      } catch {}
    }
    try {
      localStorage.setItem("trouvaille_preset_mode", presetMode);
    } catch {}

    try {
      localStorage.setItem("trouvaille_onboarding_focus", selectedFocus);
      localStorage.setItem("trouvaille_onboarded", "true");
      localStorage.setItem("trouvaille_tour_pending", "true");
    } catch {}

    onComplete();
  };

  const totalSteps = presetMode === "default" ? 4 : 5;
  const currentStepNumber =
    presetMode === "default" && step >= 4 ? step - 1 : step;

  return (
    <div
      className="fixed inset-0 z-[1000] flex flex-col justify-between overflow-hidden select-none px-4 sm:px-6"
      style={{
        background: "#08080a",
        fontFamily: "'Urbanist', sans-serif",
        paddingTop: "max(calc(env(safe-area-inset-top, 0px) + 14px), 20px)",
        paddingBottom:
          "max(calc(env(safe-area-inset-bottom, 0px) + 14px), 20px)",
      }}
    >
      {/* ── Subtle Ambient Backdrop (Zero Glow) ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 -left-32 w-[380px] h-[380px] rounded-full bg-white/[0.03] blur-[120px]" />
        <div className="absolute bottom-1/4 -right-32 w-[340px] h-[340px] rounded-full bg-white/[0.025] blur-[100px]" />
      </div>

      {/* ── Top Navigation & Step Indicator ── */}
      <div className="px-2 relative z-10 flex items-center justify-between pt-1">
        {step > 1 ? (
          <button
            type="button"
            onClick={handlePrevStep}
            className="w-8 h-8 rounded-full flex items-center justify-center border active:scale-95 transition-all cursor-pointer text-white/60 hover:text-white"
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              borderColor: "rgba(255, 255, 255, 0.1)",
            }}
          >
            <ArrowLeft size={15} strokeWidth={2} />
          </button>
        ) : (
          <div className="w-8" />
        )}

        {/* Step Indicator */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
            <div
              key={s}
              className={`h-1 rounded-full transition-all duration-300 ${
                s === currentStepNumber
                  ? "w-5 bg-white"
                  : s < currentStepNumber
                    ? "w-1.5 bg-white/40"
                    : "w-1.5 bg-white/15"
              }`}
            />
          ))}
        </div>

        <div className="w-8 text-right">
          <span className="text-[11px] font-mono text-white/40">
            {currentStepNumber}/{totalSteps}
          </span>
        </div>
      </div>

      {/* ── Step Content Container ── */}
      <div className="px-2 flex-1 overflow-y-auto no-scrollbar py-2 relative z-10 flex flex-col justify-center max-w-sm mx-auto w-full">
        <AnimatePresence mode="wait">
          {/* STEP 1: IDENTITY & ARCHITECTURE */}
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4 w-full text-left"
            >
              {/* Header */}
              <div className="space-y-0.5">
                <h1 className="text-[23px] sm:text-[25px] font-semibold tracking-tight text-white leading-tight">
                  {isIndonesian ? "Selamat Datang di " : "Welcome to "}
                  <span>Accrual</span>
                </h1>
                <p className="text-[12px] text-white/50">
                  {isIndonesian
                    ? "Konfigurasi awal ruang finansial Anda."
                    : "Set up your financial workspace."}
                </p>
              </div>

              {/* Name Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider block">
                  {isIndonesian ? "Nama Panggilan" : "Display Name"}
                </label>
                <div className="relative flex items-center border-b border-white/15 focus-within:border-white transition-colors py-0.5">
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder={isIndonesian ? "Nama Anda" : "Your Name"}
                    className="w-full bg-transparent text-[16px] font-medium text-white placeholder:text-white/20 outline-none pr-7"
                  />
                  {userName.trim() && (
                    <button
                      type="button"
                      onClick={() => setUserName("")}
                      className="text-white/30 hover:text-white/70 p-1 cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Language Switcher */}
              <div className="space-y-1 pt-0.5">
                <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider block">
                  {isIndonesian ? "Bahasa" : "Language"}
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setLanguage("id");
                    }}
                    className={`py-1.5 px-3 rounded-xl text-[11.5px] font-semibold transition-all cursor-pointer ${
                      language === "id"
                        ? "bg-white text-black shadow-xs"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    Bahasa Indonesia
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setLanguage("en");
                    }}
                    className={`py-1.5 px-3 rounded-xl text-[11.5px] font-semibold transition-all cursor-pointer ${
                      language === "en"
                        ? "bg-white text-black shadow-xs"
                        : "text-white/50 hover:text-white"
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>

              {/* Base Currency */}
              <div className="space-y-1 pt-0.5">
                <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider block">
                  {isIndonesian ? "Mata Uang Utama" : "Base Currency"}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setCurrencyPickerOpen(true);
                  }}
                  className="w-full py-2 px-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:border-white/20 active:scale-[0.99] transition-all flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-6.5 h-6.5 rounded-xl bg-white/10 flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                      {activeCurrencyMeta.symbol}
                    </div>
                    <span className="text-[12.5px] font-medium text-white truncate">
                      {activeCurrencyMeta.code} · {activeCurrencyMeta.name}
                    </span>
                  </div>
                  <ChevronRight size={14} className="text-white/40 shrink-0" />
                </button>
              </div>

              {/* Preset Mode Selection */}
              <div className="space-y-1.5 pt-0.5">
                <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider block">
                  {isIndonesian
                    ? "Arsitektur Ruang Kerja"
                    : "Workspace Architecture"}
                </label>

                <div className="space-y-1.5">
                  <div
                    onClick={() => {
                      triggerHaptic("light");
                      setPresetMode("default");
                    }}
                    className={`p-3 rounded-2xl text-left transition-all border cursor-pointer ${
                      presetMode === "default"
                        ? "bg-white/[0.06] border-white/25 shadow-xs"
                        : "bg-white/[0.02] border-white/[0.06] opacity-60 hover:opacity-80"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12.5px] font-semibold text-white">
                            {isIndonesian
                              ? "Preset Standar"
                              : "Curated Default"}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-white/10 text-white/80">
                            {isIndonesian ? "Rekomendasi" : "Recommended"}
                          </span>
                        </div>
                        <p className="text-[11px] text-white/50">
                          {isIndonesian
                            ? "Siap pakai dengan 3 akun likuid & 14 kategori."
                            : "Ready-to-use with 3 liquid accounts & 14 categories."}
                        </p>
                      </div>
                      <div
                        className={`w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                          presetMode === "default"
                            ? "bg-white border-white text-black"
                            : "border-white/20 bg-transparent"
                        }`}
                      >
                        {presetMode === "default" && (
                          <Check size={10} strokeWidth={3} />
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      triggerHaptic("light");
                      setPresetMode("custom");
                    }}
                    className={`p-3 rounded-2xl text-left transition-all border cursor-pointer ${
                      presetMode === "custom"
                        ? "bg-white/[0.06] border-white/25 shadow-xs"
                        : "bg-white/[0.02] border-white/[0.06] opacity-60 hover:opacity-80"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[12.5px] font-semibold text-white block">
                          {isIndonesian ? "Kustom Mandiri" : "Custom Setup"}
                        </span>
                        <p className="text-[11px] text-white/50">
                          {isIndonesian
                            ? "Pilih akun dan saluran keuangan sendiri."
                            : "Handpick accounts and channels manually."}
                        </p>
                      </div>
                      <div
                        className={`w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                          presetMode === "custom"
                            ? "bg-white border-white text-black"
                            : "border-white/20 bg-transparent"
                        }`}
                      >
                        {presetMode === "custom" && (
                          <Check size={10} strokeWidth={3} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 2: FINANCIAL FOCUS */}
          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-3 w-full text-left"
            >
              <div className="space-y-0.5">
                <h1 className="text-[23px] sm:text-[25px] font-semibold tracking-tight text-white leading-tight">
                  {isIndonesian ? "Fokus Finansial" : "Financial Focus"}
                </h1>
                <p className="text-[12px] text-white/50">
                  {isIndonesian
                    ? "Prioritaskan metrik dan widget dasbor Anda."
                    : "Calibrate your primary dashboard priority."}
                </p>
              </div>

              <ArchetypeCardSelector
                items={archetypeItems}
                activeIndex={Math.max(
                  0,
                  archetypeItems.findIndex((f) => f.key === selectedFocus),
                )}
                onActiveChange={(item) =>
                  setSelectedFocus(item.key as FocusKey)
                }
              />
            </motion.div>
          )}

          {/* STEP 3: ACCOUNTS (CUSTOM MODE) */}
          {step === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-3 w-full text-left"
            >
              <div className="space-y-0.5">
                <h1 className="text-[23px] sm:text-[25px] font-semibold tracking-tight text-white leading-tight">
                  {isIndonesian ? "Saluran Akun" : "Active Channels"}
                </h1>
                <p className="text-[12px] text-white/50">
                  {isIndonesian
                    ? "Pilih akun aktif untuk pencatatan harian."
                    : "Select accounts you transact with."}
                </p>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 p-0.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] w-full">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setAccountRegionTab("local");
                  }}
                  className={`flex-1 py-1.5 rounded-xl text-[11.5px] font-semibold transition-all cursor-pointer ${
                    accountRegionTab === "local"
                      ? "bg-white text-black shadow-xs"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  {isIndonesian ? "Lokal" : "Domestic"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setAccountRegionTab("global");
                  }}
                  className={`flex-1 py-1.5 rounded-xl text-[11.5px] font-semibold transition-all cursor-pointer ${
                    accountRegionTab === "global"
                      ? "bg-white text-black shadow-xs"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  {isIndonesian ? "Internasional" : "Global"}
                </button>
              </div>

              {/* Account List */}
              <div className="divide-y divide-white/[0.06] border-y border-white/[0.08]">
                {ACCOUNT_OPTIONS.filter(
                  (acc) => acc.region === accountRegionTab,
                ).map((acc) => {
                  const isChecked = Boolean(selectedAccounts[acc.id]);
                  const Icon = acc.icon;
                  const accName = isIndonesian ? acc.nameId : acc.nameEn;
                  const accSub = isIndonesian ? acc.subId : acc.subEn;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => handleToggleAccount(acc.id)}
                      className="w-full py-2.5 px-1 flex items-center justify-between text-left transition-all active:scale-[0.99] cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all ${
                            isChecked
                              ? "bg-white/10 border-white/20 text-white"
                              : "bg-white/[0.03] border-white/10 text-white/40"
                          }`}
                        >
                          <Icon size={15} strokeWidth={1.8} />
                        </div>
                        <div>
                          <div
                            className={`text-[12.5px] font-medium ${
                              isChecked ? "text-white" : "text-white/50"
                            }`}
                          >
                            {accName}
                          </div>
                          <div className="text-[10px] text-white/40 leading-none mt-0.5">
                            {accSub}
                          </div>
                        </div>
                      </div>

                      <div
                        className={`w-4.5 h-4.5 rounded-full flex items-center justify-center border transition-all ${
                          isChecked
                            ? "bg-white border-white text-black"
                            : "border-white/20 bg-transparent"
                        }`}
                      >
                        {isChecked && <Check size={10} strokeWidth={3} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* STEP 4: STARTING BALANCE */}
          {step === 4 && (
            <motion.div
              key="step-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-5 w-full text-left"
            >
              <div className="space-y-0.5">
                <h1 className="text-[23px] sm:text-[25px] font-semibold tracking-tight text-white leading-tight">
                  {isIndonesian ? "Saldo Awal" : "Initial Balance"}
                </h1>
                <p className="text-[12px] text-white/50">
                  {isIndonesian
                    ? "Estimasi cadangan kas saat ini."
                    : "Your current liquid reserve."}
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5 border-b border-white/15 pb-2.5 focus-within:border-white transition-colors">
                  <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider block">
                    {activeCurrencyMeta.code}
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[20px] font-light text-white/40 select-none">
                      {activeCurrencyMeta.symbol}
                    </span>
                    <input
                      type="text"
                      inputMode={
                        activeCurrencyMeta.decimals > 0 ? "decimal" : "numeric"
                      }
                      value={startingBalanceDisplay}
                      onChange={(e) => {
                        const { raw, formatted } = formatLiveAmountInput(
                          e.target.value,
                          isIndonesian && activeCurrencyMeta.decimals === 0,
                          activeCurrencyMeta.decimals > 0,
                          activeCurrencyMeta.decimals,
                        );
                        setStartingBalance(raw || 0);
                        setStartingBalanceDisplay(formatted);
                      }}
                      placeholder="0"
                      className="w-full text-[32px] sm:text-[36px] font-light tracking-tight text-white amount leading-none bg-transparent outline-none placeholder:text-white/20"
                    />
                  </div>
                </div>

                {/* Quick Increments */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {quickIncrements.map((inc) => (
                    <button
                      key={inc}
                      type="button"
                      onClick={() => handleQuickAddBalance(inc)}
                      className="py-1 px-2.5 rounded-full text-[11px] font-medium amount border active:scale-95 transition-all cursor-pointer text-white/80 border-white/15 hover:border-white/30 bg-white/[0.04]"
                    >
                      +
                      {inc >= 1000000
                        ? `${inc / 1000000}M`
                        : inc >= 1000
                          ? `${inc / 1000}K`
                          : inc}
                    </button>
                  ))}
                  {startingBalance > 0 && (
                    <button
                      type="button"
                      onClick={handleClearBalance}
                      className="py-1 px-2.5 rounded-full text-[11px] font-medium text-white/40 hover:text-white/70 transition-colors cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 5: DAILY ROUTINE */}
          {step === 5 && (
            <motion.div
              key="step-5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-5 w-full text-left"
            >
              <div className="space-y-0.5">
                <h1 className="text-[23px] sm:text-[25px] font-semibold tracking-tight text-white leading-tight">
                  {isIndonesian ? "Pengingat Harian" : "Daily Reminder"}
                </h1>
                <p className="text-[12px] text-white/50">
                  {isIndonesian
                    ? "Notifikasi singkat setiap petang untuk mencatat transaksi."
                    : "Brief evening prompt to capture daily outlays."}
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b border-white/[0.08]">
                  <span className="text-[13px] font-semibold text-white">
                    {isIndonesian ? "Pengingat Rutin" : "Routine Reminder"}
                  </span>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={reminderEnabled}
                    onClick={() => {
                      triggerHaptic("medium");
                      setReminderEnabled(!reminderEnabled);
                    }}
                    className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 border ${
                      reminderEnabled
                        ? "bg-white border-white"
                        : "bg-white/10 border-white/15 opacity-60"
                    }`}
                  >
                    <motion.div
                      animate={{ x: reminderEnabled ? 20 : 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 30,
                      }}
                      className={`w-5 h-5 rounded-full shadow-xs ${
                        reminderEnabled ? "bg-black" : "bg-white/60"
                      }`}
                    />
                  </button>
                </div>

                {/* Hour Selector */}
                <div
                  className={`space-y-2 transition-opacity ${reminderEnabled ? "opacity-100" : "opacity-30 pointer-events-none"}`}
                >
                  <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider block">
                    {isIndonesian ? "Jam Pengingat" : "Reminder Time"}
                  </span>

                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                    {[18, 19, 20, 21, 22].map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => {
                          triggerHaptic("light");
                          setReminderHour(h);
                        }}
                        className={`py-1.5 px-3 rounded-full text-[11.5px] font-semibold amount border transition-all cursor-pointer ${
                          reminderHour === h
                            ? "bg-white text-black border-white shadow-xs"
                            : "bg-white/[0.04] text-white/60 border-white/10 hover:border-white/30"
                        }`}
                      >
                        {h}:00
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Bottom Action Dock (Zero Glow) ── */}
      <div className="px-2 relative z-10 pt-2 max-w-sm mx-auto w-full space-y-1.5">
        {step === 1 && presetMode === "default" ? (
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={handleQuickStart}
              className="w-full h-11 rounded-full font-semibold text-[13px] active:scale-[0.985] transition-all cursor-pointer bg-white text-black flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Zap
                size={14}
                strokeWidth={2.5}
                className="fill-black text-black"
              />
              <span>{isIndonesian ? "Mulai Cepat" : "Quick Start"}</span>
            </button>

            <button
              type="button"
              onClick={handleNextStep}
              className="w-full py-1 text-center text-[11px] font-medium text-white/45 hover:text-white transition-colors cursor-pointer"
            >
              {isIndonesian
                ? "Sesuaikan Langkah demi Langkah"
                : "Customize Step-by-Step"}
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={handleNextStep}
              className="w-full h-11 rounded-full font-semibold text-[13px] active:scale-[0.985] transition-all cursor-pointer bg-white text-black flex items-center justify-center gap-1.5 shadow-sm"
            >
              <span>
                {step === 5
                  ? isIndonesian
                    ? "Buka Accrual"
                    : "Enter Accrual"
                  : isIndonesian
                    ? "Lanjutkan"
                    : "Continue"}
              </span>
              <ArrowRight size={14} strokeWidth={2} />
            </button>

            {step === 4 && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setStartingBalance(0);
                  setStep(5);
                }}
                className="w-full py-1 text-center text-[11px] font-medium text-white/40 hover:text-white/70 transition-colors cursor-pointer"
              >
                {isIndonesian ? "Lewati saldo awal" : "Skip initial balance"}
              </button>
            )}
          </>
        )}
      </div>

      {/* Currency Selection BottomSheet */}
      <BottomSheet
        isOpen={currencyPickerOpen}
        onClose={() => {
          setCurrencyPickerOpen(false);
          setCurrencySearch("");
        }}
        zIndex={1100}
      >
        <div className="p-4 pb-6 space-y-3 text-left max-w-sm mx-auto select-none">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-white shrink-0">
                <Coins size={15} strokeWidth={1.8} />
              </div>
              <div>
                <h2 className="text-[15px] font-bold tracking-tight text-[var(--text-primary)]">
                  {isIndonesian ? "Pilih Mata Uang" : "Select Currency"}
                </h2>
                <p className="text-[10.5px] text-[var(--text-tertiary)]">
                  {isIndonesian
                    ? "Mata uang utama pembukuan"
                    : "Primary currency"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setCurrencyPickerOpen(false);
                setCurrencySearch("");
              }}
              className="w-6.5 h-6.5 rounded-full flex items-center justify-center bg-white/[0.05] border border-white/10 text-white/50 hover:text-white"
            >
              <X size={12} strokeWidth={2} />
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex items-center rounded-xl px-3 h-9 border bg-white/[0.04] border-white/10">
            <Search size={13} className="text-white/40 mr-2 shrink-0" />
            <input
              type="text"
              value={currencySearch}
              onChange={(e) => setCurrencySearch(e.target.value)}
              placeholder={
                isIndonesian ? "Cari mata uang..." : "Search currency..."
              }
              aria-label={
                isIndonesian ? "Cari mata uang" : "Search currency"
              }
              className="w-full bg-transparent text-[16px] sm:text-[12.5px] outline-none text-white placeholder:text-white/30"
            />
            {currencySearch && (
              <button
                type="button"
                onClick={() => setCurrencySearch("")}
                aria-label={isIndonesian ? "Hapus pencarian" : "Clear search"}
                className="text-white/40 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Currency List */}
          <div className="divide-y divide-white/[0.06] border-y border-white/[0.08]">
            {filteredCurrencies.map((curr) => {
              const isSelected = curr.code === selectedCurrency;
              return (
                <button
                  key={curr.code}
                  type="button"
                  onClick={() => handleSelectCurrency(curr.code)}
                  className={`w-full py-2.5 px-1.5 flex items-center justify-between transition-all active:scale-[0.99] cursor-pointer text-left ${
                    isSelected ? "bg-white/[0.05]" : "hover:bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-[11px] border shrink-0 ${
                        isSelected
                          ? "bg-white text-black border-white"
                          : "bg-white/[0.06] border-white/10 text-white/80"
                      }`}
                    >
                      {curr.symbol}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-semibold text-white truncate">
                        {curr.code} ·{" "}
                        <span className="font-normal text-white/60">
                          {curr.name}
                        </span>
                      </div>
                      <div className="text-[9.5px] text-white/40">
                        {curr.countryCode} · {curr.decimals}{" "}
                        {isIndonesian ? "desimal" : "decimals"}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                      isSelected
                        ? "bg-white border-white text-black"
                        : "border-white/20 bg-transparent"
                    }`}
                  >
                    {isSelected && <Check size={9} strokeWidth={3} />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
