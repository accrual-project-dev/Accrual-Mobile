import { useState, useMemo, useCallback, useDeferredValue } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Inbox } from "lucide-react";
import {
  format,
  subDays,
  startOfMonth,
  endOfMonth,
  subMonths,
  parse,
  parseISO,
  eachDayOfInterval,
  eachWeekOfInterval,
  endOfWeek,
  eachMonthOfInterval,
} from "date-fns";
import { GroupedVirtuoso } from "react-virtuoso";

import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "../components/ui/PullToRefreshIndicator";
import { triggerHaptic } from "../lib/haptics";
import { useDraftTransactions } from "../lib/draftTransactionService";
import type { ParsedStatementItem } from "../lib/statementParser";
import {
  useAllTransactions,
  useDeleteTransaction,
  useBatchDeleteTransactions,
} from "../hooks/useTransactions";
import { useWallets, resolveTransactionWallets } from "../hooks/useWallets";
import { useCategories } from "../hooks/useCategories";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { usePrivacy } from "../contexts/PrivacyContext";
import { useSpace } from "../contexts/SpaceContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useCurrency } from "../contexts/CurrencyContext";
import { isUsdtWallet, reverseTransactionWithHolding } from "../lib/holdingSyncEngine";
import type { Transaction, Category, Wallet as WalletType } from "../lib/types";
import { formatCurrency, getDateLabel } from "../lib/utils";
import { useDeferredRender } from "../hooks/useDeferredRender";
import { TransactionItem } from "../components/transactions/TransactionItem";
import { useUnusualSpending } from "../hooks/useUnusualSpending";
import { isCorrectionTx } from "../lib/financialMath";

import {
  TransactionHorizonBarChart,
  type FilterType,
  type TimeRangeType,
  type ChartPoint,
} from "../components/transactions/TransactionHorizonBarChart";
import { TransactionFilterBar } from "../components/transactions/TransactionFilterBar";
import { TransactionBatchActionBar } from "../components/transactions/TransactionBatchActionBar";
import { TransactionModalsContainer } from "../components/transactions/TransactionModalsContainer";

const isTxCorrection = isCorrectionTx;

function summarizeTransactionsForChart(
  txs: Transaction[],
  filter: FilterType,
  isTxCorrectionFn: (tx: Transaction) => boolean,
) {
  let income = 0;
  let expense = 0;
  let transfer = 0;
  let adjustment = 0;

  txs.forEach((t) => {
    const amt = Number(t.amount || 0);
    if (t.type === "income" && !isTxCorrectionFn(t)) income += amt;
    else if (t.type === "expense" && !isTxCorrectionFn(t)) expense += amt;
    else if (t.type === "transfer") transfer += amt;
    else if (isTxCorrectionFn(t)) adjustment += amt;
  });

  let activeValue = expense + income + transfer + adjustment;
  if (filter === "income") activeValue = income;
  else if (filter === "expense") activeValue = expense;
  else if (filter === "transfer") activeValue = transfer;
  else if (filter === "adjustment") activeValue = adjustment;

  return { income, expense, transfer, adjustment, activeValue };
}

const MONTHS_LIST = [
  { code: "01", short: "Jan", full: "January" },
  { code: "02", short: "Feb", full: "February" },
  { code: "03", short: "Mar", full: "March" },
  { code: "04", short: "Apr", full: "April" },
  { code: "05", short: "May", full: "May" },
  { code: "06", short: "Jun", full: "June" },
  { code: "07", short: "Jul", full: "July" },
  { code: "08", short: "Aug", full: "August" },
  { code: "09", short: "Sep", full: "September" },
  { code: "10", short: "Oct", full: "October" },
  { code: "11", short: "Nov", full: "November" },
  { code: "12", short: "Dec", full: "December" },
];

export interface TransactionsPageProps {
  onOpenScan?: () => void;
  onOpenImport?: () => void;
  onOpenVoiceAdd?: () => void;
  onOpenBatchReview?: (items: ParsedStatementItem[], appName?: string) => void;
}

export function TransactionsPage({
  onOpenScan: _onOpenScan,
  onOpenImport: _onOpenImport,
  onOpenVoiceAdd: _onOpenVoiceAdd,
  onOpenBatchReview,
}: TransactionsPageProps = {}) {
  const { isStealthMode, toggleStealthMode } = usePrivacy();
  const {
    items: allDraftItems,
    count: draftCount,
    clearAll: clearAllDrafts,
  } = useDraftTransactions();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [search, setSearch] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchScope, setSearchScope] = useState<"current" | "all">("current");
  const deferredSearch = useDeferredValue(search);

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    if (!val) {
      setSearchScope("current");
    }
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearch("");
    setSearchScope("current");
  }, []);
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedWalletName, setSelectedWalletName] = useState<string | null>(
    null,
  );
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRangeType>("this_month");
  const [selectedCustomMonth, setSelectedCustomMonth] = useState<string>(
    format(new Date(), "yyyy-MM"),
  );
  const [pickerYear, setPickerYear] = useState<number>(
    new Date().getFullYear(),
  );
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [pendingDeletedIds, setPendingDeletedIds] = useState<Set<string>>(
    () => new Set(),
  );

  const {
    data: allTxs = [],
    isLoading,
    refetch: refetchTxs,
  } = useAllTransactions();
  const { data: wallets = [], refetch: refetchWallets } = useWallets();
  const { data: categories = [], refetch: refetchCategories } = useCategories();
  const deleteTx = useDeleteTransaction();
  const batchDeleteTx = useBatchDeleteTransactions();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { preferredCurrency, currencyMeta } = useCurrency();
  const { t, isIndonesian } = useLanguage();
  const {
    activeSpace,
    activeSpaceId,
    setActiveSpaceId,
    filterTransactionsBySpace,
  } = useSpace();

  // Selection Mode State for Bulk Actions
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());

  // O(1) Dictionary Lookup Maps for Categories and Wallets
  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((c) => map.set(c.id, c));
    return map;
  }, [categories]);

  const walletMap = useMemo(() => {
    const map = new Map<string, WalletType>();
    wallets.forEach((w) => map.set(w.id, w));
    return map;
  }, [wallets]);

  const visibleTxs = useMemo(
    () =>
      filterTransactionsBySpace(allTxs, activeSpaceId).filter(
        (t) => !pendingDeletedIds.has(t.id),
      ),
    [allTxs, activeSpaceId, filterTransactionsBySpace, pendingDeletedIds],
  );

  const { checkUnusual } = useUnusualSpending(visibleTxs);

  // 5-second Undo Grace Period for single deletion
  const handleDeleteTransaction = useCallback(
    (tx: Transaction) => {
      setPendingDeletedIds((prev) => new Set(prev).add(tx.id));
      showToast(
        isIndonesian ? "Transaksi dihapus" : "Transaction deleted",
        "delete",
        () => {
          const fromWallet = wallets.find((w) => w.id === tx.wallet_id);
          const toWallet = wallets.find((w) => w.id === tx.to_wallet_id);
          const isCrypto =
            isUsdtWallet(fromWallet) ||
            (tx.type === "transfer" && isUsdtWallet(toWallet));
          if (isCrypto) {
            reverseTransactionWithHolding(
              {
                type: tx.type,
                amount: Number(tx.amount),
                wallet_id: tx.wallet_id,
                to_wallet_id: tx.to_wallet_id,
                occurred_on: tx.occurred_on,
                note: tx.note,
              },
              wallets,
              user?.id,
            );
          }
          deleteTx.mutate(tx.id, {
            onSuccess: () => {
              setPendingDeletedIds((prev) => {
                const next = new Set(prev);
                next.delete(tx.id);
                return next;
              });
            },
          });
        },
        5000,
        () => {
          setPendingDeletedIds((prev) => {
            const next = new Set(prev);
            next.delete(tx.id);
            return next;
          });
        },
      );
    },
    [deleteTx, showToast, isIndonesian, wallets, user?.id],
  );

  const handleToggleSelect = useCallback((tx: Transaction) => {
    setSelectedTxIds((prev) => {
      const next = new Set(prev);
      if (next.has(tx.id)) {
        next.delete(tx.id);
      } else {
        next.add(tx.id);
      }
      return next;
    });
  }, []);

  const handleEnterSelectMode = useCallback((tx?: Transaction) => {
    setIsSelectMode(true);
    if (tx) {
      setSelectedTxIds(new Set([tx.id]));
    }
  }, []);

  const handleItemClick = useCallback(
    (t: Transaction) => {
      if (isSelectMode) {
        handleToggleSelect(t);
      } else {
        setEditingTx(t);
        setSheetOpen(true);
      }
    },
    [isSelectMode, handleToggleSelect],
  );

  const handleExitSelectMode = useCallback(() => {
    setIsSelectMode(false);
    setSelectedTxIds(new Set());
  }, []);

  // Bulk Deletion with 5-second Undo Grace Period
  const handleBulkDelete = useCallback(() => {
    if (selectedTxIds.size === 0) return;
    triggerHaptic("heavy");
    const idsToDelete = Array.from(selectedTxIds);
    setPendingDeletedIds((prev) => {
      const next = new Set(prev);
      idsToDelete.forEach((id) => next.add(id));
      return next;
    });
    const count = idsToDelete.length;
    handleExitSelectMode();

    showToast(
      isIndonesian
        ? `${count} transaksi dihapus`
        : `${count} transactions deleted`,
      "delete",
      () => {
        idsToDelete.forEach((id) => {
          const tx = allTxs.find((t) => t.id === id);
          if (!tx) return;
          const fromWallet = wallets.find((w) => w.id === tx.wallet_id);
          const toWallet = wallets.find((w) => w.id === tx.to_wallet_id);
          const isCrypto =
            isUsdtWallet(fromWallet) ||
            (tx.type === "transfer" && isUsdtWallet(toWallet));
          if (isCrypto) {
            reverseTransactionWithHolding(
              {
                type: tx.type,
                amount: Number(tx.amount),
                wallet_id: tx.wallet_id,
                to_wallet_id: tx.to_wallet_id,
                occurred_on: tx.occurred_on,
                note: tx.note,
              },
              wallets,
              user?.id,
            );
          }
        });
        batchDeleteTx.mutate(idsToDelete, {
          onSuccess: () => {
            setPendingDeletedIds((prev) => {
              const next = new Set(prev);
              idsToDelete.forEach((id) => next.delete(id));
              return next;
            });
          },
        });
      },
      5000,
      () => {
        setPendingDeletedIds((prev) => {
          const next = new Set(prev);
          idsToDelete.forEach((id) => next.delete(id));
          return next;
        });
      },
    );
  }, [
    selectedTxIds,
    handleExitSelectMode,
    showToast,
    batchDeleteTx,
    isIndonesian,
    allTxs,
    wallets,
    user?.id,
  ]);

  const handleDuplicateTransaction = useCallback((tx: Transaction) => {
    setEditingTx({
      ...tx,
      id: "",
      occurred_on: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
      created_at: new Date().toISOString(),
    });
    setSheetOpen(true);
  }, []);

  const { pullDistance, isRefreshing, threshold } = usePullToRefresh({
    onRefresh: async () => {
      await Promise.all([refetchTxs(), refetchWallets(), refetchCategories()]);
    },
  });

  const isDark =
    typeof document !== "undefined"
      ? document.documentElement.getAttribute("data-theme") !== "light"
      : true;
  const shouldRenderHeavy = useDeferredRender(150);

  const scrollParent = useMemo(
    () =>
      typeof document !== "undefined"
        ? document.getElementById("app-scroll-container")
        : null,
    [],
  );

  const resolveWalletNames = useCallback(
    (tx: Transaction) => resolveTransactionWallets(tx, walletMap),
    [walletMap],
  );

  const scopedTxs = useMemo(() => {
    const now = new Date();
    let txs = visibleTxs.filter((t) => !!t.occurred_on);

    if (timeRange === "this_month") {
      const startStr = format(startOfMonth(now), "yyyy-MM-dd");
      const endStr = format(endOfMonth(now), "yyyy-MM-dd");
      txs = txs.filter((t) => {
        const day = t.occurred_on.slice(0, 10);
        return day >= startStr && day <= endStr;
      });
    } else if (timeRange === "last_month") {
      const prev = subMonths(now, 1);
      const startStr = format(startOfMonth(prev), "yyyy-MM-dd");
      const endStr = format(endOfMonth(prev), "yyyy-MM-dd");
      txs = txs.filter((t) => {
        const day = t.occurred_on.slice(0, 10);
        return day >= startStr && day <= endStr;
      });
    } else if (timeRange === "last_30") {
      const startStr = format(subDays(now, 29), "yyyy-MM-dd");
      const endStr = format(now, "yyyy-MM-dd");
      txs = txs.filter((t) => {
        const day = t.occurred_on.slice(0, 10);
        return day >= startStr && day <= endStr;
      });
    } else if (timeRange === "custom_month") {
      txs = txs.filter((t) => t.occurred_on.startsWith(selectedCustomMonth));
    } else if (timeRange === "custom_range") {
      if (customStartDate) {
        const startDay = customStartDate.slice(0, 10);
        txs = txs.filter((t) => t.occurred_on.slice(0, 10) >= startDay);
      }
      if (customEndDate) {
        const endDay = customEndDate.slice(0, 10);
        txs = txs.filter((t) => t.occurred_on.slice(0, 10) <= endDay);
      }
    }

    return txs;
  }, [
    visibleTxs,
    timeRange,
    selectedCustomMonth,
    customStartDate,
    customEndDate,
  ]);

  // Filter & Search transactions within the active timeframe
  const filteredTxs = useMemo(() => {
    let txs =
      searchScope === "all" && deferredSearch.trim()
        ? visibleTxs.filter((t) => !!t.occurred_on)
        : scopedTxs;

    if (filter === "income") {
      txs = txs.filter((t) => t.type === "income" && !isTxCorrection(t));
    } else if (filter === "expense") {
      txs = txs.filter((t) => t.type === "expense" && !isTxCorrection(t));
    } else if (filter === "transfer") {
      txs = txs.filter((t) => t.type === "transfer");
    } else if (filter === "adjustment") {
      txs = txs.filter((t) => isTxCorrection(t));
    }

    if (selectedWalletName) {
      const target = selectedWalletName.toLowerCase();
      txs = txs.filter((t) => {
        const { from, to } = resolveWalletNames(t);
        return (
          from.toLowerCase() === target ||
          (t.type === "transfer" && to.toLowerCase() === target)
        );
      });
    }

    if (selectedCategoryIds.length > 0) {
      const catSet = new Set(selectedCategoryIds);
      txs = txs.filter((t) => t.category_id && catSet.has(t.category_id));
    }

    const minAmt = parseFloat(minAmount);
    if (!isNaN(minAmt) && minAmt > 0) {
      txs = txs.filter((t) => Number(t.amount || 0) >= minAmt);
    }

    const maxAmt = parseFloat(maxAmount);
    if (!isNaN(maxAmt) && maxAmt > 0) {
      txs = txs.filter((t) => Number(t.amount || 0) <= maxAmt);
    }

    const q = deferredSearch.toLowerCase().trim();
    if (q) {
      const digitsOnly = q.replace(/[^0-9]/g, "");
      txs = txs.filter((t) => {
        const { from, to } = resolveWalletNames(t);
        const catName =
          t.categories?.name ||
          (t.category_id ? categoryMap.get(t.category_id)?.name : "") ||
          "";
        const formattedAmount = formatCurrency(
          Number(t.amount || 0),
          preferredCurrency,
        ).toLowerCase();
        const amountStr = String(t.amount || "");

        const matchesText =
          (t.note && t.note.toLowerCase().includes(q)) ||
          catName.toLowerCase().includes(q) ||
          from.toLowerCase().includes(q) ||
          to.toLowerCase().includes(q);

        const matchesAmount =
          (digitsOnly.length > 0 && amountStr.includes(digitsOnly)) ||
          formattedAmount.includes(q) ||
          amountStr.includes(q);

        return matchesText || matchesAmount;
      });
    }
    return txs;
  }, [
    scopedTxs,
    visibleTxs,
    searchScope,
    filter,
    selectedWalletName,
    selectedCategoryIds,
    minAmount,
    maxAmount,
    deferredSearch,
    resolveWalletNames,
    categoryMap,
    preferredCurrency,
  ]);

  // Count matching transactions across all time
  const allTimeMatchCount = useMemo(() => {
    const q = deferredSearch.toLowerCase().trim();
    if (!q) return 0;
    const digitsOnly = q.replace(/[^0-9]/g, "");

    return visibleTxs.filter((t) => {
      if (!t.occurred_on) return false;
      const { from, to } = resolveWalletNames(t);
      const catName =
        t.categories?.name ||
        (t.category_id ? categoryMap.get(t.category_id)?.name : "") ||
        "";
      const formattedAmount = formatCurrency(
        Number(t.amount || 0),
        preferredCurrency,
      ).toLowerCase();
      const amountStr = String(t.amount || "");

      const matchesText =
        (t.note && t.note.toLowerCase().includes(q)) ||
        catName.toLowerCase().includes(q) ||
        from.toLowerCase().includes(q) ||
        to.toLowerCase().includes(q);

      const matchesAmount =
        (digitsOnly.length > 0 && amountStr.includes(digitsOnly)) ||
        formattedAmount.includes(q) ||
        amountStr.includes(q);

      return matchesText || matchesAmount;
    }).length;
  }, [deferredSearch, visibleTxs, resolveWalletNames, categoryMap, preferredCurrency]);

  // Count matching transactions in current period
  const currentPeriodMatchCount = useMemo(() => {
    const q = deferredSearch.toLowerCase().trim();
    if (!q) return 0;
    const digitsOnly = q.replace(/[^0-9]/g, "");

    return scopedTxs.filter((t) => {
      const { from, to } = resolveWalletNames(t);
      const catName =
        t.categories?.name ||
        (t.category_id ? categoryMap.get(t.category_id)?.name : "") ||
        "";
      const formattedAmount = formatCurrency(
        Number(t.amount || 0),
        preferredCurrency,
      ).toLowerCase();
      const amountStr = String(t.amount || "");

      const matchesText =
        (t.note && t.note.toLowerCase().includes(q)) ||
        catName.toLowerCase().includes(q) ||
        from.toLowerCase().includes(q) ||
        to.toLowerCase().includes(q);

      const matchesAmount =
        (digitsOnly.length > 0 && amountStr.includes(digitsOnly)) ||
        formattedAmount.includes(q) ||
        amountStr.includes(q);

      return matchesText || matchesAmount;
    }).length;
  }, [deferredSearch, scopedTxs, resolveWalletNames, categoryMap, preferredCurrency]);

  const filteredTxsByDay = useMemo(() => {
    const dayMap = new Map<string, Transaction[]>();
    const monthMap = new Map<string, Transaction[]>();

    filteredTxs.forEach((tx) => {
      const dayKey = tx.occurred_on ? tx.occurred_on.slice(0, 10) : "";
      const monthKey = tx.occurred_on ? tx.occurred_on.slice(0, 7) : "";

      const dayList = dayMap.get(dayKey);
      if (dayList) dayList.push(tx);
      else dayMap.set(dayKey, [tx]);

      const monthList = monthMap.get(monthKey);
      if (monthList) monthList.push(tx);
      else monthMap.set(monthKey, [tx]);
    });

    return { dayMap, monthMap };
  }, [filteredTxs]);

  const dynamicChartData = useMemo(() => {
    const now = new Date();
    const points: ChartPoint[] = [];

    if (timeRange === "custom_range") {
      if (
        customStartDate &&
        customEndDate &&
        customStartDate <= customEndDate
      ) {
        try {
          const start = parseISO(customStartDate);
          const end = parseISO(customEndDate);
          const intervalDays = eachDayOfInterval({ start, end });
          if (intervalDays.length <= 62) {
            intervalDays.forEach((d) => {
              const dateStr = format(d, "yyyy-MM-dd");
              const totals = summarizeTransactionsForChart(
                filteredTxsByDay.dayMap.get(dateStr) || [],
                filter,
                isTxCorrection,
              );
              points.push({ dateStr, label: format(d, "d MMM"), ...totals });
            });
            return points;
          } else if (intervalDays.length <= 180) {
            const weeks = eachWeekOfInterval(
              { start, end },
              { weekStartsOn: 1 },
            );
            weeks.forEach((weekStart) => {
              const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
              const actualEnd = weekEnd > end ? end : weekEnd;
              const actualStart = weekStart < start ? start : weekStart;
              const weekDays = eachDayOfInterval({
                start: actualStart,
                end: actualEnd,
              });
              const weekTxs: Transaction[] = [];
              weekDays.forEach((d) => {
                const dateStr = format(d, "yyyy-MM-dd");
                const dayTxs = filteredTxsByDay.dayMap.get(dateStr);
                if (dayTxs) weekTxs.push(...dayTxs);
              });
              const totals = summarizeTransactionsForChart(
                weekTxs,
                filter,
                isTxCorrection,
              );
              points.push({
                dateStr: format(actualStart, "yyyy-MM-dd"),
                label: `${format(actualStart, "d/M")}-${format(actualEnd, "d/M")}`,
                ...totals,
              });
            });
            return points;
          } else {
            const months = eachMonthOfInterval({ start, end });
            months.forEach((monthDate) => {
              const monthKey = format(monthDate, "yyyy-MM");
              const totals = summarizeTransactionsForChart(
                filteredTxsByDay.monthMap.get(monthKey) || [],
                filter,
                isTxCorrection,
              );
              points.push({
                dateStr: monthKey,
                label: format(monthDate, "MMM yy"),
                ...totals,
              });
            });
            return points;
          }
        } catch {
          // fallback
        }
      }
    }

    if (
      timeRange === "this_month" ||
      timeRange === "last_month" ||
      timeRange === "custom_month"
    ) {
      let targetMonthDate = now;
      if (timeRange === "last_month") targetMonthDate = subMonths(now, 1);
      else if (timeRange === "custom_month") {
        try {
          targetMonthDate = parse(selectedCustomMonth, "yyyy-MM", new Date());
        } catch {
          targetMonthDate = now;
        }
      }

      const start = startOfMonth(targetMonthDate);
      const end = endOfMonth(targetMonthDate);
      eachDayOfInterval({ start, end }).forEach((d) => {
        const dateStr = format(d, "yyyy-MM-dd");
        const totals = summarizeTransactionsForChart(
          filteredTxsByDay.dayMap.get(dateStr) || [],
          filter,
          isTxCorrection,
        );
        points.push({ dateStr, label: format(d, "d"), ...totals });
      });
      return points;
    }

    if (timeRange === "last_30") {
      for (let i = 29; i >= 0; i--) {
        const d = subDays(now, i);
        const dateStr = format(d, "yyyy-MM-dd");
        const totals = summarizeTransactionsForChart(
          filteredTxsByDay.dayMap.get(dateStr) || [],
          filter,
          isTxCorrection,
        );
        points.push({ dateStr, label: format(d, "d"), ...totals });
      }
      return points;
    }

    if (filteredTxs.length === 0) return [];

    const earliestDate = filteredTxs.reduce(
      (min, tx) => (tx.occurred_on < min ? tx.occurred_on : min),
      filteredTxs[0].occurred_on,
    );
    const earliestMonth = new Date(`${earliestDate.slice(0, 7)}-01T00:00:00`);
    const totalMonths =
      (now.getFullYear() - earliestMonth.getFullYear()) * 12 +
      (now.getMonth() - earliestMonth.getMonth()) +
      1;

    for (let i = 0; i < totalMonths; i++) {
      const monthDate = new Date(
        earliestMonth.getFullYear(),
        earliestMonth.getMonth() + i,
        1,
      );
      const monthKey = format(monthDate, "yyyy-MM");
      const totals = summarizeTransactionsForChart(
        filteredTxsByDay.monthMap.get(monthKey) || [],
        filter,
        isTxCorrection,
      );
      points.push({
        dateStr: monthKey,
        label:
          totalMonths > 12
            ? format(monthDate, "MMM yy")
            : format(monthDate, "MMM"),
        ...totals,
      });
    }

    return points;
  }, [
    filteredTxs,
    filteredTxsByDay,
    filter,
    timeRange,
    selectedCustomMonth,
    customStartDate,
    customEndDate,
  ]);

  const totalPeriodAmount = useMemo(() => {
    return dynamicChartData.reduce((s, d) => s + d.activeValue, 0);
  }, [dynamicChartData]);

  // Group by date using all filteredTxs
  const { groupKeys, groupedTxs, groupCounts, flatTxs } = useMemo(() => {
    const g: Record<string, Transaction[]> = {};
    filteredTxs.forEach((tx) => {
      const dateKey = tx.occurred_on
        ? tx.occurred_on.slice(0, 10)
        : "Unknown";
      if (!g[dateKey]) g[dateKey] = [];
      g[dateKey].push(tx);
    });

    const keys = Object.keys(g);
    const counts = keys.map((k) => g[k].length);
    const flat = keys.flatMap((k) => g[k]);

    return {
      groupKeys: keys,
      groupedTxs: g,
      groupCounts: counts,
      flatTxs: flat,
    };
  }, [filteredTxs]);

  const filterTabs: { key: FilterType; label: string }[] = useMemo(
    () => [
      { key: "all", label: isIndonesian ? "Semua" : "All" },
      { key: "expense", label: isIndonesian ? "Pengeluaran" : "Outflow" },
      { key: "income", label: isIndonesian ? "Pemasukan" : "Inflow" },
      { key: "transfer", label: "Transfer" },
      { key: "adjustment", label: isIndonesian ? "Koreksi" : "Correction" },
    ],
    [isIndonesian],
  );

  const maxBar = Math.max(...dynamicChartData.map((d) => d.activeValue), 1);

  const selectedMonthLabel = useMemo(() => {
    if (timeRange === "this_month")
      return isIndonesian ? "Bulan Ini" : "This Month";
    if (timeRange === "last_month")
      return isIndonesian ? "Bulan Lalu" : "Last Month";
    if (timeRange === "last_30")
      return isIndonesian ? "30 Hari Terakhir" : "Last 30 Days";
    if (timeRange === "all") return isIndonesian ? "Semua Waktu" : "All Time";
    if (timeRange === "custom_range") {
      if (customStartDate && customEndDate) {
        try {
          const s = parseISO(customStartDate);
          const e = parseISO(customEndDate);
          return `${format(s, "d MMM")} - ${format(e, "d MMM")}`;
        } catch {
          return isIndonesian ? "Rentang Kustom" : "Custom Range";
        }
      }
      return isIndonesian ? "Rentang Kustom" : "Custom Range";
    }
    try {
      const parsed = parse(selectedCustomMonth, "yyyy-MM", new Date());
      return format(parsed, "MMMM yyyy");
    } catch {
      return isIndonesian ? "Bulan Kustom" : "Custom Month";
    }
  }, [
    timeRange,
    selectedCustomMonth,
    customStartDate,
    customEndDate,
    isIndonesian,
  ]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filter !== "all") count++;
    if (selectedWalletName) count++;
    if (selectedCategoryIds.length > 0) count += selectedCategoryIds.length;
    if (minAmount.trim()) count++;
    if (maxAmount.trim()) count++;
    if (timeRange === "custom_range") count++;
    else if (timeRange !== "this_month") count++;
    return count;
  }, [
    filter,
    selectedWalletName,
    selectedCategoryIds,
    minAmount,
    maxAmount,
    timeRange,
  ]);

  const handleResetAllFilters = useCallback(() => {
    setFilter("all");
    setSelectedWalletName(null);
    setSelectedCategoryIds([]);
    setMinAmount("");
    setMaxAmount("");
    setTimeRange("this_month");
    setCustomStartDate("");
    setCustomEndDate("");
    setSearch("");
    setSearchScope("current");
    triggerHaptic("medium");
  }, []);

  const handleSelectAllOrNone = useCallback(() => {
    triggerHaptic("light");
    if (selectedTxIds.size === visibleTxs.length && visibleTxs.length > 0) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(visibleTxs.map((t) => t.id)));
    }
  }, [selectedTxIds.size, visibleTxs]);

  return (
    <div
      className="min-h-screen relative select-none pb-36 max-w-lg sm:max-w-xl mx-auto"
      style={{ background: "var(--bg-base)" }}
    >
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
        threshold={threshold}
      />

      {/* ====== HEADER & FILTERS ====== */}
      <div className="px-4 sm:px-5 pt-2 pb-2">
        <AnimatePresence initial={false}>
          {!isSearchFocused && !search.trim() && (
            <motion.div
              key="horizon-chart-container"
              initial={{ opacity: 1, height: "auto" }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden mb-2"
            >
              <TransactionHorizonBarChart
                filter={filter}
                selectedMonthLabel={selectedMonthLabel}
                totalPeriodAmount={totalPeriodAmount}
                dynamicChartData={dynamicChartData}
                maxBar={maxBar}
                isStealthMode={isStealthMode}
                toggleStealthMode={toggleStealthMode}
                onOpenMonthPicker={() => setMonthPickerOpen(true)}
                draftCount={draftCount}
                allDraftItems={allDraftItems}
                onOpenBatchReview={onOpenBatchReview}
                clearAllDrafts={clearAllDrafts}
                activeSpaceId={activeSpaceId}
                activeSpaceName={activeSpace.name}
                visibleTxsCount={visibleTxs.length}
                onResetActiveSpace={() => setActiveSpaceId("all")}
                shouldRenderHeavy={shouldRenderHeavy}
                isDark={isDark}
                isIndonesian={isIndonesian}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic Sticky Search & Filter Container (Zero Glow, Liquid Glass) */}
        <div
          className={`transition-all duration-200 ${
            isSearchFocused || search.trim()
              ? "sticky top-0 z-30 pt-2 pb-1.5 backdrop-blur-2xl bg-[var(--bg-base)]/85 border-b border-[var(--glass-border)]/40"
              : ""
          }`}
        >
          <TransactionFilterBar
            search={search}
            onSearchChange={handleSearchChange}
            isSearchFocused={isSearchFocused}
            onFocusSearch={() => setIsSearchFocused(true)}
            onBlurSearch={() => setIsSearchFocused(false)}
            onClearSearch={handleClearSearch}
            searchScope={searchScope}
            onSearchScopeChange={setSearchScope}
            currentScopeCount={currentPeriodMatchCount}
            allTimeScopeCount={allTimeMatchCount}
            filter={filter}
            onFilterChange={setFilter}
            filterTabs={filterTabs}
            activeFiltersCount={activeFiltersCount}
            onOpenFilterSheet={() => setFilterSheetOpen(true)}
            isSelectMode={isSelectMode}
            onToggleSelectMode={() => {
              if (isSelectMode) {
                handleExitSelectMode();
              } else {
                setIsSelectMode(true);
              }
            }}
            timeRange={timeRange}
            selectedMonthLabel={selectedMonthLabel}
            onResetTimeRange={() => {
              setTimeRange("this_month");
              setCustomStartDate("");
              setCustomEndDate("");
              triggerHaptic("light");
            }}
            selectedWalletName={selectedWalletName}
            onResetWallet={() => {
              setSelectedWalletName(null);
              triggerHaptic("light");
            }}
            selectedCategoryIds={selectedCategoryIds}
            categories={categories}
            onRemoveCategory={(cid) => {
              setSelectedCategoryIds((prev) => prev.filter((id) => id !== cid));
              triggerHaptic("light");
            }}
            minAmount={minAmount}
            maxAmount={maxAmount}
            onResetAmount={() => {
              setMinAmount("");
              setMaxAmount("");
              triggerHaptic("light");
            }}
            onResetAllFilters={handleResetAllFilters}
            isIndonesian={isIndonesian}
          />
        </div>
      </div>

      {/* ====== TRANSACTION LIST ====== */}
      <div
        className="px-4 sm:px-5 pb-36 space-y-4"
        onTouchMove={() => {
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
        }}
        onWheel={() => {
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
        }}
      >
        {isLoading || !shouldRenderHeavy ? (
          <div className="space-y-2 pt-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-15 rounded-2xl animate-pulse"
                style={{
                  background: isDark
                    ? "linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)"
                    : "linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 247, 250, 0.90) 100%)",
                  border: isDark
                    ? "1px solid rgba(255, 255, 255, 0.08)"
                    : "1px solid rgba(0, 0, 0, 0.06)",
                }}
              />
            ))}
          </div>
        ) : groupKeys.length === 0 ? (
          <div className="py-14 px-4 flex flex-col items-center justify-center text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
              style={{
                background: isDark
                  ? "linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)"
                  : "linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 247, 250, 0.90) 100%)",
                border: isDark
                  ? "1px solid rgba(255, 255, 255, 0.08)"
                  : "1px solid rgba(0, 0, 0, 0.06)",
                boxShadow: isDark
                  ? "0 8px 24px -4px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)"
                  : "0 4px 14px -4px rgba(31, 36, 48, 0.04), inset 0 1px 0 #ffffff",
                color: "var(--text-tertiary)",
              }}
            >
              <Inbox size={22} strokeWidth={1.75} />
            </div>
            <p
              className="text-[13.5px] font-semibold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {search
                ? isIndonesian
                  ? "Tidak ada transaksi yang cocok"
                  : "No matching transactions found"
                : isIndonesian
                  ? "Tidak ada transaksi pada periode ini"
                  : "No transactions recorded in this period"}
            </p>
            <p
              className="text-[11.5px] mt-0.5 max-w-[260px] leading-relaxed"
              style={{ color: "var(--text-tertiary)" }}
            >
              {search
                ? t(
                    "transactions.emptySearch",
                    "Try searching with different keywords or adjust your filters.",
                  )
                : t(
                    "transactions.emptyFresh",
                    "Start managing your finances by logging your expenses and income.",
                  )}
            </p>
            {search && searchScope === "current" && allTimeMatchCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setSearchScope("all");
                }}
                className="mt-3.5 h-8 px-4 rounded-full text-[11.5px] font-semibold transition-all active:scale-95 cursor-pointer select-none"
                style={{
                  background: isDark
                    ? "linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)"
                    : "linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 247, 250, 0.90) 100%)",
                  border: isDark
                    ? "1px solid rgba(255, 255, 255, 0.08)"
                    : "1px solid rgba(0, 0, 0, 0.06)",
                }}
              >
                {isIndonesian
                  ? `Cari di Semua Waktu (${allTimeMatchCount})`
                  : `Search All Time (${allTimeMatchCount})`}
              </button>
            )}
          </div>
        ) : (
          <GroupedVirtuoso
            customScrollParent={scrollParent || undefined}
            computeItemKey={(index) => flatTxs[index]?.id || String(index)}
            groupCounts={groupCounts}
            groupContent={(index) => {
              const dateKey = groupKeys[index];
              const txs = groupedTxs[dateKey];
              const dayTotal = txs.reduce((s, t) => {
                if (t.type === "income") return s + Number(t.amount);
                if (t.type === "expense") return s - Number(t.amount);
                return s;
              }, 0);
              return (
                <div
                  className="flex justify-between items-center px-1 pb-1.5 pt-3.5"
                  style={{ background: "var(--bg-base)" }}
                >
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {getDateLabel(dateKey)}
                  </span>
                  <span
                    className="text-[11.5px] font-bold amount tabular-nums"
                    style={{
                      color:
                        dayTotal >= 0
                          ? "var(--text-primary)"
                          : "var(--text-tertiary)",
                    }}
                  >
                    {isStealthMode ? (
                      `${currencyMeta.symbol} ••••••••`
                    ) : (
                      <>
                        {dayTotal > 0 ? "+" : ""}
                        {formatCurrency(dayTotal, preferredCurrency)}
                      </>
                    )}
                  </span>
                </div>
              );
            }}
            itemContent={(index) => {
              const tx = flatTxs[index];
              const { from, to } = resolveWalletNames(tx);
              const isUnusual = checkUnusual(tx).isUnusual;
              return (
                <div className="pb-1.5">
                  <TransactionItem
                    tx={tx}
                    categories={categories}
                    categoryMap={categoryMap}
                    fromWalletName={from}
                    toWalletName={to}
                    isUnusual={isUnusual}
                    isSelectMode={isSelectMode}
                    isSelected={selectedTxIds.has(tx.id)}
                    onClick={handleItemClick}
                    onDelete={handleDeleteTransaction}
                    onDuplicate={handleDuplicateTransaction}
                    onToggleSelect={handleToggleSelect}
                    onLongPress={handleEnterSelectMode}
                  />
                </div>
              );
            }}
          />
        )}
      </div>

      {/* Floating Bulk Action Bar */}
      <TransactionBatchActionBar
        isSelectMode={isSelectMode}
        selectedCount={selectedTxIds.size}
        totalVisibleCount={visibleTxs.length}
        onSelectAllOrNone={handleSelectAllOrNone}
        onBulkDelete={handleBulkDelete}
        onExitSelectMode={handleExitSelectMode}
        isIndonesian={isIndonesian}
      />

      {/* Bottom Sheets and Modals Container */}
      <TransactionModalsContainer
        monthPickerOpen={monthPickerOpen}
        onCloseMonthPicker={() => setMonthPickerOpen(false)}
        timeRange={timeRange}
        setTimeRange={setTimeRange}
        pickerYear={pickerYear}
        setPickerYear={setPickerYear}
        selectedCustomMonth={selectedCustomMonth}
        setSelectedCustomMonth={setSelectedCustomMonth}
        monthsList={MONTHS_LIST}
        accountPickerOpen={accountPickerOpen}
        onCloseAccountPicker={() => setAccountPickerOpen(false)}
        selectedWalletName={selectedWalletName}
        setSelectedWalletName={setSelectedWalletName}
        wallets={wallets}
        filterSheetOpen={filterSheetOpen}
        onCloseFilterSheet={() => setFilterSheetOpen(false)}
        activeFiltersCount={activeFiltersCount}
        onResetAllFilters={handleResetAllFilters}
        filter={filter}
        setFilter={setFilter}
        filterTabs={filterTabs}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
        categories={categories}
        selectedCategoryIds={selectedCategoryIds}
        setSelectedCategoryIds={setSelectedCategoryIds}
        minAmount={minAmount}
        setMinAmount={setMinAmount}
        maxAmount={maxAmount}
        setMaxAmount={setMaxAmount}
        filteredTxsCount={filteredTxs.length}
        sheetOpen={sheetOpen}
        onCloseSheet={() => {
          setSheetOpen(false);
          setEditingTx(null);
        }}
        editingTx={editingTx}
        onOpenScan={_onOpenScan}
        onOpenVoiceAdd={() => {
          setSheetOpen(false);
          setEditingTx(null);
          _onOpenVoiceAdd?.();
        }}
        isIndonesian={isIndonesian}
      />

      {/* Bottom padding for tabbar */}
      <div className="h-6" />
    </div>
  );
}
