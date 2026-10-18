import { ShieldCheck, ChevronRight } from "lucide-react";
import { triggerHaptic } from "../../lib/haptics";

interface HealthScoreHeroCardProps {
  isIndonesian: boolean;
  isDark: boolean;
  rangeTitle: string;
  healthScore: number;
  savingsRate: number;
  totalIncome: number;
  totalExpense: number;
  committedPercentage: number;
  hideBalance: boolean;
  formatWithPreferred: (amount: number) => string;
  onOpenDiagnostic: () => void;
}

export function HealthScoreHeroCard({
  isIndonesian,
  isDark,
  rangeTitle,
  healthScore,
  savingsRate,
  totalIncome,
  totalExpense,
  committedPercentage,
  hideBalance,
  formatWithPreferred,
  onOpenDiagnostic,
}: HealthScoreHeroCardProps) {
  const netFlow = totalIncome - totalExpense;

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
      className="rounded-[26px] p-5 select-none space-y-4 relative overflow-hidden"
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

      {/* ── 1. Header (Single Line) ────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
              border: cardBorder,
              color: "var(--text-primary)",
            }}
          >
            <ShieldCheck size={16} strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h3
              className="text-[13px] font-semibold truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {isIndonesian
                ? "Indeks Ketahanan Finansial"
                : "Financial Health Diagnostic Index"}
            </h3>
            <p
              className="text-[11px] truncate"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian
                ? `Evaluasi performa ${rangeTitle} · 6 pilar ketahanan`
                : `${rangeTitle} performance · 6-pillar resilience`}
            </p>
          </div>
        </div>

        {/* Status Grade Pill (Single Line) */}
        <div
          className="px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1.5"
          style={{
            background: isDark
              ? "rgba(255,255,255,0.05)"
              : "rgba(0,0,0,0.04)",
            border: cardBorder,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: isDark ? "#ffffff" : "#18181b" }}
          />
          <span
            className="text-[11px] font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {totalIncome === 0 && totalExpense === 0
              ? isIndonesian
                ? "Kalibrasi (—)"
                : "Calibrating (—)"
              : healthScore >= 85
                ? isIndonesian
                  ? "Prima (AAA)"
                  : "Excellent (AAA)"
                : healthScore >= 70
                  ? isIndonesian
                    ? "Sehat (AA)"
                    : "Good (AA)"
                  : healthScore >= 50
                    ? isIndonesian
                      ? "Moderat (A)"
                      : "Moderate (A)"
                    : healthScore >= 16
                      ? isIndonesian
                        ? "Defisit (BB)"
                        : "Deficit (BB)"
                      : isIndonesian
                        ? "Kritis (C)"
                        : "Critical (C)"}
          </span>
        </div>
      </div>

      {/* ── 2. Hero Score & View Diagnostic Link ──────────────────────────── */}
      <div className="flex items-baseline justify-between pt-0.5">
        <div className="flex items-baseline gap-2">
          <span
            className="text-[34px] sm:text-[38px] font-light tracking-tight leading-none tabular-nums"
            style={{ color: "var(--text-primary)" }}
          >
            {healthScore}
          </span>
          <span
            className="text-[12px] font-medium"
            style={{ color: "var(--text-tertiary)" }}
          >
            / 100 {isIndonesian ? "poin indeks" : "score index"}
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            onOpenDiagnostic();
            triggerHaptic("light");
          }}
          className="flex items-center gap-1 text-[11px] font-semibold cursor-pointer transition-colors hover:text-[var(--text-primary)]"
          style={{ color: "var(--text-tertiary)" }}
        >
          <span>
            {isIndonesian ? "Buka Diagnostik" : "View Diagnostic"}
          </span>
          <ChevronRight size={13} />
        </button>
      </div>

      {/* ── 3. Sleek Single-Track Progress Gauge ─────────────────────────── */}
      <div
        className="w-full h-2 rounded-full overflow-hidden p-0.5"
        style={{
          background: isDark
            ? "rgba(255,255,255,0.06)"
            : "rgba(0,0,0,0.05)",
        }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.max(4, Math.min(100, healthScore))}%`,
            background: isDark ? "#FFFFFF" : "#18181B",
          }}
        />
      </div>

      {/* ── 4. Key 3-Pillar Telemetry Summary ────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 pt-0.5">
        <div
          className="p-2.5 rounded-xl text-center"
          style={{
            background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.025)",
            border: cardBorder,
          }}
        >
          <span
            className="text-[9.5px] uppercase font-semibold block truncate"
            style={{ color: "var(--text-tertiary)" }}
          >
            {isIndonesian ? "Laju Tabungan" : "Savings Rate"}
          </span>
          <span
            className="text-[12px] font-bold tabular-nums block mt-0.5"
            style={{ color: "var(--text-primary)" }}
          >
            {savingsRate.toFixed(0)}%
          </span>
        </div>

        <div
          className="p-2.5 rounded-xl text-center"
          style={{
            background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.025)",
            border: cardBorder,
          }}
        >
          <span
            className="text-[9.5px] uppercase font-semibold block truncate"
            style={{ color: "var(--text-tertiary)" }}
          >
            {isIndonesian ? "Arus Bersih" : "Net Flow"}
          </span>
          <span
            className="text-[12px] font-bold tabular-nums block mt-0.5 truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {hideBalance
              ? "••••••••"
              : `${netFlow >= 0 ? "+" : "-"}${formatWithPreferred(Math.abs(netFlow))}`}
          </span>
        </div>

        <div
          className="p-2.5 rounded-xl text-center"
          style={{
            background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.025)",
            border: cardBorder,
          }}
        >
          <span
            className="text-[9.5px] uppercase font-semibold block truncate"
            style={{ color: "var(--text-tertiary)" }}
          >
            {isIndonesian ? "Beban Komitmen" : "Committed"}
          </span>
          <span
            className="text-[12px] font-bold tabular-nums block mt-0.5"
            style={{ color: "var(--text-primary)" }}
          >
            {committedPercentage.toFixed(0)}%
          </span>
        </div>
      </div>
    </section>
  );
}
