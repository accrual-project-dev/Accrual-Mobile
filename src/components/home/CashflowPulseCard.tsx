import { TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { triggerHaptic } from "../../lib/haptics";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";

interface CashflowPulseCardProps {
  netCashflow: number;
  totalIncome: number;
  totalExpense: number;
  dailyAverage: number;
  daysElapsed: number;
  savingsRate: number;
  momentum: "positive" | "negative" | "neutral";
  momentumReason: string;
  hideBalance?: boolean;
  onOpenDrillDown?: (mode: "net" | "outflow" | "budget") => void;
  budgetTarget?: number;
  budgetRisk?: string;
  consumedPct?: number;
  isAheadOfPace?: boolean;
  paceDiff?: number;
}

export function CashflowPulseCard({
  netCashflow,
  totalIncome,
  totalExpense,
  dailyAverage,
  daysElapsed,
  savingsRate,
  momentum,
  momentumReason,
  hideBalance = false,
  onOpenDrillDown,
  budgetTarget = 0,
  budgetRisk = "SAFE",
  consumedPct,
}: CashflowPulseCardProps) {
  const { language } = useLanguage();
  const { formatWithPreferred, currencyMeta } = useCurrency();
  const isIndonesian = language === "id";

  const isSurplus = netCashflow >= 0;
  const outflowRatio =
    totalIncome > 0
      ? Math.min(100, Math.round((totalExpense / totalIncome) * 100))
      : totalExpense > 0
        ? 100
        : 0;

  const momentumLabel = isIndonesian
    ? momentum === "positive"
      ? "Positif"
      : momentum === "negative"
        ? "Negatif"
        : "Netral"
    : momentum;

  const handleClick = () => {
    triggerHaptic("light");
    if (onOpenDrillDown) {
      onOpenDrillDown(isSurplus ? "net" : "outflow");
    }
  };

  return (
    <section
      onClick={handleClick}
      className="glass-surface p-4 rounded-[24px] mb-3 cursor-pointer active:scale-[0.99] transition-transform select-none"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--glass-border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Header: Title + Momentum Status + Savings Pill */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-semibold tracking-tight">
                {isIndonesian ? "Denyut Arus Kas" : "Cashflow Pulse"}
              </span>
              <span
                className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                style={{
                  background: "var(--glass-fill-strong)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                {momentumLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
            style={{
              background: "var(--glass-fill-strong)",
              color: "var(--text-primary)",
              border: "1px solid var(--glass-border)",
            }}
          >
            {isSurplus ? (
              <TrendingUp size={11} className="shrink-0" />
            ) : (
              <TrendingDown size={11} className="shrink-0" />
            )}
            <span>
              {hideBalance
                ? "••%"
                : isSurplus
                  ? `${savingsRate.toFixed(0)}% ${isIndonesian ? "ditabung" : "saved"}`
                  : isIndonesian ? "Defisit" : "Deficit"}
            </span>
          </span>
          <ChevronRight size={13} style={{ color: "var(--text-tertiary)" }} />
        </div>
      </div>

      {/* Main Metric: Net Cashflow Amount & Status */}
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <div>
          <div
            className="amount text-[22px] tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {hideBalance
              ? `${currencyMeta.symbol} ••••••••`
              : `${isSurplus ? "+" : "-"}${formatWithPreferred(Math.abs(netCashflow))}`}
          </div>
          <p
            className="text-[11px] font-medium mt-0.5"
            style={{ color: "var(--text-tertiary)" }}
          >
            {isSurplus
              ? isIndonesian ? "Surplus bulan ini" : "Surplus this month"
              : isIndonesian ? "Defisit bulan ini" : "Deficit this month"}{" "}
            · {momentumReason}
          </p>
        </div>
      </div>

      {/* Consumption Bar: Inflow vs Outflow */}
      <div className="my-3">
        <div className="flex justify-between items-center text-[10px] font-semibold mb-1">
          <span style={{ color: "var(--text-tertiary)" }}>
            {isIndonesian ? "Utilitasi arus kas" : "Cashflow utilization"}
          </span>
          <span style={{ color: "var(--text-secondary)" }}>
            {hideBalance
              ? "••%"
              : `${outflowRatio}% ${isIndonesian ? "terpakai" : "consumed"}`}
          </span>
        </div>
        <div
          className="h-1.5 w-full rounded-full overflow-hidden"
          style={{ background: "var(--glass-fill-strong)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.min(100, outflowRatio)}%`,
              background: "var(--text-primary)",
            }}
          />
        </div>

        {/* Integrated Budget Bar (Compact) */}
        {budgetTarget > 0 && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic("light");
              onOpenDrillDown?.("budget");
            }}
            className="mt-2.5 pt-2 border-t border-[var(--glass-border)] cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all"
            title={isIndonesian ? "Lihat Detail Anggaran" : "View Budget Details"}
          >
            <div className="flex justify-between items-center text-[10px] font-semibold mb-1">
              <span
                className="flex items-center gap-1.5"
                style={{ color: "var(--text-tertiary)" }}
              >
                <span>{isIndonesian ? "Progres Anggaran" : "Budget Progress"}</span>
                <span
                  className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full uppercase"
                  style={{
                    background:
                      budgetRisk === "AT RISK"
                        ? "var(--text-primary)"
                        : "var(--glass-fill)",
                    color:
                      budgetRisk === "AT RISK"
                        ? "var(--bg-canvas)"
                        : "var(--text-secondary)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  {budgetRisk === "AT RISK"
                    ? isIndonesian ? "BERISIKO" : "AT RISK"
                    : isIndonesian ? "AMAN" : budgetRisk}
                </span>
              </span>
              <span style={{ color: "var(--text-secondary)" }}>
                {hideBalance
                  ? "••%"
                  : `${consumedPct !== undefined ? consumedPct.toFixed(0) : Math.round((totalExpense / budgetTarget) * 100)}% ${isIndonesian ? "dari" : "of"} ${formatWithPreferred(budgetTarget)}`}
              </span>
            </div>
            <div
              className="h-1.5 w-full rounded-full overflow-hidden"
              style={{ background: "var(--glass-fill-strong)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(100, (totalExpense / budgetTarget) * 100)}%`,
                  background:
                    budgetRisk === "AT RISK"
                      ? "var(--text-primary)"
                      : "var(--accent)",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 3-Column Compact Breakdown Footer */}
      <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-[var(--glass-border)]">
        <div>
          <p
            className="text-[9px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-tertiary)" }}
          >
            {isIndonesian ? "Pemasukan" : "Inflow"}
          </p>
          <p
            className="amount text-[12px] mt-0.5 truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {hideBalance ? `${currencyMeta.symbol} ••••` : `+${formatWithPreferred(totalIncome)}`}
          </p>
        </div>

        <div className="text-center">
          <p
            className="text-[9px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-tertiary)" }}
          >
            {isIndonesian ? "Pengeluaran" : "Outflow"}
          </p>
          <p
            className="amount text-[12px] mt-0.5 truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {hideBalance ? `${currencyMeta.symbol} ••••` : `-${formatWithPreferred(totalExpense)}`}
          </p>
        </div>

        <div className="text-right">
          <p
            className="text-[9px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-tertiary)" }}
          >
            {isIndonesian ? `Rerata/Hari (${daysElapsed}hr)` : `Daily Avg (${daysElapsed}d)`}
          </p>
          <p
            className="amount text-[12px] mt-0.5 truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {hideBalance ? `${currencyMeta.symbol} ••••` : formatWithPreferred(dailyAverage)}
          </p>
        </div>
      </div>
    </section>
  );
}
