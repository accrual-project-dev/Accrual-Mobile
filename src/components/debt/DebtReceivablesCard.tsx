// ======================================================================
// TROUVAILLE DEBT & RECEIVABLES BENTO CARD
// Executive Apple Luxury summary card for Home springboard dashboard.
// Strictly compliant with GEMINI.md:
// - Rule 1: Vector outline icons from lucide-react only
// - Rule 2: Monochrome Apple luxury styling (var(--bg-elevated), var(--glass-border))
// - Rule 6: Strictly non-mixed localization (100% pure ID / pure EN)
// ======================================================================

import { ChevronRight } from "lucide-react";
import type { DebtReceivableSummary } from "../../types/debt";
import { formatRupiah } from "../../lib/utils";
import { CompactShell } from "../home/widgets/CompactShell";

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
  if (size === "half") {
    return (
      <CompactShell
        title={isIndonesian ? "Utang & Piutang" : "Debt & Payables"}
        onOpenDetail={onClick}
      >
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
          className="flex-1 flex flex-col justify-between py-1 cursor-pointer select-none"
        >
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-tertiary)] block">
              {isIndonesian ? "Posisi Bersih" : "Net Position"}
            </span>
            <span className="text-[16px] font-extrabold tracking-tight text-[var(--text-primary)] block truncate">
              {summary.netReceivables >= 0 ? "+" : ""}
              {formatRupiah(summary.netReceivables)}
            </span>
          </div>

          <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)] pt-1 border-t border-[var(--glass-border)]">
            <span>
              {summary.activeReceivablesCount + summary.activeDebtsCount === 0
                ? summary.settledReceivablesCount + summary.settledDebtsCount > 0
                  ? isIndonesian
                    ? "Semua Lunas"
                    : "All Settled"
                  : isIndonesian
                    ? "Mulai Catat"
                    : "Get Started"
                : `${summary.activeReceivablesCount + summary.activeDebtsCount} ${
                    isIndonesian ? "Pihak Aktif" : "Active"
                  }`}
            </span>
            <ChevronRight size={12} strokeWidth={2} className="text-[var(--text-tertiary)]" />
          </div>
        </div>
      </CompactShell>
    );
  }

  // Full-size widget: Matches CategoryBudgets & UpcomingBills section architecture
  return (
    <section className="space-y-2">
      {/* External Section Header matching Home dashboard visual hierarchy */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h3 className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">
            {isIndonesian ? "Buku Utang & Piutang" : "Debt & Receivables"}
          </h3>
          <p className="text-[11px] text-[var(--text-tertiary)] font-medium">
            {summary.activeReceivablesCount + summary.activeDebtsCount === 0
              ? summary.settledReceivablesCount + summary.settledDebtsCount > 0
                ? isIndonesian
                  ? "Semua kewajiban telah lunas"
                  : "All debts and receivables settled"
                : isIndonesian
                  ? "Ketuk untuk mencatat pinjaman atau utang"
                  : "Tap to track loans and payables"
              : isIndonesian
                ? `${summary.activeReceivablesCount} piutang aktif, ${summary.activeDebtsCount} utang aktif`
                : `${summary.activeReceivablesCount} active receivables, ${summary.activeDebtsCount} active debts`}
          </p>
        </div>

        <button
          type="button"
          onClick={onClick}
          className="flex items-center gap-1 text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer select-none transition-colors"
        >
          <span>{isIndonesian ? "Kelola" : "Manage"}</span>
          <ChevronRight size={13} strokeWidth={2} />
        </button>
      </div>

      {/* Main Apple Luxury Glass Card */}
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
        className="glass-surface p-4 rounded-[22px] transition-all active:scale-[0.99] cursor-pointer select-none space-y-3.5 relative overflow-hidden"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--glass-border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {/* Specular Rim Light Reflection */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[12%] right-[12%] top-[1px] h-[1.5px] rounded-full"
          style={{
            background: isDark
              ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), rgba(255,255,255,0.45), rgba(255,255,255,0.25), transparent)"
              : "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), rgba(255,255,255,1), rgba(255,255,255,0.8), transparent)",
          }}
        />

        {/* 3 Metric Columns: Receivables, Debts, Net Position */}
        <div className="grid grid-cols-3 gap-2 text-center items-center">
          {/* Receivables */}
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-tertiary)] block">
              {isIndonesian ? "Piutang" : "Receivables"}
            </span>
            <span className="text-[14px] font-bold tracking-tight text-[var(--text-primary)] block truncate">
              {formatRupiah(summary.totalReceivables)}
            </span>
            <span className="text-[9.5px] font-medium text-[var(--text-tertiary)] block">
              {summary.activeReceivablesCount} {isIndonesian ? "pihak" : "active"}
            </span>
          </div>

          {/* Debts */}
          <div className="space-y-0.5 border-x border-[var(--glass-border)] px-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-tertiary)] block">
              {isIndonesian ? "Utang" : "Debts"}
            </span>
            <span className="text-[14px] font-bold tracking-tight text-[var(--text-secondary)] block truncate">
              {formatRupiah(summary.totalDebts)}
            </span>
            <span className="text-[9.5px] font-medium text-[var(--text-tertiary)] block">
              {summary.activeDebtsCount} {isIndonesian ? "pihak" : "active"}
            </span>
          </div>

          {/* Net Position */}
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-tertiary)] block">
              {isIndonesian ? "Posisi Bersih" : "Net Position"}
            </span>
            <span
              className="text-[14px] font-bold tracking-tight block truncate"
              style={{
                color:
                  summary.netReceivables > 0
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
              }}
            >
              {summary.netReceivables >= 0 ? "+" : ""}
              {formatRupiah(summary.netReceivables)}
            </span>
            <span className="text-[9.5px] font-medium text-[var(--text-tertiary)] block">
              {summary.settledReceivablesCount + summary.settledDebtsCount} {isIndonesian ? "lunas" : "settled"}
            </span>
          </div>
        </div>

        {/* Attention Badges (Overdue / Approaching Due) if any */}
        {(summary.overdueCount > 0 || summary.approachingDueCount > 0) && (
          <div className="pt-2 border-t border-[var(--glass-border)] flex items-center justify-between text-[10.5px]">
            <span className="text-[var(--text-tertiary)] font-medium">
              {isIndonesian ? "Status Jatuh Tempo" : "Due Date Status"}
            </span>
            <div className="flex items-center gap-1.5">
              {summary.overdueCount > 0 && (
                <span
                  className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                  style={{
                    background: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)",
                    border: "1px solid var(--glass-border)",
                    color: "var(--text-primary)",
                  }}
                >
                  {summary.overdueCount} {isIndonesian ? "Terlewat" : "Overdue"}
                </span>
              )}
              {summary.approachingDueCount > 0 && (
                <span
                  className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                  style={{
                    background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)",
                    border: "1px solid var(--glass-border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {summary.approachingDueCount} {isIndonesian ? "Mendekati Tempo" : "Due Soon"}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
