import { memo } from "react";
import {
  Calendar,
  ChevronDown,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from "recharts";
import { formatCurrency } from "../../lib/utils";
import { triggerHaptic } from "../../lib/haptics";
import type { ParsedStatementItem } from "../../lib/statementParser";
import { useCurrency } from "../../contexts/CurrencyContext";

export type FilterType = "all" | "expense" | "income" | "transfer" | "adjustment";
export type TimeRangeType =
  | "this_month"
  | "last_month"
  | "last_30"
  | "custom_month"
  | "custom_range"
  | "all";

export type ChartPoint = {
  dateStr: string;
  label: string;
  income: number;
  expense: number;
  transfer: number;
  adjustment: number;
  activeValue: number;
};

const GlassTooltip = ({ active, payload, label }: any) => {
  const { preferredCurrency } = useCurrency();
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--glass-border)",
        borderRadius: 12,
        padding: "8px 12px",
        boxShadow: "0 8px 24px var(--shadow-strength)",
        fontFamily: "Urbanist, sans-serif",
      }}
    >
      <p
        style={{
          color: "var(--text-tertiary)",
          fontSize: 11,
          fontWeight: 700,
          marginBottom: 2,
        }}
      >
        {label}
      </p>
      <p
        style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 700 }}
      >
        {formatCurrency(payload[0]?.value ?? 0, preferredCurrency)}
      </p>
    </div>
  );
};

export interface TransactionHorizonBarChartProps {
  filter: FilterType;
  selectedMonthLabel: string;
  totalPeriodAmount: number;
  dynamicChartData: ChartPoint[];
  maxBar: number;
  isStealthMode: boolean;
  toggleStealthMode: () => void;
  onOpenMonthPicker: () => void;
  draftCount: number;
  allDraftItems: ParsedStatementItem[];
  onOpenBatchReview?: (items: ParsedStatementItem[], appName?: string) => void;
  clearAllDrafts: () => void;
  activeSpaceId: string;
  activeSpaceName: string;
  visibleTxsCount: number;
  onResetActiveSpace: () => void;
  shouldRenderHeavy: boolean;
  isDark: boolean;
  isIndonesian: boolean;
}

export const TransactionHorizonBarChart = memo(function TransactionHorizonBarChart({
  filter,
  selectedMonthLabel,
  totalPeriodAmount,
  dynamicChartData,
  maxBar,
  isStealthMode,
  toggleStealthMode,
  onOpenMonthPicker,
  draftCount,
  allDraftItems,
  onOpenBatchReview,
  clearAllDrafts,
  activeSpaceId,
  activeSpaceName,
  visibleTxsCount,
  onResetActiveSpace,
  shouldRenderHeavy,
  isDark,
  isIndonesian,
}: TransactionHorizonBarChartProps) {
  const { preferredCurrency, currencyMeta } = useCurrency();
  const activityLabel = (() => {
    if (isIndonesian) {
      if (filter === "income") return `${selectedMonthLabel} Pemasukan`;
      if (filter === "expense") return `${selectedMonthLabel} Pengeluaran`;
      if (filter === "transfer") return `${selectedMonthLabel} Transfer`;
      if (filter === "adjustment") return `${selectedMonthLabel} Koreksi`;
      return `${selectedMonthLabel} Aktivitas`;
    }
    if (filter === "income") return `${selectedMonthLabel} Inflow`;
    if (filter === "expense") return `${selectedMonthLabel} Outflow`;
    if (filter === "transfer") return `${selectedMonthLabel} Transfers`;
    if (filter === "adjustment") return `${selectedMonthLabel} Corrections`;
    return `${selectedMonthLabel} Activity`;
  })();

  return (
    <div
      className="relative overflow-hidden p-5 rounded-[24px] select-none space-y-3.5 mb-2"
      style={{
        background: isDark
          ? "linear-gradient(160deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.015) 100%)"
          : "linear-gradient(160deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 247, 250, 0.90) 100%)",
        border: isDark
          ? "1px solid rgba(255, 255, 255, 0.08)"
          : "1px solid rgba(0, 0, 0, 0.06)",
        boxShadow: isDark
          ? "0 18px 44px -10px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.12)"
          : "0 10px 30px -8px rgba(31, 36, 48, 0.06), inset 0 1px 0 #ffffff",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
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

      {/* Header Metrics */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] truncate leading-none mb-1.5">
            {activityLabel}
          </p>
          <p
            className="text-[28px] sm:text-[32px] font-bold tracking-tight leading-tight amount whitespace-nowrap"
            style={{ color: "var(--text-primary)" }}
          >
            {isStealthMode ? `${currencyMeta.symbol} ••••••••` : formatCurrency(totalPeriodAmount, preferredCurrency)}
          </p>
          <p className="text-[11px] font-medium mt-1 text-[var(--text-tertiary)] truncate">
            {dynamicChartData.length} data points · {selectedMonthLabel}
          </p>
        </div>

        {/* Header Action Pills: Stealth Mode & Month Selector */}
        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
          <button
            type="button"
            onClick={toggleStealthMode}
            className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-all touch-manipulation cursor-pointer select-none no-pull"
            style={{
              background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
              color: isStealthMode ? "var(--accent)" : "var(--text-secondary)",
            }}
            title={isStealthMode ? "Disable Stealth Mode" : "Enable Stealth Mode"}
          >
            {isStealthMode ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>

          <button
            type="button"
            onClick={() => {
              onOpenMonthPicker();
              triggerHaptic("light");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full active:scale-95 transition-all touch-manipulation cursor-pointer select-none no-pull shrink-0 whitespace-nowrap"
            style={{
              background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
            }}
          >
            <Calendar size={12} style={{ color: "var(--text-secondary)" }} />
            <span
              className="text-[11px] font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {selectedMonthLabel}
            </span>
            <ChevronDown size={11} style={{ color: "var(--text-tertiary)" }} />
          </button>
        </div>
      </div>

      {/* Draft Inbox Banner */}
      {draftCount > 0 && (
        <div
          className="p-3 rounded-2xl flex items-center justify-between gap-3 animate-fadeIn"
          style={{
            background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.025)",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
                color: "var(--text-primary)",
              }}
            >
              <Sparkles size={13} />
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
                {isIndonesian
                  ? `${draftCount} Transaksi Siap Ditinjau`
                  : `${draftCount} Transactions Ready to Review`}
              </p>
              <p className="text-[10px] text-[var(--text-tertiary)] truncate">
                {isIndonesian
                  ? "Tersimpan di draft · Saldo belum terpotong"
                  : "Saved in drafts · Balance unchanged"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("medium");
                onOpenBatchReview?.(allDraftItems, isIndonesian ? "Draft Transaksi" : "Draft Inbox");
              }}
              className="px-3 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
              style={{
                background: isDark ? "#FFFFFF" : "#18181B",
                color: isDark ? "#09090c" : "#FFFFFF",
              }}
            >
              <span>{isIndonesian ? "Tinjau" : "Review"}</span>
              <ArrowRight size={11} />
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                clearAllDrafts();
              }}
              className="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-colors"
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
                color: "var(--text-tertiary)",
              }}
              title={isIndonesian ? "Buang Semua Draft" : "Dismiss All Drafts"}
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Active Space Segregation Notice */}
      {activeSpaceId !== "all" && activeSpaceId !== "personal" && (
        <div
          className="px-3 py-1.5 rounded-xl flex items-center justify-between text-[11px] font-medium animate-fadeIn"
          style={{
            background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.025)",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
            color: "var(--text-secondary)",
          }}
        >
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse" />
            <span>
              {isIndonesian ? (
                <>
                  Difilter ke space <strong>{activeSpaceName}</strong> ({visibleTxsCount} catatan)
                </>
              ) : (
                <>
                  Filtered to <strong>{activeSpaceName}</strong> space ({visibleTxsCount} records)
                </>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              onResetActiveSpace();
            }}
            className="text-[10px] font-semibold underline underline-offset-2 opacity-80 hover:opacity-100 cursor-pointer"
            style={{ color: "var(--text-primary)" }}
          >
            {isIndonesian ? "Lihat Semua" : "View All"}
          </button>
        </div>
      )}

      {/* DYNAMIC TIMEFRAME GRADIENT BAR CHART */}
      <div className="h-[95px] w-full pt-1 flex items-end">
        {!shouldRenderHeavy ? (
          <div className="w-full flex justify-around items-end h-full px-2 pb-5">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div
                key={i}
                className="w-8 rounded-md bg-white/5 animate-pulse"
                style={{ height: `${[45, 70, 35, 80, 50, 65, 40][(i - 1) % 7]}%` }}
              />
            ))}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={dynamicChartData}
              margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="activeBarGradDark"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity={1} />
                  <stop offset="100%" stopColor="#D4D4D8" stopOpacity={0.9} />
                </linearGradient>
                <linearGradient
                  id="inactiveBarGradDark"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.65} />
                  <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0.18} />
                </linearGradient>
                <linearGradient
                  id="activeBarGradLight"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#18181B" stopOpacity={1} />
                  <stop offset="100%" stopColor="#3F3F46" stopOpacity={0.85} />
                </linearGradient>
                <linearGradient
                  id="inactiveBarGradLight"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#18181B" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#18181B" stopOpacity={0.12} />
                </linearGradient>
              </defs>
              <Tooltip
                content={<GlassTooltip />}
                cursor={{ fill: "transparent" }}
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                interval={
                  dynamicChartData.length > 20
                    ? 4
                    : dynamicChartData.length > 10
                      ? 2
                      : 0
                }
                tick={{
                  fill: "var(--text-tertiary)",
                  fontSize: 9,
                  fontWeight: 700,
                }}
              />
              <YAxis hide domain={[0, maxBar * 1.15]} />
              <Bar
                dataKey="activeValue"
                radius={[4, 4, 4, 4]}
                maxBarSize={
                  dynamicChartData.length > 20
                    ? 8
                    : dynamicChartData.length > 10
                      ? 16
                      : 28
                }
              >
                {dynamicChartData.map((_, index) => {
                  const isCurrentDay = index === dynamicChartData.length - 1;
                  const fillId = isDark
                    ? isCurrentDay
                      ? "url(#activeBarGradDark)"
                      : "url(#inactiveBarGradDark)"
                    : isCurrentDay
                      ? "url(#activeBarGradLight)"
                      : "url(#inactiveBarGradLight)";

                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={fillId}
                      style={{ transition: "fill 0.3s ease" }}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
});
