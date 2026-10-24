import { useState } from "react";
import { Eye, EyeOff, ArrowUpRight, ArrowDownRight } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { triggerHaptic } from "../../lib/haptics";
import { useCurrency } from "../../contexts/CurrencyContext";

export type BalanceSheetRange = "1D" | "7D" | "1M" | "3M" | "6M" | "1Y" | "ALL";

function formatAxisY(val: number): string {
  const abs = Math.abs(val);
  if (abs >= 1000000000)
    return (abs / 1000000000).toFixed(1).replace(/\.0$/, "") + "B";
  if (abs >= 1000000)
    return (abs / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (abs >= 1000) return (abs / 1000).toFixed(0) + "k";
  return String(abs);
}

interface GlassTooltipProps {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
  isStealthMode?: boolean;
  isIndonesian?: boolean;
  isDark?: boolean;
}

const GlassTooltip = ({
  active,
  payload,
  label,
  isStealthMode,
  isIndonesian,
  isDark,
}: GlassTooltipProps) => {
  const { formatWithPreferred } = useCurrency();
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value ?? 0;

  return (
    <div
      className="p-2 px-3 rounded-2xl select-none shadow-2xl border"
      style={{
        background: isDark
          ? "rgba(18, 18, 22, 0.94)"
          : "rgba(255, 255, 255, 0.96)",
        borderColor: isDark
          ? "rgba(255, 255, 255, 0.12)"
          : "rgba(0, 0, 0, 0.08)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
      }}
    >
      <p className="text-[10px] font-medium text-[var(--text-tertiary)] mb-1">
        {label}
      </p>
      <div className="flex items-center gap-2">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: isDark ? "#ffffff" : "#18181b" }}
        />
        <span className="text-[11px] font-medium text-[var(--text-secondary)]">
          {isIndonesian ? "Kekayaan" : "Net Worth"}
        </span>
        <span className="text-[12px] font-bold text-[var(--text-primary)] tabular-nums amount">
          {isStealthMode ? "••••••••" : formatWithPreferred(val)}
        </span>
      </div>
    </div>
  );
};

interface WealthHistoryTrajectoryCardProps {
  netWorth: number;
  assetTrend: {
    diff: number;
    percent: number;
    chartData: Array<{ label: string; balance: number }>;
  };
  bsRange: BalanceSheetRange;
  onChangeRange: (range: BalanceSheetRange) => void;
  bsRangeLabels: Record<BalanceSheetRange, string>;
  chartPeak: number;
  chartTrough: number;
  capitalDeployment: number;
  isStealthMode: boolean;
  onToggleStealthMode: () => void;
  isIndonesian: boolean;
  isDark: boolean;
}

export function WealthHistoryTrajectoryCard({
  netWorth,
  assetTrend,
  bsRange,
  onChangeRange,
  bsRangeLabels: _bsRangeLabels,
  chartPeak,
  chartTrough,
  capitalDeployment,
  isStealthMode,
  onToggleStealthMode,
  isIndonesian,
  isDark,
}: WealthHistoryTrajectoryCardProps) {
  const { formatWithPreferred, formatCompactWithPreferred, currencyMeta } = useCurrency();
  const isPositive = assetTrend.diff >= 0;
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

  // Surface Tokens (Apple Minimalist Monochrome, Zero Glow)
  const cardBg = isDark
    ? "linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.015) 100%)"
    : "linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 247, 250, 0.90) 100%)";

  const cardBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.08)"
    : "1px solid rgba(0, 0, 0, 0.06)";

  // 5 Rentang Waktu Esensial
  const curatedRanges: BalanceSheetRange[] = ["1M", "3M", "6M", "1Y", "ALL"];

  return (
    <section
      className="relative overflow-hidden select-none p-4 sm:p-5 rounded-[28px] transition-all"
      style={{
        background: cardBg,
        border: cardBorder,
        boxShadow: isDark
          ? "0 14px 36px -10px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
          : "0 8px 24px -8px rgba(31, 36, 48, 0.06), inset 0 1px 0 #ffffff",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
      }}
    >
      {/* Specular Rim Top Highlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[12%] right-[12%] top-[1px] h-[1.5px] rounded-full"
        style={{
          background: isDark
            ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), rgba(255,255,255,0.45), rgba(255,255,255,0.25), transparent)"
            : "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), rgba(255,255,255,1), rgba(255,255,255,0.8), transparent)",
        }}
      />

      {/* ── BARIS 1: Header Judul di Kiri & 5 Timeframe Ringkas di Kanan ── */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.1em] truncate"
            style={{ color: "var(--text-tertiary)" }}
          >
            {isIndonesian ? "Akumulasi Kekayaan" : "Wealth over time"}
          </span>
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              onToggleStealthMode();
            }}
            className="p-0.5 rounded-full text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors active:scale-90 cursor-pointer shrink-0"
            title={
              isStealthMode
                ? isIndonesian
                  ? "Tampilkan"
                  : "Show"
                : isIndonesian
                  ? "Sembunyikan"
                  : "Hide"
            }
            aria-label="Toggle Stealth"
          >
            {isStealthMode ? (
              <EyeOff size={13} strokeWidth={1.8} />
            ) : (
              <Eye size={13} strokeWidth={1.8} />
            )}
          </button>
        </div>

        {/* 5 Timeframe Compact Track */}
        <div
          className="flex items-center p-[2px] rounded-full shrink-0"
          style={{
            background: isDark
              ? "rgba(255, 255, 255, 0.05)"
              : "rgba(0, 0, 0, 0.04)",
            border: isDark
              ? "1px solid rgba(255, 255, 255, 0.07)"
              : "1px solid rgba(0, 0, 0, 0.05)",
          }}
        >
          {curatedRanges.map((r) => {
            const isActive = bsRange === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => {
                  onChangeRange(r);
                  triggerHaptic("light");
                }}
                className="px-2.5 h-5 rounded-full text-[9px] font-semibold tracking-tight cursor-pointer select-none transition-all active:scale-95 flex items-center justify-center"
                style={{
                  background: isActive
                    ? isDark
                      ? "#ffffff"
                      : "#18181b"
                    : "transparent",
                  color: isActive
                    ? isDark
                      ? "#000000"
                      : "#ffffff"
                    : "var(--text-tertiary)",
                  boxShadow: isActive
                    ? isDark
                      ? "inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 2px 6px rgba(0, 0, 0, 0.3)"
                      : "0 2px 6px rgba(0, 0, 0, 0.14)"
                    : "none",
                }}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── BARIS 2: Nominal Besar di Kiri & Keterangan Keuntungan Terbuka (Unboxed) di Kanan ── */}
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="amount text-[27px] sm:text-[30px] font-bold tracking-tight text-[var(--text-primary)] leading-none tabular-nums">
          {isStealthMode ? `${currencyMeta.symbol} ••••••••` : formatWithPreferred(netWorth)}
        </h2>

        {/* Keterangan Keuntungan: Murni Tipografi Terbuka, Tanpa Kotak/Pill, Ada Angka & Persen */}
        <div className="flex items-center gap-1.5 text-[11px] sm:text-[11.5px] tabular-nums shrink-0">
          <span className="flex items-center gap-0.5 text-[var(--text-primary)] font-bold">
            {isPositive ? (
              <ArrowUpRight size={12} strokeWidth={2.4} className="shrink-0" />
            ) : (
              <ArrowDownRight
                size={12}
                strokeWidth={2.4}
                className="shrink-0"
              />
            )}
            <span>
              {isStealthMode
                ? "••••"
                : `${isPositive ? "+" : ""}${formatWithPreferred(assetTrend.diff)}`}
            </span>
          </span>

          <span className="text-[var(--text-secondary)] font-semibold">
            (
            {isStealthMode
              ? "••••"
              : `${isPositive ? "+" : ""}${assetTrend.percent.toFixed(1)}%`}
            )
          </span>

          <span className="text-[9.5px] font-normal text-[var(--text-tertiary)] hidden sm:inline">
            {isIndonesian ? "vs lalu" : "vs last"}
          </span>
        </div>
      </div>

      {/* ── 3. Grafik Area Minimalis (Label Sumbu Y Lega & Tepi Kanan Rapi) ── */}
      <div className="h-[145px] w-full mt-2 relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={assetTrend.chartData}
            margin={{ top: 8, right: 8, left: -4, bottom: 2 }}
            onMouseMove={(state) => {
              if (state?.activeLabel) {
                setHoveredLabel(String(state.activeLabel));
              }
            }}
            onMouseLeave={() => setHoveredLabel(null)}
          >
            <defs>
              <linearGradient
                id="wealthCleanGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={isDark ? "#ffffff" : "#18181b"}
                  stopOpacity={isDark ? 0.16 : 0.08}
                />
                <stop
                  offset="100%"
                  stopColor={isDark ? "#ffffff" : "#18181b"}
                  stopOpacity={0.0}
                />
              </linearGradient>
            </defs>

            {/* Garis Kisi Horizontal Halus */}
            <CartesianGrid
              strokeDasharray="2 3"
              stroke={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}
              vertical={false}
              horizontal={true}
            />

            {/* Sumbu Y di Kiri (Lebar 38px memastikan digit 19.1M dll tidak terpotong menjadi iM) */}
            <YAxis
              orientation="left"
              width={38}
              domain={["auto", "auto"]}
              tick={{
                fontSize: 9,
                fill: isDark ? "rgba(255,255,255,0.38)" : "#71717a",
                fontFamily: "Urbanist",
                fontWeight: 600,
              }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatAxisY}
              dx={-2}
            />

            {/* Sumbu X di Bawah */}
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
              dy={4}
            />

            <Tooltip
              content={
                <GlassTooltip
                  isStealthMode={isStealthMode}
                  isIndonesian={isIndonesian}
                  isDark={isDark}
                />
              }
              cursor={{
                stroke: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)",
                strokeWidth: 1,
                strokeDasharray: "2 2",
              }}
            />

            <Area
              type="monotone"
              dataKey="balance"
              stroke={isDark ? "#ffffff" : "#18181b"}
              strokeWidth={1.8}
              fill="url(#wealthCleanGradient)"
              dot={false}
              activeDot={{
                r: 4,
                fill: isDark ? "#ffffff" : "#18181b",
                stroke: isDark ? "#09090c" : "#ffffff",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Kapsul Tanggal Aktif Saat Hover */}
        {hoveredLabel && (
          <div
            className="absolute bottom-[-1px] left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[9px] font-bold shadow-md transition-all pointer-events-none"
            style={{
              background: isDark ? "#ffffff" : "#18181b",
              color: isDark ? "#000000" : "#ffffff",
            }}
          >
            {hoveredLabel}
          </div>
        )}
      </div>

      {/* ── 4. Telemetri 4 Kolom Bawah ── */}
      <div
        className="grid grid-cols-4 gap-2 pt-3 mt-3 border-t text-left"
        style={{
          borderColor: isDark
            ? "rgba(255, 255, 255, 0.07)"
            : "rgba(0, 0, 0, 0.05)",
        }}
      >
        <div>
          <span className="text-[8.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block truncate">
            {isIndonesian ? "Tertinggi" : "High"}
          </span>
          <span className="amount text-[11px] sm:text-[11.5px] font-semibold text-[var(--text-primary)] mt-0.5 block truncate tabular-nums">
            {isStealthMode
              ? "••••"
              : formatCompactWithPreferred(chartPeak)}
          </span>
        </div>

        <div>
          <span className="text-[8.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block truncate">
            {isIndonesian ? "Terendah" : "Low"}
          </span>
          <span className="amount text-[11px] sm:text-[11.5px] font-semibold text-[var(--text-primary)] mt-0.5 block truncate tabular-nums">
            {isStealthMode
              ? "••••"
              : formatCompactWithPreferred(chartTrough)}
          </span>
        </div>

        <div>
          <span className="text-[8.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block truncate">
            {isIndonesian ? "Injeksi MTD" : "Inflow MTD"}
          </span>
          <span className="amount text-[11px] sm:text-[11.5px] font-semibold text-[var(--text-primary)] mt-0.5 block truncate tabular-nums">
            {isStealthMode
              ? "••••"
              : capitalDeployment > 0
                ? `+${formatCompactWithPreferred(capitalDeployment)}`
                : formatCompactWithPreferred(0)}
          </span>
        </div>

        <div>
          <span className="text-[8.5px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block truncate">
            {isIndonesian ? "Ekuitas Δ" : "Equity Δ"}
          </span>
          <span className="amount text-[11px] sm:text-[11.5px] font-semibold text-[var(--text-primary)] mt-0.5 block truncate tabular-nums">
            {isStealthMode
              ? "••••"
              : `${isPositive ? "+" : "-"}${formatCompactWithPreferred(Math.abs(assetTrend.diff))}`}
          </span>
        </div>
      </div>
    </section>
  );
}
