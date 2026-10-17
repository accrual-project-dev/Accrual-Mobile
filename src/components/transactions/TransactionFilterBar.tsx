import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  SlidersHorizontal,
  CheckSquare,
  Calendar,
  Wallet,
  Tag,
} from "lucide-react";
import { triggerHaptic } from "../../lib/haptics";
import { formatCurrency } from "../../lib/utils";
import type { Category } from "../../lib/types";
import type { FilterType, TimeRangeType } from "./TransactionHorizonBarChart";
import { useTheme } from "../../contexts/ThemeContext";
import { useCurrency } from "../../contexts/CurrencyContext";

export interface TransactionFilterBarProps {
  search: string;
  onSearchChange: (val: string) => void;
  isSearchFocused: boolean;
  onFocusSearch: () => void;
  onBlurSearch: () => void;
  onClearSearch: () => void;
  filter: FilterType;
  onFilterChange: (type: FilterType) => void;
  filterTabs: { key: FilterType; label: string }[];
  activeFiltersCount: number;
  onOpenFilterSheet: () => void;
  isSelectMode: boolean;
  onToggleSelectMode: () => void;
  timeRange: TimeRangeType;
  selectedMonthLabel: string;
  onResetTimeRange: () => void;
  selectedWalletName: string | null;
  onResetWallet: () => void;
  selectedCategoryIds: string[];
  categories: Category[];
  onRemoveCategory: (cid: string) => void;
  minAmount: string;
  maxAmount: string;
  onResetAmount: () => void;
  onResetAllFilters: () => void;
  isIndonesian: boolean;
  searchScope?: "current" | "all";
  onSearchScopeChange?: (scope: "current" | "all") => void;
  currentScopeCount?: number;
  allTimeScopeCount?: number;
}

export const TransactionFilterBar = memo(function TransactionFilterBar({
  search,
  onSearchChange,
  isSearchFocused,
  onFocusSearch,
  onBlurSearch,
  onClearSearch,
  filter,
  onFilterChange,
  filterTabs,
  activeFiltersCount,
  onOpenFilterSheet,
  isSelectMode,
  onToggleSelectMode,
  timeRange,
  selectedMonthLabel,
  onResetTimeRange,
  selectedWalletName,
  onResetWallet,
  selectedCategoryIds,
  categories,
  onRemoveCategory,
  minAmount,
  maxAmount,
  onResetAmount,
  onResetAllFilters,
  isIndonesian,
  searchScope = "current",
  onSearchScopeChange,
  currentScopeCount = 0,
  allTimeScopeCount = 0,
}: TransactionFilterBarProps) {
  const { theme } = useTheme();
  const { preferredCurrency } = useCurrency();
  const isDark = theme !== "light";

  return (
    <>
      {/* Full-Width Search Bar with Dynamic Focus Animation */}
      <div
        className="flex items-center pl-3.5 pr-2 py-1.5 rounded-2xl mb-2.5 no-pull transition-all duration-200"
        style={{
          background: isDark
            ? "linear-gradient(160deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)"
            : "linear-gradient(160deg, rgba(255, 255, 255, 0.96) 0%, rgba(246, 247, 250, 0.88) 100%)",
          border: isSearchFocused
            ? isDark
              ? "1px solid rgba(255, 255, 255, 0.3)"
              : "1px solid rgba(0, 0, 0, 0.25)"
            : isDark
              ? "1px solid rgba(255, 255, 255, 0.08)"
              : "1px solid rgba(0, 0, 0, 0.06)",
          boxShadow: isSearchFocused
            ? isDark
              ? "0 8px 24px -4px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
              : "0 6px 20px -4px rgba(0, 0, 0, 0.08), inset 0 1px 0 #ffffff"
            : isDark
              ? "0 4px 16px -2px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.06)"
              : "0 2px 10px -2px rgba(31, 36, 48, 0.04), inset 0 1px 0 #ffffff",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
        }}
      >
        <Search
          size={16}
          className="shrink-0"
          style={{
            color: isSearchFocused
              ? "var(--text-primary)"
              : "var(--text-tertiary)",
          }}
        />
        <input
          type="text"
          value={search}
          onFocus={onFocusSearch}
          onBlur={onBlurSearch}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={isIndonesian ? "Cari transaksi..." : "Search transactions..."}
          className="w-full bg-transparent pl-2.5 pr-2 py-1 text-[13px] outline-none font-semibold touch-manipulation no-pull min-w-0"
          style={{ color: "var(--text-primary)" }}
        />
        {search && (
          <button
            type="button"
            onClick={() => {
              onClearSearch();
              triggerHaptic("light");
            }}
            className="p-1 rounded-full shrink-0 mr-1 touch-manipulation cursor-pointer"
            style={{ color: "var(--text-tertiary)" }}
          >
            <X size={14} />
          </button>
        )}

        {/* Smooth hiding of side buttons (Filters & Select) when search is focused or active */}
        <AnimatePresence>
          {!isSearchFocused && !search && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, width: 0 }}
              animate={{ opacity: 1, scale: 1, width: "auto" }}
              exit={{ opacity: 0, scale: 0.9, width: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center shrink-0 overflow-hidden"
            >
              {/* Filter Trigger Button */}
              <div className="h-4 w-[1px] bg-white/10 shrink-0 mx-1" />
              <button
                type="button"
                onClick={() => {
                  onOpenFilterSheet();
                  triggerHaptic("light");
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl active:scale-95 transition-all shrink-0 touch-manipulation cursor-pointer select-none no-pull"
                style={{
                  background:
                    activeFiltersCount > 0
                      ? isDark ? "#FFFFFF" : "#18181B"
                      : isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
                  color:
                    activeFiltersCount > 0
                      ? isDark ? "#09090c" : "#FFFFFF"
                      : "var(--text-secondary)",
                  border:
                    activeFiltersCount > 0
                      ? isDark ? "1px solid #FFFFFF" : "1px solid #18181B"
                      : isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
                }}
                title={isIndonesian ? "Filter Lanjutan" : "Advanced Filters"}
              >
                <SlidersHorizontal size={13} />
                <span className="text-[11px] font-semibold">
                  {isIndonesian ? "Filter" : "Filters"}
                </span>
                {activeFiltersCount > 0 && (
                  <span
                    className="w-4 h-4 rounded-full text-[9px] font-semibold flex items-center justify-center"
                    style={{
                      background: isDark ? "#09090c" : "#FFFFFF",
                      color: isDark ? "#FFFFFF" : "#18181B",
                    }}
                  >
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              {/* Select Mode Trigger Button */}
              <div className="h-4 w-[1px] bg-white/10 shrink-0 mx-1" />
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("medium");
                  onToggleSelectMode();
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl active:scale-95 transition-all shrink-0 touch-manipulation cursor-pointer select-none no-pull"
                style={{
                  background: isSelectMode
                    ? isDark ? "#FFFFFF" : "#18181B"
                    : isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
                  color: isSelectMode
                    ? isDark ? "#09090c" : "#FFFFFF"
                    : "var(--text-secondary)",
                  border: isSelectMode
                    ? isDark ? "1px solid #FFFFFF" : "1px solid #18181B"
                    : isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
                }}
                title={
                  isSelectMode
                    ? isIndonesian ? "Keluar Mode Pilihan" : "Exit Select Mode"
                    : isIndonesian ? "Pilih Transaksi" : "Select Transactions"
                }
              >
                <CheckSquare size={13} />
                <span className="text-[11px] font-semibold">
                  {isSelectMode ? (isIndonesian ? "Selesai" : "Done") : (isIndonesian ? "Pilih" : "Select")}
                </span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Search Scope Filter Strip (Current Period vs All Time) */}
      <AnimatePresence>
        {search.trim().length > 0 && timeRange !== "all" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-1.5 mb-2.5 px-0.5 overflow-x-auto no-scrollbar"
          >
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onSearchScopeChange?.("current");
              }}
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all touch-manipulation cursor-pointer shrink-0 active:scale-95"
              style={{
                background:
                  searchScope === "current"
                    ? "var(--text-primary)"
                    : "var(--glass-fill)",
                color:
                  searchScope === "current"
                    ? "var(--bg-base)"
                    : "var(--text-secondary)",
                border:
                  searchScope === "current"
                    ? "1px solid var(--text-primary)"
                    : "1px solid var(--glass-border)",
              }}
            >
              {selectedMonthLabel || (isIndonesian ? "Periode Ini" : "Current Period")}{" "}
              <span className="opacity-75 text-[10px]">({currentScopeCount})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onSearchScopeChange?.("all");
              }}
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all touch-manipulation cursor-pointer shrink-0 active:scale-95"
              style={{
                background:
                  searchScope === "all"
                    ? "var(--text-primary)"
                    : currentScopeCount === 0 && allTimeScopeCount > 0
                      ? "rgba(255, 255, 255, 0.12)"
                      : "var(--glass-fill)",
                color:
                  searchScope === "all"
                    ? "var(--bg-base)"
                    : currentScopeCount === 0 && allTimeScopeCount > 0
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                border:
                  searchScope === "all"
                    ? "1px solid var(--text-primary)"
                    : currentScopeCount === 0 && allTimeScopeCount > 0
                      ? "1px solid rgba(255, 255, 255, 0.3)"
                      : "1px solid var(--glass-border)",
              }}
            >
              {isIndonesian ? "Semua Waktu" : "All Time"}{" "}
              <span className="opacity-75 text-[10px]">({allTimeScopeCount})</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unified Clean Filter Tabs */}
      <div
        className="flex p-1 rounded-full no-pull"
        style={{
          background: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.03)",
          border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
        }}
      >
        {filterTabs.map((tab) => {
          const isSelected = filter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                onFilterChange(tab.key);
                triggerHaptic("light");
              }}
              className="flex-1 py-1.5 rounded-full text-[12px] font-bold transition-all touch-manipulation cursor-pointer select-none no-pull"
              style={{
                background: isSelected
                  ? isDark
                    ? "#FFFFFF"
                    : "#18181B"
                  : "transparent",
                color: isSelected
                  ? isDark
                    ? "#09090c"
                    : "#FFFFFF"
                  : "var(--text-secondary)",
                boxShadow: isSelected
                  ? isDark
                    ? "0 2px 8px rgba(0, 0, 0, 0.4)"
                    : "0 2px 8px rgba(0, 0, 0, 0.12)"
                  : "none",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active Filter Chips Strip */}
      {activeFiltersCount > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1.5 mt-2">
          {timeRange !== "this_month" && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0"
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)",
                color: "var(--text-primary)",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
              }}
            >
              <Calendar size={11} className="opacity-70" />
              <span>{selectedMonthLabel}</span>
              <button
                type="button"
                onClick={() => {
                  onResetTimeRange();
                  triggerHaptic("light");
                }}
                className="p-0.5 rounded-full hover:opacity-80 cursor-pointer"
              >
                <X size={10} />
              </button>
            </span>
          )}

          {selectedWalletName && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0"
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)",
                color: "var(--text-primary)",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
              }}
            >
              <Wallet size={11} className="opacity-70" />
              <span>{selectedWalletName}</span>
              <button
                type="button"
                onClick={() => {
                  onResetWallet();
                  triggerHaptic("light");
                }}
                className="p-0.5 rounded-full hover:opacity-80 cursor-pointer"
              >
                <X size={10} />
              </button>
            </span>
          )}

          {selectedCategoryIds.map((cid) => {
            const cat = categories.find((c) => c.id === cid);
            return (
              <span
                key={cid}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0"
                style={{
                  background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)",
                  color: "var(--text-primary)",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
                }}
              >
                <Tag size={11} className="opacity-70" />
                <span>{cat?.name || (isIndonesian ? "Kategori" : "Category")}</span>
                <button
                  type="button"
                  onClick={() => {
                    onRemoveCategory(cid);
                    triggerHaptic("light");
                  }}
                  className="p-0.5 rounded-full hover:opacity-80 cursor-pointer"
                >
                  <X size={10} />
                </button>
              </span>
            );
          })}

          {(minAmount || maxAmount) && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0"
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)",
                color: "var(--text-primary)",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
              }}
            >
              <span>
                {minAmount && maxAmount
                  ? `${formatCurrency(Number(minAmount), preferredCurrency)} - ${formatCurrency(Number(maxAmount), preferredCurrency)}`
                  : minAmount
                    ? `≥ ${formatCurrency(Number(minAmount), preferredCurrency)}`
                    : `≤ ${formatCurrency(Number(maxAmount), preferredCurrency)}`}
              </span>
              <button
                type="button"
                onClick={() => {
                  onResetAmount();
                  triggerHaptic("light");
                }}
                className="p-0.5 rounded-full hover:opacity-80 cursor-pointer"
              >
                <X size={10} />
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={onResetAllFilters}
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 touch-manipulation cursor-pointer select-none"
            style={{
              color: isDark ? "#FFFFFF" : "#18181B",
              background: "transparent",
            }}
          >
            {isIndonesian ? "Hapus semua" : "Clear all"}
          </button>
        </div>
      )}
    </>
  );
});
