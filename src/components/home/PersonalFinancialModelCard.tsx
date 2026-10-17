import { useMemo, useState } from "react";
import { ChevronRight, Layers3 } from "lucide-react";
import { triggerHaptic } from "../../lib/haptics";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import { useTheme } from "../../contexts/ThemeContext";
import type { LiquidityHorizonResult } from "../../hooks/useFinancialIntelligence";

export type ModelLayer = "actual" | "baseline" | "scenario";

export interface ModelFlowValues {
  income: number;
  committedExpenses: number;
  variableExpenses: number;
  retainedCash: number;
  savingsInvestment: number;
  assets: number;
  liabilities: number;
  netWorth: number;
}

export interface PersonalFinancialModelInsights {
  currentNetWorth: number;
  historicalTrendLabel: string;
  historicalTrendValue: string;
  currentCashflow: number;
  personalBaseline: string;
  upcomingCommitments: number;
  goalTrajectory: string;
  scenarioImpact: string;
}

interface PersonalFinancialModelCardProps {
  hideBalance?: boolean;
  actual: ModelFlowValues;
  baseline: ModelFlowValues;
  scenario: ModelFlowValues;
  insights?: PersonalFinancialModelInsights;
  liquidityHorizon?: LiquidityHorizonResult;
  onOpenDetails?: () => void;
}

export function PersonalFinancialModelCard({
  hideBalance = false,
  actual,
  baseline,
  scenario,
  liquidityHorizon,
  onOpenDetails,
}: PersonalFinancialModelCardProps) {
  const { language } = useLanguage();
  const { formatWithPreferred, currencyMeta } = useCurrency();
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const isIndonesian = language === "id";

  const formatMoney = (amount: number) => {
    return hideBalance ? `${currencyMeta?.symbol || "Rp"} ••••••••` : formatWithPreferred(amount);
  };

  const [layer, setLayer] = useState<ModelLayer>("actual");

  const active = useMemo(() => {
    if (layer === "baseline") return baseline;
    if (layer === "scenario") return scenario;
    return actual;
  }, [actual, baseline, layer, scenario]);

  const coverageMonths =
    liquidityHorizon && liquidityHorizon.status === "sufficient"
      ? liquidityHorizon.totalCoverageMonths
      : 3.5;

  const isStrong = liquidityHorizon
    ? liquidityHorizon.resilienceTier === "STRONG" ||
      liquidityHorizon.resilienceTier === "EXCEPTIONAL"
    : true;

  const cardBg = isDark
    ? "linear-gradient(160deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.015) 100%)"
    : "linear-gradient(160deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 247, 250, 0.90) 100%)";

  const cardBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.08)"
    : "1px solid rgba(0, 0, 0, 0.06)";

  const cardShadow = isDark
    ? "0 18px 44px -10px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.12)"
    : "0 10px 30px -8px rgba(31, 36, 48, 0.06), inset 0 1px 0 #ffffff";

  return (
    <section
      className="p-5 rounded-[26px] transition-all select-none space-y-3.5 flex flex-col justify-between relative overflow-hidden"
      style={{
        background: cardBg,
        border: cardBorder,
        boxShadow: cardShadow,
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

      <div>
        {/* Header (1 line) */}
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
                border: cardBorder,
                color: "var(--text-primary)",
              }}
            >
              <Layers3 size={16} strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2
                  className="text-[13px] font-semibold tracking-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  {isIndonesian
                    ? "Model Struktural & Horizon Likuiditas"
                    : "Structural Model & Liquidity"}
                </h2>
                <span
                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                  style={{
                    background: isDark ? "rgba(255, 255, 255, 0.07)" : "rgba(0, 0, 0, 0.05)",
                    color: "var(--text-secondary)",
                    border: cardBorder,
                  }}
                >
                  {isIndonesian ? "3 Lapisan" : "3 Layers"}
                </span>
              </div>
              <p
                className="text-[11px] font-medium leading-tight mt-0.5"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian
                  ? "Baseline finansial personal, perbandingan skenario & cadangan darurat"
                  : "Personal financial baseline, scenario comparison & emergency buffer"}
              </p>
            </div>
          </div>
        </div>

        {/* Layer Switcher */}
        <div
          className="grid grid-cols-3 gap-1 p-1 rounded-2xl mb-3.5"
          style={{
            background: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.035)",
            border: cardBorder,
          }}
        >
          {(["actual", "baseline", "scenario"] as ModelLayer[]).map((item) => {
            const isActive = item === layer;
            const itemLabel =
              item === "actual"
                ? isIndonesian
                  ? "Aktual"
                  : "Actual"
                : item === "baseline"
                  ? isIndonesian
                    ? "Garis Dasar"
                    : "Baseline"
                  : isIndonesian
                    ? "Skenario"
                    : "Scenario";

            return (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setLayer(item);
                  triggerHaptic("light");
                }}
                className="py-1.5 rounded-xl text-[11px] font-semibold transition-all cursor-pointer text-center"
                style={{
                  background: isActive
                    ? isDark
                      ? "#FFFFFF"
                      : "#18181B"
                    : "transparent",
                  color: isActive
                    ? isDark
                      ? "#0A0A0B"
                      : "#FFFFFF"
                    : "var(--text-secondary)",
                  boxShadow: isActive ? "0 2px 8px rgba(0,0,0,0.18)" : "none",
                }}
              >
                {itemLabel}
              </button>
            );
          })}
        </div>

        {/* Flow Matrix Rows (Unboxed Clean Flow) */}
        <div
          className="p-3.5 rounded-2xl space-y-2 mb-3.5"
          style={{
            background: isDark ? "rgba(255, 255, 255, 0.025)" : "rgba(0, 0, 0, 0.02)",
            border: cardBorder,
          }}
        >
          <div className="flex items-center justify-between text-xs">
            <span
              className="text-[11px]"
              style={{ color: "var(--text-secondary)" }}
            >
              {isIndonesian ? "Pemasukan Bulanan" : "Monthly Income"}
            </span>
            <span
              className="text-[12px] font-semibold tabular-nums"
              style={{ color: "var(--text-primary)" }}
            >
              {formatMoney(active.income)}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span
              className="text-[11px]"
              style={{ color: "var(--text-secondary)" }}
            >
              {isIndonesian ? "Pengeluaran Rutin (Committed)" : "Committed Expenses"}
            </span>
            <span
              className="text-[12px] font-semibold tabular-nums"
              style={{ color: "var(--text-secondary)" }}
            >
              {formatMoney(active.committedExpenses)}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span
              className="text-[11px]"
              style={{ color: "var(--text-secondary)" }}
            >
              {isIndonesian ? "Pengeluaran Fleksibel" : "Variable Expenses"}
            </span>
            <span
              className="text-[12px] font-semibold tabular-nums"
              style={{ color: "var(--text-secondary)" }}
            >
              {formatMoney(active.variableExpenses)}
            </span>
          </div>

          <div
            className="flex items-center justify-between text-xs pt-1.5"
            style={{
              borderTop: isDark
                ? "1px solid rgba(255, 255, 255, 0.06)"
                : "1px solid rgba(0, 0, 0, 0.05)",
            }}
          >
            <span
              className="text-[11px] font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {isIndonesian ? "Sisa Kas Ditahan" : "Retained Cash"}
            </span>
            <span
              className="text-[12px] font-bold tabular-nums"
              style={{
                color:
                  active.retainedCash >= 0
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
              }}
            >
              {formatMoney(active.retainedCash)}
            </span>
          </div>
        </div>

        {/* Integrated Telemetry Strip: Liquidity & Debt Status */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div
            className="p-2.5 rounded-xl flex items-center justify-between"
            style={{
              background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.025)",
              border: cardBorder,
            }}
          >
            <div>
              <span
                className="text-[9px] uppercase font-semibold block"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Cadangan Likuiditas" : "Liquidity Buffer"}
              </span>
              <span
                className="font-bold tabular-nums text-[13px] block mt-0.5"
                style={{ color: "var(--text-primary)" }}
              >
                {hideBalance
                  ? "•••"
                  : `${coverageMonths.toFixed(1)} ${isIndonesian ? "Bulan" : "mo"}`}
              </span>
            </div>
            <span
              className="px-1.5 py-0.5 rounded text-[9px] font-semibold"
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.07)" : "rgba(0, 0, 0, 0.05)",
                border: cardBorder,
                color: "var(--text-secondary)",
              }}
            >
              {isStrong
                ? isIndonesian
                  ? "Kuat"
                  : "Strong"
                : isIndonesian
                  ? "Aman"
                  : "Safe"}
            </span>
          </div>

          <div
            className="p-2.5 rounded-xl flex items-center justify-between"
            style={{
              background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.025)",
              border: cardBorder,
            }}
          >
            <div>
              <span
                className="text-[9px] uppercase font-semibold block"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Akselerator Utang" : "Debt Accelerator"}
              </span>
              <span
                className="font-bold tabular-nums text-[13px] block mt-0.5"
                style={{ color: "var(--text-primary)" }}
              >
                Avalanche
              </span>
            </div>
            <span
              className="text-[9px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? "Bebas 2027" : "Free 2027"}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Action Button */}
      <button
        type="button"
        onClick={() => {
          triggerHaptic("medium");
          onOpenDetails?.();
        }}
        className="w-full py-2.5 px-3.5 rounded-xl flex items-center justify-between text-xs font-semibold active:scale-[0.99] transition-transform select-none cursor-pointer mt-1"
        style={{
          background: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.035)",
          border: cardBorder,
          color: "var(--text-primary)",
        }}
      >
        <span className="flex items-center gap-2">
          <Layers3 size={14} style={{ color: "var(--text-tertiary)" }} />
          {isIndonesian
            ? "Buka Lembar Model Finansial Lengkap"
            : "Open Full Financial Model Sheet"}
        </span>
        <ChevronRight size={14} style={{ color: "var(--text-tertiary)" }} />
      </button>
    </section>
  );
}
