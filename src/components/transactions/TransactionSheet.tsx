import { triggerHaptic, triggerSuccessHaptic } from "../../lib/haptics";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCcw,
  Trash2,
  Zap,
  Search,
  X,
  ScanLine,
  Sparkles,
  Mic,
  Check,
  PenLine,
  AlertCircle,
  AlertTriangle,
  Coins,
  Lock,
  Plus,
  Edit3,
} from "lucide-react";
import { TransactionKeypadSheet } from "./TransactionKeypadSheet";
import { CategorySelectorRibbon } from "./CategorySelectorRibbon";
import { WalletSelectorRibbon } from "./WalletSelectorRibbon";
import { ShortcutManagementSheet } from "../settings/ShortcutManagementSheet";
import { motion, AnimatePresence } from "framer-motion";
import { BottomSheet } from "../ui/BottomSheet";
import { useCategories } from "../../hooks/useCategories";
import { useWallets } from "../../hooks/useWallets";
import { useWalletBalances } from "../../hooks/useWalletBalances";
import {
  useAddTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
  useAllTransactions,
} from "../../hooks/useTransactions";
import { useCategorySuggestions } from "../../hooks/useCategorySuggestions";
import { useWalletSuggestions } from "../../hooks/useWalletSuggestions";
import { useMerchantMemory } from "../../hooks/useMerchantMemory";
import { useBudgetTarget } from "../../hooks/useBudgetTarget";
import { useToast } from "../../contexts/ToastContext";
import { formatCurrency, formatLiveAmountInput, generateUUID } from "../../lib/utils";
import { format, isToday, parseISO } from "date-fns";
import { IconRenderer } from "../ui/IconRenderer";
import { GlassDatePicker } from "../ui/GlassDatePicker";
import type { Transaction, TransactionType } from "../../lib/types";
import { useShortcuts } from "../../hooks/useShortcuts";
import { evaluateMathSafe } from "../../lib/evaluateMathSafe";
import { classifySemanticCategory } from "../../lib/semanticClassifier";
import { useSpace } from "../../contexts/SpaceContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import {
  isUsdtWallet,
  syncTransactionWithHolding,
  reverseTransactionWithHolding,
} from "../../lib/holdingSyncEngine";
import {
  getSavedUsdtPref,
  fetchUsdtPriceInIDR,
  USD_IDR_ESTIMATE,
} from "../../lib/marketPriceService";

interface TransactionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  transaction?: Transaction | null;
  initialValues?: {
    type?: TransactionType;
    amount?: number;
    categoryId?: string | null;
    category_id?: string | null;
    walletId?: string | null;
    wallet_id?: string | null;
    toWalletId?: string | null;
    date?: Date;
    time?: string;
    note?: string;
  } | null;
  onOpenScan?: () => void;
  onOpenVoiceAdd?: () => void;
}

type TabType = TransactionType;

export function TransactionSheet({
  isOpen,
  onClose,
  transaction,
  initialValues,
  onOpenScan,
  onOpenVoiceAdd,
}: TransactionSheetProps) {
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const { isIndonesian } = useLanguage();
  const { preferredCurrency, currencyMeta, convertToIdr, convertFromIdr } =
    useCurrency();
  const allowDecimals = true;
  const maxDecimals = Math.max(currencyMeta.decimals, 2);

  const formatDisplayNumber = useCallback(
    (num: number) => {
      if (!num || isNaN(num) || num <= 0) return "";
      return num.toLocaleString(isIndonesian ? "id-ID" : "en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: maxDecimals,
      });
    },
    [isIndonesian, maxDecimals],
  );

  const [activeTab, setActiveTab] = useState<TabType>(
    () => transaction?.type || initialValues?.type || "expense",
  );
  const [type, setType] = useState<TransactionType>(
    transaction?.type || initialValues?.type || "expense",
  );
  const [amount, setAmount] = useState(
    transaction ? String(transaction.amount) : "0",
  );
  const [amountInput, setAmountInput] = useState(
    transaction && Number(transaction.amount) > 0
      ? Number(transaction.amount).toLocaleString("id-ID")
      : "",
  );
  const amountInputRef = useRef<HTMLInputElement>(null);
  const [shortcutSheetOpen, setShortcutSheetOpen] = useState(false);

  const [useCustomKeypad] = useState<boolean>(() => {
    const saved = localStorage.getItem("trouvaille_keypad_mode");
    return saved !== "system";
  });

  const [isKeypadOpen, setIsKeypadOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (useCustomKeypad) {
        setIsKeypadOpen(true);
      } else {
        requestAnimationFrame(() => {
          amountInputRef.current?.focus();
        });
      }
    } else {
      setIsKeypadOpen(false);
    }
  }, [isOpen, useCustomKeypad]);

  const [note, setNote] = useState(transaction?.note || "");
  const [date, setDate] = useState<Date>(
    transaction?.occurred_on ? parseISO(transaction.occurred_on) : new Date(),
  );
  const [time, setTime] = useState<string>(
    transaction?.occurred_on && transaction.occurred_on.includes("T")
      ? format(parseISO(transaction.occurred_on), "HH:mm")
      : transaction?.created_at
        ? format(new Date(transaction.created_at), "HH:mm")
        : format(new Date(), "HH:mm"),
  );
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const lastSavedTimestampRef = useRef<number>(0);
  const lastSavedPayloadRef = useRef<{
    amount: number;
    type: string;
    walletId: string | null;
    categoryId: string | null;
    note: string;
  } | null>(null);
  const [duplicateWarningAcknowledged, setDuplicateWarningAcknowledged] =
    useState(false);

  const [categoryId, setCategoryId] = useState<string | null>(
    transaction?.category_id || null,
  );
  const [walletId, setWalletId] = useState<string | null>(
    transaction?.wallet_id || null,
  );
  const [toWalletId, setToWalletId] = useState<string | null>(
    transaction?.to_wallet_id || null,
  );
  const { shortcuts } = useShortcuts();
  const { user } = useAuth();
  const { data: wallets = [] } = useWallets();
  const { balancesById } = useWalletBalances();

  const fromWallet = useMemo(
    () => wallets.find((w) => w.id === walletId),
    [wallets, walletId],
  );
  const toWallet = useMemo(
    () => wallets.find((w) => w.id === toWalletId),
    [wallets, toWalletId],
  );

  const isFromCrypto = useMemo(() => isUsdtWallet(fromWallet), [fromWallet]);
  const isToCrypto = useMemo(() => isUsdtWallet(toWallet), [toWallet]);
  const isCryptoInvolved = isFromCrypto || (type === "transfer" && isToCrypto);

  const [cryptoRate, setCryptoRate] = useState<number>(() => {
    return getSavedUsdtPref(user?.id).rate || USD_IDR_ESTIMATE;
  });
  const [cryptoUnits, setCryptoUnits] = useState<string>("");
  const [isUnitsInputMode, setIsUnitsInputMode] = useState<boolean>(false);
  const [isEditingRate, setIsEditingRate] = useState<boolean>(false);
  const [customRateStr, setCustomRateStr] = useState<string>("");

  const usdtPref = useMemo(() => getSavedUsdtPref(user?.id), [user?.id]);
  const usdtAvgBuyPrice = useMemo(() => {
    return usdtPref.units > 0
      ? Math.round(usdtPref.costBasis / usdtPref.units)
      : cryptoRate;
  }, [usdtPref, cryptoRate]);

  // Realized PnL preview for liquidation (transfer out from crypto)
  const estimatedRealizedPnL = useMemo(() => {
    if (!isFromCrypto || type !== "transfer") return null;
    const u = parseFloat(cryptoUnits) || 0;
    if (u <= 0 || !cryptoRate) return null;
    return Math.round(u * (cryptoRate - usdtAvgBuyPrice));
  }, [isFromCrypto, type, cryptoUnits, cryptoRate, usdtAvgBuyPrice]);

  useEffect(() => {
    if (isCryptoInvolved) {
      fetchUsdtPriceInIDR()
        .then((rate) => {
          if (rate > 5000 && rate < 50000) setCryptoRate(rate);
        })
        .catch(() => {});
    }
  }, [isCryptoInvolved]);

  useEffect(() => {
    if (isCryptoInvolved && !isUnitsInputMode) {
      const rawNum = Number(amount) || 0;
      const numInIdr =
        preferredCurrency === "IDR"
          ? rawNum
          : convertToIdr(rawNum, preferredCurrency);
      if (numInIdr > 0 && cryptoRate > 0) {
        setCryptoUnits(Number((numInIdr / cryptoRate).toFixed(4)).toString());
      } else {
        setCryptoUnits("");
      }
    }
  }, [
    amount,
    cryptoRate,
    isCryptoInvolved,
    isUnitsInputMode,
    preferredCurrency,
    convertToIdr,
  ]);

  const handleCryptoUnitsChange = (valStr: string) => {
    setCryptoUnits(valStr);
    const u = parseFloat(valStr);
    if (!isNaN(u) && u > 0 && cryptoRate > 0) {
      const calcAmountIdr = Math.round(u * cryptoRate);
      const displayAmt =
        preferredCurrency === "IDR"
          ? calcAmountIdr
          : Number(convertFromIdr(calcAmountIdr).toFixed(maxDecimals));
      setAmount(String(displayAmt));
      setAmountInput(formatDisplayNumber(displayAmt));
    } else if (!valStr) {
      setAmount("0");
      setAmountInput("");
    }
  };

  const [moreCatOpen, setMoreCatOpen] = useState(false);
  const [moreWalletOpen, setMoreWalletOpen] = useState(false);
  const [searchCatQuery, setSearchCatQuery] = useState("");
  const [searchWalletQuery, setSearchWalletQuery] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [walletTarget, setWalletTarget] = useState<"from" | "to">("from");
  const [isNoteFocused, setIsNoteFocused] = useState(false);

  const activeTags = useMemo(() => {
    if (!note) return [];
    const matches = note.match(/#([a-zA-Z0-9_-]+)/g);
    return matches ? matches.map((m) => m.toLowerCase()) : [];
  }, [note]);

  const { activeSpace, activeSpaceId, currentUserRole } = useSpace();

  const selectedSpaceId = useMemo<string>(() => {
    if (transaction?.ledger_id) return transaction.ledger_id;
    if (transaction?.space_id) return transaction.space_id;
    if (
      transaction?.note?.toLowerCase().includes("#business") ||
      transaction?.note?.toLowerCase().includes("#kantor")
    )
      return "business";
    if (
      transaction?.note?.toLowerCase().includes("#travel") ||
      transaction?.note?.toLowerCase().includes("#liburan")
    )
      return "travel";
    return activeSpaceId !== "all" ? activeSpaceId : "personal";
  }, [transaction, activeSpaceId]);

  const handleToggleTag = (tag: string) => {
    triggerHaptic("light");
    const normalized = tag.startsWith("#")
      ? tag.toLowerCase()
      : `#${tag.toLowerCase()}`;
    if (activeTags.includes(normalized)) {
      const regex = new RegExp(`\\s*${normalized}\\b`, "gi");
      const updated = note.replace(regex, "").trim();
      setNote(updated);
    } else {
      const updated = note.trim() ? `${note.trim()} ${normalized}` : normalized;
      setNote(updated);
    }
  };

  const { data: allCategories = [] } = useCategories();
  const categories = useMemo(() => {
    if (type === "transfer") return allCategories;
    return allCategories.filter((c) => c.type === type);
  }, [allCategories, type]);
  const { data: allTxs = [] } = useAllTransactions();

  const addTx = useAddTransaction();
  const updateTx = useUpdateTransaction();
  const deleteTx = useDeleteTransaction();
  const { showToast } = useToast();

  const suggestedCategories = useCategorySuggestions({
    categories,
    transactions: allTxs,
    type,
    selectedWalletId: walletId,
  });

  const suggestedFromWallets = useWalletSuggestions({
    wallets,
    transactions: allTxs,
    type,
    selectedCategoryId: categoryId,
    target: "from",
  });

  const suggestedToWallets = useWalletSuggestions({
    wallets,
    transactions: allTxs,
    type,
    target: "to",
  });

  const { budgetTarget } = useBudgetTarget();
  const { getMemoryForNote } = useMerchantMemory(allTxs);

  const merchantPrediction = useMemo(() => {
    if (!note || note.trim().length < 2) return null;
    return getMemoryForNote(note);
  }, [note, getMemoryForNote]);

  const predictedCategory = useMemo(() => {
    if (merchantPrediction?.categoryId) {
      const match = allCategories.find(
        (c) => c.id === merchantPrediction.categoryId,
      );
      if (match) return match;
    }
    if (note && note.trim().length >= 2) {
      const semantic = classifySemanticCategory(note, allCategories);
      if (semantic.category) return semantic.category;
    }
    return null;
  }, [merchantPrediction, allCategories, note]);

  const predictedWallet = useMemo(() => {
    if (!merchantPrediction?.walletId) return null;
    return wallets.find((w) => w.id === merchantPrediction.walletId) || null;
  }, [merchantPrediction, wallets]);

  const userExplicitlySelectedCategoryRef = useRef(false);
  const userExplicitlySelectedWalletRef = useRef(false);

  useEffect(() => {
    if (isOpen && !transaction) {
      userExplicitlySelectedCategoryRef.current = false;
      userExplicitlySelectedWalletRef.current = false;
    }
  }, [isOpen, transaction]);

  // Real-time automatic category & wallet inference based on typed note
  useEffect(() => {
    if (
      !userExplicitlySelectedCategoryRef.current &&
      !transaction &&
      type !== "transfer" &&
      predictedCategory
    ) {
      setCategoryId(predictedCategory.id);
    }
  }, [predictedCategory, transaction, type]);

  useEffect(() => {
    if (
      !userExplicitlySelectedWalletRef.current &&
      !transaction &&
      predictedWallet
    ) {
      setWalletId(predictedWallet.id);
    }
  }, [predictedWallet, transaction]);

  const isDuplicateDetected = useMemo(() => {
    const currentValRaw = evaluateMathSafe(amountInput);
    const currentVal =
      preferredCurrency === "IDR"
        ? currentValRaw
        : Math.round(convertToIdr(currentValRaw, preferredCurrency));
    if (!currentVal || currentVal <= 0 || allTxs.length === 0) return false;
    const refTime = date ? date.getTime() : 0;
    if (!refTime) return false;
    return allTxs.some((tx) => {
      if (transaction && tx.id === transaction.id) return false;
      if (tx.amount !== currentVal) return false;
      if (type !== "transfer" && categoryId && tx.category_id !== categoryId)
        return false;
      if (walletId && tx.wallet_id !== walletId) return false;
      const txTime = new Date(tx.created_at || tx.occurred_on).getTime();
      const diffMinutes = Math.abs(refTime - txTime) / (1000 * 60);
      return diffMinutes <= 15;
    });
  }, [
    amountInput,
    allTxs,
    transaction,
    type,
    categoryId,
    walletId,
    date,
    preferredCurrency,
    convertToIdr,
  ]);

  const budgetImpact = useMemo(() => {
    if (type !== "expense" || !categoryId) return null;
    const numFromState = Number(amount);
    const currentValRaw = /[+\-*/×÷]/.test(amountInput)
      ? evaluateMathSafe(amountInput)
      : !isNaN(numFromState) && numFromState > 0
        ? numFromState
        : evaluateMathSafe(amountInput);
    const currentVal =
      preferredCurrency === "IDR"
        ? currentValRaw
        : Math.round(convertToIdr(currentValRaw, preferredCurrency));
    if (currentVal <= 0) return null;

    const now = date || new Date();
    const currentMonthStr = format(now, "yyyy-MM");

    const existingSpent = allTxs
      .filter((tx) => {
        if (tx.type !== "expense" || tx.category_id !== categoryId)
          return false;
        if (transaction && tx.id === transaction.id) return false;
        const txDateStr = tx.occurred_on || tx.created_at;
        return txDateStr && txDateStr.startsWith(currentMonthStr);
      })
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);

    const projectedSpent = existingSpent + currentVal;
    const selectedCat = allCategories.find((c) => c.id === categoryId);
    const catBudget = selectedCat?.budget_amount || null;

    if (catBudget && catBudget > 0) {
      const isOver = projectedSpent > catBudget;
      const remaining = Math.max(0, catBudget - projectedSpent);
      const remainingPct = Math.max(
        0,
        Math.round(((catBudget - projectedSpent) / catBudget) * 100),
      );
      return {
        hasBudget: true,
        categoryName:
          selectedCat?.name || (isIndonesian ? "Kategori" : "Category"),
        projectedSpent,
        budget: catBudget,
        pct: remainingPct,
        isOver,
        remaining,
        diff: projectedSpent - catBudget,
      };
    }

    if (budgetTarget && budgetTarget > 0) {
      const monthExpenses = allTxs
        .filter((tx) => {
          if (tx.type !== "expense") return false;
          if (transaction && tx.id === transaction.id) return false;
          const txDateStr = tx.occurred_on || tx.created_at;
          return txDateStr && txDateStr.startsWith(currentMonthStr);
        })
        .reduce((sum, tx) => sum + (tx.amount || 0), 0);

      const totalProjected = monthExpenses + currentVal;
      const isOver = totalProjected > budgetTarget;
      const remaining = Math.max(0, budgetTarget - totalProjected);
      const remainingPct = Math.max(
        0,
        Math.round(((budgetTarget - totalProjected) / budgetTarget) * 100),
      );

      return {
        hasBudget: true,
        categoryName: isIndonesian ? "Total Anggaran" : "Overall Budget",
        projectedSpent: totalProjected,
        budget: budgetTarget,
        pct: remainingPct,
        isOver,
        remaining,
        diff: totalProjected - budgetTarget,
      };
    }

    return {
      hasBudget: false,
      categoryName:
        selectedCat?.name || (isIndonesian ? "Kategori" : "Category"),
      projectedSpent,
      budget: null,
      pct: null,
      isOver: false,
      remaining: 0,
      diff: 0,
    };
  }, [
    type,
    categoryId,
    amount,
    amountInput,
    date,
    allTxs,
    transaction,
    allCategories,
    budgetTarget,
    isIndonesian,
    preferredCurrency,
    convertToIdr,
  ]);

  const filteredMoreCategories = useMemo(() => {
    if (!moreCatOpen) return [];
    if (!searchCatQuery.trim()) return suggestedCategories;
    const q = searchCatQuery.toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [moreCatOpen, categories, suggestedCategories, searchCatQuery]);

  const filteredMoreWallets = useMemo(() => {
    if (!moreWalletOpen) return [];
    const list =
      walletTarget === "to" ? suggestedToWallets : suggestedFromWallets;
    if (!searchWalletQuery.trim()) return list;
    const q = searchWalletQuery.toLowerCase();
    return wallets.filter((w) => w.name.toLowerCase().includes(q));
  }, [
    moreWalletOpen,
    wallets,
    suggestedToWallets,
    suggestedFromWallets,
    walletTarget,
    searchWalletQuery,
  ]);

  const displayCategories = useMemo(() => {
    if (!categoryId) return suggestedCategories.slice(0, 10);
    const inTop = suggestedCategories
      .slice(0, 10)
      .some((c) => c.id === categoryId);
    if (inTop) return suggestedCategories.slice(0, 10);
    const selectedCat = categories.find((c) => c.id === categoryId);
    return selectedCat
      ? [
          selectedCat,
          ...suggestedCategories.filter((c) => c.id !== categoryId).slice(0, 9),
        ]
      : suggestedCategories.slice(0, 10);
  }, [suggestedCategories, categories, categoryId]);

  const displayFromWallets = useMemo(() => {
    if (!walletId) return suggestedFromWallets.slice(0, 8);
    const inTop = suggestedFromWallets
      .slice(0, 8)
      .some((w) => w.id === walletId);
    if (inTop) return suggestedFromWallets.slice(0, 8);
    const selectedW = wallets.find((w) => w.id === walletId);
    return selectedW
      ? [
          selectedW,
          ...suggestedFromWallets.filter((w) => w.id !== walletId).slice(0, 7),
        ]
      : suggestedFromWallets.slice(0, 8);
  }, [suggestedFromWallets, wallets, walletId]);

  const displayToWallets = useMemo(() => {
    if (!toWalletId) return suggestedToWallets.slice(0, 8);
    const inTop = suggestedToWallets
      .slice(0, 8)
      .some((w) => w.id === toWalletId);
    if (inTop) return suggestedToWallets.slice(0, 8);
    const selectedW = wallets.find((w) => w.id === toWalletId);
    return selectedW
      ? [
          selectedW,
          ...suggestedToWallets.filter((w) => w.id !== toWalletId).slice(0, 7),
        ]
      : suggestedToWallets.slice(0, 8);
  }, [suggestedToWallets, wallets, toWalletId]);

  const prevOpenRef = useRef(false);
  const prevTxIdRef = useRef<string | null>(null);

  useEffect(() => {
    const isOpening = isOpen && !prevOpenRef.current;
    const isTxChanged = transaction && transaction.id !== prevTxIdRef.current;

    if (isOpen && (isOpening || isTxChanged)) {
      setIsSaving(false);
      if (transaction) {
        setActiveTab(transaction.type);
        setType(transaction.type);
        const rawTxAmt = Number(transaction.amount || 0);
        const displayTxAmt =
          preferredCurrency === "IDR"
            ? rawTxAmt
            : Number(convertFromIdr(rawTxAmt).toFixed(maxDecimals));
        setAmount(String(displayTxAmt || "0"));
        setAmountInput(
          displayTxAmt > 0 ? formatDisplayNumber(displayTxAmt) : "",
        );
        setNote(transaction.note || "");
        setDate(
          transaction.occurred_on
            ? parseISO(transaction.occurred_on.replace(" ", "T"))
            : new Date(),
        );
        setTime(
          transaction.occurred_on &&
            /[T ]\d{2}:\d{2}/.test(transaction.occurred_on)
            ? format(
                parseISO(transaction.occurred_on.replace(" ", "T")),
                "HH:mm",
              )
            : transaction.created_at
              ? format(new Date(transaction.created_at), "HH:mm")
              : format(new Date(), "HH:mm"),
        );

        if (transaction.category_id) {
          setCategoryId(transaction.category_id);
        } else if (transaction.categories?.name) {
          const foundCat = allCategories.find(
            (c) =>
              c.name.toLowerCase() ===
              transaction.categories!.name.toLowerCase(),
          );
          if (foundCat) setCategoryId(foundCat.id);
        } else {
          let foundByNote = null;
          if (transaction.note) {
            const noteLower = transaction.note.toLowerCase();
            foundByNote = allCategories.find((c) =>
              noteLower.includes(c.name.toLowerCase()),
            );
          }
          setCategoryId(
            foundByNote
              ? foundByNote.id
              : categories.length > 0
                ? categories[0].id
                : null,
          );
        }

        let resolvedFromWalletId: string | null = null;
        if (
          transaction.wallet_id &&
          wallets.some((w) => w.id === transaction.wallet_id)
        ) {
          resolvedFromWalletId = transaction.wallet_id;
        } else {
          if (transaction.note) {
            const noteLower = transaction.note.toLowerCase();
            const foundByNote = wallets.find((w) =>
              noteLower.includes(w.name.toLowerCase()),
            );
            if (foundByNote) resolvedFromWalletId = foundByNote.id;
          }
          if (!resolvedFromWalletId && wallets.length > 0) {
            const cashW = wallets.find((w) => w.name.toLowerCase() === "cash");
            resolvedFromWalletId = cashW ? cashW.id : wallets[0].id;
          }
        }
        setWalletId(resolvedFromWalletId);

        let resolvedToWalletId: string | null = null;
        if (
          transaction.to_wallet_id &&
          wallets.some((w) => w.id === transaction.to_wallet_id)
        ) {
          resolvedToWalletId = transaction.to_wallet_id;
        } else {
          if (wallets.length > 1) {
            const other = wallets.find((w) => w.id !== resolvedFromWalletId);
            resolvedToWalletId = other ? other.id : wallets[1].id;
          }
        }
        setToWalletId(resolvedToWalletId);
      } else {
        const initType = initialValues?.type || "expense";
        const rawInitAmt =
          initialValues?.amount !== undefined && initialValues?.amount !== null
            ? Number(initialValues.amount)
            : 0;
        const displayInitAmt =
          rawInitAmt > 0
            ? preferredCurrency === "IDR"
              ? rawInitAmt
              : Number(convertFromIdr(rawInitAmt).toFixed(maxDecimals))
            : 0;
        const initAmt = String(displayInitAmt);
        const initAmtInput =
          displayInitAmt > 0 ? formatDisplayNumber(displayInitAmt) : "";
        const initNote = initialValues?.note || "";
        const initDate = initialValues?.date || new Date();

        setActiveTab(initType);
        setType(initType);
        setAmount(initAmt);
        setAmountInput(initAmtInput);
        setNote(initNote);
        setDate(initDate);
        setTime(initialValues?.time || format(new Date(), "HH:mm"));
        const defaultCatId =
          initialValues?.categoryId !== undefined
            ? initialValues.categoryId
            : initialValues?.category_id !== undefined
              ? initialValues.category_id
              : suggestedCategories[0]?.id ||
                (categories.length > 0 ? categories[0].id : null);
        const defaultFromId =
          initialValues?.walletId !== undefined
            ? initialValues.walletId
            : initialValues?.wallet_id !== undefined
              ? initialValues.wallet_id
              : suggestedFromWallets[0]?.id ||
                (wallets.length > 0 ? wallets[0].id : null);
        const defaultToId =
          initialValues?.toWalletId !== undefined
            ? initialValues.toWalletId
            : suggestedToWallets.find((w) => w.id !== defaultFromId)?.id ||
              (wallets.length > 1 ? wallets[1].id : null);
        setCategoryId(defaultCatId);
        setWalletId(defaultFromId);
        setToWalletId(defaultToId);
      }
    }

    prevOpenRef.current = isOpen;
    prevTxIdRef.current = transaction?.id || null;
  }, [
    isOpen,
    transaction,
    initialValues,
    allCategories,
    categories,
    wallets,
    suggestedCategories,
    suggestedFromWallets,
    suggestedToWallets,
    preferredCurrency,
    convertFromIdr,
    maxDecimals,
    formatDisplayNumber,
  ]);

  useEffect(() => {
    if (type === "transfer") {
      if (!toWalletId && wallets.length > 1) {
        const other = wallets.find((w) => w.id !== walletId);
        setToWalletId(other ? other.id : wallets[1].id);
      } else if (toWalletId && toWalletId === walletId && wallets.length > 1) {
        const other = wallets.find((w) => w.id !== walletId);
        if (other) setToWalletId(other.id);
      }
    }
  }, [type, wallets, walletId, toWalletId]);

  const currentNumericAmount = useMemo(() => {
    const direct = Number(amount);
    if (!isNaN(direct) && direct > 0) return direct;
    const evaluated = evaluateMathSafe(amountInput);
    if (!isNaN(evaluated) && evaluated > 0) return evaluated;
    return 0;
  }, [amount, amountInput]);

  const activeSourceWallet = useMemo(() => {
    return wallets.find((w) => w.id === walletId) || wallets[0] || null;
  }, [wallets, walletId]);

  const isCreditOrLoan = useMemo(() => {
    if (!activeSourceWallet) return false;
    return (
      activeSourceWallet.classification === "credit" ||
      activeSourceWallet.classification === "loan"
    );
  }, [activeSourceWallet]);

  const effectiveSourceBalance = useMemo(() => {
    if (!activeSourceWallet) return 0;
    const computedBal =
      balancesById[activeSourceWallet.id] ?? activeSourceWallet.balance ?? 0;
    if (
      transaction &&
      transaction.wallet_id === activeSourceWallet.id &&
      (transaction.type === "expense" || transaction.type === "transfer")
    ) {
      return computedBal + (transaction.amount || 0);
    }
    return computedBal;
  }, [activeSourceWallet, balancesById, transaction]);

  const isOverdraft = useMemo(() => {
    if (type !== "expense" && type !== "transfer") return false;
    if (isCreditOrLoan || !activeSourceWallet) return false;
    if (currentNumericAmount <= 0) return false;
    return currentNumericAmount > effectiveSourceBalance;
  }, [
    type,
    isCreditOrLoan,
    activeSourceWallet,
    currentNumericAmount,
    effectiveSourceBalance,
  ]);

  const lastSaveTriggeredAt = useRef<number>(0);
  const touchHandledRef = useRef<boolean>(false);
  const touchStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const executeSave = () => {
    const now = Date.now();
    if (now - lastSaveTriggeredAt.current < 750) return;
    lastSaveTriggeredAt.current = now;
    handleSave();
  };

  const handleSave = () => {
    if (
      typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement
    ) {
      document.activeElement.blur();
    }
    setIsKeypadOpen(false);

    if (currentUserRole === "viewer") {
      showToast(
        isIndonesian
          ? "Anda tidak memiliki izin untuk menyimpan transaksi (Mode Viewer)."
          : "You do not have permission to save transactions (Viewer Mode).",
        "info",
      );
      return;
    }

    const isUUID = (id?: string | null) => !!id && id.trim().length > 0;

    const evaluatedFromInput =
      amountInput.trim() !== ""
        ? evaluateMathSafe(amountInput)
        : Number(amount) || 0;
    const rawDisplayAmount = evaluatedFromInput;

    const numAmount =
      preferredCurrency === "IDR"
        ? Math.round(rawDisplayAmount)
        : Math.round(convertToIdr(rawDisplayAmount, preferredCurrency));
    if (
      isSavingRef.current ||
      isSaving ||
      addTx.isPending ||
      updateTx.isPending
    ) {
      return;
    }

    if (rawDisplayAmount <= 0 || numAmount <= 0) {
      triggerHaptic("medium");
      showToast(
        isIndonesian
          ? "Nominal transaksi harus lebih besar dari 0"
          : "Amount must be greater than 0",
        "error",
      );
      return;
    }

    const matchedFromWallet =
      wallets.find((w) => w.id === walletId) || wallets[0];
    const matchedToWallet =
      wallets.find((w) => w.id === toWalletId) ||
      (wallets.length > 1 ? wallets[1] : null);
    const matchedCat =
      categories.find((c) => c.id === categoryId) ||
      (categories.length > 0 ? categories[0] : null);

    const effectiveWalletId = matchedFromWallet?.id || null;
    const effectiveToWalletId = matchedToWallet?.id || null;
    const effectiveCatId = matchedCat?.id || null;

    isSavingRef.current = true;
    setIsSaving(true);

    if (type !== "transfer" && !isUUID(effectiveWalletId)) {
      isSavingRef.current = false;
      setIsSaving(false);
      showToast(
        isIndonesian
          ? "Pilih akun yang valid sebelum menyimpan"
          : "Choose a valid account before saving",
        "error",
        () => {},
      );
      return;
    }

    if (type === "transfer") {
      if (!isUUID(effectiveWalletId) || !isUUID(effectiveToWalletId)) {
        isSavingRef.current = false;
        setIsSaving(false);
        showToast(
          isIndonesian
            ? "Pilih akun asal dan akun tujuan"
            : "Choose both source and destination accounts",
          "error",
          () => {},
        );
        return;
      }
      if (effectiveWalletId === effectiveToWalletId) {
        isSavingRef.current = false;
        setIsSaving(false);
        showToast(
          isIndonesian
            ? "Akun transfer harus berbeda"
            : "Transfer accounts must be different",
          "error",
          () => {},
        );
        return;
      }
    }

    if (type !== "transfer" && !isUUID(effectiveCatId)) {
      isSavingRef.current = false;
      setIsSaving(false);
      showToast(
        isIndonesian
          ? "Pilih kategori yang valid sebelum menyimpan"
          : "Choose a valid category before saving",
        "error",
        () => {},
      );
      return;
    }

    const [h, m] = time.split(":").map(Number);
    const txDate = new Date(date);
    if (!isNaN(h) && !isNaN(m)) {
      txDate.setHours(h, m, 0, 0);
    }

    const payload = {
      type,
      amount: numAmount,
      note: note || null,
      space_id: selectedSpaceId === "personal" ? null : selectedSpaceId,
      ledger_id: selectedSpaceId || "personal",
      occurred_on: format(txDate, "yyyy-MM-dd'T'HH:mm:ss"),
      created_at: txDate.toISOString(),
      category_id:
        type === "transfer"
          ? null
          : isUUID(effectiveCatId)
            ? effectiveCatId
            : null,
      wallet_id: isUUID(effectiveWalletId) ? effectiveWalletId : null,
      to_wallet_id:
        type === "transfer" && isUUID(effectiveToWalletId)
          ? effectiveToWalletId
          : null,
    };

    triggerSuccessHaptic();
    if (!transaction) {
      showToast(
        isIndonesian ? "Transaksi ditambahkan" : "Transaction added",
        "add",
        () => {},
      );
    } else {
      showToast(
        isIndonesian ? "Transaksi diperbarui" : "Transaction updated",
        "update",
        () => {},
      );
    }

    const effectiveUnits = cryptoUnits ? parseFloat(cryptoUnits) : undefined;

    // Check if the transaction previously involved crypto holdings
    const prevFromWallet = transaction?.wallet_id
      ? wallets.find((w) => w.id === transaction.wallet_id)
      : null;
    const prevToWallet = transaction?.to_wallet_id
      ? wallets.find((w) => w.id === transaction.to_wallet_id)
      : null;
    const wasCryptoInvolved =
      Boolean(transaction) &&
      (isUsdtWallet(prevFromWallet) ||
        (transaction?.type === "transfer" && isUsdtWallet(prevToWallet)));

    if (transaction && transaction.id) {
      // 1. Revert previous holding impact cleanly if it previously involved crypto
      if (wasCryptoInvolved) {
        reverseTransactionWithHolding(
          {
            type: transaction.type,
            amount: Number(transaction.amount),
            wallet_id: transaction.wallet_id,
            to_wallet_id: transaction.to_wallet_id,
            occurred_on: transaction.occurred_on,
            note: transaction.note,
            tx_id: transaction.id,
          },
          wallets,
          user?.id,
        );
      }

      // 2. Synchronize new holding impact if the updated transaction involves crypto
      if (isCryptoInvolved) {
        syncTransactionWithHolding(
          {
            type,
            amount: numAmount,
            wallet_id: effectiveWalletId,
            to_wallet_id: effectiveToWalletId,
            occurred_on: format(txDate, "yyyy-MM-dd'T'HH:mm:ss"),
            note,
            customUnits: effectiveUnits,
            customPrice: cryptoRate,
            tx_id: transaction.id,
          },
          wallets,
          user?.id,
        );
      }

      onClose();

      updateTx.mutate(
        { id: transaction.id, ...payload },
        {
          onSuccess: () => {
            isSavingRef.current = false;
            setIsSaving(false);
          },
          onError: (err) => {
            isSavingRef.current = false;
            setIsSaving(false);
            console.error("Update tx error:", err);
            showToast(
              isIndonesian
                ? "Gagal memperbarui transaksi"
                : "Failed to update transaction",
              "error",
              () => {},
            );
          },
        },
      );
    } else {
      const newTxId = generateUUID();
      if (isCryptoInvolved) {
        syncTransactionWithHolding(
          {
            type,
            amount: numAmount,
            wallet_id: effectiveWalletId,
            to_wallet_id: effectiveToWalletId,
            occurred_on: format(txDate, "yyyy-MM-dd'T'HH:mm:ss"),
            note,
            customUnits: effectiveUnits,
            customPrice: cryptoRate,
            tx_id: newTxId,
          },
          wallets,
          user?.id,
        );
      }

      onClose();

      addTx.mutate(
        { id: newTxId, ...payload },
        {
          onSuccess: () => {
            lastSavedTimestampRef.current = Date.now();
            lastSavedPayloadRef.current = {
              amount: numAmount,
              type,
              walletId: effectiveWalletId,
              categoryId: effectiveCatId,
              note,
            };
            setDuplicateWarningAcknowledged(false);
            isSavingRef.current = false;
            setIsSaving(false);
          },
          onError: () => {
            isSavingRef.current = false;
            setIsSaving(false);
            showToast(
              isIndonesian
                ? "Gagal menyimpan transaksi"
                : "Failed to save transaction",
              "error",
              () => {},
            );
          },
        },
      );
    }
  };

  const handleDelete = () => {
    if (!transaction) return;
    const deletedTx = { ...transaction };
    const prevFromWallet = transaction.wallet_id
      ? wallets.find((w) => w.id === transaction.wallet_id)
      : null;
    const prevToWallet = transaction.to_wallet_id
      ? wallets.find((w) => w.id === transaction.to_wallet_id)
      : null;
    const wasCrypto =
      isUsdtWallet(prevFromWallet) ||
      (transaction.type === "transfer" && isUsdtWallet(prevToWallet));

    if (wasCrypto) {
      reverseTransactionWithHolding(
        {
          type: transaction.type,
          amount: Number(transaction.amount),
          wallet_id: transaction.wallet_id,
          to_wallet_id: transaction.to_wallet_id,
          occurred_on: transaction.occurred_on,
          note: transaction.note,
          tx_id: transaction.id,
        },
        wallets,
        user?.id,
      );
    }
    deleteTx.mutate(transaction.id, {
      onSuccess: () => {
        showToast(
          isIndonesian ? "Transaksi dihapus" : "Transaction deleted",
          "delete",
          () => {
            if (wasCrypto) {
              syncTransactionWithHolding(
                {
                  type: deletedTx.type,
                  amount: Number(deletedTx.amount),
                  wallet_id: deletedTx.wallet_id,
                  to_wallet_id: deletedTx.to_wallet_id,
                  occurred_on: deletedTx.occurred_on,
                  note: deletedTx.note,
                  tx_id: deletedTx.id,
                },
                wallets,
                user?.id,
              );
            }
            addTx.mutate(
              {
                id: deletedTx.id,
                amount: Number(deletedTx.amount),
                type: deletedTx.type,
                category_id: deletedTx.category_id,
                wallet_id: deletedTx.wallet_id,
                to_wallet_id: deletedTx.to_wallet_id,
                note: deletedTx.note,
                occurred_on: deletedTx.occurred_on,
                created_at: deletedTx.created_at,
                space_id: deletedTx.space_id,
                ledger_id: deletedTx.ledger_id,
                created_by_name: deletedTx.created_by_name,
              },
              {
                onSuccess: () => {
                  showToast(
                    isIndonesian
                      ? "Transaksi dipulihkan"
                      : "Transaction restored",
                    "add",
                  );
                },
              },
            );
          },
          5000,
        );
        onClose();
      },
    });
  };

  // ── Liquid Glass Tactile Materials ───────────────────────────────────────
  const controlBg = isDark
    ? "linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.035) 100%)"
    : "linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(255, 255, 255, 0.72) 100%)";

  const controlBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.06)"
    : "1px solid rgba(0, 0, 0, 0.05)";

  const controlShadow = isDark
    ? "0 2px 8px rgba(0, 0, 0, 0.22)"
    : "0 1px 4px rgba(30, 35, 50, 0.04)";

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      resetHeightKey={isKeypadOpen}
      disableHeightLock={true}
    >
      <div
        className={`px-5 pt-1 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] max-w-lg mx-auto ${
          isKeypadOpen && useCustomKeypad ? "pb-[330px]" : "pb-2"
        }`}
      >
        {/* ── 1. Top Segmented Switcher (Expense / Income / Transfer) ── */}
        <div
          className="flex p-1 rounded-full mb-3.5 transition-all select-none"
          style={{
            background: controlBg,
            border: controlBorder,
            boxShadow: controlShadow,
          }}
        >
          {[
            {
              key: "expense" as TabType,
              label: isIndonesian ? "Pengeluaran" : "Expense",
              icon: <ArrowDownCircle size={13} strokeWidth={2} />,
            },
            {
              key: "income" as TabType,
              label: isIndonesian ? "Pemasukan" : "Income",
              icon: <ArrowUpCircle size={13} strokeWidth={2} />,
            },
            {
              key: "transfer" as TabType,
              label: isIndonesian ? "Transfer" : "Transfer",
              icon: <RefreshCcw size={13} strokeWidth={2} />,
            },
          ].map((t) => {
            const isSelected = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setActiveTab(t.key);
                  setType(t.key);
                  triggerHaptic("light");
                }}
                className="flex-1 py-1.5 rounded-full text-[11.5px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer select-none active:scale-[0.97]"
                style={{
                  background: isSelected
                    ? isDark
                      ? "#ffffff"
                      : "#18181b"
                    : "transparent",
                  color: isSelected
                    ? isDark
                      ? "#000000"
                      : "#ffffff"
                    : "var(--text-tertiary)",
                  boxShadow: isSelected
                    ? isDark
                      ? "0 3px 10px rgba(0, 0, 0, 0.35), inset 0 1px 0 #ffffff"
                      : "0 3px 8px rgba(0, 0, 0, 0.16)"
                    : "none",
                }}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── 2. Quick Shortcuts Strip (Preset Chips) ── */}
        {!transaction && shortcuts.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar mb-3 -mx-1 px-1 select-none">
            {shortcuts.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setActiveTab(s.type);
                  setType(s.type);
                  const rawShortcutAmt = Number(s.amount || 0);
                  const dispAmt =
                    preferredCurrency === "IDR"
                      ? rawShortcutAmt
                      : Number(
                          convertFromIdr(rawShortcutAmt).toFixed(maxDecimals),
                        );
                  setAmount(String(dispAmt));
                  setAmountInput(
                    dispAmt > 0 ? formatDisplayNumber(dispAmt) : "",
                  );
                  setNote(s.note);
                  if (s.category_id) setCategoryId(s.category_id);
                  if (s.wallet_id) setWalletId(s.wallet_id);
                  triggerHaptic("light");
                }}
                className="whitespace-nowrap px-3 py-1 rounded-full text-[10.5px] font-medium shrink-0 transition-transform active:scale-95 flex items-center gap-1 cursor-pointer select-none"
                style={{
                  background: controlBg,
                  border: controlBorder,
                  color: "var(--text-secondary)",
                }}
              >
                <Zap size={10.5} strokeWidth={2} />
                <span>{s.title}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setShortcutSheetOpen(true);
              }}
              className="whitespace-nowrap px-2.5 py-1 rounded-full text-[10.5px] font-medium shrink-0 transition-transform active:scale-95 flex items-center gap-1 cursor-pointer select-none"
              style={{
                background: "transparent",
                border: "1px dashed var(--glass-border)",
                color: "var(--text-tertiary)",
              }}
            >
              <Plus size={10.5} strokeWidth={2} />
              <span>{isIndonesian ? "Preset" : "Preset"}</span>
            </button>
          </div>
        )}

        {/* ── 3. Hero Amount Display Capsule ── */}
        <div className="text-center py-0.5 mb-3.5 select-none">
          <div
            onClick={() => {
              if (useCustomKeypad) {
                triggerHaptic("light");
                setIsKeypadOpen((prev) => !prev);
              } else {
                amountInputRef.current?.focus();
              }
            }}
            className={`w-full max-w-[320px] sm:max-w-[340px] mx-auto flex items-baseline justify-center gap-2 px-6 py-3 rounded-3xl transition-all cursor-pointer relative overflow-hidden ${
              isKeypadOpen && useCustomKeypad
                ? "ring-2 ring-white/15 border-white/30"
                : "active:scale-[0.99]"
            }`}
            style={{
              background: isDark
                ? "linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)"
                : "linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(246,247,250,0.85) 100%)",
              border: controlBorder,
              boxShadow: isDark
                ? "0 8px 24px -6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)"
                : "0 4px 16px -4px rgba(31,36,48,0.06), inset 0 1px 0 #ffffff",
            }}
          >
            {/* Specular Rim Lighting */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-[10%] right-[10%] top-[1px] h-[1.5px] rounded-full"
              style={{
                background: isDark
                  ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), rgba(255,255,255,0.5), rgba(255,255,255,0.3), transparent)"
                  : "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), rgba(255,255,255,1), rgba(255,255,255,0.8), transparent)",
              }}
            />

            <span
              className="text-[18px] sm:text-[20px] font-bold select-none shrink-0"
              style={{ color: "var(--text-tertiary)" }}
            >
              {currencyMeta.symbol}
            </span>

            <input
              ref={amountInputRef}
              type="text"
              readOnly={useCustomKeypad}
              tabIndex={useCustomKeypad ? -1 : 0}
              inputMode={
                useCustomKeypad ? "none" : allowDecimals ? "decimal" : "numeric"
              }
              pattern={allowDecimals ? undefined : "[0-9]*"}
              value={amountInput}
              onClick={() => {
                if (useCustomKeypad) {
                  triggerHaptic("light");
                  setIsKeypadOpen(true);
                }
              }}
              onChange={(e) => {
                const val = e.target.value;
                if (/^[0-9+\-*/×÷.,\s]*$/.test(val)) {
                  if (/[+\-*/×÷]/.test(val)) {
                    setAmountInput(val);
                  } else {
                    const { raw, formatted } = formatLiveAmountInput(
                      val,
                      isIndonesian,
                      allowDecimals,
                      maxDecimals,
                    );
                    setAmount(raw ? String(raw) : "0");
                    setAmountInput(formatted);
                  }
                }
              }}
              onBlur={() => {
                const evaluated = evaluateMathSafe(amountInput);
                setAmount(String(evaluated));
                setAmountInput(
                  evaluated === 0 ? "" : formatDisplayNumber(evaluated),
                );
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const evaluated = evaluateMathSafe(amountInput);
                  setAmount(String(evaluated));
                  setAmountInput(
                    evaluated === 0 ? "" : formatDisplayNumber(evaluated),
                  );
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="0"
              className={`text-[38px] sm:text-[42px] font-bold tracking-tight leading-none bg-transparent outline-none text-left min-w-[50px] max-w-[240px] ${
                useCustomKeypad ? "pointer-events-none select-none" : ""
              }`}
              style={{
                color: "var(--text-primary)",
                width: `${Math.max(1.8, (amountInput || "0").length + 1)}ch`,
              }}
            />
          </div>

          {/* Quick Increment Chips (Pill Row) */}
          <div className="flex items-center justify-center gap-1.5 mt-2.5 px-2">
            {(currencyMeta.code === "IDR" || currencyMeta.code === "JPY"
              ? [
                  { label: "+10K", add: 10000 },
                  { label: "+50K", add: 50000 },
                  { label: "+100K", add: 100000 },
                  { label: "+500K", add: 500000 },
                ]
              : [
                  { label: `+${currencyMeta.symbol}5`, add: 5 },
                  { label: `+${currencyMeta.symbol}10`, add: 10 },
                  { label: `+${currencyMeta.symbol}50`, add: 50 },
                  { label: `+${currencyMeta.symbol}100`, add: 100 },
                ]
            ).map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  const current = evaluateMathSafe(amountInput);
                  const next = Number(
                    (current + preset.add).toFixed(maxDecimals),
                  );
                  setAmount(String(next));
                  setAmountInput(formatDisplayNumber(next));
                }}
                className="px-3 py-1 rounded-full text-[10.5px] font-semibold active:scale-95 transition-all cursor-pointer select-none"
                style={{
                  background: controlBg,
                  border: controlBorder,
                  boxShadow: controlShadow,
                  color: "var(--text-secondary)",
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Crypto Holding Liquidation / Purchase Sync Bar */}
          {isCryptoInvolved && (
            <div
              className="mt-3 p-3 rounded-2xl max-w-[340px] mx-auto text-left space-y-2 select-none"
              style={{
                background: controlBg,
                border: controlBorder,
                boxShadow: controlShadow,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Coins
                    size={13}
                    strokeWidth={1.8}
                    className="text-[var(--text-secondary)]"
                  />
                  <span className="text-[11px] font-semibold tracking-tight text-[var(--text-primary)]">
                    {isFromCrypto && type === "transfer"
                      ? isIndonesian
                        ? "Pencairan Aset"
                        : "Asset Liquidation"
                      : isToCrypto && type === "transfer"
                        ? isIndonesian
                          ? "Pembelian Aset"
                          : "Asset Purchase"
                        : type === "income"
                          ? isIndonesian
                            ? "Hasil Staking"
                            : "Staking Yield"
                          : isIndonesian
                            ? "Eksekusi Kripto"
                            : "Crypto Execution"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setIsEditingRate((prev) => !prev);
                    if (!isEditingRate) {
                      setCustomRateStr(formatLiveAmountInput(String(Math.round(cryptoRate)), isIndonesian).display);
                    }
                  }}
                  className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.05] hover:bg-white/[0.09] active:scale-[0.97] transition-all border border-[var(--glass-border)] text-[var(--text-secondary)] cursor-pointer"
                  title={isIndonesian ? "Klik untuk atur kurs kustom" : "Click to edit custom rate"}
                >
                  <span>1 USDT ≈ Rp {cryptoRate.toLocaleString("id-ID")}</span>
                  <Edit3 size={10} className="text-[var(--text-tertiary)]" />
                </button>
              </div>

              {isEditingRate && (
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--glass-border)]/40">
                  <span className="text-[10px] text-[var(--text-tertiary)] shrink-0">
                    {isIndonesian ? "Kurs Kustom (Rp/USDT):" : "Custom Rate (IDR/USDT):"}
                  </span>
                  <div className="flex items-center gap-1 flex-1 max-w-[140px]">
                    <span className="text-[11px] font-mono text-[var(--text-tertiary)]">Rp</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={customRateStr}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const formatted = formatLiveAmountInput(raw, isIndonesian);
                        setCustomRateStr(formatted.display);
                        const clean = formatted.rawNumber;
                        if (clean > 0) {
                          setCryptoRate(clean);
                          const u = parseFloat(cryptoUnits);
                          if (!isNaN(u) && u > 0) {
                            const calcAmountIdr = Math.round(u * clean);
                            const displayAmt =
                              preferredCurrency === "IDR"
                                ? calcAmountIdr
                                : Number(convertFromIdr(calcAmountIdr).toFixed(maxDecimals));
                            setAmount(String(displayAmt));
                            setAmountInput(formatDisplayNumber(displayAmt));
                          }
                        }
                      }}
                      placeholder={cryptoRate.toLocaleString("id-ID")}
                      className="w-full text-[11px] font-mono font-semibold bg-transparent outline-none py-0.5 px-1.5 rounded-md text-right"
                      style={{
                        background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                        border: controlBorder,
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>
                </div>
              )}

              {estimatedRealizedPnL !== null && (
                <div className="flex items-center justify-between pt-1 border-t border-[var(--glass-border)]/40 text-[10px]">
                  <span className="text-[var(--text-tertiary)]">
                    {isIndonesian ? "Estimasi Realized P&L:" : "Est. Realized P&L:"}
                  </span>
                  <span
                    className={`font-mono font-semibold ${
                      estimatedRealizedPnL >= 0
                        ? "text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)]"
                    }`}
                  >
                    {estimatedRealizedPnL >= 0 ? "+" : "−"}
                    {formatCurrency(Math.abs(estimatedRealizedPnL), preferredCurrency)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-1 border-t border-[var(--glass-border)]/40">
                <div className="flex-1">
                  <span className="text-[10px] text-[var(--text-tertiary)] block">
                    {isIndonesian ? "Kuantitas Koin" : "Coin Units"}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <input
                      type="number"
                      step="any"
                      value={cryptoUnits}
                      onFocus={() => setIsUnitsInputMode(true)}
                      onBlur={() => setIsUnitsInputMode(false)}
                      onChange={(e) => handleCryptoUnitsChange(e.target.value)}
                      placeholder="0.00"
                      className="w-full text-[12.5px] font-mono font-semibold bg-transparent outline-none py-0.5 px-2 rounded-lg"
                      style={{
                        background: isDark
                          ? "rgba(255,255,255,0.06)"
                          : "rgba(0,0,0,0.04)",
                        border: controlBorder,
                        color: "var(--text-primary)",
                      }}
                    />
                    <span className="text-[10.5px] font-semibold uppercase text-[var(--text-tertiary)] shrink-0">
                      USDT
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] text-[var(--text-tertiary)] block">
                    {isIndonesian ? "Dampak Unit" : "Units Impact"}
                  </span>
                  <span
                    className="text-[12px] font-mono font-semibold mt-1 block"
                    style={{
                      color:
                        isFromCrypto &&
                        (type === "transfer" || type === "expense")
                          ? "var(--text-secondary)"
                          : "var(--text-primary)",
                    }}
                  >
                    {isFromCrypto && (type === "transfer" || type === "expense")
                      ? `-${cryptoUnits || "0"} USDT`
                      : `+${cryptoUnits || "0"} USDT`}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Duplicate Transaction Alert */}
          {(isDuplicateDetected || duplicateWarningAcknowledged) && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2.5 mx-1 px-3 py-2 rounded-2xl flex items-center justify-between gap-2.5 text-[11.5px] font-medium"
              style={{
                background: controlBg,
                border: controlBorder,
                boxShadow: controlShadow,
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle
                  size={14}
                  className="shrink-0 text-[var(--text-secondary)]"
                  strokeWidth={2}
                />
                <span className="leading-snug text-[11px] text-[var(--text-secondary)]">
                  {duplicateWarningAcknowledged
                    ? isIndonesian
                      ? "Transaksi serupa baru disimpan. Ketuk Simpan lagi untuk konfirmasi."
                      : "Similar transaction saved just now. Tap Save again to confirm."
                    : isIndonesian
                      ? "Kemungkinan duplikat: transaksi serupa tercatat 15 menit terakhir"
                      : "Possible duplicate: similar record within 15 mins"}
                </span>
              </div>
              {duplicateWarningAcknowledged && (
                <button
                  type="button"
                  onClick={() => setDuplicateWarningAcknowledged(false)}
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 cursor-pointer active:scale-95"
                  style={{
                    background: isDark
                      ? "rgba(255,255,255,0.12)"
                      : "rgba(0,0,0,0.08)",
                    border: controlBorder,
                    color: "var(--text-primary)",
                  }}
                >
                  {isIndonesian ? "Batal" : "Dismiss"}
                </button>
              )}
            </motion.div>
          )}

          {/* Budget Impact Preview */}
          {budgetImpact && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 mx-1 px-3 py-1.5 rounded-2xl flex items-center justify-between text-[11px] font-medium"
              style={{
                background: controlBg,
                border: controlBorder,
                boxShadow: controlShadow,
                color: "var(--text-secondary)",
              }}
            >
              <div className="flex items-center gap-1.5 truncate pr-2">
                {budgetImpact.isOver ? (
                  <AlertTriangle
                    size={12}
                    strokeWidth={2}
                    className="shrink-0 text-[var(--text-primary)]"
                  />
                ) : (
                  <span className="font-semibold text-[var(--text-primary)] truncate">
                    {budgetImpact.categoryName}
                  </span>
                )}
                <span className="opacity-50">·</span>
                <span className="truncate">
                  {budgetImpact.hasBudget
                    ? budgetImpact.isOver
                      ? isIndonesian
                        ? `Melebihi: +${formatCurrency(budgetImpact.diff, preferredCurrency)}`
                        : `Over Budget: +${formatCurrency(budgetImpact.diff, preferredCurrency)}`
                      : isIndonesian
                        ? `Sisa: ${formatCurrency(budgetImpact.remaining, preferredCurrency)}`
                        : `Remaining: ${formatCurrency(budgetImpact.remaining, preferredCurrency)}`
                    : isIndonesian
                      ? `Total Bulan: ${formatCurrency(budgetImpact.projectedSpent, preferredCurrency)}`
                      : `MTD: ${formatCurrency(budgetImpact.projectedSpent, preferredCurrency)}`}
                </span>
              </div>
              {budgetImpact.hasBudget && (
                <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-white/[0.08] border border-[var(--glass-border)] text-[var(--text-primary)] shrink-0">
                  {budgetImpact.pct}% {isIndonesian ? "sisa" : "left"}
                </span>
              )}
            </motion.div>
          )}
        </div>

        {/* ── 4. Category Ribbon ── */}
        {type !== "transfer" && (
          <CategorySelectorRibbon
            categories={displayCategories}
            selectedCategoryId={categoryId}
            onSelectCategory={(id) => {
              userExplicitlySelectedCategoryRef.current = true;
              setCategoryId(id);
            }}
            onOpenMore={() => setMoreCatOpen(true)}
          />
        )}

        {/* ── 5. Account / Wallet Ribbon ── */}
        <WalletSelectorRibbon
          type={type}
          displayFromWallets={displayFromWallets}
          displayToWallets={displayToWallets}
          walletId={walletId}
          toWalletId={toWalletId}
          onSelectWallet={(id) => {
            userExplicitlySelectedWalletRef.current = true;
            setWalletId(id);
          }}
          onSelectToWallet={(id) => setToWalletId(id)}
          onOpenMore={(target) => {
            setWalletTarget(target);
            setMoreWalletOpen(true);
          }}
        />

        {/* ── Overdraft Warning Capsule (Real-time Guardrail) ── */}
        <AnimatePresence>
          {isOverdraft && (
            <motion.div
              initial={{ opacity: 0, y: -4, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              transition={{ duration: 0.16 }}
              className="mb-3 mx-0.5 px-3 py-2 rounded-2xl flex items-center gap-2.5 text-[11.5px] font-medium overflow-hidden"
              style={{
                background: controlBg,
                border: controlBorder,
                boxShadow: controlShadow,
              }}
            >
              <AlertTriangle
                size={14}
                className="shrink-0 text-[var(--text-secondary)]"
                strokeWidth={1.75}
              />
              <span className="leading-snug text-[11px] text-[var(--text-secondary)]">
                {isIndonesian
                  ? `Nominal melebihi saldo akun saat ini (${formatCurrency(effectiveSourceBalance, preferredCurrency)})`
                  : `Amount exceeds current account balance (${formatCurrency(effectiveSourceBalance, preferredCurrency)})`}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 6. Note & Date/Time Compact Capsule ── */}
        <div
          className="rounded-2xl p-2.5 px-3.5 mb-3 flex items-center gap-2.5 transition-all"
          style={{
            background: controlBg,
            border: "none",
            boxShadow: controlShadow,
          }}
        >
          <PenLine
            size={13.5}
            strokeWidth={1.8}
            style={{
              color: isNoteFocused
                ? "var(--text-primary)"
                : "var(--text-tertiary)",
            }}
          />
          <input
            type="text"
            value={note}
            onFocus={() => setIsNoteFocused(true)}
            onBlur={() => setIsNoteFocused(false)}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              isIndonesian
                ? "Tambah catatan (opsional)..."
                : "Add note (optional)..."
            }
            aria-label={
              isIndonesian ? "Catatan transaksi" : "Transaction note"
            }
            className="bg-transparent border-0 border-none outline-none appearance-none [box-shadow:none] text-[16px] sm:text-[12.5px] placeholder:text-[12px] placeholder:text-[var(--text-tertiary)] placeholder:opacity-65 font-normal flex-1 min-w-0"
            style={{
              color: "var(--text-primary)",
              border: "none",
              outline: "none",
              WebkitAppearance: "none",
              boxShadow: "none",
            }}
          />

          <AnimatePresence>
            {!isNoteFocused && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, width: 0 }}
                animate={{ opacity: 1, scale: 1, width: "auto" }}
                exit={{ opacity: 0, scale: 0.95, width: 0 }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-1.5 shrink-0 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setDateOpen(true);
                  }}
                  className="px-2.5 py-1 rounded-full text-[10.5px] font-medium active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                  style={{
                    background: isDark
                      ? "rgba(255, 255, 255, 0.06)"
                      : "rgba(0, 0, 0, 0.04)",
                    border: controlBorder,
                    color: "var(--text-primary)",
                  }}
                >
                  <CalendarIcon
                    size={11}
                    strokeWidth={1.8}
                    className="text-[var(--text-tertiary)]"
                  />
                  <span>
                    {isToday(date)
                      ? isIndonesian
                        ? "Hari Ini"
                        : "Today"
                      : format(date, "dd/MM")}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setTimeOpen(true);
                  }}
                  className="px-2.5 py-1 rounded-full text-[10.5px] font-medium active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                  style={{
                    background: isDark
                      ? "rgba(255, 255, 255, 0.06)"
                      : "rgba(0, 0, 0, 0.04)",
                    border: controlBorder,
                    color: "var(--text-primary)",
                  }}
                >
                  <Clock
                    size={11}
                    strokeWidth={1.8}
                    className="text-[var(--text-tertiary)]"
                  />
                  <span>{time}</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Dedicated Ledger Notice */}
        {activeSpace &&
          activeSpace.id !== "all" &&
          activeSpace.id !== "personal" && (
            <div className="mb-2 px-3 py-1.5 rounded-2xl bg-white/[0.04] border border-white/10 text-[11px] text-[var(--text-secondary)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span>
                  {isIndonesian ? "Ruang:" : "Space:"}{" "}
                  <strong className="text-[var(--text-primary)]">
                    {activeSpace.name}
                  </strong>
                </span>
              </div>
              {activeSpace.tag ? (
                <button
                  type="button"
                  onClick={() => handleToggleTag(activeSpace.tag!)}
                  className="text-[10px] font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-white/[0.06] border border-white/10 px-2 py-0.5 rounded-full transition-colors cursor-pointer"
                >
                  {activeTags.includes(activeSpace.tag.toLowerCase())
                    ? isIndonesian
                      ? "Tertaut"
                      : "Tagged"
                    : isIndonesian
                      ? `Lampirkan ${activeSpace.tag}`
                      : `Attach ${activeSpace.tag}`}
                </button>
              ) : (
                <span className="text-[10px] font-mono text-[var(--text-secondary)] bg-white/[0.06] border border-white/10 px-2 py-0.5 rounded-full">
                  {isIndonesian ? "Otomatis" : "Auto"}
                </span>
              )}
            </div>
          )}

        {/* Smart Merchant Match Chip */}
        {(predictedCategory || predictedWallet) && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-2.5 px-1 flex items-center gap-2"
          >
            <button
              type="button"
              onClick={() => {
                triggerHaptic("medium");
                if (predictedCategory) setCategoryId(predictedCategory.id);
                if (predictedWallet) setWalletId(predictedWallet.id);
              }}
              className="px-3 py-1 rounded-full text-[11px] font-medium flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer select-none"
              style={{
                background: controlBg,
                border: controlBorder,
                boxShadow: controlShadow,
                color: "var(--text-secondary)",
              }}
            >
              <Sparkles size={11} className="text-zinc-400 shrink-0" />
              <span>{isIndonesian ? "Cocok pintar:" : "Smart match:"}</span>
              {predictedCategory && (
                <span className="font-bold text-[var(--text-primary)]">
                  {predictedCategory.name}
                </span>
              )}
              {predictedWallet && (
                <span className="text-[var(--text-tertiary)]">
                  ({predictedWallet.name})
                </span>
              )}
              <span className="ml-1 text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-white text-black">
                {isIndonesian ? "Terapkan" : "Apply"}
              </span>
            </button>
          </motion.div>
        )}

        {/* ── 7. Action Button Bar (Scan, Save, Voice/Delete) ── */}
        <div className="flex items-center gap-2 mt-3 mb-1 select-none">
          {transaction ? (
            <button
              type="button"
              onClick={() => {
                triggerHaptic("medium");
                setIsDeleteConfirmOpen(true);
              }}
              className="w-11 h-11 rounded-2xl flex items-center justify-center active:scale-95 shrink-0 transition-all cursor-pointer select-none"
              style={{
                background: controlBg,
                border: controlBorder,
                boxShadow: controlShadow,
                color: "var(--text-secondary)",
              }}
              title={isIndonesian ? "Hapus Transaksi" : "Delete Transaction"}
            >
              <Trash2 size={16} strokeWidth={1.8} />
            </button>
          ) : onOpenScan ? (
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onOpenScan();
              }}
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 active:scale-95 transition-all cursor-pointer select-none"
              style={{
                background: controlBg,
                border: controlBorder,
                boxShadow: controlShadow,
                color: "var(--text-primary)",
              }}
              title={
                isIndonesian ? "Pindai Struk / Bukti Transfer" : "Scan Receipt"
              }
            >
              <ScanLine size={16} strokeWidth={1.8} />
            </button>
          ) : null}

          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              if (
                typeof document !== "undefined" &&
                document.activeElement instanceof HTMLElement
              ) {
                document.activeElement.blur();
              }
              const touch = e.touches[0];
              if (touch) {
                touchStartPos.current = { x: touch.clientX, y: touch.clientY };
              }
            }}
            onTouchEnd={(e) => {
              const touch = e.changedTouches[0];
              if (touch) {
                const dx = Math.abs(touch.clientX - touchStartPos.current.x);
                const dy = Math.abs(touch.clientY - touchStartPos.current.y);
                if (dx < 14 && dy < 14) {
                  e.preventDefault();
                  touchHandledRef.current = true;
                  setTimeout(() => {
                    touchHandledRef.current = false;
                  }, 600);
                  executeSave();
                }
              }
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (touchHandledRef.current) return;
              executeSave();
            }}
            disabled={
              currentUserRole === "viewer" ||
              isSaving ||
              currentNumericAmount <= 0 ||
              addTx.isPending ||
              updateTx.isPending
            }
            className="flex-1 h-11 rounded-full font-semibold text-[13px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer select-none shadow-sm"
            style={{
              background: isDark ? "#ffffff" : "#18181b",
              color: isDark ? "#000000" : "#ffffff",
              boxShadow: isDark
                ? "0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 #ffffff"
                : "0 4px 14px rgba(0, 0, 0, 0.15)",
            }}
          >
            {currentUserRole === "viewer" ? (
              <span className="font-semibold flex items-center gap-1.5 opacity-75">
                <Lock size={14} strokeWidth={2} />
                {isIndonesian ? "Hanya Lihat" : "Read-Only"}
              </span>
            ) : isSaving || addTx.isPending || updateTx.isPending ? (
              <span className="font-semibold">
                {isIndonesian ? "Menyimpan..." : "Saving..."}
              </span>
            ) : (
              <div className="flex items-center justify-center gap-1.5">
                <Check size={15} strokeWidth={2.8} />
                <span className="font-semibold">
                  {transaction
                    ? isIndonesian
                      ? "Perbarui Transaksi"
                      : "Update Transaction"
                    : isIndonesian
                      ? "Simpan Transaksi"
                      : "Save Transaction"}
                </span>
              </div>
            )}
          </button>

          {!transaction && onOpenVoiceAdd && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onOpenVoiceAdd();
              }}
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 active:scale-95 transition-all cursor-pointer select-none"
              style={{
                background: controlBg,
                border: controlBorder,
                boxShadow: controlShadow,
                color: "var(--text-primary)",
              }}
              title={isIndonesian ? "Pencatatan Suara" : "Voice Logging"}
            >
              <Mic size={16} strokeWidth={1.8} />
            </button>
          )}
        </div>
      </div>

      {/* ── More Categories Sub-Sheet (Frosted 3-Column Pill Grid) ── */}
      <BottomSheet
        isOpen={moreCatOpen}
        onClose={() => {
          setMoreCatOpen(false);
          setSearchCatQuery("");
        }}
      >
        <div className="px-5 pt-1 pb-7 max-w-lg mx-auto select-none">
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <h3 className="font-semibold text-[16px] text-[var(--text-primary)] leading-tight">
                {isIndonesian ? "Pilih Kategori" : "Select Category"}
              </h3>
              <p className="text-[10.5px] font-medium text-[var(--text-tertiary)] mt-0.5">
                {filteredMoreCategories.length}{" "}
                {isIndonesian ? "kategori tersedia" : "categories available"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setMoreCatOpen(false);
                setSearchCatQuery("");
              }}
              className="h-7 px-3 rounded-full text-[11px] font-semibold active:scale-95 transition-all cursor-pointer"
              style={{
                background: controlBg,
                border: controlBorder,
                color: "var(--text-secondary)",
              }}
            >
              {isIndonesian ? "Tutup" : "Close"}
            </button>
          </div>

          {/* Search Pill */}
          <div
            className="flex items-center gap-2 px-3.5 h-10 rounded-2xl mb-3.5 transition-all"
            style={{
              background: controlBg,
              border: "none",
              boxShadow: controlShadow,
            }}
          >
            <Search
              size={14}
              className="text-[var(--text-tertiary)] shrink-0"
            />
            <input
              type="text"
              value={searchCatQuery}
              onChange={(e) => setSearchCatQuery(e.target.value)}
              placeholder={
                isIndonesian ? "Cari kategori..." : "Search category..."
              }
              className="flex-1 bg-transparent border-0 border-none outline-none appearance-none text-[12.5px] font-medium text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
            />
            {searchCatQuery && (
              <button
                type="button"
                onClick={() => setSearchCatQuery("")}
                className="cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {filteredMoreCategories.length === 0 ? (
            <div className="py-12 text-center text-[12px] text-[var(--text-tertiary)]">
              {isIndonesian
                ? `Kategori "${searchCatQuery}" tidak ditemukan`
                : `No categories matching "${searchCatQuery}"`}
            </div>
          ) : (
            <div
              className="grid grid-cols-3 gap-2 pr-0.5"
              onTouchMove={() => {
                if (document.activeElement instanceof HTMLElement) {
                  document.activeElement.blur();
                }
              }}
            >
              {filteredMoreCategories.map((cat) => {
                const isSelected = categoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      userExplicitlySelectedCategoryRef.current = true;
                      setCategoryId(cat.id);
                      setMoreCatOpen(false);
                      setSearchCatQuery("");
                      triggerHaptic("light");
                    }}
                    className="h-10 px-2.5 rounded-full flex items-center justify-start gap-2 cursor-pointer select-none active:scale-95 transition-all"
                    style={{
                      background: isSelected
                        ? isDark
                          ? "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.98) 48%, rgba(244,245,247,0.95) 100%)"
                          : "#18181b"
                        : controlBg,
                      color: isSelected
                        ? isDark
                          ? "#000000"
                          : "#ffffff"
                        : "var(--text-secondary)",
                      border: isSelected
                        ? isDark
                          ? "1px solid rgba(255,255,255,0.86)"
                          : "1px solid #18181b"
                        : controlBorder,
                      boxShadow: isSelected
                        ? "0 3px 10px rgba(0, 0, 0, 0.25)"
                        : controlShadow,
                      backdropFilter: "blur(18px) saturate(255%)",
                      WebkitBackdropFilter: "blur(18px) saturate(155%)",
                    }}
                  >
                    <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-white/[0.08]">
                      <IconRenderer icon={cat.emoji} size="w-3.5 h-3.5" />
                    </span>
                    <span className="text-[11px] font-semibold truncate leading-none">
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </BottomSheet>

      {/* ── More Accounts Sub-Sheet (Frosted 3-Column Pill Grid) ── */}
      <BottomSheet
        isOpen={moreWalletOpen}
        onClose={() => {
          setMoreWalletOpen(false);
          setSearchWalletQuery("");
        }}
      >
        <div className="px-5 pt-1 pb-7 max-w-lg mx-auto select-none">
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <h3 className="font-semibold text-[16px] text-[var(--text-primary)] leading-tight">
                {isIndonesian ? "Pilih Akun" : "Select Account"}
              </h3>
              <p className="text-[10.5px] font-medium text-[var(--text-tertiary)] mt-0.5">
                {walletTarget === "from"
                  ? isIndonesian
                    ? "Akun Asal"
                    : "Source Account"
                  : isIndonesian
                    ? "Akun Tujuan"
                    : "Destination Account"}{" "}
                · {filteredMoreWallets.length}{" "}
                {isIndonesian ? "akun" : "accounts"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setMoreWalletOpen(false);
                setSearchWalletQuery("");
              }}
              className="h-7 px-3 rounded-full text-[11px] font-semibold active:scale-95 transition-all cursor-pointer"
              style={{
                background: controlBg,
                border: controlBorder,
                color: "var(--text-secondary)",
              }}
            >
              {isIndonesian ? "Tutup" : "Close"}
            </button>
          </div>

          <div
            className="flex items-center gap-2 px-3.5 h-10 rounded-2xl mb-3.5 transition-all"
            style={{
              background: controlBg,
              border: "none",
              boxShadow: controlShadow,
            }}
          >
            <Search
              size={14}
              className="text-[var(--text-tertiary)] shrink-0"
            />
            <input
              type="text"
              value={searchWalletQuery}
              onChange={(e) => setSearchWalletQuery(e.target.value)}
              placeholder={isIndonesian ? "Cari akun..." : "Search account..."}
              className="flex-1 bg-transparent border-0 border-none outline-none appearance-none text-[12.5px] font-medium text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
            />
            {searchWalletQuery && (
              <button
                type="button"
                onClick={() => setSearchWalletQuery("")}
                className="cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {filteredMoreWallets.length === 0 ? (
            <div className="py-12 text-center text-[12px] text-[var(--text-tertiary)]">
              {isIndonesian
                ? `Akun "${searchWalletQuery}" tidak ditemukan`
                : `No accounts matching "${searchWalletQuery}"`}
            </div>
          ) : (
            <div
              className="grid grid-cols-3 gap-2 pr-0.5"
              onTouchMove={() => {
                if (document.activeElement instanceof HTMLElement) {
                  document.activeElement.blur();
                }
              }}
            >
              {filteredMoreWallets.map((w) => {
                const isSelected =
                  (walletTarget === "from" ? walletId : toWalletId) === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => {
                      if (walletTarget === "from") {
                        userExplicitlySelectedWalletRef.current = true;
                        setWalletId(w.id);
                      } else {
                        setToWalletId(w.id);
                      }
                      setMoreWalletOpen(false);
                      setSearchWalletQuery("");
                      triggerHaptic("light");
                    }}
                    className="h-10 px-2.5 rounded-full flex items-center justify-start gap-2 cursor-pointer select-none active:scale-95 transition-all"
                    style={{
                      background: isSelected
                        ? isDark
                          ? "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.98) 48%, rgba(244,245,247,0.95) 100%)"
                          : "#18181b"
                        : controlBg,
                      color: isSelected
                        ? isDark
                          ? "#000000"
                          : "#ffffff"
                        : "var(--text-secondary)",
                      border: isSelected
                        ? isDark
                          ? "1px solid rgba(255,255,255,0.86)"
                          : "1px solid #18181b"
                        : controlBorder,
                      boxShadow: isSelected
                        ? "0 3px 10px rgba(0, 0, 0, 0.25)"
                        : controlShadow,
                      backdropFilter: "blur(18px) saturate(255%)",
                      WebkitBackdropFilter: "blur(18px) saturate(155%)",
                    }}
                  >
                    <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-white/[0.08]">
                      <IconRenderer icon={w.icon} size="w-3.5 h-3.5" />
                    </span>
                    <span className="text-[11px] font-semibold truncate leading-none">
                      {w.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </BottomSheet>

      {/* Date Picker Sheet */}
      <BottomSheet isOpen={dateOpen} onClose={() => setDateOpen(false)}>
        <div className="p-5 pb-10 flex flex-col items-center">
          <h3
            className="font-semibold text-lg mb-4"
            style={{ color: "var(--text-primary)" }}
          >
            {isIndonesian ? "Pilih Tanggal" : "Select Date"}
          </h3>
          <GlassDatePicker
            date={date}
            onChange={(d) => {
              setDate(d);
              setDateOpen(false);
            }}
          />
        </div>
      </BottomSheet>

      {/* Glass Time Picker Sheet */}
      <BottomSheet isOpen={timeOpen} onClose={() => setTimeOpen(false)}>
        <div className="p-5 pb-10 flex flex-col items-center max-w-sm mx-auto">
          <h3 className="font-semibold text-lg mb-1 text-[var(--text-primary)]">
            {isIndonesian ? "Pilih Waktu" : "Select Time"}
          </h3>
          <p className="text-[12px] font-medium mb-5 text-[var(--text-tertiary)]">
            {isIndonesian ? "Waktu transaksi" : "Transaction timestamp"}
          </p>

          <div
            className="p-4 rounded-3xl w-full max-w-[260px] flex items-center justify-center gap-3"
            style={{
              background: controlBg,
              border: "none",
              boxShadow: controlShadow,
            }}
          >
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="bg-transparent text-3xl font-semibold amount text-center border-0 border-none outline-none appearance-none cursor-pointer"
              style={{
                color: "var(--text-primary)",
                colorScheme: isDark ? "dark" : "light",
              }}
            />
          </div>

          <div className="flex gap-2 mt-5">
            {[
              { label: isIndonesian ? "Pagi" : "Morning", time: "08:00" },
              { label: isIndonesian ? "Siang" : "Noon", time: "12:30" },
              { label: isIndonesian ? "Sore" : "Evening", time: "17:00" },
              { label: isIndonesian ? "Malam" : "Night", time: "20:00" },
            ].map((preset) => (
              <button
                key={preset.time}
                onClick={() => {
                  setTime(preset.time);
                  setTimeOpen(false);
                }}
                className="px-3 py-1.5 rounded-full text-[11px] font-semibold active:scale-95 transition-all"
                style={{
                  background: controlBg,
                  border: controlBorder,
                  color: "var(--text-secondary)",
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setTimeOpen(false)}
            className="w-full max-w-[260px] h-11 mt-6 rounded-full font-semibold text-[13px] active:scale-[0.98] transition-all cursor-pointer shadow-sm"
            style={{
              background: isDark ? "#ffffff" : "#18181b",
              color: isDark ? "#000000" : "#ffffff",
            }}
          >
            {isIndonesian ? "Selesai" : "Done"}
          </button>
        </div>
      </BottomSheet>

      {/* Liquid Glass On-Screen Keypad Drawer */}
      <TransactionKeypadSheet
        isOpen={isKeypadOpen}
        onClose={() => setIsKeypadOpen(false)}
        expression={amountInput}
        onExpressionChange={(newExpr, numericVal) => {
          setAmountInput(newExpr);
          setAmount(String(numericVal));
        }}
        onDone={() => {
          setIsKeypadOpen(false);
          const evaluated = evaluateMathSafe(amountInput);
          setAmount(String(evaluated));
          setAmountInput(evaluated === 0 ? "" : formatDisplayNumber(evaluated));
        }}
      />

      {/* Quick Shortcut Preset Management Sheet */}
      <ShortcutManagementSheet
        isOpen={shortcutSheetOpen}
        onClose={() => setShortcutSheetOpen(false)}
      />

      {/* Apple Luxury Deletion Confirmation Sheet */}
      <BottomSheet
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        zIndex={1050}
        title={isIndonesian ? "Konfirmasi Hapus" : "Delete Confirmation"}
      >
        <div
          className="px-5 sm:px-6 space-y-4 pt-1 select-none max-w-lg mx-auto"
          style={{
            paddingBottom:
              "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)",
          }}
        >
          <div
            className="p-4 rounded-2xl flex items-start gap-3"
            style={{
              background: controlBg,
              border: controlBorder,
              boxShadow: controlShadow,
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
              style={{
                background: isDark
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(0, 0, 0, 0.05)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-primary)",
              }}
            >
              <Trash2 size={16} strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-[13.5px] font-semibold text-[var(--text-primary)]">
                {isIndonesian
                  ? "Hapus transaksi ini?"
                  : "Delete this transaction?"}
              </h4>
              <p className="text-[11.5px] text-[var(--text-tertiary)] mt-1 leading-relaxed">
                {isIndonesian
                  ? "Transaksi akan dihapus dari catatan keuangan Anda. Anda dapat memulihkannya melalui tombol Urungkan pada notifikasi."
                  : "This transaction will be removed from your financial records. You can restore it using the Undo button on the notification."}
              </p>
            </div>
          </div>

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setIsDeleteConfirmOpen(false);
              }}
              className="flex-1 h-11 rounded-full font-semibold text-[13px] active:scale-[0.98] transition-all cursor-pointer"
              style={{
                background: controlBg,
                border: controlBorder,
                boxShadow: controlShadow,
                color: "var(--text-primary)",
              }}
            >
              {isIndonesian ? "Batal" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsDeleteConfirmOpen(false);
                handleDelete();
              }}
              className="flex-1 h-11 rounded-full font-semibold text-[13px] active:scale-[0.98] transition-all cursor-pointer shadow-sm"
              style={{
                background: isDark ? "#ffffff" : "#18181b",
                color: isDark ? "#000000" : "#ffffff",
              }}
            >
              {isIndonesian ? "Hapus" : "Delete"}
            </button>
          </div>
        </div>
      </BottomSheet>
    </BottomSheet>
  );
}
