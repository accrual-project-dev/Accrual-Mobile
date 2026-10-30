import { useState, useEffect, useMemo } from "react";
import {
  Check,
  Sparkles,
  AlertCircle,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  CheckSquare,
  Square,
  Bookmark,
  ChevronRight,
  X,
  Search,
  CreditCard,
  PenLine,
  Trash2,
} from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { IconRenderer } from "../ui/IconRenderer";
import type { Category, Wallet, TransactionType } from "../../lib/types";
import type { ParsedStatementItem } from "../../lib/statementParser";
import { useCurrency } from "../../contexts/CurrencyContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import { triggerHaptic, triggerSuccessHaptic } from "../../lib/haptics";
import { useBills, useMarkBillPaid } from "../../hooks/useBills";
import { useWalletBalances } from "../../hooks/useWalletBalances";
import { saveMerchantMemory } from "../../lib/merchantCategoryMemory";
import { findBestMatchingBill } from "../../lib/billMatchingEngine";
import { formatLiveAmountInput } from "../../lib/utils";

interface BatchTransactionReviewSheetProps {
  isOpen: boolean;
  onClose: () => void;
  items: ParsedStatementItem[];
  categories: Category[];
  wallets: Wallet[];
  onConfirmBatch: (items: ParsedStatementItem[]) => Promise<void>;
  onSaveDraft: (items: ParsedStatementItem[]) => void;
  sourceTitle?: string;
}

export function BatchTransactionReviewSheet({
  isOpen,
  onClose,
  items: initialItems,
  categories,
  wallets,
  onConfirmBatch,
  onSaveDraft,
  sourceTitle,
}: BatchTransactionReviewSheetProps) {
  const { isIndonesian } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const { formatWithPreferred, currencyMeta } = useCurrency();

  const { data: bills = [] } = useBills();
  const markBillPaid = useMarkBillPaid();
  const { balancesById } = useWalletBalances();

  const [items, setItems] = useState<ParsedStatementItem[]>(initialItems);
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Full Edit Modal State
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editAmountDisplay, setEditAmountDisplay] = useState("");
  const [editAmountRaw, setEditAmountRaw] = useState<number>(0);
  const [editNote, setEditNote] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");

  // Category picker sheet state
  const [activeItemForCategory, setActiveItemForCategory] = useState<
    string | null
  >(null);
  const [searchCategoryQuery, setSearchCategoryQuery] = useState("");

  // Wallet picker sheet state
  const [activeItemForWallet, setActiveItemForWallet] = useState<{
    itemId: string;
    field: "walletId" | "destinationWalletId";
  } | null>(null);
  const [searchWalletQuery, setSearchWalletQuery] = useState("");

  // Sync state when initialItems change or sheet opens
  useEffect(() => {
    if (isOpen && initialItems.length > 0) {
      setItems(initialItems);
      const selMap: Record<string, boolean> = {};
      initialItems.forEach((it) => {
        selMap[it.id] = it.selected;
      });
      setSelectedMap(selMap);
      setEditingItemId(null);
    }
  }, [isOpen, initialItems]);

  // Evaluate bills match if not already attached
  useEffect(() => {
    if (bills && bills.length > 0) {
      setItems((prev) =>
        prev.map((it) => {
          if (it.matchedBill) return it;
          const match = findBestMatchingBill(
            it.cleanDescription,
            it.amount,
            bills,
          );
          if (match) {
            return {
              ...it,
              matchedBill: {
                id: match.bill.id,
                title: match.bill.title,
                amount: match.bill.amount,
                exactAmountMatch: match.exactAmountMatch,
                confirmedPaid: true,
              },
            };
          }
          return it;
        }),
      );
    }
  }, [bills]);

  const editingItem = useMemo(
    () => items.find((it) => it.id === editingItemId) || null,
    [items, editingItemId],
  );

  const openEditModal = (it: ParsedStatementItem) => {
    triggerHaptic("light");
    setEditingItemId(it.id);
    const parsedAmt = formatLiveAmountInput(
      String(Math.round(it.amount || 0)),
      isIndonesian,
      false,
      0,
    );
    setEditAmountDisplay(parsedAmt.display);
    setEditAmountRaw(parsedAmt.rawNumber);

    // If cleanDescription is just a generic fallback, show empty note in the editor
    const rawDesc = (it.cleanDescription ?? it.description ?? "").trim();
    const catLower = (it.suggestedCategoryName || "").trim().toLowerCase();
    const walLower = (it.walletName || "").trim().toLowerCase();
    const isFallbackDesc =
      !rawDesc ||
      rawDesc.toLowerCase() === "pengeluaran" ||
      rawDesc.toLowerCase() === "expense" ||
      rawDesc.toLowerCase() === "dana masuk" ||
      rawDesc.toLowerCase() === "income" ||
      rawDesc.toLowerCase() === catLower ||
      rawDesc.toLowerCase() === `${catLower}${walLower}`;

    setEditNote(isFallbackDesc ? "" : rawDesc);
    setEditDate(it.date || new Date().toISOString().slice(0, 10));
    setEditTime((it.time || "12:00").slice(0, 5));
  };

  const handleSaveEditModal = () => {
    if (!editingItemId) return;
    triggerSuccessHaptic();
    const cleanNote = editNote.trim();
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== editingItemId) return it;
        return {
          ...it,
          amount: editAmountRaw > 0 ? editAmountRaw : it.amount,
          description: cleanNote,
          cleanDescription: cleanNote,
          date: editDate || it.date,
          time: editTime || it.time,
          needsReview: false,
          captureTimestampConfirmed: true,
        };
      }),
    );
    setSelectedMap((prev) => ({ ...prev, [editingItemId]: true }));
    setEditingItemId(null);
  };

  const handleDeleteReviewItem = (id: string) => {
    triggerHaptic("medium");
    setItems((prev) => prev.filter((it) => it.id !== id));
    setSelectedMap((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (editingItemId === id) {
      setEditingItemId(null);
    }
  };

  const selectedCount = useMemo(() => {
    return items.filter((it) => selectedMap[it.id]).length;
  }, [items, selectedMap]);

  const totalSelectedAmount = useMemo(() => {
    return items
      .filter((it) => selectedMap[it.id] && it.type === "expense")
      .reduce((acc, it) => acc + it.amount, 0);
  }, [items, selectedMap]);

  const allSelected = items.length > 0 && selectedCount === items.length;

  const handleToggleAll = () => {
    triggerHaptic("light");
    const nextState = !allSelected;
    const nextMap: Record<string, boolean> = {};
    items.forEach((it) => {
      nextMap[it.id] = nextState;
    });
    setSelectedMap(nextMap);
  };

  const handleToggleItem = (id: string) => {
    triggerHaptic("light");
    setSelectedMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleToggleType = (id: string, targetType?: TransactionType) => {
    triggerHaptic("light");
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        if (targetType) return { ...it, type: targetType };
        let nextType: TransactionType = "expense";
        if (it.type === "expense") nextType = "income";
        else if (it.type === "income") nextType = "transfer";
        else nextType = "expense";
        return { ...it, type: nextType };
      }),
    );
  };

  const handleToggleBillPaid = (id: string) => {
    triggerHaptic("light");
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id || !it.matchedBill) return it;
        return {
          ...it,
          matchedBill: {
            ...it.matchedBill,
            confirmedPaid: !it.matchedBill.confirmedPaid,
          },
        };
      }),
    );
  };

  const handleSelectCategory = (cat: Category) => {
    if (!activeItemForCategory) return;
    triggerHaptic("light");
    const targetItem = items.find((it) => it.id === activeItemForCategory);
    if (targetItem && targetItem.cleanDescription) {
      saveMerchantMemory(targetItem.cleanDescription, cat.id, cat.name);
    }
    setItems((prev) =>
      prev.map((it) =>
        it.id === activeItemForCategory
          ? {
              ...it,
              suggestedCategoryId: cat.id,
              suggestedCategoryName: cat.name,
              suggestedCategoryEmoji: cat.emoji,
              needsReview: false,
              confidence: 0.95,
            }
          : it,
      ),
    );
    setActiveItemForCategory(null);
    setSearchCategoryQuery("");
  };

  const handleSelectWallet = (selectedWallet: Wallet) => {
    if (!activeItemForWallet) return;
    triggerHaptic("light");
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== activeItemForWallet.itemId) return it;
        if (activeItemForWallet.field === "walletId") {
          return {
            ...it,
            walletId: selectedWallet.id,
            walletName: selectedWallet.name,
          };
        } else {
          return {
            ...it,
            destinationWalletId: selectedWallet.id,
            destinationWalletName: selectedWallet.name,
          };
        }
      }),
    );
    setActiveItemForWallet(null);
    setSearchWalletQuery("");
  };

  const activeCategoryItem = useMemo(() => {
    return items.find((it) => it.id === activeItemForCategory);
  }, [items, activeItemForCategory]);

  const filteredCategories = useMemo(() => {
    if (!activeCategoryItem) return categories;
    const isIncome = activeCategoryItem.type === "income";
    const typeCats = categories.filter((c) =>
      isIncome ? c.type === "income" : c.type !== "income",
    );
    const pool = typeCats.length > 0 ? typeCats : categories;
    if (!searchCategoryQuery.trim()) return pool;
    const q = searchCategoryQuery.trim().toLowerCase();
    return pool.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, activeCategoryItem, searchCategoryQuery]);

  const activeWalletItem = useMemo(() => {
    return items.find((it) => it.id === activeItemForWallet?.itemId);
  }, [items, activeItemForWallet]);

  const filteredWallets = useMemo(() => {
    if (!searchWalletQuery.trim()) return wallets;
    const q = searchWalletQuery.trim().toLowerCase();
    return wallets.filter((w) => w.name.toLowerCase().includes(q));
  }, [wallets, searchWalletQuery]);

  const handleApprove = async () => {
    const selectedItems = items.filter((it) => selectedMap[it.id]);
    if (selectedItems.length === 0) return;

    try {
      setIsSubmitting(true);
      triggerSuccessHaptic();

      for (const item of selectedItems) {
        if (item.matchedBill?.confirmedPaid && bills.length > 0) {
          const targetBill = bills.find((b) => b.id === item.matchedBill?.id);
          if (targetBill) {
            try {
              await markBillPaid.mutateAsync({
                bill: targetBill,
                paid: true,
                recordTransaction: false,
              });
            } catch (billErr) {
              console.warn(
                "[BatchReview] Failed to auto-settle bill:",
                billErr,
              );
            }
          }
        }
      }

      await onConfirmBatch(selectedItems);
      onClose();
    } catch (err) {
      console.error("[BatchReview] Confirm batch failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveToDraft = () => {
    const selectedItems = items.filter((it) => selectedMap[it.id]);
    const itemsToDraft = selectedItems.length > 0 ? selectedItems : items;
    triggerSuccessHaptic();
    onSaveDraft(itemsToDraft);
    onClose();
  };

  // ── Clean Apple Liquid Glass Tokens ──
  const buttonGlassBg = isDark
    ? "rgba(255, 255, 255, 0.05)"
    : "rgba(0, 0, 0, 0.035)";

  const buttonGlassBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.08)"
    : "1px solid rgba(0, 0, 0, 0.06)";

  const hairlineDivider = isDark
    ? "rgba(255, 255, 255, 0.08)"
    : "rgba(0, 0, 0, 0.06)";

  return (
    <>
      <BottomSheet isOpen={isOpen} onClose={onClose}>
        <div
          className="px-4 pt-2.5 pb-[max(calc(env(safe-area-inset-bottom,0px)+16px),24px)] max-w-lg mx-auto select-none font-sans"
          style={{ color: "var(--text-primary)" }}
        >
          {/* ── 1. Header Bar ── */}
          <div
            className="flex items-center justify-between pb-3 mb-3 border-b"
            style={{ borderColor: hairlineDivider }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: buttonGlassBg,
                  border: buttonGlassBorder,
                  color: "var(--text-primary)",
                }}
              >
                <Sparkles size={14} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <h3 className="text-[14.5px] font-bold tracking-tight text-[var(--text-primary)] truncate leading-tight">
                  {isIndonesian ? "Tinjau & Edit Transaksi" : "Review & Edit Transactions"}
                </h3>
                <p className="text-[10.5px] text-[var(--text-tertiary)] truncate mt-0.5">
                  {sourceTitle ||
                    (isIndonesian ? "Tangkapan Pintasan" : "Shortcut Captures")}
                  {" · "}
                  {items.length} {isIndonesian ? "item" : "items"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-colors active:scale-90"
              style={{
                background: buttonGlassBg,
                border: buttonGlassBorder,
                color: "var(--text-tertiary)",
              }}
            >
              <X size={13} strokeWidth={2} />
            </button>
          </div>

          {/* ── 2. Multi-Select Control Bar ── */}
          <div className="flex items-center justify-between mb-2.5 px-1">
            <button
              type="button"
              onClick={handleToggleAll}
              className="flex items-center gap-1.5 text-[11.5px] font-semibold transition-opacity cursor-pointer hover:opacity-80 active:scale-95"
              style={{ color: "var(--text-secondary)" }}
            >
              {allSelected ? (
                <CheckSquare
                  size={14}
                  strokeWidth={2}
                  className="text-[var(--text-primary)]"
                />
              ) : (
                <Square
                  size={14}
                  strokeWidth={2}
                  className="text-[var(--text-tertiary)]"
                />
              )}
              <span>
                {allSelected
                  ? isIndonesian
                    ? "Batal Pilih Semua"
                    : "Deselect All"
                  : isIndonesian
                  ? "Pilih Semua"
                  : "Select All"}
              </span>
            </button>

            <span className="text-[10.5px] font-medium text-[var(--text-tertiary)] tabular-nums">
              {selectedCount}/{items.length}{" "}
              {isIndonesian ? "dipilih" : "selected"}
              {totalSelectedAmount > 0
                ? ` · ${formatWithPreferred(totalSelectedAmount)}`
                : ""}
            </span>
          </div>

          {/* ── 3. Transaction List Cards ── */}
          <div className="space-y-2 mb-3.5 flex-1 min-h-0 pb-3">
            {items.map((it) => {
              const isSelected = Boolean(selectedMap[it.id]);
              const isOutflow = it.type === "expense";
              const isTransfer = it.type === "transfer";

              const rawNote = (it.cleanDescription ?? it.description ?? "").trim();
              const catNameLower = (it.suggestedCategoryName || "").trim().toLowerCase();
              const walNameLower = (it.walletName || "").trim().toLowerCase();
              const hasRealNote =
                Boolean(rawNote) &&
                rawNote.toLowerCase() !== "pengeluaran" &&
                rawNote.toLowerCase() !== "expense" &&
                rawNote.toLowerCase() !== "dana masuk" &&
                rawNote.toLowerCase() !== "income" &&
                rawNote.toLowerCase() !== catNameLower &&
                rawNote.toLowerCase() !== `${catNameLower}${walNameLower}`;

              const displayTitle = hasRealNote
                ? rawNote
                : it.suggestedCategoryName ||
                  (isTransfer
                    ? "Transfer"
                    : isOutflow
                    ? isIndonesian
                      ? "Pengeluaran"
                      : "Expense"
                    : isIndonesian
                    ? "Pemasukan"
                    : "Income");

              return (
                <div
                  key={it.id}
                  onClick={() => handleToggleItem(it.id)}
                  className="p-3 rounded-2xl transition-all cursor-pointer select-none"
                  style={{
                    background: isSelected
                      ? isDark
                        ? "linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)"
                        : "linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 247, 250, 0.90) 100%)"
                      : isDark
                      ? "rgba(255, 255, 255, 0.02)"
                      : "rgba(0, 0, 0, 0.015)",
                    border: isSelected
                      ? isDark
                        ? "1px solid rgba(255, 255, 255, 0.12)"
                        : "1px solid rgba(0, 0, 0, 0.09)"
                      : isDark
                      ? "1px solid rgba(255, 255, 255, 0.05)"
                      : "1px solid rgba(0, 0, 0, 0.04)",
                    opacity: isSelected ? 1 : 0.55,
                  }}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Checkbox */}
                    <div
                      className="mt-0.5 w-4.5 h-4.5 rounded-md flex items-center justify-center shrink-0 transition-colors"
                      style={{
                        background: isSelected
                          ? isDark
                            ? "#ffffff"
                            : "#18181b"
                          : "transparent",
                        border: isSelected
                          ? "none"
                          : isDark
                          ? "1.5px solid rgba(255, 255, 255, 0.25)"
                          : "1.5px solid rgba(0, 0, 0, 0.2)",
                        color: isSelected
                          ? isDark
                            ? "#000000"
                            : "#ffffff"
                          : "transparent",
                      }}
                    >
                      {isSelected && <Check size={11} strokeWidth={3} />}
                    </div>

                    {/* Transaction Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(it);
                          }}
                          className="min-w-0 flex-1 flex items-center gap-1.5"
                        >
                          <p
                            className="text-[12.5px] font-bold truncate leading-tight tracking-tight"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {displayTitle}
                          </p>
                          {!hasRealNote && (
                            <span
                              className="text-[9.5px] font-normal shrink-0"
                              style={{ color: "var(--text-tertiary)" }}
                            >
                              ({isIndonesian ? "Tanpa catatan" : "No note"})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(it);
                            }}
                            className="text-[13px] font-bold tracking-tight tabular-nums cursor-pointer hover:underline"
                            style={{
                              color: isOutflow
                                ? "var(--text-primary)"
                                : "var(--text-secondary)",
                            }}
                          >
                            {isOutflow ? "−" : "+"}
                            {formatWithPreferred(it.amount)}
                          </button>

                          {/* Explicit Edit Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(it);
                            }}
                            className="h-6 px-2 rounded-lg text-[10px] font-semibold flex items-center gap-1 cursor-pointer active:scale-95 transition-transform"
                            style={{
                              background: buttonGlassBg,
                              border: buttonGlassBorder,
                              color: "var(--text-primary)",
                            }}
                            title={isIndonesian ? "Edit Transaksi" : "Edit Transaction"}
                          >
                            <PenLine size={10} strokeWidth={2} />
                            <span>{isIndonesian ? "Edit" : "Edit"}</span>
                          </button>
                        </div>
                      </div>

                      {/* Metadata & Quick Micro-Pills */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {/* Type Toggle Pill */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleType(it.id);
                          }}
                          className="h-5.5 px-2 rounded-full text-[9.5px] font-semibold flex items-center gap-1 cursor-pointer active:scale-95 transition-transform"
                          style={{
                            background: buttonGlassBg,
                            border: buttonGlassBorder,
                            color: "var(--text-secondary)",
                          }}
                        >
                          {isTransfer ? (
                            <ArrowLeftRight size={9.5} strokeWidth={2} />
                          ) : isOutflow ? (
                            <ArrowUpRight size={9.5} strokeWidth={2} />
                          ) : (
                            <ArrowDownLeft size={9.5} strokeWidth={2} />
                          )}
                          <span>
                            {isTransfer
                              ? "Transfer"
                              : isOutflow
                              ? isIndonesian
                                ? "Keluar"
                                : "Expense"
                              : isIndonesian
                              ? "Masuk"
                              : "Income"}
                          </span>
                        </button>

                        {/* Category Pill */}
                        {!isTransfer && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveItemForCategory(it.id);
                            }}
                            className="h-5.5 px-2 rounded-full text-[9.5px] font-medium flex items-center gap-1 cursor-pointer active:scale-95 transition-transform"
                            style={{
                              background: buttonGlassBg,
                              border: buttonGlassBorder,
                              color: "var(--text-secondary)",
                            }}
                          >
                            {it.suggestedCategoryEmoji && (
                              <IconRenderer
                                icon={it.suggestedCategoryEmoji}
                                size="w-3 h-3"
                              />
                            )}
                            <span className="truncate max-w-[95px]">
                              {it.suggestedCategoryName ||
                                (isIndonesian ? "Pilih Kategori" : "Select Category")}
                            </span>
                          </button>
                        )}

                        {/* Wallet Pill(s) */}
                        {wallets.length > 0 && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveItemForWallet({
                                  itemId: it.id,
                                  field: "walletId",
                                });
                              }}
                              className="h-5.5 px-2 rounded-full text-[9.5px] font-medium flex items-center gap-1 cursor-pointer active:scale-95 transition-transform"
                              style={{
                                background: buttonGlassBg,
                                border: buttonGlassBorder,
                                color: "var(--text-secondary)",
                              }}
                            >
                              <CreditCard size={9.5} strokeWidth={2} />
                              <span className="truncate max-w-[85px]">
                                {wallets.find((w) => w.id === it.walletId)?.name ||
                                  it.walletName ||
                                  wallets[0].name}
                              </span>
                            </button>

                            {isTransfer && (
                              <>
                                <ArrowRight
                                  size={9}
                                  strokeWidth={2}
                                  className="text-[var(--text-tertiary)]"
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveItemForWallet({
                                      itemId: it.id,
                                      field: "destinationWalletId",
                                    });
                                  }}
                                  className="h-5.5 px-2 rounded-full text-[9.5px] font-medium flex items-center gap-1 cursor-pointer active:scale-95 transition-transform"
                                  style={{
                                    background: buttonGlassBg,
                                    border: buttonGlassBorder,
                                    color: "var(--text-secondary)",
                                  }}
                                >
                                  <CreditCard size={9.5} strokeWidth={2} />
                                  <span className="truncate max-w-[85px]">
                                    {wallets.find(
                                      (w) => w.id === it.destinationWalletId,
                                    )?.name ||
                                      it.destinationWalletName ||
                                      wallets.find((w) => w.id !== it.walletId)
                                        ?.name ||
                                      (isIndonesian ? "Tujuan" : "Destination")}
                                  </span>
                                </button>
                              </>
                            )}
                          </div>
                        )}

                        {/* Date & Time Pill (Tap to Edit) */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(it);
                          }}
                          className="h-5.5 px-2 rounded-full text-[9.5px] font-mono flex items-center gap-1 cursor-pointer active:scale-95"
                          style={{
                            background: buttonGlassBg,
                            border: buttonGlassBorder,
                            color: "var(--text-tertiary)",
                          }}
                        >
                          <Calendar size={9.5} />
                          <span>{it.date}</span>
                          {it.time && (
                            <>
                              <span>·</span>
                              <Clock size={9.5} />
                              <span>{it.time.slice(0, 5)}</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Bill Auto-Matching Inset Sub-Row */}
                      {it.matchedBill && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleBillPaid(it.id);
                          }}
                          className="mt-2 flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl text-[10.5px] font-medium border cursor-pointer active:scale-[0.985] transition-all select-none"
                          style={{
                            background: it.matchedBill.confirmedPaid
                              ? isDark
                                ? "rgba(255, 255, 255, 0.05)"
                                : "rgba(0, 0, 0, 0.03)"
                              : "transparent",
                            borderColor: buttonGlassBorder,
                            color: "var(--text-primary)",
                          }}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Bookmark
                              size={11}
                              strokeWidth={2}
                              className="shrink-0 text-[var(--text-secondary)]"
                            />
                            <span className="truncate">
                              {isIndonesian
                                ? `Tagihan: ${it.matchedBill.title}`
                                : `Bill: ${it.matchedBill.title}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 text-[9.5px] text-[var(--text-secondary)] font-semibold">
                            <span>
                              {it.matchedBill.confirmedPaid
                                ? isIndonesian
                                  ? "Tandai Lunas"
                                  : "Mark Paid"
                                : isIndonesian
                                ? "Lewati"
                                : "Skip"}
                            </span>
                            <div
                              className="w-3.5 h-3.5 rounded flex items-center justify-center border transition-all"
                              style={{
                                background: it.matchedBill.confirmedPaid
                                  ? isDark
                                    ? "#ffffff"
                                    : "#18181b"
                                  : "transparent",
                                borderColor: it.matchedBill.confirmedPaid
                                  ? "transparent"
                                  : isDark
                                  ? "rgba(255, 255, 255, 0.2)"
                                  : "rgba(0, 0, 0, 0.2)",
                                color: it.matchedBill.confirmedPaid
                                  ? isDark
                                    ? "#000000"
                                    : "#ffffff"
                                  : "transparent",
                              }}
                            >
                              {it.matchedBill.confirmedPaid && (
                                <Check size={9} strokeWidth={3} />
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Duplicate Warning Badge */}
                      {it.isDuplicate && (
                        <div
                          className="mt-1.5 flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9.5px] font-medium"
                          style={{
                            background: isDark
                              ? "rgba(255, 255, 255, 0.04)"
                              : "rgba(0, 0, 0, 0.03)",
                            color: "var(--text-tertiary)",
                            border: buttonGlassBorder,
                          }}
                        >
                          <AlertCircle size={10} className="shrink-0" />
                          <span className="truncate">
                            {isIndonesian
                              ? "Kemungkinan duplikat"
                              : "Possible duplicate"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── 4. Action Controls Bar ── */}
          <div
            className="pt-2 border-t flex items-center gap-2"
            style={{ borderColor: hairlineDivider }}
          >
            <button
              type="button"
              onClick={handleSaveToDraft}
              className="flex-1 h-10 px-3 rounded-full text-[11.5px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 select-none"
              style={{
                background: buttonGlassBg,
                border: buttonGlassBorder,
                color: "var(--text-primary)",
              }}
            >
              <Bookmark size={13} strokeWidth={2} />
              <span>{isIndonesian ? "Simpan Draf" : "Save Draft"}</span>
            </button>

            <button
              type="button"
              disabled={selectedCount === 0 || isSubmitting}
              onClick={handleApprove}
              className="flex-1 h-10 px-3 rounded-full text-[11.5px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed select-none shadow-xs"
              style={{
                background: isDark ? "#ffffff" : "#18181b",
                color: isDark ? "#000000" : "#ffffff",
              }}
            >
              {isSubmitting ? (
                <span className="animate-pulse">
                  {isIndonesian ? "Mencatat..." : "Saving..."}
                </span>
              ) : (
                <>
                  <span>
                    {isIndonesian
                      ? `Catat ${selectedCount} Transaksi`
                      : `Record ${selectedCount} Items`}
                  </span>
                  <Check size={13} strokeWidth={2.5} />
                </>
              )}
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* ── 5. Full Edit Review Item Modal (Nominal, Kategori, Akun, Tanggal/Jam, Catatan) ── */}
      {editingItem && (
        <div
          className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center p-4 pb-[max(calc(env(safe-area-inset-bottom,0px)+16px),24px)] sm:pb-4 backdrop-blur-md"
          style={{ background: "rgba(0, 0, 0, 0.5)" }}
          onClick={() => setEditingItemId(null)}
        >
          <div
            className="w-full max-w-sm rounded-[26px] p-4 border select-none space-y-3.5"
            style={{
              background: isDark
                ? "linear-gradient(160deg, rgba(24, 24, 30, 0.98) 0%, rgba(12, 12, 16, 0.99) 100%)"
                : "linear-gradient(160deg, rgba(255, 255, 255, 0.99) 0%, rgba(246, 247, 250, 0.98) 100%)",
              borderColor: buttonGlassBorder,
              color: "var(--text-primary)",
              boxShadow: isDark
                ? "0 20px 50px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.12)"
                : "0 14px 36px rgba(0, 0, 0, 0.12), inset 0 1px 0 #ffffff",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              className="flex items-center justify-between pb-2.5 border-b"
              style={{ borderColor: hairlineDivider }}
            >
              <div className="flex items-center gap-2">
                <PenLine size={14} strokeWidth={2} />
                <h4 className="text-[14px] font-bold">
                  {isIndonesian ? "Edit Item Tinjauan" : "Edit Review Item"}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setEditingItemId(null)}
                className="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              >
                <X size={13} strokeWidth={2} />
              </button>
            </div>

            {/* Transaction Type Segmented Switcher */}
            <div
              className="grid grid-cols-3 gap-1 p-1 rounded-xl border"
              style={{
                background: buttonGlassBg,
                borderColor: hairlineDivider,
              }}
            >
              {(["expense", "income", "transfer"] as TransactionType[]).map(
                (tType) => {
                  const active = editingItem.type === tType;
                  return (
                    <button
                      key={tType}
                      type="button"
                      onClick={() => handleToggleType(editingItem.id, tType)}
                      className="h-8 rounded-lg text-[11.5px] font-semibold transition-all cursor-pointer"
                      style={{
                        background: active
                          ? isDark
                            ? "#ffffff"
                            : "#18181b"
                          : "transparent",
                        color: active
                          ? isDark
                            ? "#000000"
                            : "#ffffff"
                          : "var(--text-secondary)",
                      }}
                    >
                      {tType === "expense"
                        ? isIndonesian
                          ? "Pengeluaran"
                          : "Expense"
                        : tType === "income"
                        ? isIndonesian
                          ? "Pemasukan"
                          : "Income"
                        : "Transfer"}
                    </button>
                  );
                },
              )}
            </div>

            {/* Nominal Input */}
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
                {isIndonesian ? "Nominal Transaksi" : "Transaction Amount"}
              </label>
              <div
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border"
                style={{
                  background: buttonGlassBg,
                  borderColor: hairlineDivider,
                }}
              >
                <span className="text-[14px] font-bold text-[var(--text-tertiary)]">
                  {currencyMeta.symbol}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={editAmountDisplay}
                  onChange={(e) => {
                    const parsed = formatLiveAmountInput(
                      e.target.value,
                      isIndonesian,
                      false,
                      0,
                    );
                    setEditAmountDisplay(parsed.display);
                    setEditAmountRaw(parsed.rawNumber);
                  }}
                  placeholder="0"
                  className="w-full bg-transparent text-[17px] font-bold outline-none tabular-nums"
                  style={{ color: "var(--text-primary)" }}
                />
              </div>
              <div className="flex items-center gap-1.5">
                {[10000, 50000, 100000].map((step) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      const next = (editAmountRaw || 0) + step;
                      const parsed = formatLiveAmountInput(
                        String(next),
                        isIndonesian,
                        false,
                        0,
                      );
                      setEditAmountDisplay(parsed.display);
                      setEditAmountRaw(parsed.rawNumber);
                    }}
                    className="h-6 px-2.5 rounded-full text-[10px] font-semibold border cursor-pointer active:scale-95"
                    style={{
                      background: buttonGlassBg,
                      borderColor: hairlineDivider,
                      color: "var(--text-secondary)",
                    }}
                  >
                    +{step / 1000}K
                  </button>
                ))}
              </div>
            </div>

            {/* Category & Account Selectors */}
            <div className="grid grid-cols-2 gap-2">
              {editingItem.type !== "transfer" && (
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
                    {isIndonesian ? "Kategori" : "Category"}
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveItemForCategory(editingItem.id)}
                    className="w-full h-9.5 px-3 rounded-xl border flex items-center justify-between gap-1.5 text-[12px] font-medium cursor-pointer"
                    style={{
                      background: buttonGlassBg,
                      borderColor: hairlineDivider,
                      color: "var(--text-primary)",
                    }}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {editingItem.suggestedCategoryEmoji && (
                        <IconRenderer
                          icon={editingItem.suggestedCategoryEmoji}
                          size="w-3.5 h-3.5"
                        />
                      )}
                      <span className="truncate">
                        {editingItem.suggestedCategoryName ||
                          (isIndonesian ? "Pilih" : "Select")}
                      </span>
                    </div>
                    <ChevronRight size={12} className="shrink-0 text-[var(--text-tertiary)]" />
                  </button>
                </div>
              )}

              <div
                className={
                  editingItem.type === "transfer"
                    ? "col-span-2 grid grid-cols-2 gap-2"
                    : "space-y-1"
                }
              >
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
                    {editingItem.type === "transfer"
                      ? isIndonesian
                        ? "Dari Akun"
                        : "From Account"
                      : isIndonesian
                      ? "Akun / Wallet"
                      : "Account / Wallet"}
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveItemForWallet({
                        itemId: editingItem.id,
                        field: "walletId",
                      })
                    }
                    className="w-full h-9.5 px-3 rounded-xl border flex items-center justify-between gap-1.5 text-[12px] font-medium cursor-pointer"
                    style={{
                      background: buttonGlassBg,
                      borderColor: hairlineDivider,
                      color: "var(--text-primary)",
                    }}
                  >
                    <span className="truncate">
                      {wallets.find((w) => w.id === editingItem.walletId)?.name ||
                        editingItem.walletName ||
                        wallets[0]?.name ||
                        (isIndonesian ? "Pilih" : "Select")}
                    </span>
                    <ChevronRight size={12} className="shrink-0 text-[var(--text-tertiary)]" />
                  </button>
                </div>

                {editingItem.type === "transfer" && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
                      {isIndonesian ? "Ke Akun" : "To Account"}
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveItemForWallet({
                          itemId: editingItem.id,
                          field: "destinationWalletId",
                        })
                      }
                      className="w-full h-9.5 px-3 rounded-xl border flex items-center justify-between gap-1.5 text-[12px] font-medium cursor-pointer"
                      style={{
                        background: buttonGlassBg,
                        borderColor: hairlineDivider,
                        color: "var(--text-primary)",
                      }}
                    >
                      <span className="truncate">
                        {wallets.find(
                          (w) => w.id === editingItem.destinationWalletId,
                        )?.name ||
                          editingItem.destinationWalletName ||
                          (isIndonesian ? "Pilih" : "Select")}
                      </span>
                      <ChevronRight size={12} className="shrink-0 text-[var(--text-tertiary)]" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Date & Time Inputs */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
                  {isIndonesian ? "Tanggal" : "Date"}
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full h-9.5 px-3 rounded-xl border text-[12px] font-medium bg-transparent outline-none"
                  style={{
                    background: buttonGlassBg,
                    borderColor: hairlineDivider,
                    color: "var(--text-primary)",
                  }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
                  {isIndonesian ? "Jam" : "Time"}
                </label>
                <input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="w-full h-9.5 px-3 rounded-xl border text-[12px] font-medium bg-transparent outline-none"
                  style={{
                    background: buttonGlassBg,
                    borderColor: hairlineDivider,
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            </div>

            {/* Optional Note Input */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
                {isIndonesian ? "Catatan (Opsional)" : "Note (Optional)"}
              </label>
              <div
                className="flex items-center gap-2 px-3 h-9.5 rounded-xl border"
                style={{
                  background: buttonGlassBg,
                  borderColor: hairlineDivider,
                }}
              >
                <input
                  type="text"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder={
                    isIndonesian
                      ? "Kosongkan jika tanpa catatan..."
                      : "Leave blank if no note..."
                  }
                  className="w-full bg-transparent text-[12.5px] font-medium outline-none"
                  style={{ color: "var(--text-primary)" }}
                />
                {editNote && (
                  <button
                    type="button"
                    onClick={() => setEditNote("")}
                    className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Footer Actions: Delete & Save */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleDeleteReviewItem(editingItem.id)}
                className="w-10 h-10 rounded-xl border flex items-center justify-center cursor-pointer active:scale-95"
                style={{
                  background: buttonGlassBg,
                  borderColor: hairlineDivider,
                  color: "var(--text-tertiary)",
                }}
                title={isIndonesian ? "Hapus Item" : "Delete Item"}
              >
                <Trash2 size={14} strokeWidth={2} />
              </button>

              <button
                type="button"
                onClick={handleSaveEditModal}
                className="flex-1 h-10 rounded-xl font-semibold text-[12.5px] flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
                style={{
                  background: isDark ? "#ffffff" : "#18181b",
                  color: isDark ? "#000000" : "#ffffff",
                }}
              >
                <Check size={14} strokeWidth={2.5} />
                <span>
                  {isIndonesian ? "Simpan Perubahan" : "Save Changes"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. Category Picker Popover Sheet ── */}
      {activeItemForCategory && (
        <div
          className="fixed inset-0 z-[105] flex items-end sm:items-center justify-center p-4 pb-[max(calc(env(safe-area-inset-bottom,0px)+16px),24px)] sm:pb-4 backdrop-blur-md"
          style={{ background: "rgba(0, 0, 0, 0.45)" }}
          onClick={() => {
            setActiveItemForCategory(null);
            setSearchCategoryQuery("");
          }}
        >
          <div
            className="w-full max-w-sm rounded-[24px] p-3.5 border select-none max-h-[82dvh] flex flex-col"
            style={{
              background: isDark
                ? "linear-gradient(160deg, rgba(26, 26, 32, 0.98) 0%, rgba(14, 14, 18, 0.99) 100%)"
                : "linear-gradient(160deg, rgba(255, 255, 255, 0.99) 0%, rgba(246, 247, 250, 0.98) 100%)",
              borderColor: buttonGlassBorder,
              color: "var(--text-primary)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between pb-2.5 mb-2.5 border-b"
              style={{ borderColor: hairlineDivider }}
            >
              <h4 className="text-[13.5px] font-bold">
                {isIndonesian ? "Pilih Kategori" : "Select Category"}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setActiveItemForCategory(null);
                  setSearchCategoryQuery("");
                }}
                className="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer text-[var(--text-tertiary)]"
              >
                <X size={13} strokeWidth={2} />
              </button>
            </div>

            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl mb-2.5 border"
              style={{
                background: buttonGlassBg,
                borderColor: buttonGlassBorder,
              }}
            >
              <Search size={13} strokeWidth={2} className="text-[var(--text-tertiary)] shrink-0" />
              <input
                type="text"
                value={searchCategoryQuery}
                onChange={(e) => setSearchCategoryQuery(e.target.value)}
                placeholder={isIndonesian ? "Cari kategori..." : "Search categories..."}
                className="bg-transparent text-[12.5px] font-medium text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none w-full"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 no-scrollbar min-h-0 pb-2">
              {filteredCategories.map((c) => {
                const isSelected = activeCategoryItem?.suggestedCategoryId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectCategory(c)}
                    className="w-full p-2.5 rounded-xl flex items-center justify-between hover:bg-white/[0.04] active:scale-[0.98] transition-all cursor-pointer text-left"
                    style={{
                      background: isSelected
                        ? isDark
                          ? "rgba(255, 255, 255, 0.06)"
                          : "rgba(0, 0, 0, 0.04)"
                        : "transparent",
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <IconRenderer icon={c.emoji} size="w-4 h-4" />
                      <span className="text-[12.5px] font-medium truncate">
                        {c.name}
                      </span>
                    </div>
                    {isSelected ? (
                      <Check size={13} strokeWidth={2.5} className="text-[var(--text-primary)] shrink-0" />
                    ) : (
                      <ChevronRight size={13} strokeWidth={2} className="text-[var(--text-tertiary)] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── 7. Account / Wallet Picker Popover Sheet ── */}
      {activeItemForWallet && (
        <div
          className="fixed inset-0 z-[105] flex items-end sm:items-center justify-center p-4 pb-[max(calc(env(safe-area-inset-bottom,0px)+16px),24px)] sm:pb-4 backdrop-blur-md"
          style={{ background: "rgba(0, 0, 0, 0.45)" }}
          onClick={() => {
            setActiveItemForWallet(null);
            setSearchWalletQuery("");
          }}
        >
          <div
            className="w-full max-w-sm rounded-[24px] p-3.5 border select-none max-h-[82dvh] flex flex-col"
            style={{
              background: isDark
                ? "linear-gradient(160deg, rgba(26, 26, 32, 0.98) 0%, rgba(14, 14, 18, 0.99) 100%)"
                : "linear-gradient(160deg, rgba(255, 255, 255, 0.99) 0%, rgba(246, 247, 250, 0.98) 100%)",
              borderColor: buttonGlassBorder,
              color: "var(--text-primary)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between pb-2.5 mb-2.5 border-b"
              style={{ borderColor: hairlineDivider }}
            >
              <h4 className="text-[13.5px] font-bold">
                {activeItemForWallet.field === "destinationWalletId"
                  ? isIndonesian
                    ? "Pilih Akun Tujuan"
                    : "Select Destination Account"
                  : isIndonesian
                  ? "Pilih Akun Sumber"
                  : "Select Source Account"}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setActiveItemForWallet(null);
                  setSearchWalletQuery("");
                }}
                className="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer text-[var(--text-tertiary)]"
              >
                <X size={13} strokeWidth={2} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 no-scrollbar min-h-0 pb-2">
              {filteredWallets.map((w) => {
                const currentId =
                  activeItemForWallet.field === "destinationWalletId"
                    ? activeWalletItem?.destinationWalletId
                    : activeWalletItem?.walletId || wallets[0]?.id;
                const isSelected = currentId === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => handleSelectWallet(w)}
                    className="w-full p-2.5 rounded-xl flex items-center justify-between hover:bg-white/[0.04] active:scale-[0.98] transition-all cursor-pointer text-left"
                    style={{
                      background: isSelected
                        ? isDark
                          ? "rgba(255, 255, 255, 0.06)"
                          : "rgba(0, 0, 0, 0.04)"
                        : "transparent",
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CreditCard size={14} strokeWidth={2} />
                      <div className="min-w-0">
                        <span className="text-[12.5px] font-medium truncate block">
                          {w.name}
                        </span>
                        <span className="text-[10px] text-[var(--text-tertiary)] tabular-nums block">
                          {formatWithPreferred(balancesById[w.id] ?? w.balance ?? 0)}
                        </span>
                      </div>
                    </div>
                    {isSelected ? (
                      <Check size={13} strokeWidth={2.5} className="text-[var(--text-primary)] shrink-0" />
                    ) : (
                      <ChevronRight size={13} strokeWidth={2} className="text-[var(--text-tertiary)] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
