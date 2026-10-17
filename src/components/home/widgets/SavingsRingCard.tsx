import { Info, Activity } from "lucide-react";
import type { WidgetSize } from "../../../lib/widgetLayoutTypes";
import { CompactShell } from "./CompactShell";
import { useTheme } from "../../../contexts/ThemeContext";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useCurrency } from "../../../contexts/CurrencyContext";

export function SavingsRingCard({
  rate,
  inflow,
  outflow,
  size = "half",
  onOpenDetail,
}: {
  rate: number;
  inflow: number;
  outflow: number;
  size?: WidgetSize;
  onOpenDetail?: () => void;
}) {
  const { theme } = useTheme();
  const { isIndonesian } = useLanguage();
  const { formatWithPreferred } = useCurrency();
  const isDark = theme !== "light";
  const boundedRate = Math.min(100, Math.max(0, rate));
  const radius = size === "half" ? 26 : 38;
  const strokeWidth = size === "half" ? 5 : 6.5;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (boundedRate / 100) * circ;

  const netRetention = inflow - outflow;
  const isSurplus = netRetention >= 0;
  const targetSavings = Math.max(0, inflow * 0.2); // 20% savings rule benchmark
  const ruleProgress =
    targetSavings > 0
      ? Math.min(100, Math.max(0, (netRetention / targetSavings) * 100))
      : 0;

  const ringSvg = (
    <div className="relative flex items-center justify-center shrink-0">
      <svg
        width={(radius + strokeWidth) * 2}
        height={(radius + strokeWidth) * 2}
        className="rotate-[-90deg]"
      >
        <circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          fill="none"
          stroke={isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)"}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          fill="none"
          stroke="var(--text-primary)"
          strokeWidth={strokeWidth}
          strokeDasharray={circ}
          strokeDashoffset={isNaN(offset) ? circ : offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease-in-out" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-[13px] font-semibold amount text-[var(--text-primary)] leading-none">
          {boundedRate.toFixed(0)}%
        </span>
        <span className="text-[8px] font-semibold text-[var(--text-tertiary)] mt-0.5">
          {isIndonesian ? "Tersimpan" : "Saved"}
        </span>
      </div>
    </div>
  );

  if (size === "half") {
    return (
      <CompactShell title={isIndonesian ? "Rasio Tabungan" : "Savings Ring"} onOpenDetail={onOpenDetail}>
        <div className="flex-1 flex items-center justify-center py-0.5">{ringSvg}</div>
        <div className="flex justify-between items-center text-[10px] text-[var(--text-tertiary)] pt-1 border-t border-black/5 dark:border-white/5 shrink-0">
          <span>{isSurplus ? (isIndonesian ? "Sisa Kas" : "Retained") : (isIndonesian ? "Defisit" : "Deficit")}</span>
          <span
            className={`font-semibold amount ${
              isSurplus ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
            }`}
          >
            {formatWithPreferred(Math.abs(netRetention))}
          </span>
        </div>
      </CompactShell>
    );
  }

  return (
    <section
      className="glass-surface p-4 rounded-[22px] select-none space-y-3"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--glass-border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "var(--glass-fill)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <Activity size={14} className="text-[var(--text-primary)]" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)] leading-tight">
              {isIndonesian ? "Laju & Retensi Tabungan" : "Savings Velocity & Retention"}
            </h3>
            <p className="text-[10px] text-[var(--text-tertiary)]">
              {isIndonesian
                ? "Tingkat simpanan modal vs perputaran bulanan"
                : "Capital retention rate vs monthly turnover"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full"
            style={{
              background: "var(--glass-fill)",
              border: "1px solid var(--glass-border)",
              color: isSurplus ? "var(--text-primary)" : "var(--text-secondary)",
            }}
          >
            {boundedRate.toFixed(1)}% {isIndonesian ? "Tersimpan" : "Saved"}
          </span>
          {onOpenDetail && (
            <button
              type="button"
              onClick={onOpenDetail}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] active:scale-90 transition-all cursor-pointer"
            >
              <Info size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 pt-1">
        {ringSvg}
        <div className="flex-1 space-y-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div
              className="p-2 rounded-xl"
              style={{ background: "var(--glass-fill)" }}
            >
              <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
                {isIndonesian ? "Pemasukan" : "Inflow"}
              </span>
              <span className="text-[12px] font-semibold amount text-[var(--text-primary)] block mt-0.5">
                +{formatWithPreferred(inflow)}
              </span>
            </div>
            <div
              className="p-2 rounded-xl"
              style={{ background: "var(--glass-fill)" }}
            >
              <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
                {isIndonesian ? "Pengeluaran" : "Outflow"}
              </span>
              <span className="text-[12px] font-semibold amount text-[var(--text-primary)] block mt-0.5">
                -{formatWithPreferred(outflow)}
              </span>
            </div>
            <div
              className="p-2 rounded-xl"
              style={{ background: "var(--glass-fill)" }}
            >
              <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
                {isIndonesian ? "Posisi Bersih" : "Net Position"}
              </span>
              <span
                className={`text-[12px] font-semibold amount block mt-0.5 ${
                  isSurplus ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                }`}
              >
                {isSurplus ? "+" : "-"}
                {formatWithPreferred(Math.abs(netRetention))}
              </span>
            </div>
          </div>

          {/* 20% Target Benchmark */}
          <div className="pt-1">
            <div className="flex justify-between text-[10px] text-[var(--text-tertiary)] mb-1">
              <span>{isIndonesian ? "Target Tabungan 20% Standar" : "Standard 20% Savings Rule Target"}</span>
              <span className="font-semibold text-[var(--text-primary)]">
                {formatWithPreferred(targetSavings)}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden bg-black/[0.06] dark:bg-white/10">
              <div
                className="h-full rounded-full bg-[var(--text-primary)] transition-all duration-700"
                style={{ width: `${ruleProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="pt-1 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[10px] text-[var(--text-tertiary)]">
        <span>
          {isSurplus
            ? isIndonesian
              ? `Surplus modal bersih ${formatWithPreferred(netRetention)} berhasil dipertahankan.`
              : `Net capital surplus of ${formatWithPreferred(netRetention)} preserved.`
            : isIndonesian
              ? `Pengeluaran melampaui pemasukan bulan ini sebesar ${formatWithPreferred(Math.abs(netRetention))}.`
              : `Outflow exceeds inflow this month by ${formatWithPreferred(Math.abs(netRetention))}.`}
        </span>
        <span className="font-semibold text-[var(--text-secondary)]">
          {isSurplus
            ? isIndonesian ? "Akumulasi" : "Accumulating"
            : isIndonesian ? "Defisit Modal" : "Capital Deficit"}
        </span>
      </div>
    </section>
  );
}
