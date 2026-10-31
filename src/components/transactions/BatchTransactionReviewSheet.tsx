import { useState, useEffect, useMemo, useRef } from "react";
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
  ArrowLeft,
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
import { updateDraftItem, removeDraftItem } from "../../lib/draftTransactionService";
import { formatLiveAmountInput } from "../../lib/utils";
import { parseCleanNumber } from "../assets/AddAssetModal";

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

  // Self-contained Edit Draft State (Single BottomSheet View — No stacked modals)
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editType, setEditType] = useState<TransactionType>("expense");
  const [editAmountDisplay, setEditAmountDisplay] = useState("");
  const [editAmountRaw, setEditAmountRaw] = useState<number>(0);
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState<string | null>(null);
  const [editCategoryEmoji, setEditCategoryEmoji] = useState<string | null>(null);
  const [editWalletId, setEditWalletId] = useState<string | null>(null);
  const [editWalletName, setEditWalletName] = useState<string | undefined>(undefined);
  const [editDestWalletId, setEditDestWalletId] = useState<string | null>(null);
  const [editDestWalletName, setEditDestWalletName] = useState<string | undefined>(undefined);
  const [editNote, setEditNote] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");

  // Inline Sub-Picker View inside the same BottomSheet ("none" | "category" | "wallet" | "dest_wallet")
  const [pickerMode, setPickerMode] = useState<
    "none" | "category" | "wallet" | "dest_wallet"
  >("none");
  const [pickerTargetItemId, setPickerTargetItemId] = useState<string | null>(null);
  const [searchPickerQuery, setSearchPickerQuery] = useState("");

  // Track previous open state & item IDs signature so parent re-renders never wipe active edits
  const wasOpenRef = useRef(false);
  const prevInitialSignatureRef = useRef("");

  useEffect(() => {
    const sig = initialItems.map((i) => i.id).join("|");
    if (isOpen && (!wasOpenRef.current || sig !== prevInitialSignatureRef.current)) {
      wasOpenRef.current = true;
      prevInitialSignatureRef.current = sig;
      setItems(initialItems);
      const selMap: Record<string, boolean> = {};
      initialItems.forEach((it) => {
        selMap[it.id] = it.selected !== false;
      });
      setSelectedMap(selMap);
      setEditingItemId(null);
      setPickerMode("none");
      setPickerTargetItemId(null);
    } else if (!isOpen && wasOpenRef.current) {
      wasOpenRef.current = false;
      setEditingItemId(null);
      setPickerMode("none");
      setPickerTargetItemId(null);
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

  const openEditView = (it: ParsedStatementItem) => {
    triggerHaptic("light");
    setPickerMode("none");
    setEditingItemId(it.id);
    setEditType(it.type || "expense");

    const parsedAmt = formatLiveAmountInput(
      String(Math.round(it.amount || 0)),
      isIndonesian,
      false,
      0,
    );
    setEditAmountDisplay(parsedAmt.display);
    setEditAmountRaw(parsedAmt.rawNumber);

    const matchedCat =
      categories.find((c) => c.id === it.suggestedCategoryId) ||
      categories.find(
        (c) =>
          it.suggestedCategoryName &&
          c.name.toLowerCase() === it.suggestedCategoryName.toLowerCase(),
      );
    setEditCategoryId(matchedCat?.id || it.suggestedCategoryId || null);
    setEditCategoryName(matchedCat?.name || it.suggestedCategoryName || null);
    setEditCategoryEmoji(matchedCat?.emoji || it.suggestedCategoryEmoji || null);

    const matchedWal =
      wallets.find((w) => w.id === it.walletId) ||
      wallets.find(
        (w) =>
          it.walletName &&
          w.name.toLowerCase() === it.walletName.toLowerCase(),
      ) ||
      wallets[0];
    setEditWalletId(matchedWal?.id || it.walletId || null);
    setEditWalletName(matchedWal?.name || it.walletName || undefined);

    const matchedDestWal =
      wallets.find((w) => w.id === it.destinationWalletId) ||
      wallets.find(
        (w) =>
          it.destinationWalletName &&
          w.name.toLowerCase() === it.destinationWalletName.toLowerCase(),
      ) ||
      wallets.find((w) => w.id !== (matchedWal?.id || it.walletId));
    setEditDestWalletId(matchedDestWal?.id || it.destinationWalletId || null);
    setEditDestWalletName(
      matchedDestWal?.name || it.destinationWalletName || undefined,
    );

    const rawDesc = (it.cleanDescription ?? it.description ?? "").trim();
    const catLower = (
      matchedCat?.name ||
      it.suggestedCategoryName ||
      ""
    )
      .trim()
      .toLowerCase();
    const walLower = (matchedWal?.name || it.walletName || "")
      .trim()
      .toLowerCase();
    const isFallbackDesc =
      !rawDesc ||
      rawDesc.toLowerCase() === "pengeluaran" ||
      rawDesc.toLowerCase() === "expense" ||
      rawDesc.toLowerCase() === "dana masuk" ||
      rawDesc.toLowerCase() === "income" ||
      rawDesc.toLowerCase() === "pemasukan" ||
      rawDesc.toLowerCase() === catLower ||
      rawDesc.toLowerCase() === `${catLower}${walLower}`;

    setEditNote(isFallbackDesc ? "" : rawDesc);
    setEditDate(it.date || new Date().toISOString().slice(0, 10));
    setEditTime((it.time || "12:00").slice(0, 5));
  };

  const applyAndPersistItemUpdate = (
    itemId: string,
    updater: (prevItem: ParsedStatementItem) => ParsedStatementItem,
  ) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const nextItem = updater(it);
        updateDraftItem(nextItem);
        return nextItem;
      }),
    );
  };

  const handleSaveEditView = () => {
    if (!editingItemId) return;
    triggerSuccessHaptic();
    const cleanNote = editNote.trim();
    const parsedNum =
      editAmountRaw > 0
        ? editAmountRaw
        : parseCleanNumber(editAmountDisplay, !isIndonesian);

    if (cleanNote && editCategoryId && editCategoryName && editType !== "transfer") {
      saveMerchantMemory(cleanNote, editCategoryId, editCategoryName);
    }

    applyAndPersistItemUpdate(editingItemId, (it) => {
      const finalAmount = parsedNum > 0 ? parsedNum : it.amount;
      let finalDestId = editType === "transfer" ? editDestWalletId : null;
      let finalDestName = editType === "transfer" ? editDestWalletName : undefined;
      if (editType === "transfer" && finalDestId === editWalletId) {
        const altWal = wallets.find((w) => w.id !== editWalletId);
        finalDestId = altWal?.id || null;
        finalDestName = altWal?.name;
      }

      return {
        ...it,
        type: editType,
        amount: finalAmount,
        description: cleanNote,
        cleanDescription: cleanNote,
        suggestedCategoryId: editType === "transfer" ? null : editCategoryId,
        suggestedCategoryName: editType === "transfer" ? null : editCategoryName,
        suggestedCategoryEmoji: editType === "transfer" ? null : editCategoryEmoji,
        walletId: editWalletId,
        walletName: editWalletName,
        destinationWalletId: finalDestId,
        destinationWalletName: finalDestName,
        date: editDate || it.date,
        time: editTime || it.time,
        needsReview: false,
        captureTimestampConfirmed: true,
      };
    });

    setSelectedMap((prev) => ({ ...prev, [editingItemId]: true }));
    setEditingItemId(null);
    setPickerMode("none");
  };

  const handleDeleteReviewItem = (id: string) => {
    triggerHaptic("medium");
    removeDraftItem(id);
    const remaining = items.filter((it) => it.id !== id);
    setItems(remaining);
    setSelectedMap((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (editingItemId === id) {
      setEditingItemId(null);
      setPickerMode("none");
    }
    if (remaining.length === 0) {
      onClose();
    }
  };

  const selectedCount = useMemo(() => {
    return items.filter((it) => selectedMap[it.id]).length;
  }, [items, selectedMap]);

  const totalSelectedAmount = useMemo(() => {
    return items
      .filter((it) => selectedMap[it.id])
      .reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
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

  const handleToggleTypeOnCard = (id: string) => {
    triggerHaptic("light");
    applyAndPersistItemUpdate(id, (it) => {
      let nextType: TransactionType = "expense";
      if (it.type === "expense") nextType = "income";
      else if (it.type === "income") nextType = "transfer";
      else nextType = "expense";

      let nextCatId = it.suggestedCategoryId;
      let nextCatName = it.suggestedCategoryName;
      let nextCatEmoji = it.suggestedCategoryEmoji;

      if (nextType !== "transfer") {
        const currentCat = categories.find((c) => c.id === nextCatId);
        const needSwitch =
          !currentCat ||
          (nextType === "income" && currentCat.type !== "income") ||
          (nextType === "expense" && currentCat.type === "income");
        if (needSwitch) {
          const fallbackCat =
            categories.find((c) =>
              nextType === "income" ? c.type === "income" : c.type !== "income",
            ) || categories[0];
          nextCatId = fallbackCat?.id || null;
          nextCatName = fallbackCat?.name || null;
          nextCatEmoji = fallbackCat?.emoji || null;
        }
      }

      const destWal =
        nextType === "transfer"
          ? wallets.find((w) => w.id === it.destinationWalletId) ||
            wallets.find((w) => w.id !== it.walletId)
          : undefined;

      return {
        ...it,
        type: nextType,
        suggestedCategoryId: nextType === "transfer" ? null : nextCatId,
        suggestedCategoryName: nextType === "transfer" ? null : nextCatName,
        suggestedCategoryEmoji: nextType === "transfer" ? null : nextCatEmoji,
        destinationWalletId: nextType === "transfer" ? destWal?.id || null : null,
        destinationWalletName: nextType === "transfer" ? destWal?.name : undefined,
      };
    });
  };

  const handleSwitchEditType = (tType: TransactionType) => {
    triggerHaptic("light");
    setEditType(tType);
    if (tType !== "transfer") {
      const currentCat = categories.find((c) => c.id === editCategoryId);
      const isMismatch =
        !currentCat ||
        (tType === "income" && currentCat.type !== "income") ||
        (tType === "expense" && currentCat.type === "income");
      if (isMismatch) {
        const defaultCat =
          categories.find((c) =>
            tType === "income" ? c.type === "income" : c.type !== "income",
          ) || categories[0];
        if (defaultCat) {
          setEditCategoryId(defaultCat.id);
          setEditCategoryName(defaultCat.name);
          setEditCategoryEmoji(defaultCat.emoji);
        }
      }
    } else if (!editDestWalletId || editDestWalletId === editWalletId) {
      const altWal = wallets.find((w) => w.id !== editWalletId);
      if (altWal) {
        setEditDestWalletId(altWal.id);
        setEditDestWalletName(altWal.name);
      }
    }
  };

  const handleToggleBillPaid = (id: string) => {
    triggerHaptic("light");
    applyAndPersistItemUpdate(id, (it) => {
      if (!it.matchedBill) return it;
      return {
        ...it,
        matchedBill: {
          ...it.matchedBill,
          confirmedPaid: !it.matchedBill.confirmedPaid,
        },
      };
    });
  };

  const handlePickCategory = (cat: Category) => {
    triggerHaptic("light");
    if (editingItemId && pickerTargetItemId === editingItemId) {
      setEditCategoryId(cat.id);
      setEditCategoryName(cat.name);
      setEditCategoryEmoji(cat.emoji);
    } else if (pickerTargetItemId) {
      const targetItem = items.find((it) => it.id === pickerTargetItemId);
      if (targetItem && targetItem.cleanDescription) {
        saveMerchantMemory(targetItem.cleanDescription, cat.id, cat.name);
      }
      applyAndPersistItemUpdate(pickerTargetItemId, (it) => ({
        ...it,
        suggestedCategoryId: cat.id,
        suggestedCategoryName: cat.name,
        suggestedCategoryEmoji: cat.emoji,
        needsReview: false,
        confidence: 0.95,
      }));
    }
    setPickerMode("none");
    setSearchPickerQuery("");
  };

  const handlePickWallet = (selectedWallet: Wallet) => {
    triggerHaptic("light");
    if (editingItemId && pickerTargetItemId === editingItemId) {
      if (pickerMode === "dest_wallet") {
        setEditDestWalletId(selectedWallet.id);
        setEditDestWalletName(selectedWallet.name);
      } else {
        setEditWalletId(selectedWallet.id);
        setEditWalletName(selectedWallet.name);
      }
    } else if (pickerTargetItemId) {
      const isDest = pickerMode === "dest_wallet";
      applyAndPersistItemUpdate(pickerTargetItemId, (it) =>
        isDest
          ? {
              ...it,
              destinationWalletId: selectedWallet.id,
              destinationWalletName: selectedWallet.name,
            }
          : {
              ...it,
              walletId: selectedWallet.id,
              walletName: selectedWallet.name,
            },
      );
    }
    setPickerMode("none");
    setSearchPickerQuery("");
  };

  const filteredCategories = useMemo(() => {
    const targetItem = items.find((it) => it.id === pickerTargetItemId);
    const activeType =
      editingItemId && pickerTargetItemId === editingItemId
        ? editType
        : targetItem?.type || "expense";
    const isIncome = activeType === "income";
    const typeCats = categories.filter((c) =>
      isIncome ? c.type === "income" : c.type !== "income",
    );
    const pool = typeCats.length > 0 ? typeCats : categories;
    if (!searchPickerQuery.trim()) return pool;
    const q = searchPickerQuery.trim().toLowerCase();
    return pool.filter((c) => c.name.toLowerCase().includes(q));
  }, [
    categories,
    items,
    pickerTargetItemId,
    editingItemId,
    editType,
    searchPickerQuery,
  ]);

  const filteredWallets = useMemo(() => {
    if (!searchPickerQuery.trim()) return wallets;
    const q = searchPickerQuery.trim().toLowerCase();
    return wallets.filter((w) => w.name.toLowerCase().includes(q));
  }, [wallets, searchPickerQuery]);

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
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div
        className="px-4 pt-2.5 pb-[max(calc(env(safe-area-inset-bottom,0px)+16px),24px)] max-w-lg mx-auto select-none font-sans"
        style={{ color: "var(--text-primary)" }}
      >
        {/* ============================================================ */}
        {/* VIEW A: INLINE CATEGORY OR WALLET PICKER (SINGLE SHEET)      */}
        {/* ============================================================ */}
        {pickerMode !== "none" ? (
          <div className="space-y-3">
            <div
              className="flex items-center justify-between pb-3 border-b"
              style={{ borderColor: hairlineDivider }}
            >
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setPickerMode("none");
                    setSearchPickerQuery("");
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
                  style={{
                    background: buttonGlassBg,
                    border: buttonGlassBorder,
                    color: "var(--text-primary)",
                  }}
                >
                  <ArrowLeft size={14} strokeWidth={2} />
                </button>
                <div>
                  <h4 className="text-[14.5px] font-bold leading-tight">
                    {pickerMode === "category"
                      ? isIndonesian
                        ? "Pilih Kategori"
                        : "Select Category"
                      : pickerMode === "dest_wallet"
                      ? isIndonesian
                        ? "Pilih Akun Tujuan"
                        : "Select Destination Account"
                      : isIndonesian
                      ? "Pilih Akun Sumber"
                      : "Select Source Account"}
                  </h4>
                  <p className="text-[10.5px] text-[var(--text-tertiary)] mt-0.5">
                    {isIndonesian
                      ? "Ketuk untuk menerapkan perubahan"
                      : "Tap to apply selection"}
                  </p>
                </div>
              </div>
            </div>

            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border"
              style={{
                background: buttonGlassBg,
                border: buttonGlassBorder,
              }}
            >
              <Search
                size={13}
                strokeWidth={2}
                className="text-[var(--text-tertiary)] shrink-0"
              />
              <input
                type="text"
                value={searchPickerQuery}
                onChange={(e) => setSearchPickerQuery(e.target.value)}
                placeholder={
                  pickerMode === "category"
                    ? isIndonesian
                      ? "Cari kategori..."
                      : "Search categories..."
                    : isIndonesian
                    ? "Cari akun / dompet..."
                    : "Search account / wallet..."
                }
                className="bg-transparent text-[12.5px] font-medium text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none w-full"
              />
              {searchPickerQuery && (
                <button
                  type="button"
                  onClick={() => setSearchPickerQuery("")}
                  className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="space-y-1 pb-2">
              {pickerMode === "category" ? (
                filteredCategories.map((c) => {
                  const targetItem = items.find(
                    (it) => it.id === pickerTargetItemId,
                  );
                  const activeCatId =
                    editingItemId && pickerTargetItemId === editingItemId
                      ? editCategoryId
                      : targetItem?.suggestedCategoryId;
                  const isSelected = activeCatId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handlePickCategory(c)}
                      className="w-full p-2.5 rounded-xl flex items-center justify-between hover:bg-white/[0.04] active:scale-[0.99] transition-all cursor-pointer text-left"
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
                        <Check
                          size={13}
                          strokeWidth={2.5}
                          className="text-[var(--text-primary)] shrink-0"
                        />
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
                filteredWallets.map((w) => {
                  const targetItem = items.find(
                    (it) => it.id === pickerTargetItemId,
                  );
                  const currentId =
                    editingItemId && pickerTargetItemId === editingItemId
                      ? pickerMode === "dest_wallet"
                        ? editDestWalletId
                        : editWalletId
                      : pickerMode === "dest_wallet"
                      ? targetItem?.destinationWalletId
                      : targetItem?.walletId || wallets[0]?.id;
                  const isSelected = currentId === w.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => handlePickWallet(w)}
                      className="w-full p-2.5 rounded-xl flex items-center justify-between hover:bg-white/[0.04] active:scale-[0.99] transition-all cursor-pointer text-left"
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
                            {formatWithPreferred(
                              balancesById[w.id] ?? w.balance ?? 0,
                            )}
                          </span>
                        </div>
                      </div>
                      {isSelected ? (
                        <Check
                          size={13}
                          strokeWidth={2.5}
                          className="text-[var(--text-primary)] shrink-0"
                        />
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
              )}
            </div>
          </div>
        ) : editingItem ? (
          /* ============================================================ */
          /* VIEW B: INLINE EDIT TRANSACTION VIEW (SINGLE SHEET)          */
          /* ============================================================ */
          <div className="space-y-3.5">
            {/* Header with Back Button */}
            <div
              className="flex items-center justify-between pb-3 border-b"
              style={{ borderColor: hairlineDivider }}
            >
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setEditingItemId(null);
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
                  style={{
                    background: buttonGlassBg,
                    border: buttonGlassBorder,
                    color: "var(--text-primary)",
                  }}
                >
                  <ArrowLeft size={14} strokeWidth={2} />
                </button>
                <div>
                  <h4 className="text-[14.5px] font-bold leading-tight">
                    {isIndonesian ? "Edit Transaksi Draft" : "Edit Draft Transaction"}
                  </h4>
                  <p className="text-[10.5px] text-[var(--text-tertiary)] mt-0.5">
                    {isIndonesian
                      ? "Perubahan otomatis tersimpan ke daftar tinjauan"
                      : "Changes are automatically saved to the review list"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteReviewItem(editingItem.id)}
                className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
                style={{
                  background: buttonGlassBg,
                  border: buttonGlassBorder,
                  color: "var(--text-tertiary)",
                }}
                title={isIndonesian ? "Hapus Item" : "Delete Item"}
              >
                <Trash2 size={13.5} strokeWidth={2} />
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
                  const active = editType === tType;
                  return (
                    <button
                      key={tType}
                      type="button"
                      onClick={() => handleSwitchEditType(tType)}
                      className="h-8.5 rounded-lg text-[11.5px] font-semibold transition-all cursor-pointer"
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
                    className="h-6.5 px-2.5 rounded-full text-[10px] font-semibold border cursor-pointer active:scale-95 tabular-nums"
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
              {editType !== "transfer" && (
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
                    {isIndonesian ? "Kategori" : "Category"}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setPickerTargetItemId(editingItem.id);
                      setSearchPickerQuery("");
                      setPickerMode("category");
                    }}
                    className="w-full h-10 px-3 rounded-xl border flex items-center justify-between gap-1.5 text-[12px] font-medium cursor-pointer"
                    style={{
                      background: buttonGlassBg,
                      borderColor: hairlineDivider,
                      color: "var(--text-primary)",
                    }}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {editCategoryEmoji && (
                        <IconRenderer
                          icon={editCategoryEmoji}
                          size="w-3.5 h-3.5"
                        />
                      )}
                      <span className="truncate">
                        {editCategoryName ||
                          (isIndonesian ? "Pilih Kategori" : "Select Category")}
                      </span>
                    </div>
                    <ChevronRight
                      size={12}
                      className="shrink-0 text-[var(--text-tertiary)]"
                    />
                  </button>
                </div>
              )}

              <div
                className={
                  editType === "transfer"
                    ? "col-span-2 grid grid-cols-2 gap-2"
                    : "space-y-1"
                }
              >
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
                    {editType === "transfer"
                      ? isIndonesian
                        ? "Dari Akun"
                        : "From Account"
                      : isIndonesian
                      ? "Akun / Dompet"
                      : "Account / Wallet"}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setPickerTargetItemId(editingItem.id);
                      setSearchPickerQuery("");
                      setPickerMode("wallet");
                    }}
                    className="w-full h-10 px-3 rounded-xl border flex items-center justify-between gap-1.5 text-[12px] font-medium cursor-pointer"
                    style={{
                      background: buttonGlassBg,
                      borderColor: hairlineDivider,
                      color: "var(--text-primary)",
                    }}
                  >
                    <span className="truncate">
                      {wallets.find((w) => w.id === editWalletId)?.name ||
                        editWalletName ||
                        wallets[0]?.name ||
                        (isIndonesian ? "Pilih" : "Select")}
                    </span>
                    <ChevronRight
                      size={12}
                      className="shrink-0 text-[var(--text-tertiary)]"
                    />
                  </button>
                </div>

                {editType === "transfer" && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
                      {isIndonesian ? "Ke Akun" : "To Account"}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        setPickerTargetItemId(editingItem.id);
                        setSearchPickerQuery("");
                        setPickerMode("dest_wallet");
                      }}
                      className="w-full h-10 px-3 rounded-xl border flex items-center justify-between gap-1.5 text-[12px] font-medium cursor-pointer"
                      style={{
                        background: buttonGlassBg,
                        borderColor: hairlineDivider,
                        color: "var(--text-primary)",
                      }}
                    >
                      <span className="truncate">
                        {wallets.find((w) => w.id === editDestWalletId)?.name ||
                          editDestWalletName ||
                          wallets.find((w) => w.id !== editWalletId)?.name ||
                          (isIndonesian ? "Pilih" : "Select")}
                      </span>
                      <ChevronRight
                        size={12}
                        className="shrink-0 text-[var(--text-tertiary)]"
                      />
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
                  className="w-full h-10 px-3 rounded-xl border text-[12px] font-medium bg-transparent outline-none tabular-nums"
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
                  className="w-full h-10 px-3 rounded-xl border text-[12px] font-medium bg-transparent outline-none tabular-nums"
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
                className="flex items-center gap-2 px-3 h-10 rounded-xl border"
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

            {/* Footer Actions: Cancel & Save */}
            <div className="flex items-center gap-2 pt-1.5">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setEditingItemId(null);
                }}
                className="flex-1 h-10.5 rounded-xl border font-semibold text-[12px] flex items-center justify-center cursor-pointer active:scale-[0.98]"
                style={{
                  background: buttonGlassBg,
                  borderColor: hairlineDivider,
                  color: "var(--text-secondary)",
                }}
              >
                {isIndonesian ? "Batal" : "Cancel"}
              </button>

              <button
                type="button"
                onClick={handleSaveEditView}
                className="flex-1 h-10.5 rounded-xl font-semibold text-[12.5px] flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
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
        ) : (
          /* ============================================================ */
          /* VIEW C: MAIN TRANSACTION REVIEW LIST (SINGLE SHEET)          */
          /* ============================================================ */
          <>
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
                      ? "Tinjau & Edit Transaksi"
                      : "Review & Edit Transactions"}
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

                const rawNote = (
                  it.cleanDescription ??
                  it.description ??
                  ""
                ).trim();
                const catNameLower = (it.suggestedCategoryName || "")
                  .trim()
                  .toLowerCase();
                const walNameLower = (it.walletName || "").trim().toLowerCase();
                const hasRealNote =
                  Boolean(rawNote) &&
                  rawNote.toLowerCase() !== "pengeluaran" &&
                  rawNote.toLowerCase() !== "expense" &&
                  rawNote.toLowerCase() !== "dana masuk" &&
                  rawNote.toLowerCase() !== "income" &&
                  rawNote.toLowerCase() !== "pemasukan" &&
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
                              openEditView(it);
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
                                openEditView(it);
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
                                openEditView(it);
                              }}
                              className="h-6 px-2 rounded-lg text-[10px] font-semibold flex items-center gap-1 cursor-pointer active:scale-95 transition-transform"
                              style={{
                                background: buttonGlassBg,
                                border: buttonGlassBorder,
                                color: "var(--text-primary)",
                              }}
                              title={
                                isIndonesian
                                  ? "Edit Transaksi"
                                  : "Edit Transaction"
                              }
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
                              handleToggleTypeOnCard(it.id);
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
                                triggerHaptic("light");
                                setPickerTargetItemId(it.id);
                                setSearchPickerQuery("");
                                setPickerMode("category");
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
                                  (isIndonesian
                                    ? "Pilih Kategori"
                                    : "Select Category")}
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
                                  triggerHaptic("light");
                                  setPickerTargetItemId(it.id);
                                  setSearchPickerQuery("");
                                  setPickerMode("wallet");
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
                                  {wallets.find((w) => w.id === it.walletId)
                                    ?.name ||
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
                                      triggerHaptic("light");
                                      setPickerTargetItemId(it.id);
                                      setSearchPickerQuery("");
                                      setPickerMode("dest_wallet");
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
                                        wallets.find(
                                          (w) => w.id !== it.walletId,
                                        )?.name ||
                                        (isIndonesian
                                          ? "Tujuan"
                                          : "Destination")}
                                    </span>
                                  </button>
                                </>
                              )}
                            </div>
                          )}

                          {/* Date & Time Pill (Pure Urbanist tabular-nums, Zero font-mono) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditView(it);
                            }}
                            className="h-5.5 px-2 rounded-full text-[9.5px] font-medium tabular-nums flex items-center gap-1 cursor-pointer active:scale-95"
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
          </>
        )}
      </div>
    </BottomSheet>
  );
}
