import { useState, useMemo } from "react";
import {
  Plus,
  Trash2,
  Search,
  X,
  ChevronRight,
  ChevronLeft,
  Target,
  AlertCircle,
} from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { GlassConfirmationModal } from "../ui/GlassConfirmationModal";
import { IconRenderer } from "../ui/IconRenderer";
import { MonochromeIconPickerModal } from "../ui/MonochromeIconPickerModal";
import { autoSuggestIcon } from "../../lib/iconRegistry";
import { triggerHaptic } from "../../lib/haptics";
import {
  useCategories,
  useAddCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "../../hooks/useCategories";
import { formatLiveAmountInput } from "../../lib/utils";
import { useToast } from "../../contexts/ToastContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";

interface CategoryManagementSheetsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CategoryManagementSheets({
  isOpen,
  onClose,
}: CategoryManagementSheetsProps) {
  const { data: categories = [] } = useCategories();
  const addCategory = useAddCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const { showToast } = useToast();
  const { theme } = useTheme();
  const { isIndonesian } = useLanguage();
  const {
    preferredCurrency,
    currencyMeta,
    convertToIdr,
    convertFromIdr,
    formatWithPreferred,
    formatCompactWithPreferred,
  } = useCurrency();
  const allowDecimals = currencyMeta.decimals > 0;
  const maxDecimals = currencyMeta.decimals;
  const isDark = theme !== "light";

  const budgetPresets = useMemo(() => {
    if (preferredCurrency === "IDR") {
      return [
        { label: "500k", val: 500000 },
        { label: "1M", val: 1000000 },
        { label: "2.5M", val: 2500000 },
        { label: "5M", val: 5000000 },
        { label: isIndonesian ? "Hapus" : "Clear", val: 0 },
      ];
    }
    return [
      { label: "50", val: 50 },
      { label: "100", val: 100 },
      { label: "250", val: 250 },
      { label: "500", val: 500 },
      { label: isIndonesian ? "Hapus" : "Clear", val: 0 },
    ];
  }, [preferredCurrency, isIndonesian]);

  const [viewMode, setViewMode] = useState<"list" | "edit" | "add">("list");
  const [manageCatTab, setManageCatTab] = useState<"expense" | "income">("expense");
  const [categorySearch, setCategorySearch] = useState("");
  const [catName, setCatName] = useState("");
  const [catType, setCatType] = useState<"expense" | "income">("expense");
  const [catIcon, setCatIcon] = useState("Tag");
  const [hasCustomPickedAddIcon, setHasCustomPickedAddIcon] = useState(false);
  const [iconPickerTarget, setIconPickerTarget] = useState<"add" | "edit" | null>(null);

  const [editCategory, setEditCategory] = useState<{
    id: string;
    name: string;
    emoji: string;
    budget_amount?: number | null;
    type?: string;
  } | null>(null);
  const [editCategoryBudget, setEditCategoryBudget] = useState("");
  const [catBudget, setCatBudget] = useState("");

  const [quickBudgetCategory, setQuickBudgetCategory] = useState<{
    id: string;
    name: string;
    emoji: string;
    budget_amount?: number | null;
  } | null>(null);
  const [quickBudgetValue, setQuickBudgetValue] = useState("");
  const [categoryToDelete, setCategoryToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const handleCloseAll = () => {
    setViewMode("list");
    setEditCategory(null);
    setQuickBudgetCategory(null);
    setQuickBudgetValue("");
    setCatBudget("");
    onClose();
  };

  const isDuplicateCatName = useMemo(() => {
    const trimmed = catName.trim().toLowerCase();
    if (!trimmed) return false;
    return categories.some(
      (c) => c.type === catType && c.name.trim().toLowerCase() === trimmed,
    );
  }, [catName, catType, categories]);

  const handleSaveCategory = () => {
    if (!catName.trim() || isDuplicateCatName) return;
    const finalIcon = catIcon || autoSuggestIcon(catName) || "Tag";
    const rawBudget = parseFloat(catBudget.replace(/,/g, ""));
    const numBudget = !isNaN(rawBudget) && rawBudget > 0
      ? Math.round(convertToIdr(rawBudget, preferredCurrency))
      : undefined;
    addCategory.mutate(
      {
        name: catName.trim(),
        emoji: finalIcon,
        type: catType,
        budget_amount: numBudget,
      },
      {
        onSuccess: () => {
          setViewMode("list");
          setCatName("");
          setCatBudget("");
          setCatIcon("Tag");
          setHasCustomPickedAddIcon(false);
          showToast(isIndonesian ? "Kategori dibuat" : "Category created", "add", () => {});
        },
      },
    );
  };


  const handleUpdateCategory = () => {
    if (!editCategory?.name.trim()) return;
    const rawBudget = parseFloat(editCategoryBudget.replace(/,/g, ""));
    const numBudget = !isNaN(rawBudget) && rawBudget > 0
      ? Math.round(convertToIdr(rawBudget, preferredCurrency))
      : null;
    updateCategory.mutate(
      {
        id: editCategory.id,
        name: editCategory.name.trim(),
        budget_amount: numBudget,
        emoji: editCategory.emoji || "Tag",
      },
      {
        onSuccess: () => {
          setViewMode("list");
          setEditCategory(null);
          showToast(isIndonesian ? "Kategori diperbarui" : "Category updated", "update", () => {});
        },
      },
    );
  };

  const handleOpenQuickBudget = (cat: {
    id: string;
    name: string;
    emoji: string;
    budget_amount?: number | null;
  }) => {
    triggerHaptic("light");
    setQuickBudgetCategory(cat);
    const converted = cat.budget_amount
      ? (preferredCurrency === "IDR"
          ? String(Math.round(cat.budget_amount))
          : String(Math.round(convertFromIdr(cat.budget_amount) * 100) / 100))
      : "";
    setQuickBudgetValue(converted);
  };

  const handleSaveQuickBudget = () => {
    if (!quickBudgetCategory) return;
    const rawBudget = parseFloat(quickBudgetValue.replace(/,/g, ""));
    const numBudget = !isNaN(rawBudget) && rawBudget > 0
      ? Math.round(convertToIdr(rawBudget, preferredCurrency))
      : null;
    updateCategory.mutate(
      {
        id: quickBudgetCategory.id,
        name: quickBudgetCategory.name,
        budget_amount: numBudget,
        emoji: quickBudgetCategory.emoji || "Tag",
      },
      {
        onSuccess: () => {
          setQuickBudgetCategory(null);
          setQuickBudgetValue("");
          showToast(
            numBudget
              ? (isIndonesian
                  ? `Batas bulanan diperbarui: ${formatWithPreferred(numBudget)}`
                  : `Monthly limit updated: ${formatWithPreferred(numBudget)}`)
              : (isIndonesian ? "Batas bulanan dihapus" : "Monthly limit removed"),
            "update",
            () => {},
          );
        },
      },
    );
  };

  const handleDeleteCategory = (id: string, name: string) => {
    triggerHaptic("medium");
    setCategoryToDelete({ id, name });
  };

  const executeDeleteCategory = (id: string) => {
    deleteCategory.mutate(id, {
      onSuccess: () => {
        if (editCategory?.id === id) {
          setViewMode("list");
          setEditCategory(null);
        }
        if (quickBudgetCategory?.id === id) {
          setQuickBudgetCategory(null);
        }
        showToast(
          isIndonesian ? "Kategori dihapus" : "Category deleted",
          "delete",
          () => {},
        );
        setCategoryToDelete(null);
      },
      onError: (error: any) => {
        showToast(
          error?.message ||
            (isIndonesian
              ? "Gagal menghapus kategori"
              : "Failed to delete category"),
          "error",
          () => {},
        );
        setCategoryToDelete(null);
      },
    });
  };

  const expenseCategories = categories.filter((c) => c.type === "expense");
  const incomeCategories = categories.filter((c) => c.type === "income");

  return (
    <>
      <BottomSheet isOpen={isOpen} onClose={handleCloseAll}>
        <div
          className="p-5 space-y-4"
          style={{
            paddingBottom:
              "max(calc(env(safe-area-inset-bottom, 0px) + 24px), 32px)",
          }}
        >
          {/* Header Bar */}
          {viewMode === "list" ? (
            <div className="flex items-center justify-between">
              <div>
                <h3
                  className="font-semibold text-base tracking-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  {isIndonesian ? "Kategori" : "Categories"}
                </h3>
                <p
                  className="text-[12px] mt-0.5"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {categories.length} {isIndonesian ? "total kategori · kapsul 2-kolom" : "total categories · 2-grid capsules"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setCatName("");
                    setCatType(manageCatTab);
                    setCatIcon("Tag");
                    setHasCustomPickedAddIcon(false);
                    setViewMode("add");
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm active:scale-95 cursor-pointer"
                  style={{
                    background: "var(--accent)",
                    color: "var(--accent-ink)",
                  }}
                  title={isIndonesian ? "Tambah Kategori" : "Add Category"}
                >
                  <Plus size={16} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={handleCloseAll}
                  className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer border border-[var(--glass-border)] bg-[var(--glass-fill)] text-[var(--text-secondary)] active:scale-95 transition-colors"
                  title={isIndonesian ? "Tutup" : "Close"}
                >
                  <X size={15} strokeWidth={1.75} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setViewMode("list");
                }}
                className="flex items-center gap-1 py-1 px-2 -ml-2 rounded-xl text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] active:scale-95 transition-all cursor-pointer"
              >
                <ChevronLeft size={16} strokeWidth={2} />
                <span>{isIndonesian ? "Kategori" : "Categories"}</span>
              </button>
              <h3
                className="font-semibold text-base tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                {viewMode === "edit"
                  ? (isIndonesian ? "Edit Kategori" : "Edit Category")
                  : (isIndonesian ? "Kategori Baru" : "New Category")}
              </h3>
              <button
                type="button"
                onClick={handleCloseAll}
                className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer border border-[var(--glass-border)] bg-[var(--glass-fill)] text-[var(--text-secondary)] active:scale-95 transition-colors"
                title={isIndonesian ? "Tutup" : "Close"}
              >
                <X size={15} strokeWidth={1.75} />
              </button>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* VIEW: LIST */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          {viewMode === "list" && (
            <div className="space-y-3.5">
              {/* Quick Search */}
              <div
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-[var(--bg-elevated)]"
              >
                <Search size={15} style={{ color: "var(--text-tertiary)" }} />
                <input
                  type="text"
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  placeholder={isIndonesian ? "Cari nama kategori..." : "Search category name..."}
                  className="bg-transparent text-[13px] font-medium flex-1 outline-none min-w-0"
                  style={{ color: "var(--text-primary)" }}
                />
                {categorySearch && (
                  <button
                    type="button"
                    onClick={() => setCategorySearch("")}
                    className="w-5 h-5 rounded-full flex items-center justify-center opacity-60 hover:opacity-100 cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Segmented Tab: Expense vs Income */}
              <div
                className="flex p-1 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-elevated)]"
              >
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setManageCatTab("expense");
                  }}
                  className={`flex-1 py-1.5 rounded-xl text-[12px] font-semibold transition-all cursor-pointer text-center ${
                    manageCatTab === "expense"
                      ? "bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm"
                      : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {isIndonesian ? "Pengeluaran" : "Expense"} ({expenseCategories.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setManageCatTab("income");
                  }}
                  className={`flex-1 py-1.5 rounded-xl text-[12px] font-semibold transition-all cursor-pointer text-center ${
                    manageCatTab === "income"
                      ? "bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm"
                      : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {isIndonesian ? "Pemasukan" : "Income"} ({incomeCategories.length})
                </button>
              </div>

              {/* 2-Column Luxury Pill Grid (Milky Glass in Light Mode, Obsidian in Dark Mode) */}
              {(() => {
                const filtered = categories
                  .filter((c) => c.type === manageCatTab)
                  .filter(
                    (c) =>
                      !categorySearch.trim() ||
                      c.name
                        .toLowerCase()
                        .includes(categorySearch.toLowerCase().trim()),
                  );

                if (filtered.length === 0) {
                  return (
                    <div className="py-12 text-center space-y-2">
                      <p
                        className="text-[12px] font-medium"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {categorySearch.trim()
                          ? (isIndonesian
                              ? `Tidak ada kategori yang cocok dengan "${categorySearch}"`
                              : `No categories found matching "${categorySearch}"`)
                          : (isIndonesian
                              ? `Belum ada kategori ${manageCatTab === "expense" ? "pengeluaran" : "pemasukan"}`
                              : `No ${manageCatTab} categories yet`)}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic("light");
                          setCatName(categorySearch.trim());
                          setCatType(manageCatTab);
                          setCatIcon("Tag");
                          setHasCustomPickedAddIcon(false);
                          setViewMode("add");
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border border-[var(--glass-border)] bg-[var(--glass-fill)] text-[var(--accent)] hover:border-[var(--accent)] active:scale-95 transition-all cursor-pointer"
                      >
                        <Plus size={13} strokeWidth={2} />
                        <span>{isIndonesian ? "Tambah Kategori" : "Add Category"}</span>
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-2 gap-2.5">
                    {filtered.map((cat) => {
                      const hasBudget =
                        cat.budget_amount && cat.budget_amount > 0;
                      return (
                        <div
                          key={cat.id}
                          onClick={() => {
                            triggerHaptic("light");
                            setEditCategory({
                              id: cat.id,
                              name: cat.name,
                              emoji: cat.emoji || "Tag",
                              budget_amount: cat.budget_amount,
                              type: cat.type,
                            });
                            const converted = cat.budget_amount
                              ? (preferredCurrency === "IDR"
                                  ? String(Math.round(cat.budget_amount))
                                  : String(Math.round(convertFromIdr(cat.budget_amount) * 100) / 100))
                              : "";
                            setEditCategoryBudget(converted);
                            setViewMode("edit");
                          }}
                          className="group relative min-w-0 p-3 rounded-[20px] transition-all cursor-pointer flex flex-col justify-between gap-2.5 active:scale-[0.98] select-none"
                          style={{
                            background: isDark
                              ? "linear-gradient(180deg, rgba(255,255,255,0.065) 0%, rgba(255,255,255,0.028) 100%)"
                              : "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.88) 48%, rgba(244,245,247,0.94) 100%)",
                            border: isDark
                              ? "1px solid rgba(255,255,255,0.09)"
                              : "1px solid rgba(255,255,255,0.94)",
                            boxShadow: isDark
                              ? "inset 0 1px 0 rgba(255,255,255,0.08), 0 3px 10px rgba(0,0,0,0.18)"
                              : "inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(255,255,255,0.4), 0 3px 12px rgba(15,23,42,0.05)",
                            backdropFilter: "blur(18px) saturate(155%)",
                            WebkitBackdropFilter: "blur(18px) saturate(155%)",
                          }}
                        >
                          {/* Top Tier: Icon Avatar & Category Name & Discrete Trash Icon */}
                          <div className="flex items-start justify-between gap-1.5 min-w-0">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div
                                className={`w-7.5 h-7.5 rounded-xl flex items-center justify-center shrink-0 transition-transform ${
                                  isDark
                                    ? "bg-white/[0.08] border border-white/10"
                                    : "bg-white/90 border border-black/[0.06] shadow-sm"
                                }`}
                              >
                                <IconRenderer
                                  icon={cat.emoji || "Tag"}
                                  size="w-3.5 h-3.5"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p
                                  className="font-semibold text-[12.5px] leading-tight truncate"
                                  style={{ color: "var(--text-primary)" }}
                                  title={cat.name}
                                >
                                  {cat.name}
                                </p>
                                <p className="text-[9.5px] text-[var(--text-tertiary)] uppercase tracking-wider mt-0.5">
                                  {cat.type === "expense"
                                    ? (isIndonesian ? "Pengeluaran" : "expense")
                                    : (isIndonesian ? "Pemasukan" : "income")}
                                </p>
                              </div>
                            </div>

                            {/* Discrete Delete Button with StopPropagation */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCategory(cat.id, cat.name);
                              }}
                              className="w-6 h-6 rounded-lg flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-fill)] active:scale-90 transition-all cursor-pointer shrink-0"
                              title={isIndonesian ? "Hapus Kategori" : "Delete Category"}
                            >
                              <Trash2 size={12} strokeWidth={1.75} />
                            </button>
                          </div>

                          {/* Bottom Tier: Budget Limit Micro-Pill & Edit Indicator */}
                          <div
                            className="flex items-center justify-between pt-2 border-t gap-1 text-[10.5px]"
                            style={{ borderColor: "var(--glass-border)" }}
                          >
                            {cat.type === "expense" ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenQuickBudget(cat);
                                }}
                                className=" text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1 active:scale-95 transition-all truncate cursor-pointer"
                                style={{
                                  background: hasBudget
                                    ? isDark
                                      ? "rgba(255, 255, 255, 0.06)"
                                      : "rgba(0, 0, 0, 0.04)"
                                    : "transparent",
                                  border: hasBudget
                                    ? "1px solid var(--glass-border)"
                                    : "1px dashed var(--glass-border)",
                                  color: hasBudget
                                    ? "var(--text-secondary)"
                                    : "var(--text-tertiary)",
                                }}
                                title={isIndonesian ? "Ketuk untuk mengatur batas anggaran bulanan" : "Tap to set monthly budget limit"}
                              >
                                <Target
                                  size={10}
                                  strokeWidth={2}
                                  className="opacity-70 shrink-0"
                                />
                                <span className="truncate">
                                  {hasBudget
                                    ? formatCompactWithPreferred(cat.budget_amount || 0)
                                    : (isIndonesian ? "+ Batas" : "+ Limit")}
                                </span>
                              </button>
                            ) : (
                              <span className="text-[9.5px]  text-[var(--text-tertiary)]">
                                {isIndonesian ? "Pemasukan" : "Inflow"}
                              </span>
                            )}

                            <div className="flex items-center text-[var(--text-tertiary)] opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0">
                              <ChevronRight size={13} strokeWidth={2} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* VIEW: EDIT */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          {viewMode === "edit" && editCategory && (
            <div className="space-y-4 pt-1">
              <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-elevated)] divide-y divide-[var(--glass-border)] overflow-hidden shadow-sm">
                {/* Row 1: Icon & Name */}
                <div className="p-3.5 space-y-1.5">
                  <label
                    className="text-[10px] font-semibold uppercase tracking-wider block"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {isIndonesian ? "Ikon & Nama" : "Icon & Name"}
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        setIconPickerTarget("edit");
                      }}
                      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition-transform cursor-pointer border border-[var(--glass-border)] bg-[var(--glass-fill)] hover:border-black/20 dark:hover:border-white/25"
                      title={isIndonesian ? "Ubah Ikon" : "Change Icon"}
                    >
                      <IconRenderer icon={editCategory.emoji || "Tag"} size="w-5 h-5" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={editCategory.name}
                        onChange={(e) =>
                          setEditCategory((prev) =>
                            prev ? { ...prev, name: e.target.value } : null,
                          )
                        }
                        placeholder={isIndonesian ? "Nama Kategori" : "Category Name"}
                        className="w-full min-w-0 px-3.5 py-2.5 rounded-xl border-0 border-none outline-none focus:outline-none appearance-none font-medium text-[13px] bg-[var(--glass-fill)] transition-all"
                        style={{ color: "var(--text-primary)" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Row 2: Budget Limit (If Expense) */}
                {editCategory.type === "expense" && (
                  <div className="p-3.5 space-y-1.5">
                    <label
                      className="text-[10px] font-semibold uppercase tracking-wider block"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {isIndonesian
                        ? `Batas Anggaran Bulanan (${currencyMeta.code})`
                        : `Monthly Budget Limit (${currencyMeta.code})`}
                    </label>
                    <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[var(--glass-fill)]">
                      <span className="text-[12px] font-semibold text-[var(--text-tertiary)]">
                        {currencyMeta.symbol}
                      </span>
                      <input
                        type="text"
                        inputMode={allowDecimals ? "decimal" : "numeric"}
                        value={editCategoryBudget}
                        onChange={(e) =>
                          setEditCategoryBudget(
                            formatLiveAmountInput(
                              e.target.value,
                              isIndonesian && !allowDecimals,
                              allowDecimals,
                              maxDecimals,
                            ).formatted
                          )
                        }
                        placeholder={
                          isIndonesian
                            ? `cth. 100 (kosongkan jika tanpa batas)`
                            : `e.g. 100 (leave blank for no limit)`
                        }
                        className="w-full min-w-0 bg-transparent outline-none font-medium text-[13px]"
                        style={{ color: "var(--text-primary)" }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleUpdateCategory}
                  className="w-full h-11 rounded-xl font-semibold text-[13px] active:scale-[0.98] transition-all cursor-pointer shadow-sm flex items-center justify-center"
                  style={{
                    background: "var(--text-primary)",
                    color: "var(--bg-base)",
                  }}
                >
                  {isIndonesian ? "Simpan Perubahan" : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(editCategory.id, editCategory.name)}
                  className="w-full h-10 rounded-xl font-semibold text-[12px] active:scale-[0.98] transition-all cursor-pointer border border-[var(--glass-border)] bg-[var(--glass-fill)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={13} strokeWidth={1.5} />
                  <span>{isIndonesian ? "Hapus Kategori" : "Delete Category"}</span>
                </button>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────── */}
          {/* VIEW: ADD */}
          {/* ─────────────────────────────────────────────────────────────────── */}
          {viewMode === "add" && (
            <div className="space-y-4 pt-1">
              <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-elevated)] divide-y divide-[var(--glass-border)] overflow-hidden shadow-sm">
                {/* Row 1: Type Pill */}
                <div className="p-3.5 space-y-1.5">
                  <label
                    className="text-[10px] font-semibold uppercase tracking-wider block"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {isIndonesian ? "Klasifikasi" : "Classification"}
                  </label>
                  <div className="flex p-1 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill)]">
                    {(["expense", "income"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setCatType(t)}
                        className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition-all cursor-pointer text-center ${
                          catType === t
                            ? "bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm"
                            : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        {t === "expense"
                          ? (isIndonesian ? "Pengeluaran" : "Expense")
                          : (isIndonesian ? "Pemasukan" : "Income")}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Row 2: Icon & Name */}
                <div className="p-3.5 space-y-1.5">
                  <label
                    className="text-[10px] font-semibold uppercase tracking-wider block"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {isIndonesian ? "Ikon & Nama" : "Icon & Name"}
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic("light");
                        setIconPickerTarget("add");
                      }}
                      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition-transform cursor-pointer border border-[var(--glass-border)] bg-[var(--glass-fill)] hover:border-black/20 dark:hover:border-white/25"
                      title={isIndonesian ? "Ketuk untuk mengubah ikon" : "Tap to change icon"}
                    >
                      <IconRenderer icon={catIcon} size="w-5 h-5" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={catName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCatName(val);
                          if (!hasCustomPickedAddIcon) {
                            const suggested = autoSuggestIcon(val);
                            if (suggested) setCatIcon(suggested);
                          }
                        }}
                        placeholder={isIndonesian ? "cth. Kopi, Langganan, Belanja" : "e.g. Coffee, Streaming, Groceries"}
                        className="w-full min-w-0 px-3.5 py-2.5 rounded-xl border-0 border-none outline-none focus:outline-none appearance-none font-medium text-[13px] bg-[var(--glass-fill)] transition-all"
                        style={{ color: "var(--text-primary)" }}
                      />
                    </div>
                  </div>
                </div>

                {catType === "expense" && (
                  <div className="p-3.5 space-y-1.5">
                    <label
                      className="text-[10px] font-semibold uppercase tracking-wider block"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {isIndonesian
                        ? `Batas Anggaran Bulanan (${currencyMeta.code})`
                        : `Monthly Budget Limit (${currencyMeta.code})`}
                    </label>
                    <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[var(--glass-fill)]">
                      <span className="text-[12px] font-semibold text-[var(--text-tertiary)]">
                        {currencyMeta.symbol}
                      </span>
                      <input
                        type="text"
                        inputMode={allowDecimals ? "decimal" : "numeric"}
                        value={catBudget}
                        onChange={(e) =>
                          setCatBudget(
                            formatLiveAmountInput(
                              e.target.value,
                              isIndonesian && !allowDecimals,
                              allowDecimals,
                              maxDecimals,
                            ).formatted
                          )
                        }
                        placeholder={
                          isIndonesian
                            ? `cth. 100 (kosongkan jika tanpa batas)`
                            : `e.g. 100 (leave blank for no limit)`
                        }
                        className="w-full min-w-0 bg-transparent outline-none font-medium text-[13px]"
                        style={{ color: "var(--text-primary)" }}
                      />
                    </div>
                  </div>
                )}
              </div>


              {/* Duplicate Name Realtime Warning Pill */}
              {isDuplicateCatName && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill)] text-[11px] text-[var(--text-secondary)]">
                  <AlertCircle size={14} className="shrink-0 text-[var(--text-tertiary)]" strokeWidth={1.75} />
                  <span>
                    {isIndonesian
                      ? "Kategori dengan nama ini sudah ada. Pilih nama lain agar tidak ganda."
                      : "A category with this name already exists. Choose a different name."}
                  </span>
                </div>
              )}

              {/* Primary Action Button */}
              <button
                type="button"
                onClick={handleSaveCategory}
                disabled={!catName.trim() || isDuplicateCatName}
                className="w-full h-11 rounded-xl font-semibold text-[13px] active:scale-[0.98] transition-all cursor-pointer shadow-sm flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: "var(--text-primary)",
                  color: "var(--bg-base)",
                }}
              >
                {isIndonesian ? "Buat Kategori" : "Create Category"}
              </button>
            </div>
          )}
        </div>
      </BottomSheet>

      {/* Quick Budget Limit Adjuster Sheet */}
      <BottomSheet
        isOpen={quickBudgetCategory !== null}
        onClose={() => {
          setQuickBudgetCategory(null);
          setQuickBudgetValue("");
        }}
      >
        <div
          className="p-5 space-y-4"
          style={{
            paddingBottom:
              "max(calc(env(safe-area-inset-bottom, 0px) + 24px), 32px)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isDark
                    ? "bg-white/[0.08] border border-white/10"
                    : "bg-white/90 border border-black/[0.06] shadow-sm"
                }`}
              >
                <IconRenderer
                  icon={quickBudgetCategory?.emoji || "Tag"}
                  size="w-4.5 h-4.5"
                />
              </div>
              <div className="min-w-0">
                <h3
                  className="font-semibold text-base tracking-tight truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {quickBudgetCategory?.name}
                </h3>
                <p
                  className="text-[11px] truncate"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian ? "Batas anggaran amplop bulanan" : "Monthly envelope budget limit"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setQuickBudgetCategory(null);
                setQuickBudgetValue("");
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer border border-[var(--glass-border)] bg-[var(--glass-fill)] text-[var(--text-secondary)] active:scale-95 transition-colors"
              title={isIndonesian ? "Tutup" : "Close"}
            >
              <X size={15} strokeWidth={1.75} />
            </button>
          </div>

          {/* Input Container (Milky Glass in Light Mode, Obsidian in Dark Mode) */}
          <div
            className="p-4 rounded-2xl border space-y-3"
            style={{
              background: isDark
                ? "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)"
                : "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.88) 48%, rgba(244,245,247,0.94) 100%)",
              borderColor: "var(--glass-border)",
              boxShadow: isDark
                ? "0 2px 8px rgba(0,0,0,0.22)"
                : "0 1px 4px rgba(15,23,42,0.04)",
            }}
          >
            <label
              className="text-[10px] font-semibold uppercase tracking-wider block"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian
                ? `Nominal Batas Bulanan (${currencyMeta.code})`
                : `Monthly Limit Amount (${currencyMeta.code})`}
            </label>
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[var(--glass-fill)]">
              <span className="text-[12px] font-semibold text-[var(--text-tertiary)]">
                {currencyMeta.symbol}
              </span>
              <input
                type="text"
                inputMode={allowDecimals ? "decimal" : "numeric"}
                value={quickBudgetValue}
                onChange={(e) =>
                  setQuickBudgetValue(
                    formatLiveAmountInput(
                      e.target.value,
                      isIndonesian && !allowDecimals,
                      allowDecimals,
                      maxDecimals,
                    ).formatted
                  )
                }
                placeholder={isIndonesian ? "0 (kosongkan jika tanpa batas)" : "0 (leave empty for no cap)"}
                className="w-full min-w-0 bg-transparent outline-none font-medium text-[14px]"
                style={{ color: "var(--text-primary)" }}
              />
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
              {budgetPresets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setQuickBudgetValue(p.val === 0 ? "" : String(p.val));
                  }}
                  className="px-2.5 py-1 rounded-lg text-[10.5px] border border-[var(--glass-border)] bg-[var(--glass-fill)] hover:border-black/20 dark:hover:border-white/20 active:scale-95 transition-all cursor-pointer"
                  style={{
                    color:
                      p.val === 0
                        ? "var(--text-tertiary)"
                        : "var(--text-secondary)",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setQuickBudgetCategory(null);
                setQuickBudgetValue("");
              }}
              className="flex-1 h-11 rounded-xl font-semibold text-[13px] border border-[var(--glass-border)] bg-[var(--glass-fill)] text-[var(--text-secondary)] active:scale-[0.98] transition-all cursor-pointer"
            >
              {isIndonesian ? "Batal" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={handleSaveQuickBudget}
              className="flex-1 h-11 rounded-xl font-semibold text-[13px] active:scale-[0.98] transition-all cursor-pointer shadow-sm flex items-center justify-center"
              style={{
                background: "var(--text-primary)",
                color: "var(--bg-base)",
              }}
            >
              {isIndonesian ? "Simpan Batas" : "Save Limit"}
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Universal Monochrome Icon Picker Modal */}
      <MonochromeIconPickerModal
        isOpen={iconPickerTarget !== null}
        onClose={() => setIconPickerTarget(null)}
        selectedIcon={
          iconPickerTarget === "add" ? catIcon : editCategory?.emoji || "Tag"
        }
        onSelectIcon={(iconName) => {
          if (iconPickerTarget === "add") {
            setCatIcon(iconName);
            setHasCustomPickedAddIcon(true);
          } else if (iconPickerTarget === "edit") {
            setEditCategory((prev) =>
              prev ? { ...prev, emoji: iconName } : null,
            );
          }
        }}
        title={
          iconPickerTarget === "add"
            ? (isIndonesian ? "Pilih Ikon Kategori" : "Choose Category Icon")
            : (isIndonesian ? "Edit Ikon Kategori" : "Edit Category Icon")
        }
      />

      <GlassConfirmationModal
        isOpen={categoryToDelete !== null}
        onClose={() => setCategoryToDelete(null)}
        onConfirm={() => {
          if (categoryToDelete) {
            executeDeleteCategory(categoryToDelete.id);
          }
        }}
        title={
          isIndonesian
            ? `Hapus Kategori "${categoryToDelete?.name}"?`
            : `Delete Category "${categoryToDelete?.name}"?`
        }
        description={
          isIndonesian
            ? "Transaksi yang menggunakan kategori ini akan beralih menjadi tanpa kategori. Anda dapat mengubah kategori transaksi tersebut kapan saja."
            : "Transactions assigned to this category will become uncategorized. You can reassign them at any time."
        }
        confirmLabel={isIndonesian ? "Hapus Kategori" : "Delete Category"}
        isIndonesian={isIndonesian}
        isDark={isDark}
      />
    </>
  );
}
