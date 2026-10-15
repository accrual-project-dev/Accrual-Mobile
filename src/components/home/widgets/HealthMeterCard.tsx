import { Info, ShieldCheck } from "lucide-react";
import type { WidgetSize } from "../../../lib/widgetLayoutTypes";
import { CompactShell } from "./CompactShell";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useCurrency } from "../../../contexts/CurrencyContext";

export function HealthMeterCard({
  healthScore,
  grade = "Optimal",
  size = "half",
  onOpenDetail,
}: {
  healthScore: number;
  grade?: string;
  size?: WidgetSize;
  onOpenDetail?: () => void;
}) {
  const { language } = useLanguage();
  useCurrency();
  const isIndonesian = language === "id";

  const rawGrade =
    grade ||
    (healthScore >= 80
      ? "Optimal"
      : healthScore >= 60
        ? "Good"
        : healthScore >= 40
          ? "Fair"
          : "Attention");

  const statusLabel = isIndonesian
    ? rawGrade === "Good"
      ? "Baik"
      : rawGrade === "Fair"
        ? "Cukup"
        : rawGrade === "Attention"
          ? "Perhatian"
          : "Optimal"
    : rawGrade;

  if (size === "half") {
    return (
      <CompactShell title={isIndonesian ? "Kesehatan Modal" : "Capital Health"} onOpenDetail={onOpenDetail}>
        <div className="flex-1 flex flex-col justify-center items-center py-1">
          <div className="text-center">
            <span className="text-[26px] font-semibold amount text-[var(--text-primary)] leading-none">
              {healthScore}
            </span>
            <span className="text-[10px] font-medium text-[var(--text-tertiary)] block mt-0.5">
              {isIndonesian ? "/ 100 Indeks" : "/ 100 Index"}
            </span>
          </div>
        </div>

        <div className="shrink-0">
          <div className="flex justify-between text-[10px] text-[var(--text-tertiary)] mb-1">
            <span>Status</span>
            <span className="font-semibold text-[var(--text-secondary)]">
              {statusLabel}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden bg-black/[0.06] dark:bg-white/10">
            <div
              className="h-full rounded-full bg-[var(--text-primary)] transition-all"
              style={{ width: `${Math.min(100, Math.max(0, healthScore))}%` }}
            />
          </div>
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
            <ShieldCheck size={14} strokeWidth={1.75} className="text-[var(--text-primary)]" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)] leading-tight">
              {isIndonesian ? "Kesehatan Modal" : "Capital Health"}
            </h3>
            <p className="text-[10px] text-[var(--text-tertiary)] truncate">
              {isIndonesian
                ? "Peringkat likuiditas & laju retensi modal"
                : "Liquidity rating & capital retention pace"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full"
            style={{
              background: "var(--glass-fill)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-primary)",
            }}
          >
            {statusLabel} ({healthScore}/100)
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

      <div className="flex items-center justify-between gap-4 pt-1">
        <div className="text-center shrink-0 pr-2">
          <span className="text-[34px] font-semibold amount text-[var(--text-primary)] leading-none">
            {healthScore}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block mt-1">
            {isIndonesian ? "Skor / 100" : "Score / 100"}
          </span>
        </div>

        <div className="flex-1 space-y-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div
              className="p-2 rounded-xl"
              style={{ background: "var(--glass-fill)" }}
            >
              <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
                {isIndonesian ? "Laju Tabungan" : "Savings Pace"}
              </span>
              <span className="text-[11px] font-semibold text-[var(--text-primary)] block mt-0.5">
                {healthScore >= 70
                  ? "Optimal"
                  : isIndonesian ? "Perhatian" : "Attention"}
              </span>
            </div>
            <div
              className="p-2 rounded-xl"
              style={{ background: "var(--glass-fill)" }}
            >
              <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
                {isIndonesian ? "Kendali Anggaran" : "Budget Control"}
              </span>
              <span className="text-[11px] font-semibold text-[var(--text-primary)] block mt-0.5">
                {healthScore >= 50
                  ? isIndonesian ? "Sesuai Jalur" : "Safe Track"
                  : isIndonesian ? "Pantau" : "Watch"}
              </span>
            </div>
            <div
              className="p-2 rounded-xl"
              style={{ background: "var(--glass-fill)" }}
            >
              <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
                {isIndonesian ? "Bantalan Likuid" : "Liquid Cushion"}
              </span>
              <span className="text-[11px] font-semibold text-[var(--text-primary)] block mt-0.5">
                {healthScore >= 60
                  ? isIndonesian ? "Tangguh" : "Resilient"
                  : isIndonesian ? "Moderat" : "Moderate"}
              </span>
            </div>
          </div>

          <div className="w-full h-2 rounded-full overflow-hidden bg-black/[0.06] dark:bg-white/10">
            <div
              className="h-full rounded-full bg-[var(--text-primary)] transition-all duration-700"
              style={{ width: `${Math.min(100, Math.max(0, healthScore))}%` }}
            />
          </div>
        </div>
      </div>

      <div className="pt-1 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[10px] text-[var(--text-tertiary)]">
        <span>
          {isIndonesian
            ? "Diagnostik modal mengindikasikan arus kas terkendali."
            : "Capital diagnostic indicates controlled cashflow."}
        </span>
        <span className="font-semibold text-[var(--text-secondary)]">
          {healthScore >= 75
            ? isIndonesian ? "Efisiensi Tinggi" : "High Efficiency"
            : isIndonesian ? "Perlu Tindakan" : "Moderate Action Needed"}
        </span>
      </div>
    </section>
  );
}
