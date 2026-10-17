import { useState, useMemo } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  runMonteCarloSimulation,
  type MonteCarloSimulationResult,
} from "../../lib/monteCarloEngine";
import { useCurrency } from "../../contexts/CurrencyContext";
import { triggerHaptic } from "../../lib/haptics";
import { BottomSheet } from "../ui/BottomSheet";
import {
  Flame,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Target,
  Shield,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";

interface MonteCarloSimulatorSheetProps {
  isOpen: boolean;
  onClose: () => void;
  initialNetWorth: number;
  defaultMonthlySavings: number;
  defaultMonthlyBurnRate: number;
  hideBalance?: boolean;
}

type LabTab = "fan" | "milestones" | "stress" | "insights";

export function MonteCarloSimulatorSheet({
  isOpen,
  onClose,
  initialNetWorth,
  defaultMonthlySavings,
  defaultMonthlyBurnRate,
  hideBalance = false,
}: MonteCarloSimulatorSheetProps) {
  const { isIndonesian } = useLanguage();
  const { formatWithPreferred, formatCompactWithPreferred, currencyMeta } = useCurrency();

  // Parameters
  const [horizonYears, setHorizonYears] = useState<number>(20);
  const [monthlySavings, setMonthlySavings] = useState<number>(
    Math.max(1000000, defaultMonthlySavings || 3000000)
  );
  const [annualReturn, setAnnualReturn] = useState<number>(0.085);
  const [annualVolatility, setAnnualVolatility] = useState<number>(0.15);
  const [annualInflation, setAnnualInflation] = useState<number>(0.035);
  const [swr, setSwr] = useState<number>(0.04);
  const [earlyShock, setEarlyShock] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<LabTab>("fan");
  const [seed, setSeed] = useState<number>(0);

  // Annual living expenses (baseline: monthly burn rate * 12)
  const annualExpenses = useMemo(() => {
    return Math.max(12000000, (defaultMonthlyBurnRate || 3500000) * 12);
  }, [defaultMonthlyBurnRate]);

  // Run simulation reactively
  const simulation: MonteCarloSimulationResult = useMemo(() => {
    // seed triggers fresh simulation pass
    void seed;
    return runMonteCarloSimulation({
      initialNetWorth: Math.max(0, initialNetWorth),
      monthlyContribution: monthlySavings,
      annualExpenses,
      years: horizonYears,
      expectedAnnualReturn: annualReturn,
      annualVolatility,
      annualInflation,
      safeWithdrawalRate: swr,
      iterations: 600,
      earlyShock,
      language: isIndonesian ? "id" : "en",
    });
  }, [
    initialNetWorth,
    monthlySavings,
    annualExpenses,
    horizonYears,
    annualReturn,
    annualVolatility,
    annualInflation,
    swr,
    earlyShock,
    seed,
    isIndonesian,
  ]);

  const {
    fireMilestones,
    successRate,
    resilienceRating,
    terminalValues,
    yearlyTrajectory,
    sequenceOfReturnsImpact,
    cashBufferRecommendation,
    insights,
  } = simulation;

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

  // Chart data formatting
  const chartData = useMemo(() => {
    return yearlyTrajectory.map((item) => ({
      year: item.year,
      yearLabel: item.year === 0 ? (isIndonesian ? "Sekarang" : "Now") : isIndonesian ? `Thn ${item.year}` : `Y${item.year}`,
      p10: item.p10,
      p25: item.p25,
      p50: item.p50,
      p75: item.p75,
      p90: item.p90,
      fireTarget: item.fireTarget,
    }));
  }, [yearlyTrajectory, isIndonesian]);

  // Presets
  const applyPreset = (preset: "conservative" | "moderate" | "aggressive") => {
    triggerHaptic("light");
    if (preset === "conservative") {
      setAnnualReturn(0.06);
      setAnnualVolatility(0.1);
    } else if (preset === "moderate") {
      setAnnualReturn(0.085);
      setAnnualVolatility(0.15);
    } else {
      setAnnualReturn(0.11);
      setAnnualVolatility(0.2);
    }
  };

  const handleResetDefaults = () => {
    triggerHaptic("medium");
    setHorizonYears(20);
    setMonthlySavings(Math.max(1000000, defaultMonthlySavings || 3000000));
    setAnnualReturn(0.085);
    setAnnualVolatility(0.15);
    setAnnualInflation(0.035);
    setSwr(0.04);
    setEarlyShock(false);
    setSeed((s) => s + 1);
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="p-4 sm:p-5 pb-[max(calc(env(safe-area-inset-bottom,0px)+24px),32px)] space-y-4 select-none">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: "var(--glass-fill)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-primary)",
              }}
            >
              <Flame size={20} strokeWidth={1.75} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3
                  className="font-semibold text-[16px] tracking-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  {isIndonesian ? "Lab Monte Carlo & FIRE" : "Monte Carlo & FIRE Lab"}
                </h3>
                <span
                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                  style={{
                    background: "var(--glass-fill-strong)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  {isIndonesian ? "Simulasi" : "Simulation"}
                </span>
              </div>
              <p
                className="text-[11px] font-medium"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian
                  ? "Lintasan pensiun probabilistik & ketahanan pasar"
                  : "Probabilistic retirement trajectory & market resilience"}
              </p>
            </div>
          </div>

          <button
            onClick={handleResetDefaults}
            className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{
              background: "var(--glass-fill)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-secondary)",
            }}
            title={isIndonesian ? "Reset Parameter Simulasi" : "Reset Simulation Parameters"}
            aria-label={isIndonesian ? "Reset Parameter Simulasi" : "Reset Simulation Parameters"}
          >
            <RotateCcw size={13} />
          </button>
        </div>

        {/* Hero Resilience Banner */}
        <div
          className="p-4 rounded-[22px] flex items-center justify-between"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--glass-border)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? "Probabilitas Monte Carlo" : "Monte Carlo Probability"}
            </p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span
                className="text-[28px] font-semibold tracking-tight leading-none"
                style={{ color: "var(--text-primary)" }}
              >
                {successRate}%
              </span>
              <span
                className="text-[12px] font-bold"
                style={{ color: "var(--text-secondary)" }}
              >
                {localizedResilience}
              </span>
            </div>
            <p
              className="text-[11px] font-medium mt-1"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? "Target Standard FIRE: " : "Standard FIRE Goal: "}
              {hideBalance ? `${currencyMeta?.symbol || "Rp"} ••••••` : formatWithPreferred(fireMilestones.standard.targetAmount)}
            </p>
          </div>

          <button
            onClick={() => {
              triggerHaptic("light");
              setSeed((s) => s + 1);
            }}
            className="py-2 px-3 rounded-xl flex items-center gap-1.5 text-[11px] font-bold active:scale-95 transition-transform"
            style={{
              background: "var(--glass-fill-strong)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-primary)",
            }}
          >
            <Sparkles size={13} /> {isIndonesian ? "Simulasi Ulang" : "Re-Simulate"}
          </button>
        </div>

        {/* Interactive Parameter Controls Box */}
        <div
          className="p-4 rounded-[22px] space-y-3.5"
          style={{
            background: "var(--glass-fill)",
            border: "1px solid var(--glass-border)",
          }}
        >
          <div className="flex justify-between items-center">
            <span
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? "Horizon & Strategi Simulasi" : "Simulation Horizon & Strategy"}
            </span>
            {/* Quick Strategy Presets */}
            <div className="flex items-center gap-1">
              {(["conservative", "moderate", "aggressive"] as const).map((p) => {
                const pLabel =
                  p === "conservative"
                    ? isIndonesian
                      ? "Konservatif"
                      : "Conservative"
                    : p === "moderate"
                    ? isIndonesian
                      ? "Moderat"
                      : "Moderate"
                    : isIndonesian
                    ? "Agresif"
                    : "Aggressive";
                return (
                  <button
                    key={p}
                    onClick={() => applyPreset(p)}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all"
                    style={{
                      background:
                        (p === "conservative" && annualReturn === 0.06) ||
                        (p === "moderate" && annualReturn === 0.085) ||
                        (p === "aggressive" && annualReturn === 0.11)
                          ? "var(--glass-fill-strong)"
                          : "transparent",
                      color: "var(--text-primary)",
                      border: "1px solid var(--glass-border)",
                    }}
                  >
                    {pLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Horizon Selection */}
          <div>
            <div className="flex justify-between text-[11px] font-semibold mb-1.5">
              <span style={{ color: "var(--text-secondary)" }}>
                {isIndonesian ? "Horizon Waktu" : "Horizon"}
              </span>
              <span style={{ color: "var(--text-primary)" }}>
                {horizonYears} {isIndonesian ? "Tahun" : "Years"}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {[10, 15, 20, 25, 30].map((yr) => (
                <button
                  key={yr}
                  onClick={() => {
                    triggerHaptic("light");
                    setHorizonYears(yr);
                  }}
                  className="py-1.5 rounded-xl text-[11px] font-bold transition-all text-center"
                  style={{
                    background:
                      horizonYears === yr
                        ? "var(--glass-fill-strong)"
                        : "var(--bg-elevated)",
                    color:
                      horizonYears === yr
                        ? "var(--text-primary)"
                        : "var(--text-tertiary)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  {yr}{isIndonesian ? "Thn" : "Y"}
                </button>
              ))}
            </div>
          </div>

          {/* Monthly Contribution Slider & Stepper */}
          <div>
            <div className="flex justify-between text-[11px] font-semibold mb-1">
              <span style={{ color: "var(--text-secondary)" }}>
                {isIndonesian ? "Kontribusi Bulanan" : "Monthly Contribution"}
              </span>
              <span className="font-bold" style={{ color: "var(--text-primary)" }}>
                {hideBalance ? `${currencyMeta?.symbol || "Rp"} ••••••` : formatWithPreferred(monthlySavings)} {isIndonesian ? "/ bln" : "/ mo"}
              </span>
            </div>
            <input
              type="range"
              min={500000}
              max={25000000}
              step={500000}
              value={monthlySavings}
              onChange={(e) => setMonthlySavings(Number(e.target.value))}
              className="w-full accent-[var(--text-primary)] cursor-pointer"
            />
            <div className="flex justify-between text-[9px] font-bold text-[var(--text-tertiary)] mt-0.5">
              <span>{formatCompactWithPreferred(500000)}</span>
              <span>{formatCompactWithPreferred(12500000)}</span>
              <span>{formatCompactWithPreferred(25000000)}</span>
            </div>
          </div>

          {/* Expected Return & Volatility Sliders */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <div className="flex justify-between text-[10px] font-semibold mb-1">
                <span style={{ color: "var(--text-secondary)" }}>
                  {isIndonesian ? "Imbal Hasil (Nominal)" : "Return (Nominal)"}
                </span>
                <span className="font-bold" style={{ color: "var(--text-primary)" }}>
                  {(annualReturn * 100).toFixed(1)}%
                </span>
              </div>
              <input
                type="range"
                min={0.04}
                max={0.14}
                step={0.005}
                value={annualReturn}
                onChange={(e) => setAnnualReturn(Number(e.target.value))}
                className="w-full accent-[var(--text-primary)] cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between text-[10px] font-semibold mb-1">
                <span style={{ color: "var(--text-secondary)" }}>
                  {isIndonesian ? "Volatilitas (σ)" : "Volatility (σ)"}
                </span>
                <span className="font-bold" style={{ color: "var(--text-primary)" }}>
                  {(annualVolatility * 100).toFixed(1)}%
                </span>
              </div>
              <input
                type="range"
                min={0.08}
                max={0.24}
                step={0.01}
                value={annualVolatility}
                onChange={(e) => setAnnualVolatility(Number(e.target.value))}
                className="w-full accent-[var(--text-primary)] cursor-pointer"
              />
            </div>
          </div>

          {/* Safe Withdrawal Rate & Early Shock Toggle */}
          <div className="pt-2 border-t border-[var(--glass-border)] flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                {isIndonesian ? "Rasio Penarikan (SWR):" : "SWR:"}
              </span>
              <div className="flex items-center gap-1">
                {[0.035, 0.04, 0.045].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => {
                      triggerHaptic("light");
                      setSwr(rate);
                    }}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-bold"
                    style={{
                      background: swr === rate ? "var(--glass-fill-strong)" : "transparent",
                      color: swr === rate ? "var(--text-primary)" : "var(--text-tertiary)",
                      border: "1px solid var(--glass-border)",
                    }}
                  >
                    {(rate * 100).toFixed(1)}%
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                triggerHaptic("light");
                setEarlyShock(!earlyShock);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all"
              style={{
                background: earlyShock ? "rgba(255, 255, 255, 0.15)" : "transparent",
                color: earlyShock ? "var(--text-primary)" : "var(--text-tertiary)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <AlertTriangle size={11} /> {isIndonesian ? "-25% Guncangan Awal" : "-25% Early Shock"}
            </button>
          </div>
        </div>

        {/* View Mode Navigation Tabs */}
        <div
          className="flex items-center gap-1 p-1 rounded-2xl"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--glass-border)",
          }}
        >
          {[
            { key: "fan", label: isIndonesian ? "Bagan Pita" : "Fan Chart" },
            { key: "milestones", label: isIndonesian ? "Tonggak FIRE" : "FIRE Milestones" },
            { key: "stress", label: isIndonesian ? "Uji Stres" : "Stress Test" },
            { key: "insights", label: isIndonesian ? "Wawasan Eksekutif" : "Executive Insights" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => {
                triggerHaptic("light");
                setActiveTab(t.key as LabTab);
              }}
              className="flex-1 py-1.5 rounded-xl text-[11px] font-bold transition-all text-center"
              style={{
                background:
                  activeTab === t.key
                    ? "var(--glass-fill-strong)"
                    : "transparent",
                color:
                  activeTab === t.key
                    ? "var(--text-primary)"
                    : "var(--text-tertiary)",
                border:
                  activeTab === t.key
                    ? "1px solid var(--glass-border)"
                    : "1px solid transparent",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB CONTENT 1: Fan Chart */}
        {activeTab === "fan" && (
          <div className="space-y-3">
            <div
              className="p-4 rounded-[22px] glass-surface"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h4
                    className="text-[12px] font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {isIndonesian ? "Dispersi Kekayaan Stokastik" : "Stochastic Wealth Dispersion"}
                  </h4>
                  <p
                    className="text-[10px]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {isIndonesian
                      ? `Interval kepercayaan sepanjang ${horizonYears} tahun`
                      : `Confidence intervals across ${horizonYears} years`}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="flex items-center gap-1" style={{ color: "var(--text-tertiary)" }}>
                    <span className="w-2 h-0.5 bg-[var(--text-tertiary)] rounded-full" /> {isIndonesian ? "Bear (P10)" : "P10 Bear"}
                  </span>
                  <span className="flex items-center gap-1 font-bold" style={{ color: "var(--text-primary)" }}>
                    <span className="w-2 h-0.5 bg-[var(--text-primary)] rounded-full" /> Median
                  </span>
                  <span className="flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
                    <span className="w-2 h-0.5 bg-[var(--text-secondary)] rounded-full" /> {isIndonesian ? "Bull (P90)" : "P90 Bull"}
                  </span>
                </div>
              </div>

              <div className="h-[210px] -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="fanBandUpper" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--text-primary)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--text-primary)" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="yearLabel"
                      tick={{
                        fontSize: 9.5,
                        fill: "var(--text-tertiary)",
                        fontWeight: 600,
                        fontFamily: "Urbanist",
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const data = payload[0].payload;
                        return (
                          <div
                            className="p-3 rounded-xl text-[11px] font-medium"
                            style={{
                              background: "var(--bg-elevated)",
                              border: "1px solid var(--glass-border)",
                              boxShadow: "0 8px 24px var(--shadow-strength)",
                            }}
                          >
                            <p className="font-bold text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                              {isIndonesian ? "Garis Waktu" : "Timeline"}: {label}
                            </p>
                            <p className="text-[var(--text-primary)] font-bold">
                              Median: {hideBalance ? `${currencyMeta?.symbol || "Rp"} ••••••` : formatWithPreferred(data.p50)}
                            </p>
                            <p className="text-[var(--text-tertiary)] text-[10px]">
                              Bear (P10): {hideBalance ? `${currencyMeta?.symbol || "Rp"} ••••••` : formatWithPreferred(data.p10)}
                            </p>
                            <p className="text-[var(--text-secondary)] text-[10px]">
                              Bull (P90): {hideBalance ? `${currencyMeta?.symbol || "Rp"} ••••••` : formatWithPreferred(data.p90)}
                            </p>
                            <p className="text-[10px] pt-1 mt-1 border-t border-[var(--glass-border)] text-[var(--text-tertiary)]">
                              {isIndonesian ? "Target FIRE: " : "FIRE Target: "}
                              {hideBalance ? `${currencyMeta?.symbol || "Rp"} ••••••` : formatWithPreferred(data.fireTarget)}
                            </p>
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine
                      y={fireMilestones.standard.targetAmount}
                      stroke="var(--glass-border)"
                      strokeDasharray="4 4"
                    />
                    <Area
                      type="monotone"
                      dataKey="p90"
                      stroke="none"
                      fill="url(#fanBandUpper)"
                      fillOpacity={1}
                    />
                    <Area
                      type="monotone"
                      dataKey="p50"
                      stroke="var(--text-primary)"
                      strokeWidth={2.5}
                      fill="none"
                      dot={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="p10"
                      stroke="var(--text-tertiary)"
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                      fill="none"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Terminal Outlier Summary Bento */}
            <div className="grid grid-cols-3 gap-2">
              <div
                className="p-3 rounded-2xl"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
                  {isIndonesian ? "Persentil ke-10 (Bear)" : "10th %ile (Bear)"}
                </p>
                <p className="text-[13px] font-semibold tracking-tight mt-1 text-[var(--text-primary)]">
                  {hideBalance ? `${currencyMeta?.symbol || "Rp"} ••••••` : formatWithPreferred(terminalValues.p10)}
                </p>
              </div>
              <div
                className="p-3 rounded-2xl"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  {isIndonesian ? "Ekspektasi Median" : "Median Expected"}
                </p>
                <p className="text-[13px] font-semibold tracking-tight mt-1 text-[var(--text-primary)]">
                  {hideBalance ? `${currencyMeta?.symbol || "Rp"} ••••••` : formatWithPreferred(terminalValues.p50)}
                </p>
              </div>
              <div
                className="p-3 rounded-2xl"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  {isIndonesian ? "Persentil ke-90 (Bull)" : "90th %ile (Bull)"}
                </p>
                <p className="text-[13px] font-semibold tracking-tight mt-1 text-[var(--text-primary)]">
                  {hideBalance ? `${currencyMeta?.symbol || "Rp"} ••••••` : formatWithPreferred(terminalValues.p90)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT 2: FIRE Milestones */}
        {activeTab === "milestones" && (
          <div className="space-y-2.5">
            {[
              fireMilestones.lean,
              fireMilestones.standard,
              fireMilestones.fat,
              fireMilestones.coast,
            ].map((m) => (
              <div
                key={m.type}
                className="p-3.5 rounded-[22px]"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                <div className="flex justify-between items-start mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-[var(--text-primary)]">
                      {m.label}
                    </span>
                    {m.isAchieved && (
                      <span
                        className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider"
                        style={{
                          background: "var(--glass-fill-strong)",
                          color: "var(--text-primary)",
                          border: "1px solid var(--glass-border)",
                        }}
                      >
                        <CheckCircle2 size={10} /> {isIndonesian ? "Tercapai" : "Achieved"}
                      </span>
                    )}
                  </div>
                  <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                    {hideBalance ? `${currencyMeta?.symbol || "Rp"} ••••••` : formatWithPreferred(m.targetAmount)}
                  </span>
                </div>

                <p className="text-[11px] text-[var(--text-tertiary)] mb-2.5">
                  {m.description}
                </p>

                {/* Progress bar */}
                <div
                  className="w-full h-1.5 rounded-full overflow-hidden mb-2"
                  style={{ background: "var(--glass-border)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${m.currentProgressPct}%`,
                      background: "var(--text-primary)",
                    }}
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] text-[var(--text-secondary)]">
                  <span>{isIndonesian ? "Saat Ini: " : "Current: "}{m.currentProgressPct}%</span>
                  <span>
                    {isIndonesian ? "Perkiraan Capai: " : "Arrival: "}
                    <strong className="text-[var(--text-primary)]">
                      {m.isAchieved
                        ? (isIndonesian ? "Sekarang" : "Now")
                        : m.estimatedYearsMedian !== null
                        ? (isIndonesian
                            ? `~${m.estimatedYearsMedian} thn (Median) · ~${m.estimatedYearsBear || ">30"} thn (Bear)`
                            : `~${m.estimatedYearsMedian} yrs (Median) · ~${m.estimatedYearsBear || ">30"} yrs (Bear)`)
                        : (isIndonesian ? `Melampaui ${horizonYears} tahun` : `Beyond ${horizonYears} years`)}
                    </strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB CONTENT 3: Stress Test (Sequence of Returns Risk) */}
        {activeTab === "stress" && (
          <div className="space-y-3">
            <div
              className="p-4 rounded-[22px]"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} style={{ color: "var(--text-primary)" }} />
                <h4 className="text-[13px] font-bold text-[var(--text-primary)]">
                  {isIndonesian ? "Risiko Urutan Imbal Hasil" : "Sequence of Returns Risk (SORR)"}
                </h4>
              </div>
              <p className="text-[11px] leading-relaxed text-[var(--text-tertiary)] mb-3">
                {isIndonesian ? (
                  <>
                    Penurunan tajam pasar di awal fase akumulasi atau penarikan secara
                    drastis merusak efek bunga majemuk. Di sini kami menyimulasikan <strong>penurunan -25%</strong> pada Bulan ke-6 Tahun ke-1.
                  </>
                ) : (
                  <>
                    Market crashes occurring early in your accumulation or withdrawal phase
                    exponentially harm compound interest. Here we simulate a <strong>-25% drawdown</strong> in Month 6 of Year 1.
                  </>
                )}
              </p>

              <div
                className="p-3 rounded-xl flex items-center justify-between"
                style={{
                  background: "var(--glass-fill)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
                    {isIndonesian ? "Dampak Guncangan Awal" : "Early Shock Impact"}
                  </p>
                  <p className="text-[14px] font-semibold text-[var(--text-primary)] mt-0.5">
                    {earlyShock
                      ? sequenceOfReturnsImpact
                        ? `-${sequenceOfReturnsImpact.terminalPercentageLoss}% ${isIndonesian ? "Delta Terminal" : "Terminal Delta"}`
                        : (isIndonesian ? "Aktif" : "Active")
                      : (isIndonesian ? "Mode Guncangan Nonaktif" : "Shock Mode Off")}
                  </p>
                </div>
                <button
                  onClick={() => {
                    triggerHaptic("medium");
                    setEarlyShock(!earlyShock);
                  }}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all"
                  style={{
                    background: earlyShock
                      ? "var(--text-primary)"
                      : "var(--glass-fill-strong)",
                    color: earlyShock
                      ? "var(--bg-elevated)"
                      : "var(--text-primary)",
                  }}
                >
                  {earlyShock
                    ? (isIndonesian ? "Nonaktifkan Guncangan" : "Deactivate Shock")
                    : (isIndonesian ? "Simulasikan Crash -25%" : "Inject -25% Crash")}
                </button>
              </div>
            </div>

            {/* Dynamic Cash Buffer Playbook Card */}
            <div
              className="p-4 rounded-[22px] space-y-3"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: "var(--glass-fill-strong)",
                      border: "1px solid var(--glass-border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <Shield size={13.5} strokeWidth={1.8} />
                  </div>
                  <div>
                    <span className="text-[12px] font-bold text-[var(--text-primary)] block">
                      {isIndonesian ? "Protokol Cadangan Likuiditas" : "Liquid Cash Cushion Playbook"}
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)] block">
                      {isIndonesian
                        ? "Penyangga 18–24 bulan untuk menetralkan risiko krisis pasar dini"
                        : "18–24 months buffer to neutralize early SORR risks"}
                    </span>
                  </div>
                </div>
                <span
                  className="text-[9.5px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                  style={{
                    background: "var(--glass-fill-strong)",
                    border: "1px solid var(--glass-border)",
                    color: "var(--text-primary)",
                  }}
                >
                  {isIndonesian
                    ? cashBufferRecommendation.adequacyStatus === "Optimal"
                      ? "Optimal"
                      : cashBufferRecommendation.adequacyStatus === "Adequate"
                        ? "Cukup"
                        : "Perlu Ditambah"
                    : cashBufferRecommendation.adequacyStatus}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-baseline justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] block">
                    {isIndonesian ? "Target Cadangan Tunai / Pasar Uang" : "Target Cash / Money Market Reserve"}
                  </span>
                  <span className="text-[14px] font-bold text-[var(--text-primary)] tabular-nums mt-0.5 block">
                    {hideBalance
                      ? `${currencyMeta?.symbol || "Rp"} ••••••`
                      : `${formatWithPreferred(cashBufferRecommendation.amountMin)} – ${formatWithPreferred(cashBufferRecommendation.amountMax)}`}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] block">
                    {isIndonesian ? "Probabilitas Ketahanan" : "Survival Rate"}
                  </span>
                  <span className="text-[14px] font-bold text-[var(--text-primary)] tabular-nums mt-0.5 block">
                    {successRate}%
                  </span>
                </div>
              </div>

              <p className="text-[11px] leading-relaxed text-[var(--text-tertiary)]">
                {cashBufferRecommendation.recommendationText}
              </p>

              <div
                className="pt-2.5 border-t border-[var(--glass-border)] text-[10.5px] leading-relaxed text-[var(--text-secondary)] space-y-1"
              >
                <p>
                  <strong>{isIndonesian ? "Aturan Eksekusi:" : "Execution Protocol:"}</strong>{" "}
                  {isIndonesian
                    ? "Saat terjadi crash pasar saham dini, biayai gaya hidup sepenuhnya dari dana likuid ini tanpa menjual unit reksa dana/saham hingga pasar pulih kembali ke nilai wajar."
                    : "During early market drawdowns, fund living expenses exclusively from this cash buffer without selling equity units until valuations normalize."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT 4: Executive Insights */}
        {activeTab === "insights" && (
          <div className="space-y-2.5">
            {insights.map((ins, i) => (
              <div
                key={i}
                className="p-3.5 rounded-[20px] flex items-start gap-3"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                <div
                  className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    background: "var(--glass-fill-strong)",
                    border: "1px solid var(--glass-border)",
                    color: "var(--text-primary)",
                  }}
                >
                  <Target size={13} />
                </div>
                <p className="text-[12px] leading-relaxed text-[var(--text-secondary)] font-medium">
                  {ins}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
