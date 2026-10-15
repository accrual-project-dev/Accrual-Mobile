import { useMemo } from "react";
import {
  runMonteCarloSimulation,
  type MonteCarloSimulationResult,
} from "../../lib/monteCarloEngine";
import { useCurrency } from "../../contexts/CurrencyContext";
import { triggerHaptic } from "../../lib/haptics";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import {
  Sparkles,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  SlidersHorizontal,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  Tooltip,
} from "recharts";
import { FinancialGlossaryTooltip } from "../common/FinancialGlossaryTooltip";

interface MonteCarloCardProps {
  netWorth: number;
  monthlySavings: number;
  hideBalance?: boolean;
  onOpenSimulator: () => void;
}

export function MonteCarloCard({
  netWorth,
  monthlySavings,
  hideBalance = false,
  onOpenSimulator,
}: MonteCarloCardProps) {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const { formatWithPreferred, currencyMeta } = useCurrency();
  const isDark = theme !== "light";
  const isIndonesian = language === "id";

  const simulation: MonteCarloSimulationResult = useMemo(() => {
    return runMonteCarloSimulation({
      initialNetWorth: Math.max(0, netWorth),
      monthlyContribution: Math.max(0, monthlySavings),
      annualExpenses: 50000000,
      years: 20,
      expectedAnnualReturn: 0.085,
      annualVolatility: 0.15,
      annualInflation: 0.035,
      safeWithdrawalRate: 0.04,
      iterations: 350,
      language: isIndonesian ? "id" : "en",
    });
  }, [netWorth, monthlySavings, isIndonesian]);

  const { successRate, resilienceRating, yearlyTrajectory, terminalValues } = simulation;

  const localizedResilience = isIndonesian
    ? resilienceRating === "Exceptional"
      ? "Sangat Tangguh"
      : resilienceRating === "High Resilience"
        ? "Ketahanan Tinggi"
        : resilienceRating === "Moderate"
          ? "Moderat"
          : resilienceRating === "Vulnerable"
            ? "Rentan"
            : "Kritis"
    : resilienceRating;

  const chartData = useMemo(() => {
    return yearlyTrajectory
      .filter((_, idx) => idx % 2 === 0 || idx === yearlyTrajectory.length - 1)
      .map((item) => ({
        yearLabel: item.year === 0 ? "Now" : `Y${item.year}`,
        p10: item.p10,
        p50: item.p50,
        p90: item.p90,
      }));
  }, [yearlyTrajectory]);

  return (
    <section
      className="relative overflow-hidden p-5 rounded-[24px] transition-all select-none"
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

      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
              color: "var(--text-primary)",
            }}
          >
            <TrendingUp size={16} strokeWidth={1.75} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1">
                <h2
                  className="text-[13px] font-semibold tracking-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  {isIndonesian ? "Simulasi Monte Carlo" : "Monte Carlo Simulation"}
                </h2>
                <FinancialGlossaryTooltip term="monte_carlo" />
              </div>
              <span
                className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                style={{
                  background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)",
                  color: "var(--text-secondary)",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
                }}
              >
                {isIndonesian ? "1.000 Lintasan" : "1,000 Paths"}
              </span>
            </div>
            <p
              className="text-[11px] font-medium"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian
                ? "Dispersi aset stokastik & proyeksi nilai terminal 20 tahun"
                : "Stochastic market asset dispersion & terminal forecast"}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            triggerHaptic("light");
            onOpenSimulator();
          }}
          className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
          style={{
            background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
            color: "var(--text-secondary)",
          }}
          title={isIndonesian ? "Konfigurasi Simulator Monte Carlo" : "Configure Monte Carlo Simulator"}
          aria-label={isIndonesian ? "Konfigurasi Simulator Monte Carlo" : "Configure Monte Carlo Simulator"}
        >
          <SlidersHorizontal size={14} strokeWidth={1.75} />
        </button>
      </div>

      {/* Hero Bento Statistics */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        {/* Left: Expected Median Terminal */}
        <div
          className="p-3.5 rounded-2xl flex flex-col justify-between"
          style={{
            background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.025)",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid rgba(0, 0, 0, 0.04)",
          }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-wider mb-1"
            style={{ color: "var(--text-tertiary)" }}
          >
            {isIndonesian ? "Target Median 20Y (P50)" : "Median 20Y Target"}
          </p>
          <p
            className="text-[18px] font-semibold tracking-tight truncate tabular-nums"
            style={{ color: "var(--text-primary)" }}
          >
            {hideBalance ? `${currencyMeta?.symbol || "Rp"} ••••••` : formatWithPreferred(terminalValues.p50)}
          </p>
          <span
            className="text-[10px] font-medium mt-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {isIndonesian ? "Ekspektasi Kasus Dasar" : "50th %ile Expected Case"}
          </span>
        </div>

        {/* Right: Confidence Score */}
        <div
          className="p-3.5 rounded-2xl flex flex-col justify-between"
          style={{
            background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.025)",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid rgba(0, 0, 0, 0.04)",
          }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-wider mb-1"
            style={{ color: "var(--text-tertiary)" }}
          >
            {isIndonesian ? "Ketahanan Pasar" : "Market Resilience"}
          </p>
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-[18px] font-semibold tracking-tight tabular-nums"
              style={{ color: "var(--text-primary)" }}
            >
              {successRate}%
            </span>
            <span
              className="text-[10px] font-bold"
              style={{ color: "var(--text-secondary)" }}
            >
              {localizedResilience}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-1 text-[10px] text-[var(--text-tertiary)]">
            {successRate >= 75 ? (
              <ShieldCheck size={12} style={{ color: "var(--text-secondary)" }} />
            ) : (
              <ShieldAlert size={12} style={{ color: "var(--text-tertiary)" }} />
            )}
            <span>{isIndonesian ? "Risiko kehabisan dana rendah" : "Low ruin probability"}</span>
          </div>
        </div>
      </div>

      {/* Stochastic Fan Chart Preview */}
      <div
        className="p-3 rounded-2xl mb-4"
        style={{
          background: isDark ? "rgba(255, 255, 255, 0.025)" : "rgba(0, 0, 0, 0.02)",
          border: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid rgba(0, 0, 0, 0.04)",
        }}
      >
        <div className="flex justify-between items-center mb-2 px-1">
          <span
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: "var(--text-tertiary)" }}
          >
            {isIndonesian ? "Pita Dispersi Stokastik" : "Stochastic Dispersion Band"}
          </span>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1" style={{ color: "var(--text-tertiary)" }}>
              <span className="w-2 h-0.5 rounded-full bg-[var(--text-tertiary)]" /> Bear P10
            </span>
            <span className="flex items-center gap-1 font-bold" style={{ color: "var(--text-primary)" }}>
              <span className="w-2 h-0.5 rounded-full bg-[var(--text-primary)]" /> Median
            </span>
            <span className="flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
              <span className="w-2 h-0.5 rounded-full bg-[var(--text-secondary)]" /> Bull P90
            </span>
          </div>
        </div>

        <div className="h-[125px] -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="pureMcBand" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--text-primary)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--text-primary)" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="yearLabel"
                tick={{
                  fontSize: 9,
                  fill: "var(--text-tertiary)",
                  fontWeight: 600,
                  fontFamily: "Urbanist",
                }}
                axisLine={false}
                tickLine={false}
                dy={3}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const data = payload[0].payload;
                  return (
                    <div
                      className="p-2.5 rounded-xl text-[11px] font-medium"
                      style={{
                        background: isDark ? "#121214" : "#ffffff",
                        border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid rgba(0, 0, 0, 0.08)",
                        boxShadow: "0 8px 24px var(--shadow-strength)",
                      }}
                    >
                      <p className="font-bold text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                        {isIndonesian ? "Horizon:" : "Horizon:"} {label}
                      </p>
                      <p className="text-[var(--text-primary)] font-bold tabular-nums">
                        Median (P50): {hideBalance ? `${currencyMeta?.symbol || "Rp"} ••••••` : formatWithPreferred(data.p50)}
                      </p>
                      <p className="text-[var(--text-tertiary)] text-[10px] tabular-nums">
                        {isIndonesian ? "Dasar Bear (P10):" : "Bear Floor (P10):"} {hideBalance ? `${currencyMeta?.symbol || "Rp"} ••••••` : formatWithPreferred(data.p10)}
                      </p>
                      <p className="text-[var(--text-secondary)] text-[10px] tabular-nums">
                        {isIndonesian ? "Puncak Bull (P90):" : "Bull High (P90):"} {hideBalance ? `${currencyMeta?.symbol || "Rp"} ••••••` : formatWithPreferred(data.p90)}
                      </p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="p90"
                stroke="none"
                fill="url(#pureMcBand)"
                fillOpacity={1}
              />
              <Area
                type="monotone"
                dataKey="p50"
                stroke="var(--text-primary)"
                strokeWidth={2}
                fill="none"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="p10"
                stroke="var(--text-tertiary)"
                strokeWidth={1}
                strokeDasharray="2 2"
                fill="none"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Outlier Ranges Bento */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div
          className="p-2.5 rounded-2xl"
          style={{
            background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.025)",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid rgba(0, 0, 0, 0.04)",
          }}
        >
          <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block mb-0.5">
            {isIndonesian ? "Dasar Pasar Bear (P10)" : "Bear Market Floor (10th %ile)"}
          </span>
          <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate tabular-nums">
            {hideBalance ? `${currencyMeta?.symbol || "Rp"} ••••••` : formatWithPreferred(terminalValues.p10)}
          </p>
        </div>
        <div
          className="p-2.5 rounded-2xl"
          style={{
            background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.025)",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid rgba(0, 0, 0, 0.04)",
          }}
        >
          <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] block mb-0.5">
            {isIndonesian ? "Puncak Pasar Bull (P90)" : "Bull Market Ceiling (90th %ile)"}
          </span>
          <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate tabular-nums">
            {hideBalance ? `${currencyMeta?.symbol || "Rp"} ••••••` : formatWithPreferred(terminalValues.p90)}
          </p>
        </div>
      </div>

      {/* Bottom CTA to Launch Simulator */}
      <button
        onClick={() => {
          triggerHaptic("medium");
          onOpenSimulator();
        }}
        className="w-full py-2.5 px-4 rounded-xl flex items-center justify-between font-bold text-[12px] active:scale-[0.99] transition-transform select-none cursor-pointer"
        style={{
          background: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.03)",
          border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
          color: "var(--text-primary)",
        }}
      >
        <span className="flex items-center gap-2">
          <Sparkles size={14} style={{ color: "var(--text-tertiary)" }} />
          {isIndonesian ? "Buka Lab Simulator Monte Carlo" : "Launch Monte Carlo Simulation Lab"}
        </span>
        <ChevronRight size={14} style={{ color: "var(--text-tertiary)" }} />
      </button>
    </section>
  );
}
