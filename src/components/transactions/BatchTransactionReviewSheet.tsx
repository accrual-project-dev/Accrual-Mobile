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
import { saveMerchantMemory } from "../../lib/merchantCategoryMemory";
import { findBestMatchingBill } from "../../lib/billMatchingEngine";

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
  const { formatWithPreferred } = useCurrency();

  const { data: bills = [] } = useBills();
  const markBillPaid = useMarkBillPaid();

  const [items, setItems] = useState<ParsedStatementItem[]>(initialItems);
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleToggleType = (id: string) => {
    triggerHaptic("light");
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
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
    if (targetItem) {
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

  // ── Clean Apple Liquid Glass Tokens (Zero Glow) ──
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
                {isIndonesian
                  ? "Tinjau Transaksi Massal"
                  : "Review Batch Transactions"}
              </h3>
              <p className="text-[10.5px] text-[var(--text-tertiary)] truncate mt-0.5">
                {sourceTitle ||
                  (isIndonesian
                    ? "Tangkapan Layar Riwayat"
                    : "Statement History")}
                {" · "}
                {items.length} {isIndonesian ? "terdeteksi" : "detected"}
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
            {selectedCount} {isIndonesian ? "dari" : "of"} {items.length}{" "}
            {isIndonesian ? "dipilih" : "selected"}
            {totalSelectedAmount > 0
              ? ` · ${formatWithPreferred(totalSelectedAmount)}`
              : ""}
          </span>
        </div>

        {/* ── 3. Transaction List Cards (Clean Studio Glass, Zero Glow) ── */}
        <div className="space-y-2 mb-3.5 flex-1 min-h-0">
          {items.map((it) => {
            const isSelected = Boolean(selectedMap[it.id]);
            const isOutflow = it.type === "expense";
            const isTransfer = it.type === "transfer";

            return (
              <div
                key={it.id}
                onClick={() => handleToggleItem(it.id)}
                className="p-3 rounded-2xl transition-all cursor-pointer select-none active:scale-[0.99]"
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
                  boxShadow: isSelected
                    ? isDark
                      ? "0 4px 16px -4px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.08)"
                      : "0 2px 8px -2px rgba(31, 36, 48, 0.04), inset 0 1px 0 #ffffff"
                    : "none",
                  opacity: isSelected ? 1 : 0.5,
                }}
              >
                <div className="flex items-start gap-2.5">
                  {/* Apple Tactile Checkbox */}
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
                    <div className="flex items-baseline justify-between gap-2">
                      <p
                        className="text-[12.5px] font-bold truncate leading-tight tracking-tight"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {it.cleanDescription || it.description}
                      </p>
                      <span
                        className="text-[13px] font-bold shrink-0 tracking-tight tabular-nums"
                        style={{
                          color: isOutflow
                            ? "var(--text-primary)"
                            : "var(--text-secondary)",
                        }}
                      >
                        {isOutflow ? "−" : "+"}
                        {formatWithPreferred(it.amount)}
                      </span>
                    </div>

                    {/* Metadata & Quick Micro-Pills */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {/* Type Toggle Pill */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleType(it.id);
                        }}
                        className="h-5 px-2 rounded-full text-[9.5px] font-semibold flex items-center gap-1 cursor-pointer active:scale-95 transition-transform"
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
                                : "Outflow"
                              : isIndonesian
                                ? "Masuk"
                                : "Inflow"}
                        </span>
                      </button>

                      {/* Category Pill */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveItemForCategory(it.id);
                        }}
                        className="h-5 px-2 rounded-full text-[9.5px] font-medium flex items-center gap-1 cursor-pointer active:scale-95 transition-transform"
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
                        <span className="truncate max-w-[85px]">
                          {it.suggestedCategoryName ||
                            (isIndonesian ? "Kategori" : "Category")}
                        </span>
                      </button>

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
                            className="h-5 px-2 rounded-full text-[9.5px] font-medium flex items-center gap-1 cursor-pointer active:scale-95 transition-transform"
                            style={{
                              background: buttonGlassBg,
                              border: buttonGlassBorder,
                              color: "var(--text-secondary)",
                            }}
                            title={isIndonesian ? "Pilih Akun" : "Select Account"}
                          >
                            <CreditCard size={9.5} strokeWidth={2} />
                            <span className="truncate max-w-[80px]">
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
                                className="h-5 px-2 rounded-full text-[9.5px] font-medium flex items-center gap-1 cursor-pointer active:scale-95 transition-transform"
                                style={{
                                  background: buttonGlassBg,
                                  border: buttonGlassBorder,
                                  color: "var(--text-secondary)",
                                }}
                                title={
                                  isIndonesian
                                    ? "Pilih Akun Tujuan"
                                    : "Select Destination Account"
                                }
                              >
                                <CreditCard size={9.5} strokeWidth={2} />
                                <span className="truncate max-w-[80px]">
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

                      {/* Date & Time */}
                      <div className="h-5 px-1.5 rounded-md text-[9.5px] font-mono flex items-center gap-1 text-[var(--text-tertiary)]">
                        <Calendar size={9.5} />
                        <span>{it.date}</span>
                        {it.time && (
                          <>
                            <span>·</span>
                            <Clock size={9.5} />
                            <span>{it.time}</span>
                          </>
                        )}
                      </div>

                      {/* Needs Review Badge */}
                      {(it.needsReview ||
                        (it.confidence !== undefined &&
                          it.confidence < 0.65)) && (
                        <div
                          className="h-5 px-2 rounded-full text-[9px] font-medium flex items-center gap-1 border border-dashed"
                          style={{
                            borderColor: isDark
                              ? "rgba(255, 255, 255, 0.12)"
                              : "rgba(0, 0, 0, 0.12)",
                            color: "var(--text-tertiary)",
                            background: buttonGlassBg,
                          }}
                        >
                          <AlertCircle size={9} className="shrink-0" />
                          <span>
                            {isIndonesian ? "Perlu Ditinjau" : "Review"}
                          </span>
                        </div>
                      )}
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
                            ? "Kemungkinan duplikat (tidak dicentang otomatis)"
                            : "Possible duplicate (unchecked by default)"}
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
          {/* Save to Draft Button */}
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
            <span>{isIndonesian ? "Simpan ke Draft" : "Save Draft"}</span>
          </button>

          {/* Confirm & Record Button */}
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

        {/* ── 5. Category Picker Popover Sheet ── */}
        {activeItemForCategory && (
          <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 backdrop-blur-md"
            style={{ background: "rgba(0, 0, 0, 0.45)" }}
            onClick={() => {
              setActiveItemForCategory(null);
              setSearchCategoryQuery("");
            }}
          >
            <div
              className="w-full max-w-sm rounded-[24px] p-3.5 border select-none max-h-[75vh] flex flex-col"
              style={{
                background: isDark
                  ? "linear-gradient(160deg, rgba(26, 26, 32, 0.98) 0%, rgba(14, 14, 18, 0.99) 100%)"
                  : "linear-gradient(160deg, rgba(255, 255, 255, 0.99) 0%, rgba(246, 247, 250, 0.98) 100%)",
                borderColor: buttonGlassBorder,
                color: "var(--text-primary)",
                boxShadow: isDark
                  ? "0 18px 48px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.12)"
                  : "0 14px 36px rgba(0, 0, 0, 0.1), inset 0 1px 0 #ffffff",
                backdropFilter: "blur(24px) saturate(180%)",
                WebkitBackdropFilter: "blur(24px) saturate(180%)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="flex items-center justify-between pb-2.5 mb-2.5 border-b"
                style={{ borderColor: hairlineDivider }}
              >
                <div>
                  <h4 className="text-[13.5px] font-bold">
                    {isIndonesian ? "Pilih Kategori" : "Select Category"}
                  </h4>
                  {activeCategoryItem && (
                    <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                      {activeCategoryItem.cleanDescription || activeCategoryItem.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveItemForCategory(null);
                    setSearchCategoryQuery("");
                  }}
                  className="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                >
                  <X size={13} strokeWidth={2} />
                </button>
              </div>

              {/* Search Bar */}
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
                  autoFocus
                />
                {searchCategoryQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchCategoryQuery("")}
                    className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Category List */}
              <div className="flex-1 overflow-y-auto space-y-1 no-scrollbar min-h-0">
                {filteredCategories.length > 0 ? (
                  filteredCategories.map((c) => {
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
                          <span
                            className="text-[12.5px] font-medium truncate"
                            style={{
                              color: isSelected
                                ? "var(--text-primary)"
                                : "var(--text-secondary)",
                            }}
                          >
                            {c.name}
                          </span>
                        </div>
                        {isSelected ? (
                          <Check size={13} strokeWidth={2.5} className="text-[var(--text-primary)] shrink-0" />
                        ) : (
                          <ChevronRight
                            size={13}
                            strokeWidth={2}
                            className="text-[var(--text-tertiary)] shrink-0"
                          />
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="py-6 text-center text-[11.5px] text-[var(--text-tertiary)]">
                    {isIndonesian ? "Kategori tidak ditemukan" : "No category found"}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── 6. Account / Wallet Picker Popover Sheet ── */}
        {activeItemForWallet && (
          <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 backdrop-blur-md"
            style={{ background: "rgba(0, 0, 0, 0.45)" }}
            onClick={() => {
              setActiveItemForWallet(null);
              setSearchWalletQuery("");
            }}
          >
            <div
              className="w-full max-w-sm rounded-[24px] p-3.5 border select-none max-h-[75vh] flex flex-col"
              style={{
                background: isDark
                  ? "linear-gradient(160deg, rgba(26, 26, 32, 0.98) 0%, rgba(14, 14, 18, 0.99) 100%)"
                  : "linear-gradient(160deg, rgba(255, 255, 255, 0.99) 0%, rgba(246, 247, 250, 0.98) 100%)",
                borderColor: buttonGlassBorder,
                color: "var(--text-primary)",
                boxShadow: isDark
                  ? "0 18px 48px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.12)"
                  : "0 14px 36px rgba(0, 0, 0, 0.1), inset 0 1px 0 #ffffff",
                backdropFilter: "blur(24px) saturate(180%)",
                WebkitBackdropFilter: "blur(24px) saturate(180%)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="flex items-center justify-between pb-2.5 mb-2.5 border-b"
                style={{ borderColor: hairlineDivider }}
              >
                <div>
                  <h4 className="text-[13.5px] font-bold">
                    {activeItemForWallet.field === "destinationWalletId"
                      ? isIndonesian
                        ? "Pilih Akun Tujuan"
                        : "Select Destination Account"
                      : isIndonesian
                        ? "Pilih Akun Sumber"
                        : "Select Source Account"}
                  </h4>
                  {activeWalletItem && (
                    <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                      {activeWalletItem.cleanDescription || activeWalletItem.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveItemForWallet(null);
                    setSearchWalletQuery("");
                  }}
                  className="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                >
                  <X size={13} strokeWidth={2} />
                </button>
              </div>

              {/* Search Bar (if more than 3 wallets) */}
              {wallets.length > 3 && (
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
                    value={searchWalletQuery}
                    onChange={(e) => setSearchWalletQuery(e.target.value)}
                    placeholder={isIndonesian ? "Cari akun..." : "Search account..."}
                    className="bg-transparent text-[12.5px] font-medium text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none w-full"
                    autoFocus
                  />
                  {searchWalletQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchWalletQuery("")}
                      className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              )}

              {/* Wallet List */}
              <div className="flex-1 overflow-y-auto space-y-1 no-scrollbar min-h-0">
                {filteredWallets.length > 0 ? (
                  filteredWallets.map((w) => {
                    const currentId =
                      activeItemForWallet.field === "destinationWalletId"
                        ? activeWalletItem?.destinationWalletId
                        : (activeWalletItem?.walletId || wallets[0]?.id);
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
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                            style={{
                              background: buttonGlassBg,
                              border: buttonGlassBorder,
                              color: "var(--text-primary)",
                            }}
                          >
                            <CreditCard size={13} strokeWidth={2} />
                          </div>
                          <div className="min-w-0">
                            <span
                              className="text-[12.5px] font-medium truncate block"
                              style={{
                                color: isSelected
                                  ? "var(--text-primary)"
                                  : "var(--text-secondary)",
                              }}
                            >
                              {w.name}
                            </span>
                            {w.balance !== undefined && (
                              <span className="text-[10px] text-[var(--text-tertiary)] tabular-nums block">
                                {formatWithPreferred(w.balance)}
                              </span>
                            )}
                          </div>
                        </div>
                        {isSelected ? (
                          <Check size={13} strokeWidth={2.5} className="text-[var(--text-primary)] shrink-0" />
                        ) : (
                          <ChevronRight
                            size={13}
                            strokeWidth={2}
                            className="text-[var(--text-tertiary)] shrink-0"
                          />
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="py-6 text-center text-[11.5px] text-[var(--text-tertiary)]">
                    {isIndonesian ? "Akun tidak ditemukan" : "No account found"}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
