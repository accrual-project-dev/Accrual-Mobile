import { useState } from "react";
import { Activity, ChevronRight, Info } from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { triggerHaptic } from "../../lib/haptics";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import type { ExpenseVolatilityResult } from "../../lib/financialMath";

interface ExpenseVolatilityCardProps {
  volatility: ExpenseVolatilityResult;
  hideBalance?: boolean;
}

export function ExpenseVolatilityCard({
  volatility,
  hideBalance = false,
}: ExpenseVolatilityCardProps) {
  const { isIndonesian } = useLanguage();
  const { formatWithPreferred, currencyMeta } = useCurrency();
  const [detailOpen, setDetailOpen] = useState(false);

  const getStabilityLabel = (stability: string) => {
    if (isIndonesian) {
      if (stability === "STABLE") return "Stabil";
      if (stability === "MODERATE") return "Moderat";
      if (stability === "VOLATILE") return "Volatil";
    }
    return stability.charAt(0).toUpperCase() + stability.slice(1).toLowerCase();
  };

  const getBadgeStyle = () => {
    switch (volatility.stability) {
      case "VOLATILE":
        return {
          background: "var(--text-primary)",
          color: "var(--bg-canvas)",
          border: "1px solid var(--text-primary)",
        };
      case "MODERATE":
        return {
          background: "var(--glass-fill-strong)",
          color: "var(--text-primary)",
          border: "1px solid var(--glass-border)",
        };
      case "STABLE":
      default:
        return {
          background: "var(--glass-fill-strong)",
          color: "var(--text-primary)",
          border: "1px solid var(--glass-border)",
        };
    }
  };

  return (
    <>
      <section
        onClick={() => {
          setDetailOpen(true);
          triggerHaptic("light");
        }}
        className="p-4 rounded-[24px] glass-surface cursor-pointer active:scale-[0.99] transition-transform select-none mb-3"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--glass-border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: "var(--glass-fill-strong)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-primary)",
              }}
            >
              <Activity size={14} />
            </div>
            <div>
              <p
                className="text-[13px] font-bold leading-tight"
                style={{ color: "var(--text-primary)" }}
              >
                {isIndonesian ? "Stabilitas Pengeluaran" : "Spending Stability"}
              </p>
              <p
                className="text-[11px] font-medium mt-0.5 leading-tight"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian
                  ? "Volatilitas & Variansi Beban"
                  : "Expense Volatility & Variance"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
              style={getBadgeStyle()}
            >
              {getStabilityLabel(volatility.stability)}
            </span>
            <ChevronRight size={14} style={{ color: "var(--text-tertiary)" }} />
          </div>
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-[var(--glass-border)]">
          <div>
            <p
              className="text-[11px] font-medium"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? "Rata-rata Harian" : "Daily Average"}
            </p>
            <p
              className="amount text-[13px] font-bold mt-0.5"
              style={{ color: "var(--text-primary)" }}
            >
              {hideBalance
                ? `${currencyMeta?.symbol || "Rp"} ••••••••`
                : `${formatWithPreferred(volatility.meanDailyExpense)}${isIndonesian ? "/hari" : "/day"}`}
            </p>
          </div>
          <div className="text-right">
            <p
              className="text-[11px] font-medium"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? "Puncak Beban Harian" : "Peak Day Outlay"}
            </p>
            <p
              className="amount text-[13px] font-bold mt-0.5"
              style={{ color: "var(--text-primary)" }}
            >
              {hideBalance
                ? `${currencyMeta?.symbol || "Rp"} ••••••••`
                : formatWithPreferred(volatility.peakDailyExpense)}
            </p>
          </div>
        </div>

        {/* Volatility Indicator Bar */}
        <div className="mt-2.5">
          <div
            className="h-1.5 w-full rounded-full overflow-hidden flex gap-1 p-[1px]"
            style={{
              background: "var(--glass-fill)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, Math.max(10, volatility.score))}%`,
                background: "var(--text-primary)",
              }}
            />
          </div>
        </div>

        {/* Micro-copy Reason */}
        <p
          className="text-[11px] font-medium mt-2 leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {volatility.reason}
        </p>
      </section>

      {/* Volatility Analysis Drilldown BottomSheet */}
      <BottomSheet
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={isIndonesian ? "Analisis Stabilitas Pengeluaran" : "Spending Stability Analysis"}
      >
        <div className="px-5 pb-10 space-y-4">
          <div className="flex items-start gap-2.5 p-3 rounded-2xl" style={{ background: "var(--glass-fill)", border: "1px solid var(--glass-border)" }}>
            <Info size={16} className="shrink-0 mt-0.5" style={{ color: "var(--text-secondary)" }} />
            <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {volatility.explanation}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div
              className="p-3 rounded-2xl"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <p
                className="text-[11px] font-medium"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Status Stabilitas" : "Stability Status"}
              </p>
              <p
                className="text-[15px] font-semibold mt-0.5"
                style={{ color: "var(--text-primary)" }}
              >
                {getStabilityLabel(volatility.stability)}
              </p>
            </div>
            <div
              className="p-3 rounded-2xl"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <p
                className="text-[11px] font-medium"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Skor Stabilitas" : "Stability Score"}
              </p>
              <p
                className="amount text-[15px] font-semibold mt-0.5"
                style={{ color: "var(--text-primary)" }}
              >
                {volatility.score} / 100
              </p>
            </div>
            <div
              className="p-3 rounded-2xl"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <p
                className="text-[11px] font-medium"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Variasi Harian (Deviasi Standar)" : "Daily Variation (Std Dev)"}
              </p>
              <p
                className="amount text-[15px] font-semibold mt-0.5"
                style={{ color: "var(--text-primary)" }}
              >
                {hideBalance
                  ? `${currencyMeta?.symbol || "Rp"} ••••••••`
                  : `±${formatWithPreferred(volatility.standardDeviation)}`}
              </p>
            </div>
            <div
              className="p-3 rounded-2xl"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <p
                className="text-[11px] font-medium"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Rasio Hari Aktif" : "Active Days Ratio"}
              </p>
              <p
                className="amount text-[15px] font-semibold mt-0.5"
                style={{ color: "var(--text-primary)" }}
              >
                {isIndonesian
                  ? `${volatility.activeDaysCount} dari ${volatility.totalDaysInPeriod} hari`
                  : `${volatility.activeDaysCount} of ${volatility.totalDaysInPeriod} days`}
              </p>
            </div>
          </div>

          <div
            className="p-3.5 rounded-2xl space-y-1.5"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <p
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? "Wawasan Perilaku" : "Behavioral Takeaway"}
            </p>
            <p
              className="text-[12px] leading-relaxed"
              style={{ color: "var(--text-primary)" }}
            >
              {volatility.reason}
            </p>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
