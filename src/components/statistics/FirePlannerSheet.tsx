import { useState, useMemo } from "react";
import { triggerHaptic } from "../../lib/haptics";
import { BottomSheet } from "../ui/BottomSheet";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import {
  calculateSavingsAccelerationLevers,
  calculateCashBufferRecommendation,
} from "../../lib/monteCarloEngine";
import {
  Flame,
  CheckCircle2,
  ShieldCheck,
  RotateCcw,
  Zap,
  Shield,
  TrendingUp,
} from "lucide-react";

interface FirePlannerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  initialNetWorth: number;
  defaultMonthlySavings: number;
  defaultMonthlyBurnRate: number;
  hideBalance?: boolean;
}

export function FirePlannerSheet({
  isOpen,
  onClose,
  initialNetWorth,
  defaultMonthlySavings,
  defaultMonthlyBurnRate,
  hideBalance = false,
}: FirePlannerSheetProps) {
  const { isIndonesian } = useLanguage();
  const { formatWithPreferred, currencyMeta } = useCurrency();
  const [monthlyBurn, setMonthlyBurn] = useState<number>(
    Math.max(1000000, defaultMonthlyBurnRate || 3500000)
  );
  const [monthlySavings, setMonthlySavings] = useState<number>(
    Math.max(1000000, defaultMonthlySavings || 3000000)
  );
  const [swr, setSwr] = useState<number>(0.04);
  const [realReturn, setRealReturn] = useState<number>(0.06);

  const annualExpenses = monthlyBurn * 12;
  const standardFireTarget = Math.round(annualExpenses / swr);
  const leanFireTarget = Math.round(standardFireTarget * 0.7);
  const fatFireTarget = Math.round(standardFireTarget * 1.4);
  const baristaFireTarget = Math.round(standardFireTarget * 0.6);
  const coastFireTarget = Math.round(standardFireTarget / Math.pow(1 + realReturn, 15));

  const currentCapital = Math.max(0, initialNetWorth);
  const standardProgress = Math.min(100, Math.max(0, Number(((currentCapital / standardFireTarget) * 100).toFixed(1))));

  // Project years to Standard FIRE
  const yearsToFire = useMemo(() => {
    if (currentCapital >= standardFireTarget) return 0;
    const annualSavings = monthlySavings * 12;
    if (annualSavings <= 0) return null;

    let bal = currentCapital;
    for (let yr = 1; yr <= 40; yr++) {
      bal = (bal + annualSavings) * (1 + realReturn);
      if (bal >= standardFireTarget) return yr;
    }
    return ">40";
  }, [currentCapital, standardFireTarget, monthlySavings, realReturn]);

  const milestones = [
    {
      type: "lean",
      title: "Lean FIRE",
      desc: isIndonesian
        ? "Mencakup kebutuhan pokok tak terelakkan (pangan, tempat tinggal, utilitas dasar pada 70%)."
        : "Covers non-negotiable living essentials (food, shelter, basic utilities at 70%).",
      target: leanFireTarget,
      isMet: currentCapital >= leanFireTarget,
    },
    {
      type: "barista",
      title: "Barista FIRE",
      desc: isIndonesian
        ? "Portofolio menanggung 60% gaya hidup; pekerjaan paruh waktu/passion menutup sisanya."
        : "Portfolio covers 60% of lifestyle; light flexible/passion work covers the rest.",
      target: baristaFireTarget,
      isMet: currentCapital >= baristaFireTarget,
    },
    {
      type: "standard",
      title: "Standard FIRE",
      desc: isIndonesian
        ? "Kemandirian finansial 100% penuh mempertahankan kualitas hidup saat ini."
        : "100% full financial independence maintaining your existing quality of life.",
      target: standardFireTarget,
      isMet: currentCapital >= standardFireTarget,
    },
    {
      type: "fat",
      title: "Fat FIRE",
      desc: isIndonesian
        ? "Buffer kemakmuran melimpah (140%) memungkinkan perjalanan mewah, perawatan keluarga & dana tak terduga."
        : "Generous abundance buffer (140%) enabling luxury travel, family care & contingencies.",
      target: fatFireTarget,
      isMet: currentCapital >= fatFireTarget,
    },
    {
      type: "coast",
      title: "Coast FIRE",
      desc: isIndonesian
        ? "Modal bersih yang dibutuhkan hari ini untuk tumbuh menjadi Standard FIRE dalam 15 tahun tanpa tambahan tabungan."
        : "Net capital needed today that will grow to Standard FIRE in 15 years with zero added savings.",
      target: coastFireTarget,
      isMet: currentCapital >= coastFireTarget,
    },
  ];

  const handleReset = () => {
    triggerHaptic("medium");
    setMonthlyBurn(Math.max(1000000, defaultMonthlyBurnRate || 3500000));
    setMonthlySavings(Math.max(1000000, defaultMonthlySavings || 3000000));
    setSwr(0.04);
    setRealReturn(0.06);
  };

  const accelerationLevers = useMemo(() => {
    return calculateSavingsAccelerationLevers({
      initialNetWorth: currentCapital,
      annualExpenses,
      monthlyContribution: monthlySavings,
      safeWithdrawalRate: swr,
      netRealReturn: realReturn,
    });
  }, [currentCapital, annualExpenses, monthlySavings, swr, realReturn]);

  const cashBuffer = useMemo(() => {
    return calculateCashBufferRecommendation({
      annualExpenses,
      currentNetWorth: currentCapital,
      language: isIndonesian ? "id" : "en",
    });
  }, [annualExpenses, currentCapital, isIndonesian]);

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
                  {isIndonesian ? "Perencana Pensiun FIRE" : "FIRE Retirement Planner"}
                </h3>
                <span
                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                  style={{
                    background: "var(--glass-fill-strong)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  {isIndonesian ? "Kemandirian" : "Independence"}
                </span>
              </div>
              <p
                className="text-[11px] font-medium"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian
                  ? "Laju penarikan aman, hitung mundur tonggak & ketahanan portofolio"
                  : "Safe withdrawal rates, milestone countdown & portfolio runway"}
              </p>
            </div>
          </div>

          <button
            onClick={handleReset}
            className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform"
            style={{
              background: "var(--glass-fill)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-secondary)",
            }}
            title={isIndonesian ? "Reset ke Angka Riil" : "Reset to Actuals"}
          >
            <RotateCcw size={13} />
          </button>
        </div>

        {/* Hero Card */}
        <div
          className="p-4 rounded-[22px]"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--glass-border)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
                {isIndonesian ? "Target Standard FIRE" : "Standard FIRE Goal"}
              </p>
              <p className="text-[26px] font-semibold tracking-tight mt-0.5 text-[var(--text-primary)]">
                {hideBalance ? `${currencyMeta?.symbol || "Rp"} ••••••` : formatWithPreferred(standardFireTarget)}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
                {isIndonesian ? "Estimasi Waktu" : "Timeline"}
              </span>
              <p className="text-[15px] font-semibold text-[var(--text-primary)] mt-0.5">
                {yearsToFire === 0
                  ? isIndonesian
                    ? "Tercapai"
                    : "Goal Met"
                  : yearsToFire !== null
                    ? isIndonesian
                      ? `~${yearsToFire} Tahun`
                      : `~${yearsToFire} Years`
                    : "—"}
              </p>
            </div>
          </div>

          <div
            className="w-full h-2 rounded-full overflow-hidden mt-3"
            style={{ background: "var(--glass-border)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${standardProgress}%`,
                background: "var(--text-primary)",
              }}
            />
          </div>

          <div className="flex justify-between items-center text-[10px] mt-2 text-[var(--text-secondary)]">
            <span>
              {isIndonesian ? "Kekayaan Bersih:" : "Net Worth:"}{" "}
              {hideBalance ? `${currencyMeta?.symbol || "Rp"} ••••••` : formatWithPreferred(currentCapital)}
            </span>
            <span className="font-bold text-[var(--text-primary)]">
              {standardProgress}% {isIndonesian ? "Tercapai" : "Funded"}
            </span>
          </div>
        </div>

        {/* Interactive Controls */}
        <div
          className="p-4 rounded-[22px] space-y-3"
          style={{
            background: "var(--glass-fill)",
            border: "1px solid var(--glass-border)",
          }}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] block">
            {isIndonesian ? "Parameter Perencanaan" : "Plan Parameters"}
          </span>

          {/* Monthly Living Spend */}
          <div>
            <div className="flex justify-between text-[11px] font-semibold mb-1">
              <span style={{ color: "var(--text-secondary)" }}>
                {isIndonesian ? "Pengeluaran Hidup Bulanan" : "Monthly Living Expenses"}
              </span>
              <span className="font-bold" style={{ color: "var(--text-primary)" }}>
                {hideBalance ? `${currencyMeta?.symbol || "Rp"} ••••••` : formatWithPreferred(monthlyBurn)}{" "}
                {isIndonesian ? "/ bln" : "/ mo"}
              </span>
            </div>
            <input
              type="range"
              min={1000000}
              max={30000000}
              step={500000}
              value={monthlyBurn}
              onChange={(e) => setMonthlyBurn(Number(e.target.value))}
              className="w-full accent-[var(--text-primary)] cursor-pointer"
            />
          </div>

          {/* Monthly Savings */}
          <div>
            <div className="flex justify-between text-[11px] font-semibold mb-1">
              <span style={{ color: "var(--text-secondary)" }}>
                {isIndonesian ? "Kontribusi Tabungan Bulanan" : "Monthly Savings Contribution"}
              </span>
              <span className="font-bold" style={{ color: "var(--text-primary)" }}>
                {hideBalance ? `${currencyMeta?.symbol || "Rp"} ••••••` : formatWithPreferred(monthlySavings)}{" "}
                {isIndonesian ? "/ bln" : "/ mo"}
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
          </div>

          {/* Safe Withdrawal Rate Selector */}
          <div className="pt-2 border-t border-[var(--glass-border)] flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
              {isIndonesian ? "Laju Penarikan Aman" : "Safe Withdrawal Rate (SWR)"}
            </span>
            <div className="flex items-center gap-1.5">
              {[0.03, 0.035, 0.04, 0.045].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setSwr(rate);
                  }}
                  className="px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer"
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

          {/* Real Return (Post-Inflation) Selector */}
          <div className="pt-2 border-t border-[var(--glass-border)] flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
                {isIndonesian ? "Imbal Hasil Riil Bersih" : "Net Real Return (Post-Inflation)"}
              </span>
              <span className="text-[10px] text-[var(--text-tertiary)]">
                {isIndonesian ? "Imbal hasil bersih di atas inflasi tahunan" : "Net return above annual inflation"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {[0.04, 0.05, 0.06, 0.07, 0.08].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setRealReturn(rate);
                  }}
                  className="px-2 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer"
                  style={{
                    background: realReturn === rate ? "var(--glass-fill-strong)" : "transparent",
                    color: realReturn === rate ? "var(--text-primary)" : "var(--text-tertiary)",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  {(rate * 100).toFixed(0)}%
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Interactive Savings Acceleration Levers */}
        <div
          className="p-4 rounded-[22px] space-y-3"
          style={{
            background: "var(--glass-fill)",
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
                <Zap size={13.5} strokeWidth={1.8} />
              </div>
              <div>
                <span className="text-[12px] font-bold text-[var(--text-primary)] block">
                  {isIndonesian ? "Tuas Akselerasi Tabungan" : "Savings Acceleration Levers"}
                </span>
                <span className="text-[10px] text-[var(--text-tertiary)] block">
                  {isIndonesian
                    ? "Ketuk tuas untuk mengaplikasikan ke target seketika"
                    : "Tap any lever to test immediate timeline impact"}
                </span>
              </div>
            </div>
            <TrendingUp size={14} className="text-[var(--text-tertiary)]" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            {/* Lever 1: +15% Tabungan */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("medium");
                setMonthlySavings(accelerationLevers.tier15Pct.adjustedMonthlySavings);
              }}
              className="p-2.5 rounded-xl text-left border transition-all active:scale-[0.98] cursor-pointer group"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--glass-border)",
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold tracking-wider uppercase text-[var(--text-secondary)]">
                  +15% {isIndonesian ? "Tabungan" : "Savings"}
                </span>
                <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-white/[0.06] text-[var(--text-primary)]">
                  {accelerationLevers.tier15Pct.yearsSaved > 0
                    ? isIndonesian
                      ? `-${accelerationLevers.tier15Pct.yearsSaved} thn`
                      : `-${accelerationLevers.tier15Pct.yearsSaved} yrs`
                    : isIndonesian
                      ? "Akselerasi"
                      : "Faster"}
                </span>
              </div>
              <p className="text-[11px] font-bold text-[var(--text-primary)] truncate tabular-nums">
                +{formatWithPreferred(accelerationLevers.tier15Pct.monthlySavingsDiff)}
                <span className="text-[9px] font-normal text-[var(--text-tertiary)]">
                  {isIndonesian ? "/bln" : "/mo"}
                </span>
              </p>
            </button>

            {/* Lever 2: +30% Tabungan */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("medium");
                setMonthlySavings(accelerationLevers.tier30Pct.adjustedMonthlySavings);
              }}
              className="p-2.5 rounded-xl text-left border transition-all active:scale-[0.98] cursor-pointer group"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--glass-border)",
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold tracking-wider uppercase text-[var(--text-secondary)]">
                  +30% {isIndonesian ? "Tabungan" : "Savings"}
                </span>
                <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-white/[0.06] text-[var(--text-primary)]">
                  {accelerationLevers.tier30Pct.yearsSaved > 0
                    ? isIndonesian
                      ? `-${accelerationLevers.tier30Pct.yearsSaved} thn`
                      : `-${accelerationLevers.tier30Pct.yearsSaved} yrs`
                    : isIndonesian
                      ? "Akselerasi"
                      : "Faster"}
                </span>
              </div>
              <p className="text-[11px] font-bold text-[var(--text-primary)] truncate tabular-nums">
                +{formatWithPreferred(accelerationLevers.tier30Pct.monthlySavingsDiff)}
                <span className="text-[9px] font-normal text-[var(--text-tertiary)]">
                  {isIndonesian ? "/bln" : "/mo"}
                </span>
              </p>
            </button>

            {/* Lever 3: -10% Pengeluaran */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic("medium");
                setMonthlyBurn(accelerationLevers.expenseCut10Pct.reducedMonthlyBurn);
                setMonthlySavings(accelerationLevers.expenseCut10Pct.adjustedMonthlySavings);
              }}
              className="p-2.5 rounded-xl text-left border transition-all active:scale-[0.98] cursor-pointer group"
              style={{
                background: "var(--bg-elevated)",
                borderColor: "var(--glass-border)",
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold tracking-wider uppercase text-[var(--text-secondary)]">
                  -10% {isIndonesian ? "Biaya Hidup" : "Expenses"}
                </span>
                <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-white/[0.06] text-[var(--text-primary)]">
                  {accelerationLevers.expenseCut10Pct.yearsSaved > 0
                    ? isIndonesian
                      ? `-${accelerationLevers.expenseCut10Pct.yearsSaved} thn`
                      : `-${accelerationLevers.expenseCut10Pct.yearsSaved} yrs`
                    : isIndonesian
                      ? "Target Turun"
                      : "Goal Drop"}
                </span>
              </div>
              <p className="text-[11px] font-bold text-[var(--text-primary)] truncate tabular-nums">
                -{formatWithPreferred(Math.round(monthlyBurn * 0.10))}
                <span className="text-[9px] font-normal text-[var(--text-tertiary)]">
                  {isIndonesian ? "/bln" : "/mo"}
                </span>
              </p>
            </button>
          </div>
        </div>

        {/* SORR Cash Buffer Playbook Card */}
        <div
          className="p-4 rounded-[22px] space-y-2.5"
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
                  {isIndonesian ? "Mitigasi Risiko Krisis Pasar Dini" : "Early Downturn Shield (SORR)"}
                </span>
                <span className="text-[10px] text-[var(--text-tertiary)] block">
                  {isIndonesian
                    ? "Cadangan likuid 18–24 bulan untuk melindungi portofolio"
                    : "18–24 months liquid cash buffer to protect equity portfolio"}
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
                ? cashBuffer.adequacyStatus === "Optimal"
                  ? "Optimal"
                  : cashBuffer.adequacyStatus === "Adequate"
                    ? "Cukup"
                    : "Perlu Ditambah"
                : cashBuffer.adequacyStatus}
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <span className="text-[11px] font-medium text-[var(--text-secondary)]">
              {isIndonesian ? "Target Cadangan Likuid:" : "Recommended Buffer:"}
            </span>
            <span className="text-[13px] font-bold text-[var(--text-primary)] tabular-nums">
              {hideBalance
                ? `${currencyMeta?.symbol || "Rp"} ••••••`
                : `${formatWithPreferred(cashBuffer.amountMin)} – ${formatWithPreferred(cashBuffer.amountMax)}`}
            </span>
          </div>

          <p className="text-[10.5px] leading-relaxed text-[var(--text-tertiary)]">
            {cashBuffer.recommendationText}
          </p>
        </div>

        {/* 5 Milestones Matrix */}
        <div className="space-y-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] px-1 block">
            {isIndonesian ? "Matriks Tonggak Pencapaian" : "Milestone Matrix"}
          </span>

          {milestones.map((m) => {
            const pct = Math.min(100, Math.max(0, Number(((currentCapital / m.target) * 100).toFixed(0))));
            return (
              <div
                key={m.type}
                className="p-3.5 rounded-[22px]"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-[var(--text-primary)]">
                      {m.title}
                    </span>
                    {m.isMet && (
                      <span
                        className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1"
                        style={{
                          background: "var(--glass-fill-strong)",
                          color: "var(--text-primary)",
                          border: "1px solid var(--glass-border)",
                        }}
                      >
                        <CheckCircle2 size={10} /> {isIndonesian ? "Tercapai" : "Met"}
                      </span>
                    )}
                  </div>
                  <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                    {hideBalance ? `${currencyMeta?.symbol || "Rp"} ••••••` : formatWithPreferred(m.target)}
                  </span>
                </div>

                <p className="text-[11px] text-[var(--text-tertiary)] mb-2">
                  {m.desc}
                </p>

                <div
                  className="w-full h-1.5 rounded-full overflow-hidden"
                  style={{ background: "var(--glass-border)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: "var(--text-primary)",
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-[var(--text-secondary)] mt-1.5 font-medium">
                  <span>{isIndonesian ? "Saat Ini: " : "Current: "}{pct}%</span>
                  <span>
                    {isIndonesian ? "Pengali: " : "Multiplier: "}
                    {(1 / swr).toFixed(0)}
                    {isIndonesian ? "× pengeluaran tahunan" : "× annual spend"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* SWR Safe Rule Guidance */}
        <div
          className="p-3.5 rounded-[20px] flex items-start gap-2.5"
          style={{
            background: "var(--glass-fill)",
            border: "1px solid var(--glass-border)",
          }}
        >
          <ShieldCheck size={16} className="text-[var(--text-secondary)] shrink-0 mt-0.5" />
          <div className="space-y-1 text-[11px] leading-relaxed text-[var(--text-tertiary)]">
            <p>
              {isIndonesian
                ? "Aturan Penarikan Aman 4% (Kajian Trinity) telah memperhitungkan inflasi secara dinamis: penarikan di tahun pertama adalah 4%, lalu dinaikkan setiap tahun mengikuti laju inflasi agar daya beli tidak berkurang selama 30+ tahun masa pensiun."
                : "The 4% Safe Withdrawal Rule (Trinity Study) dynamically accounts for inflation: year one starts at 4%, then withdrawals adjust upward annually to match inflation for 30+ years."}
            </p>
            <p>
              {isIndonesian
                ? "Fase akumulasi di atas menggunakan Imbal Hasil Riil (imbal hasil setelah dikurangi inflasi tahunan). Seluruh proyeksi dan target disajikan dalam nilai daya beli konstan hari ini."
                : "The accumulation phase above calculates with Real Return (Nominal Return minus Inflation). Projections and targets are presented in today's constant purchasing power."}
            </p>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
