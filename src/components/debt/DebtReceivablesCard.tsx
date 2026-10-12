// ======================================================================
// TROUVAILLE DEBT & RECEIVABLES BENTO CARD
// Luxury Apple-inspired summary card for Assets and Home dashboard.
// Strictly compliant with GEMINI.md:
// - Rule 1: Vector outline icons from lucide-react only
// - Rule 2: Monochrome Apple luxury styling
// - Rule 6: Strictly non-mixed localization (100% pure ID / pure EN)
// ======================================================================

import { BookOpen, ChevronRight } from "lucide-react";
import type { DebtReceivableSummary } from "../../types/debt";
import { formatRupiah } from "../../lib/utils";

export interface DebtReceivablesCardProps {
  summary: DebtReceivableSummary;
  isDark: boolean;
  isIndonesian: boolean;
  onClick: () => void;
  size?: "full" | "half";
}

export function DebtReceivablesCard({
  summary,
  isDark,
  isIndonesian,
  onClick,
  size = "full",
}: DebtReceivablesCardProps) {
  const hasAlerts = summary.overdueCount > 0 || summary.approachingDueCount > 0;

  if (size === "half") {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        className="h-full p-3.5 rounded-2xl flex flex-col justify-between transition-all active:scale-[0.985] cursor-pointer select-none text-left"
        style={{
          background: isDark
            ? "linear-gradient(160deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.015) 100%)"
            : "linear-gradient(160deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 247, 250, 0.88) 100%)",
          border: isDark
            ? "1px solid rgba(255, 255, 255, 0.08)"
            : "1px solid rgba(0, 0, 0, 0.06)",
          boxShadow: isDark
            ? "0 8px 24px -8px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.08)"
            : "0 4px 14px -4px rgba(0, 0, 0, 0.04), inset 0 1px 0 #ffffff",
        }}
      >
        <div className="flex items-center justify-between">
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <BookOpen size={13} strokeWidth={1.75} className="text-[var(--text-primary)]" />
          </div>
          {hasAlerts && (
            <span
              className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                color: "var(--text-primary)",
              }}
            >
              {summary.overdueCount > 0
                ? `${summary.overdueCount} ${isIndonesian ? "Terlewat" : "Overdue"}`
                : `${summary.approachingDueCount} ${isIndonesian ? "Tempo" : "Due"}`}
            </span>
          )}
        </div>

        <div className="space-y-0.5 my-2">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-tertiary)] block">
            {isIndonesian ? "Utang & Piutang" : "Debt & Receivables"}
          </span>
          <span className="text-[15px] font-extrabold tracking-tight text-[var(--text-primary)] block truncate">
            {summary.netReceivables >= 0 ? "+" : ""}
            {formatRupiah(summary.netReceivables)}
          </span>
        </div>

        <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)] pt-1 border-t border-[var(--glass-border)]">
          <span>
            {summary.activeReceivablesCount + summary.activeDebtsCount}{" "}
            {isIndonesian ? "Pihak Aktif" : "Active"}
          </span>
          <ChevronRight size={12} strokeWidth={2} className="text-[var(--text-tertiary)]" />
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="p-3.5 rounded-2xl transition-all active:scale-[0.985] cursor-pointer select-none text-left space-y-3"
      style={{
        background: isDark
          ? "linear-gradient(160deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.015) 100%)"
          : "linear-gradient(160deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 247, 250, 0.88) 100%)",
        border: isDark
          ? "1px solid rgba(255, 255, 255, 0.08)"
          : "1px solid rgba(0, 0, 0, 0.06)",
        boxShadow: isDark
          ? "0 8px 24px -8px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.08)"
          : "0 4px 14px -4px rgba(0, 0, 0, 0.04), inset 0 1px 0 #ffffff",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <BookOpen size={13} strokeWidth={1.75} className="text-[var(--text-primary)]" />
          </div>
          <div>
            <span className="text-[12px] font-bold text-[var(--text-primary)] block">
              {isIndonesian ? "Buku Utang & Piutang Pintar" : "Smart Debt & Receivables Hub"}
            </span>
            <span className="text-[10px] text-[var(--text-tertiary)] block">
              {summary.activeReceivablesCount + summary.activeDebtsCount === 0
                ? isIndonesian
                  ? "Semua kewajiban telah lunas"
                  : "All debts and receivables settled"
                : isIndonesian
                  ? `${summary.activeReceivablesCount} piutang aktif, ${summary.activeDebtsCount} utang aktif`
                  : `${summary.activeReceivablesCount} active receivables, ${summary.activeDebtsCount} active debts`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {summary.overdueCount > 0 && (
            <span
              className="px-2 py-0.5 rounded-full text-[9.5px] font-bold"
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.09)" : "rgba(0, 0, 0, 0.05)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-primary)",
              }}
            >
              {summary.overdueCount} {isIndonesian ? "Terlewat" : "Overdue"}
            </span>
          )}
          <ChevronRight size={13} strokeWidth={2} className="text-[var(--text-tertiary)]" />
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[var(--glass-border)] text-center">
        {/* Receivables */}
        <div className="space-y-0.5">
          <span className="text-[9.5px] uppercase tracking-wider font-semibold text-[var(--text-tertiary)] block">
            {isIndonesian ? "Piutang" : "Receivables"}
          </span>
          <span className="text-[12.5px] font-bold text-[var(--text-primary)] block truncate">
            {formatRupiah(summary.totalReceivables)}
          </span>
        </div>

        {/* Debts */}
        <div className="space-y-0.5 border-x border-[var(--glass-border)] px-1">
          <span className="text-[9.5px] uppercase tracking-wider font-semibold text-[var(--text-tertiary)] block">
            {isIndonesian ? "Utang" : "Debts"}
          </span>
          <span className="text-[12.5px] font-bold text-[var(--text-secondary)] block truncate">
            {formatRupiah(summary.totalDebts)}
          </span>
        </div>

        {/* Net */}
        <div className="space-y-0.5">
          <span className="text-[9.5px] uppercase tracking-wider font-semibold text-[var(--text-tertiary)] block">
            {isIndonesian ? "Bersih" : "Net"}
          </span>
          <span
            className="text-[12.5px] font-bold block truncate"
            style={{
              color:
                summary.netReceivables >= 0
                  ? "var(--text-primary)"
                  : "var(--text-secondary)",
            }}
          >
            {summary.netReceivables >= 0 ? "+" : ""}
            {formatRupiah(summary.netReceivables)}
          </span>
        </div>
      </div>
    </div>
  );
}
