import { useMemo } from "react";
import { triggerHaptic } from "../../lib/haptics";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import {
  Flame,
  ChevronRight,
  SlidersHorizontal,
  CheckCircle2,
  Hourglass,
} from "lucide-react";

interface FirePlannerCardProps {
  netWorth: number;
  monthlyBurnRate: number;
  monthlySavings: number;
  hideBalance?: boolean;
  onOpenPlanner: () => void;
}

export function FirePlannerCard({
  netWorth,
  monthlyBurnRate,
  monthlySavings,
  hideBalance = false,
  onOpenPlanner,
}: FirePlannerCardProps) {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const { formatWithPreferred, currencyMeta } = useCurrency();
  const isDark = theme !== "light";
  const isIndonesian = language === "id";

  // SWR default 4% (25x rule)
  const swr = 0.04;
  const annualExpenses = Math.max(12000000, (monthlyBurnRate || 3500000) * 12);

  const standardFireNumber = Math.round(annualExpenses / swr);
  const leanFireNumber = Math.round(standardFireNumber * 0.7);
  const fatFireNumber = Math.round(standardFireNumber * 1.4);

  const currentCapital = Math.max(0, netWorth);
  const progressPct = Math.min(100, Math.max(0, Number(((currentCapital / standardFireNumber) * 100).toFixed(1))));

  // Estimate years to standard FIRE using compound growth formula at 7% real return
  const estimatedYears = useMemo(() => {
    if (currentCapital >= standardFireNumber) return 0;
    const annualSavings = Math.max(0, monthlySavings * 12);
    if (annualSavings === 0) return null;

    const r = 0.06; // 6% real net return
    let balance = currentCapital;
    for (let yr = 1; yr <= 40; yr++) {
      balance = (balance + annualSavings) * (1 + r);
      if (balance >= standardFireNumber) {
        return yr;
      }
    }
    return ">40";
  }, [currentCapital, standardFireNumber, monthlySavings]);

  const milestones = [
    {
      label: "Lean FIRE",
      sub: isIndonesian ? "Kebutuhan Pokok (70%)" : "Essential Living (70%)",
      target: leanFireNumber,
      isAchieved: currentCapital >= leanFireNumber,
    },
    {
      label: "Standard FIRE",
      sub: isIndonesian ? "Kemandirian Penuh (100%)" : "Full Independence (100%)",
      target: standardFireNumber,
      isAchieved: currentCapital >= standardFireNumber,
    },
    {
      label: "Fat FIRE",
      sub: isIndonesian ? "Kemewahan & Cadangan (140%)" : "Luxury & Buffer (140%)",
      target: fatFireNumber,
      isAchieved: currentCapital >= fatFireNumber,
    },
  ];

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
            <Flame size={16} strokeWidth={1.75} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2
                className="text-[13px] font-bold tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                {isIndonesian ? "Perencana FIRE" : "FIRE Planner"}
              </h2>
              <span
                className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                style={{
                  background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)",
                  color: "var(--text-secondary)",
                  border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
                }}
              >
                {isIndonesian ? "Pensiun Dini" : "Retire Early"}
              </span>
            </div>
            <p
              className="text-[11px] font-medium"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian
                ? "Tonggak kemandirian finansial & runway penarikan aman"
                : "Financial Independence milestones & safe withdrawal runway"}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            triggerHaptic("light");
            onOpenPlanner();
          }}
          className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
          style={{
            background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
            color: "var(--text-secondary)",
          }}
          title={isIndonesian ? "Konfigurasi Parameter FIRE" : "Configure FIRE Parameters"}
          aria-label={isIndonesian ? "Konfigurasi Parameter FIRE" : "Configure FIRE Parameters"}
        >
          <SlidersHorizontal size={14} strokeWidth={1.75} />
        </button>
      </div>

      {/* Hero Progress Banner */}
      <div
        className="p-4 rounded-[22px] mb-4"
        style={{
          background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.025)",
          border: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid rgba(0, 0, 0, 0.04)",
        }}
      >
        <div className="flex justify-between items-start mb-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
              {isIndonesian ? "Progres Standard FIRE" : "Standard FIRE Progress"}
            </p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-[26px] font-semibold tracking-tight leading-none text-[var(--text-primary)] tabular-nums">
                {progressPct}%
              </span>
              <span className="text-[11px] font-medium text-[var(--text-tertiary)] tabular-nums">
                {isIndonesian ? "dari" : "of"}{" "}
                {hideBalance ? `${currencyMeta?.symbol || "Rp"} ••••••` : formatWithPreferred(standardFireNumber)}
              </span>
            </div>
          </div>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl"
            style={{
              background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
            }}
          >
            <Hourglass size={12} className="text-[var(--text-secondary)]" />
            <span className="text-[11px] font-bold text-[var(--text-primary)] tabular-nums">
              {estimatedYears === 0
                ? isIndonesian
                  ? "Tercapai"
                  : "Achieved"
                : estimatedYears !== null
                ? isIndonesian
                  ? `~${estimatedYears} thn lagi`
                  : `~${estimatedYears} yrs to FIRE`
                : isIndonesian
                ? "Tingkatkan Tabungan"
                : "Extend Savings"}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div
          className="w-full h-2 rounded-full overflow-hidden mt-2"
          style={{ background: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progressPct}%`,
              background: "var(--text-primary)",
            }}
          />
        </div>
      </div>

      {/* 3 Bento Milestones */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {milestones.map((m) => (
          <div
            key={m.label}
            className="p-3 rounded-2xl flex flex-col justify-between"
            style={{
              background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.025)",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid rgba(0, 0, 0, 0.04)",
            }}
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] truncate">
                  {m.label}
                </span>
                {m.isAchieved && (
                  <CheckCircle2 size={11} className="text-[var(--text-primary)] shrink-0" />
                )}
              </div>
              <p className="text-[12px] font-bold tracking-tight text-[var(--text-primary)] truncate tabular-nums">
                {hideBalance ? `${currencyMeta?.symbol || "Rp"} ••••••` : formatWithPreferred(m.target)}
              </p>
            </div>
            <div
              className="mt-2 pt-1.5"
              style={{
                borderTop: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid rgba(0, 0, 0, 0.05)",
              }}
            >
              <span
                className="text-[10px] font-bold block truncate tabular-nums"
                style={{
                  color: m.isAchieved ? "var(--text-primary)" : "var(--text-secondary)",
                }}
              >
                {m.isAchieved
                  ? isIndonesian
                    ? "Tercapai"
                    : "Met"
                  : isIndonesian
                  ? `${((currentCapital / m.target) * 100).toFixed(0)}% tercapai`
                  : `${((currentCapital / m.target) * 100).toFixed(0)}% reached`}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom CTA */}
      <button
        onClick={() => {
          triggerHaptic("medium");
          onOpenPlanner();
        }}
        className="w-full py-2.5 px-4 rounded-xl flex items-center justify-between font-bold text-[12px] active:scale-[0.99] transition-transform select-none cursor-pointer"
        style={{
          background: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.03)",
          border: isDark ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(0, 0, 0, 0.06)",
          color: "var(--text-primary)",
        }}
      >
        <span className="flex items-center gap-2">
          <Flame size={14} style={{ color: "var(--text-tertiary)" }} />
          {isIndonesian
            ? "Buka Tonggak & Perencana Runway FIRE"
            : "Open FIRE Milestones & Runway Planner"}
        </span>
        <ChevronRight size={14} style={{ color: "var(--text-tertiary)" }} />
      </button>
    </section>
  );
}
