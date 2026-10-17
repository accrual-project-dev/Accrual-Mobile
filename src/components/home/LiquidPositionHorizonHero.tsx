import { Eye, EyeOff, ArrowUpRight } from "lucide-react";
import {
  AreaChart,
  Area,
  Tooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useCurrency } from "../../contexts/CurrencyContext";
import { triggerHaptic } from "../../lib/haptics";

export type StockRange = "1D" | "1W" | "1M" | "6M" | "YTD" | "1Y" | "ALL";

export interface HorizonAssetData {
  currentBalance: number;
  diff: number;
  percent: number;
  chartData: { label: string; balance: number; occurred_on?: string }[];
  highBalance: number;
  lowBalance: number;
  periodInflow: number;
  periodOutflow: number;
}

interface LiquidPositionHorizonHeroProps {
  assetData: HorizonAssetData;
  stockRange: StockRange;
  onRangeChange: (range: StockRange) => void;
  stockRangeLabels: Record<StockRange, string>;
  isDark: boolean;
  isIndonesian: boolean;
  hideBalance: boolean;
  onToggleHideBalance: () => void;
  isColdLoading?: boolean;
}

const GlassTooltip = ({ active, payload, label, formatWithPreferred }: any) => {
  if (active && payload && payload.length) {
    const val = payload[0].value;
    return (
      <div
        className="px-2.5 py-1.5 rounded-xl text-left border shadow-xl backdrop-blur-md"
        style={{
          background: "var(--bg-elevated)",
          borderColor: "var(--glass-border)",
        }}
      >
        <p className="text-[9.5px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
          {label}
        </p>
        <p className="text-[12px] font-bold text-[var(--text-primary)] tabular-nums mt-0.5">
          {formatWithPreferred ? formatWithPreferred(val) : val}
        </p>
      </div>
    );
  }
  return null;
};

function formatAxisY(val: number): string {
  if (val === 0) return "0";
  const abs = Math.abs(val);
  if (abs >= 1000000000)
    return (abs / 1000000000).toFixed(1).replace(/\.0$/, "") + "B";
  if (abs >= 1000000)
    return (abs / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (abs >= 1000) return (abs / 1000).toFixed(0) + "k";
  return abs.toString();
}

export function LiquidPositionHorizonHero({
  assetData,
  stockRange,
  onRangeChange,
  stockRangeLabels,
  isDark,
  isIndonesian,
  hideBalance,
  onToggleHideBalance,
  isColdLoading = false,
}: LiquidPositionHorizonHeroProps) {
  const { formatWithPreferred, formatCompactWithPreferred, currencyMeta, preferredCurrency } = useCurrency();
  const isPositive = assetTrendPositive(assetData.diff);

  function assetTrendPositive(diff: number): boolean {
    return diff >= 0;
  }

  // ── Liquid Glass Tactile Materials (Identik dengan WealthHistoryTrajectoryCard) ──
  const cardBg = isDark
    ? "linear-gradient(160deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.015) 100%)"
    : "linear-gradient(160deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 247, 250, 0.90) 100%)";

  const cardBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.08)"
    : "1px solid rgba(0, 0, 0, 0.06)";

  const pillTrackBg = isDark
    ? "rgba(255, 255, 255, 0.04)"
    : "rgba(0, 0, 0, 0.035)";

  return (
    <section
      data-tour="net-worth"
      className="relative overflow-hidden select-none p-4 sm:p-5 rounded-[28px] transition-all"
      style={{
        background: cardBg,
        border: cardBorder,
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

      {/* ── 1. Seamless Header: Title & Stealth Toggle ── */}
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {isIndonesian ? "Posisi Kas Likuid" : "Liquid Position"}
        </span>

        <button
          type="button"
          onClick={() => {
            triggerHaptic("light");
            onToggleHideBalance();
          }}
          className="p-1 -mr-1 rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors active:scale-90 cursor-pointer"
          title={
            hideBalance
              ? isIndonesian
                ? "Tampilkan Saldo"
                : "Show Balance"
              : isIndonesian
                ? "Sembunyikan Saldo"
                : "Hide Balance"
          }
          aria-label="Toggle Stealth"
        >
          {hideBalance ? (
            <EyeOff size={14} strokeWidth={1.8} />
          ) : (
            <Eye size={14} strokeWidth={1.8} />
          )}
        </button>
      </div>

      {/* ── 2. Hero Big Number ── */}
      <div className="mt-1">
        {isColdLoading ? (
          <div
            className={`h-8 w-44 rounded-xl animate-pulse my-1 ${
              isDark ? "bg-white/10" : "bg-black/10"
            }`}
          />
        ) : (
          <h2 className="amount text-[28px] sm:text-[32px] font-bold tracking-tight text-[var(--text-primary)] leading-none tabular-nums">
            {hideBalance
              ? `${currencyMeta?.symbol || "Rp"} ••••••••`
              : formatWithPreferred(assetData.currentBalance)}
          </h2>
        )}
      </div>

      {/* ── 3. Performance Rate Row (Unboxed, Pure Typography) ── */}
      <div className="flex items-center justify-between text-[11px] mt-2 mb-3">
        {isColdLoading ? (
          <div
            className={`h-4 w-28 rounded-lg animate-pulse ${
              isDark ? "bg-white/10" : "bg-black/10"
            }`}
          />
        ) : (
          <div className="flex items-center gap-1 tabular-nums font-semibold text-[var(--text-secondary)]">
            <ArrowUpRight
              size={13}
              strokeWidth={2.4}
              className={`shrink-0 ${
                isPositive
                  ? "text-[var(--text-primary)]"
                  : "rotate-90 text-[var(--text-tertiary)]"
              }`}
            />
            <span>
              {hideBalance
                ? "••••"
                : `${isPositive ? "+" : ""}${formatWithPreferred(assetData.diff)}`}
            </span>
            <span className="font-normal text-[var(--text-tertiary)]">
              (
              {hideBalance
                ? "••••"
                : `${assetData.percent > 0 ? "+" : ""}${assetData.percent.toFixed(2)}%`}
              )
            </span>
          </div>
        )}

        <span className="text-[10px] font-medium text-[var(--text-tertiary)]">
          {stockRangeLabels[stockRange]} · {currencyMeta?.code || preferredCurrency || "IDR"}
        </span>
      </div>

      {/* ── 4. Floating Capsule Pill Range Track ── */}
      <div
        className="flex items-center w-full h-[28px] p-[2px] rounded-full select-none"
        style={{ background: pillTrackBg }}
      >
        {(["1D", "1W", "1M", "6M", "YTD", "1Y", "ALL"] as StockRange[]).map(
          (r) => {
            const isActive = stockRange === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => {
                  onRangeChange(r);
                  triggerHaptic("light");
                }}
                className="flex-1 h-full min-w-0 rounded-full text-[9.5px] tracking-tight cursor-pointer select-none transition-all duration-150 active:scale-95 flex items-center justify-center truncate"
                style={{
                  background: isActive
                    ? isDark
                      ? "rgba(255, 255, 255, 0.16)"
                      : "#18181b"
                    : "transparent",
                  color: isActive
                    ? isDark
                      ? "#ffffff"
                      : "#ffffff"
                    : "var(--text-tertiary)",
                  boxShadow: isActive
                    ? isDark
                      ? "inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 2px 6px rgba(0, 0, 0, 0.25)"
                      : "0 2px 6px rgba(0, 0, 0, 0.14)"
                    : "none",
                  fontWeight: isActive ? 700 : 500,
                }}
              >
                {r}
              </button>
            );
          },
        )}
      </div>

      {/* ── 5. Minimalist Area Chart (Clean Open Layout) ── */}
      <div className="h-[120px] w-full mt-1.5">
        {isColdLoading ? (
          <div
            className={`h-full w-full rounded-2xl animate-pulse ${
              isDark ? "bg-white/5" : "bg-black/5"
            }`}
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={assetData.chartData}
              margin={{ top: 4, right: 0, left: -25, bottom: 0 }}
            >
              <defs>
                <linearGradient id="heroGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={isDark ? "#FFFFFF" : "#18181b"}
                    stopOpacity={isDark ? 0.22 : 0.1}
                  />
                  <stop
                    offset="100%"
                    stopColor={isDark ? "#FFFFFF" : "#18181b"}
                    stopOpacity={0.0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="2 3"
                stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}
                vertical={false}
                horizontal={true}
              />
              <XAxis
                dataKey="label"
                tick={{
                  fontSize: 9,
                  fill: isDark ? "rgba(255,255,255,0.38)" : "#71717a",
                  fontFamily: "Urbanist",
                  fontWeight: 600,
                }}
                axisLine={false}
                tickLine={false}
                dy={3}
              />
              <YAxis
                orientation="right"
                width={34}
                domain={
                  assetData.currentBalance === 0
                    ? [0, 100000]
                    : ["auto", "auto"]
                }
                ticks={assetData.currentBalance === 0 ? [0] : undefined}
                tick={{
                  fontSize: 9,
                  fill: isDark ? "rgba(255,255,255,0.38)" : "#71717a",
                  fontFamily: "Urbanist",
                  fontWeight: 700,
                }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatAxisY}
                dx={-2}
              />
              <Tooltip content={(props) => <GlassTooltip {...props} formatWithPreferred={formatWithPreferred} />} />
              <Area
                type="monotone"
                dataKey="balance"
                stroke={isDark ? "#FFFFFF" : "#18181b"}
                strokeWidth={1.8}
                fill="url(#heroGradient)"
                dot={false}
                activeDot={{
                  r: 3.5,
                  fill: isDark ? "#FFFFFF" : "#18181b",
                  stroke: isDark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.9)",
                  strokeWidth: 1.5,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── 6. Unboxed Open Telemetry Row (Zero Inner Boxes) ── */}
      <div
        className="grid grid-cols-4 gap-2 pt-2.5 mt-1 border-t text-left"
        style={{
          borderColor: isDark
            ? "rgba(255, 255, 255, 0.07)"
            : "rgba(0, 0, 0, 0.05)",
        }}
      >
        {/* High */}
        <div>
          <span className="text-[8.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block truncate">
            {isIndonesian ? "Tertinggi" : "High"}
          </span>
          <span className="amount text-[11px] sm:text-[11.5px] font-semibold text-[var(--text-primary)] mt-0.5 block truncate tabular-nums">
            {hideBalance
              ? "••••"
              : formatCompactWithPreferred(assetData.highBalance)}
          </span>
        </div>

        {/* Low */}
        <div>
          <span className="text-[8.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block truncate">
            {isIndonesian ? "Terendah" : "Low"}
          </span>
          <span className="amount text-[11px] sm:text-[11.5px] font-semibold text-[var(--text-primary)] mt-0.5 block truncate tabular-nums">
            {hideBalance
              ? "••••"
              : formatCompactWithPreferred(assetData.lowBalance)}
          </span>
        </div>

        {/* Inflow */}
        <div>
          <span className="text-[8.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block truncate">
            {isIndonesian ? "Masuk" : "Inflow"}
          </span>
          <span className="amount text-[11px] sm:text-[11.5px] font-semibold text-[var(--text-primary)] mt-0.5 block truncate tabular-nums">
            {hideBalance
              ? "••••"
              : assetData.periodInflow > 0
                ? `+${formatCompactWithPreferred(assetData.periodInflow)}`
                : `${currencyMeta?.symbol || "Rp"} 0`}
          </span>
        </div>

        {/* Outflow */}
        <div>
          <span className="text-[8.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block truncate">
            {isIndonesian ? "Keluar" : "Outflow"}
          </span>
          <span className="amount text-[11px] sm:text-[11.5px] font-semibold text-[var(--text-primary)] mt-0.5 block truncate tabular-nums">
            {hideBalance
              ? "••••"
              : assetData.periodOutflow > 0
                ? `-${formatCompactWithPreferred(assetData.periodOutflow)}`
                : `${currencyMeta?.symbol || "Rp"} 0`}
          </span>
        </div>
      </div>
    </section>
  );
}
