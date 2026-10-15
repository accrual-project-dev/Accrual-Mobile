import React, { memo, useMemo, useRef } from "react";
import { motion, type PanInfo, useMotionValue, useTransform } from "framer-motion";
import {
  ArrowLeftRight,
  Clock,
  Scale,
  Trash2,
  Copy,
  Check,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { formatCurrency } from "../../lib/utils";
import { IconRenderer } from "../ui/IconRenderer";
import { resolveTransactionCategory } from "../../lib/categoryResolver";
import { triggerHaptic } from "../../lib/haptics";
import type { Transaction, Category } from "../../lib/types";
import { isCorrectionTx } from "../../lib/financialMath";
import { usePrivacy } from "../../contexts/PrivacyContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useCurrency } from "../../contexts/CurrencyContext";

interface TransactionItemProps {
  tx: Transaction;
  categories: Category[];
  categoryMap?: Map<string, Category>;
  fromWalletName: string;
  toWalletName: string;
  isUnusual?: boolean;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onClick: (tx: Transaction) => void;
  onDelete?: (tx: Transaction) => void;
  onDuplicate?: (tx: Transaction) => void;
  onToggleSelect?: (tx: Transaction) => void;
  onLongPress?: (tx: Transaction) => void;
}

const TransactionItemComponent: React.FC<TransactionItemProps> = ({
  tx,
  categories,
  categoryMap,
  fromWalletName,
  toWalletName,
  isUnusual,
  isSelectMode,
  isSelected,
  onClick,
  onDelete,
  onDuplicate,
  onToggleSelect,
  onLongPress,
}) => {
  const { isStealthMode } = usePrivacy();
  const { isIndonesian } = useLanguage();
  const { preferredCurrency, currencyMeta } = useCurrency();
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const isIncome = tx.type === "income";
  const isTransfer = tx.type === "transfer";
  const isCorrection = isCorrectionTx(tx);
  const isPositiveCorrection =
    isCorrection && (tx.note?.includes("(+)") || tx.type === "income");
  const timeLabel = useMemo(() => {
    if (tx.occurred_on && /[T ]\d{2}:\d{2}/.test(tx.occurred_on)) {
      try {
        return format(parseISO(tx.occurred_on.replace(" ", "T")), "HH:mm");
      } catch {
        // fallback to created_at
      }
    }
    if (tx.created_at) {
      try {
        return format(new Date(tx.created_at), "HH:mm");
      } catch {
        return "";
      }
    }
    return "";
  }, [tx.occurred_on, tx.created_at]);

  const resolvedCategory = useMemo(() => {
    return resolveTransactionCategory(tx, categoryMap || categories);
  }, [tx, categoryMap, categories]);

  const categoryDisplayName = resolvedCategory.name;
  const categoryDisplayEmoji = resolvedCategory.emoji;

  const isDraggingRef = useRef(false);
  const longPressTimerRef = useRef<any>(null);

  // Motion value for horizontal swipe with fade-in reveal for actions
  const dragX = useMotionValue(0);
  const revealOpacity = useTransform(dragX, [-80, -20, 0, 20, 80], [1, 0.4, 0, 0.4, 1]);

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handlePointerDown = () => {
    clearLongPress();
    if (!isSelectMode && onLongPress) {
      longPressTimerRef.current = setTimeout(() => {
        if (!isDraggingRef.current) {
          triggerHaptic("heavy");
          onLongPress(tx);
        }
      }, 550);
    }
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    clearLongPress();
    // Swipe Left: Delete (Threshold -75px atau velocity < -350)
    if (info.offset.x < -75 || info.velocity.x < -350) {
      triggerHaptic("heavy");
      onDelete?.(tx);
    }
    // Swipe Right: Duplicate (Threshold +75px atau velocity > +350)
    else if (info.offset.x > 75 || info.velocity.x > 350) {
      triggerHaptic("medium");
      onDuplicate?.(tx);
    }
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 150);
  };

  const handleTapOrClick = () => {
    clearLongPress();
    if (isDraggingRef.current) return;
    if (isSelectMode) {
      triggerHaptic("light");
      onToggleSelect?.(tx);
    } else {
      onClick(tx);
    }
  };

  // ── Apple Liquid Glass Studio Tokens ──
  const cardBg = isSelected
    ? isDark
      ? "rgba(255, 255, 255, 0.08)"
      : "rgba(0, 0, 0, 0.05)"
    : isDark
      ? "linear-gradient(160deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.015) 100%)"
      : "linear-gradient(160deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 247, 250, 0.90) 100%)";

  const cardBorder = isSelected
    ? isDark
      ? "1px solid rgba(255, 255, 255, 0.35)"
      : "1px solid rgba(0, 0, 0, 0.25)"
    : isDark
      ? "1px solid rgba(255, 255, 255, 0.08)"
      : "1px solid rgba(0, 0, 0, 0.06)";

  const cardShadow = isDark
    ? "0 10px 28px -6px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.12)"
    : "0 4px 16px -3px rgba(31, 36, 48, 0.06), inset 0 1px 0 #ffffff";

  const iconBg = isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.035)";

  const iconBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.08)"
    : "1px solid rgba(0, 0, 0, 0.06)";

  return (
    <div className="relative rounded-[20px] overflow-hidden select-none touch-pan-y">
      {/* Background Actions Reveal Layer (Transparent when idle to eliminate muddy blur) */}
      {!isSelectMode && (
        <motion.div
          className="absolute inset-0 flex items-center justify-between px-5 rounded-[20px]"
          style={{
            opacity: revealOpacity,
            background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid rgba(0, 0, 0, 0.04)",
          }}
        >
          {/* Left Side: Duplicate */}
          <div className="flex items-center gap-1.5 text-[var(--text-secondary)] font-semibold text-[11.5px]">
            <Copy size={15} strokeWidth={2} />
            <span>{isIndonesian ? "Duplikasi" : "Duplicate"}</span>
          </div>

          {/* Right Side: Delete */}
          <div className="flex items-center gap-1.5 text-[var(--text-primary)] font-semibold text-[11.5px]">
            <span>{isIndonesian ? "Hapus" : "Delete"}</span>
            <Trash2 size={15} strokeWidth={2} />
          </div>
        </motion.div>
      )}

      {/* Foreground Swipeable Card */}
      <motion.div
        drag={isSelectMode ? false : "x"}
        dragDirectionLock
        dragMomentum={false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.35}
        dragSnapToOrigin
        onPointerDown={handlePointerDown}
        onPointerUp={clearLongPress}
        onPointerCancel={clearLongPress}
        onDragStart={() => {
          clearLongPress();
          isDraggingRef.current = true;
        }}
        onDragEnd={handleDragEnd}
        onTap={handleTapOrClick}
        className="p-3 sm:p-3.5 rounded-[20px] flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform relative z-10"
        style={{
          x: dragX,
          willChange: "transform",
          transform: "translateZ(0)",
          background: cardBg,
          border: cardBorder,
          boxShadow: cardShadow,
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
        }}
      >
        {/* Specular Rim Highlight */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[12%] right-[12%] top-[1px] h-[1.5px] rounded-full"
          style={{
            background: isDark
              ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), rgba(255,255,255,0.45), rgba(255,255,255,0.25), transparent)"
              : "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), rgba(255,255,255,1), rgba(255,255,255,0.8), transparent)",
          }}
        />
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          {/* Selection Checkbox */}
          {isSelectMode && (
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              className="shrink-0 mr-0.5"
            >
              <div
                className="w-4.5 h-4.5 rounded-full flex items-center justify-center transition-colors"
                style={{
                  background: isSelected
                    ? isDark
                      ? "#ffffff"
                      : "#18181b"
                    : isDark
                      ? "rgba(255, 255, 255, 0.05)"
                      : "rgba(0, 0, 0, 0.04)",
                  border: isSelected
                    ? "none"
                    : isDark
                      ? "1px solid rgba(255, 255, 255, 0.15)"
                      : "1px solid rgba(0, 0, 0, 0.1)",
                  color: isSelected
                    ? isDark
                      ? "#000000"
                      : "#ffffff"
                    : "transparent",
                }}
              >
                {isSelected && <Check size={11} strokeWidth={3} />}
              </div>
            </motion.div>
          )}

          {/* Squircle Icon Container (Zero Glow / Flat Clean) */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center relative shrink-0"
            style={{
              background: iconBg,
              border: iconBorder,
            }}
          >
            {isCorrection ? (
              <Scale
                size={16}
                strokeWidth={1.8}
                style={{ color: "var(--text-primary)" }}
              />
            ) : isTransfer ? (
              <ArrowLeftRight
                size={16}
                strokeWidth={1.8}
                style={{ color: "var(--text-primary)" }}
              />
            ) : (
              <IconRenderer icon={categoryDisplayEmoji} size="w-5 h-5" />
            )}

            {/* Micro Badge Corner */}
            <div
              className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center"
              style={{
                background: isCorrection
                  ? "var(--text-primary)"
                  : isTransfer
                    ? "var(--text-primary)"
                    : isIncome
                      ? isDark
                        ? "#ffffff"
                        : "#18181b"
                      : isDark
                        ? "#222226"
                        : "#e4e4e7",
                color: isCorrection
                  ? "var(--bg-base)"
                  : isTransfer
                    ? "var(--bg-base)"
                    : isIncome
                      ? isDark
                        ? "#000000"
                        : "#ffffff"
                      : "var(--text-tertiary)",
                border: isDark ? "1.5px solid #141417" : "1.5px solid #ffffff",
              }}
            >
              {isCorrection ? (
                <Scale size={7} strokeWidth={2} />
              ) : isTransfer ? (
                <ArrowLeftRight size={7} strokeWidth={2} />
              ) : (
                <span className="text-[8px] font-bold leading-none select-none">
                  {isIncome ? "+" : "−"}
                </span>
              )}
            </div>
          </div>

          {/* Title & Metadata */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <p
                className="font-bold text-[13.5px] leading-tight truncate tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                {isCorrection
                  ? tx.note ||
                    (isIndonesian
                      ? `Koreksi (${fromWalletName})`
                      : `Correction (${fromWalletName})`)
                  : isTransfer
                    ? `${fromWalletName} ${isIndonesian ? "ke" : "to"} ${toWalletName}`
                    : categoryDisplayName}
              </p>
              {isUnusual && (
                <span
                  className="text-[7.5px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-full shrink-0 border"
                  style={{
                    background: isDark
                      ? "rgba(255, 255, 255, 0.08)"
                      : "rgba(0, 0, 0, 0.05)",
                    borderColor: isDark
                      ? "rgba(255, 255, 255, 0.1)"
                      : "rgba(0, 0, 0, 0.06)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {isIndonesian ? "Di Atas Biasa" : "Higher"}
                </span>
              )}
            </div>

            <div
              className="flex items-center gap-1 text-[10.5px] font-medium mt-0.5 truncate"
              style={{ color: "var(--text-tertiary)" }}
            >
              {timeLabel && (
                <span className="flex items-center gap-0.5 tabular-nums">
                  <Clock size={9.5} />
                  {timeLabel} ·
                </span>
              )}
              <span className="truncate">
                {isCorrection
                  ? fromWalletName
                  : tx.note || (isTransfer ? "Transfer" : fromWalletName)}
              </span>
              {tx.created_by_name && (
                <span className="opacity-70 font-normal shrink-0">
                  · {tx.created_by_name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Amount & Classification */}
        <div className="text-right shrink-0">
          <div
            className="amount font-bold text-[13.5px] sm:text-[14px] tabular-nums leading-tight"
            style={{
              color: isCorrection
                ? isPositiveCorrection
                  ? "var(--text-primary)"
                  : "var(--text-secondary)"
                : isTransfer
                  ? "var(--text-primary)"
                  : isIncome
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
            }}
          >
            {isStealthMode ? (
              `${currencyMeta.symbol} ••••••••`
            ) : (
              <>
                {isTransfer
                  ? ""
                  : isCorrection
                    ? isPositiveCorrection
                      ? "+"
                      : "-"
                    : isIncome
                      ? "+"
                      : "-"}
                {formatCurrency(Number(tx.amount), preferredCurrency)}
              </>
            )}
          </div>
          <div
            className="text-[9px] font-semibold uppercase tracking-wider mt-0.5"
            style={{ color: "var(--text-tertiary)" }}
          >
            {isCorrection
              ? isIndonesian
                ? "Koreksi"
                : "Correction"
              : isTransfer
                ? "Transfer"
                : isIncome
                  ? isIndonesian
                    ? "Pemasukan"
                    : "Inflow"
                  : isIndonesian
                    ? "Pengeluaran"
                    : "Outflow"}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export const TransactionItem = memo(TransactionItemComponent, (prev, next) => {
  return (
    prev.tx.id === next.tx.id &&
    prev.tx.amount === next.tx.amount &&
    prev.tx.note === next.tx.note &&
    prev.tx.category_id === next.tx.category_id &&
    prev.tx.categories?.name === next.tx.categories?.name &&
    prev.tx.categories?.emoji === next.tx.categories?.emoji &&
    prev.fromWalletName === next.fromWalletName &&
    prev.toWalletName === next.toWalletName &&
    prev.isUnusual === next.isUnusual &&
    prev.isSelectMode === next.isSelectMode &&
    prev.isSelected === next.isSelected
  );
});
