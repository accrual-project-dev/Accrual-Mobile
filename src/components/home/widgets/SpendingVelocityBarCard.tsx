import { Info, TrendingUp } from "lucide-react";
import type { WidgetSize } from "../../../lib/widgetLayoutTypes";
import { CompactShell } from "./CompactShell";
import { useTheme } from "../../../contexts/ThemeContext";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useCurrency } from "../../../contexts/CurrencyContext";

export function SpendingVelocityBarCard({
  dailyOutlays,
  dailyAverage,
  size = "half",
  onOpenDetail,
}: {
  dailyOutlays: { dayLabel: string; amount: number; dateStr?: string }[];
  dailyAverage: number;
  size?: WidgetSize;
  onOpenDetail?: () => void;
}) {
  const { theme } = useTheme();
  const { isIndonesian } = useLanguage();
  const { formatWithPreferred } = useCurrency();
  const isDark = theme === "dark";

  const maxAmount = Math.max(1, ...dailyOutlays.map((d) => d.amount));
  const total7d = dailyOutlays.reduce((sum, d) => sum + d.amount, 0);
  const peakDay = dailyOutlays.reduce(
    (max, d) => (d.amount > max.amount ? d : max),
    dailyOutlays[0] || { dayLabel: "-", amount: 0 },
  );
  const aboveAvgDays = dailyOutlays.filter((d) => d.amount > dailyAverage).length;

  const bars = (
    <div className="flex items-end justify-between gap-1.5 h-11 w-full pt-1">
      {dailyOutlays.map((d, i) => {
        const heightPct = Math.min(100, Math.max(8, (d.amount / maxAmount) * 100));
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
            <div
              className="w-full rounded-sm transition-all"
              style={{
                height: `${heightPct}%`,
                background:
                  d.amount > dailyAverage * 1.3
                    ? "var(--text-primary)"
                    : isDark
                      ? "rgba(255,255,255,0.25)"
                      : "rgba(0,0,0,0.18)",
              }}
              title={`${d.dayLabel}: ${formatWithPreferred(d.amount)}`}
            />
            <span className="text-[8px] font-semibold text-[var(--text-tertiary)]">
              {d.dayLabel}
            </span>
          </div>
        );
      })}
    </div>
  );

  if (size === "half") {
    return (
      <CompactShell title={isIndonesian ? "Laju 7 Hari" : "7D Velocity"} onOpenDetail={onOpenDetail}>
        <div className="flex-1 flex items-center py-0.5">{bars}</div>
        <div className="flex justify-between items-center text-[10px] text-[var(--text-tertiary)] pt-1 border-t border-black/5 dark:border-white/5 shrink-0">
          <span>{isIndonesian ? "Rerata Laju" : "Avg Pace"}</span>
          <span className="font-semibold text-[var(--text-primary)] amount">
            {formatWithPreferred(dailyAverage)}/{isIndonesian ? "hr" : "d"}
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
            <TrendingUp size={14} className="text-[var(--text-primary)]" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)] leading-tight">
              {isIndonesian ? "Laju Pengeluaran 7 Hari" : "7-Day Spending Velocity"}
            </h3>
            <p className="text-[10px] text-[var(--text-tertiary)]">
              {isIndonesian
                ? "Laju pengeluaran harian vs tolok ukur rata-rata bulanan"
                : "Daily spending run rate vs monthly average benchmark"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full amount"
            style={{
              background: "var(--glass-fill)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-primary)",
            }}
          >
            {isIndonesian ? "Rerata" : "Avg"}: {formatWithPreferred(dailyAverage)}/{isIndonesian ? "hari" : "day"}
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

      {/* 3 Summary Metric Pills */}
      <div className="grid grid-cols-3 gap-2">
        <div
          className="p-2.5 rounded-xl text-center"
          style={{ background: "var(--glass-fill)" }}
        >
          <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
            {isIndonesian ? "Total Keluar 7 Hari" : "7-Day Total Outflow"}
          </span>
          <span className="text-[13px] font-semibold amount text-[var(--text-primary)] block mt-0.5">
            {formatWithPreferred(total7d)}
          </span>
        </div>
        <div
          className="p-2.5 rounded-xl text-center"
          style={{ background: "var(--glass-fill)" }}
        >
          <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
            {isIndonesian ? "Rerata Laju Harian" : "7-Day Daily Run Rate"}
          </span>
          <span className="text-[13px] font-semibold amount text-[var(--text-primary)] block mt-0.5">
            {formatWithPreferred(Math.round(total7d / 7))}/{isIndonesian ? "hr" : "d"}
          </span>
        </div>
        <div
          className="p-2.5 rounded-xl text-center"
          style={{ background: "var(--glass-fill)" }}
        >
          <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
            {isIndonesian ? "Hari Belanja Tertinggi" : "Peak Outlay Day"}
          </span>
          <span className="text-[13px] font-semibold amount text-[var(--text-primary)] block mt-0.5">
            {peakDay.dayLabel} ({formatWithPreferred(peakDay.amount)})
          </span>
        </div>
      </div>

      {/* Taller Enhanced Bars with Exact Amounts */}
      <div className="pt-2">
        <div className="flex items-end justify-between gap-2 h-20 w-full relative">
          {/* Average Benchmark Guide Line */}
          <div
            className="absolute left-0 right-0 border-b border-dashed border-black/30 dark:border-white/25 pointer-events-none z-10"
            style={{
              bottom: `${Math.min(95, Math.max(10, (dailyAverage / maxAmount) * 100))}%`,
            }}
          >
            <span className="text-[8px] font-semibold text-white absolute right-0 -top-3.5 px-1 bg-zinc-800 dark:bg-zinc-800 rounded">
              {isIndonesian ? "Rerata" : "Avg"}: {formatWithPreferred(dailyAverage)}
            </span>
          </div>

          {dailyOutlays.map((d, i) => {
            const heightPct = Math.min(100, Math.max(6, (d.amount / maxAmount) * 100));
            const isPeak = d.amount === peakDay.amount && d.amount > 0;
            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end z-20 group relative cursor-pointer"
              >
                {/* Amount Label Above Bar */}
                <span className="text-[8.5px] font-semibold text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] transition-colors truncate">
                  {d.amount > 0
                    ? `${Math.round(d.amount / 1000)}k`
                    : "0"}
                </span>

                <div
                  className="w-full rounded-md transition-all duration-300"
                  style={{
                    height: `${heightPct}%`,
                    background: isPeak
                      ? "var(--text-primary)"
                      : d.amount > dailyAverage
                        ? isDark ? "rgba(255, 255, 255, 0.6)" : "rgba(0, 0, 0, 0.45)"
                        : d.amount > 0
                          ? isDark ? "rgba(255, 255, 255, 0.22)" : "rgba(0, 0, 0, 0.18)"
                          : isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.05)",
                    boxShadow: isPeak
                      ? isDark ? "0 0 10px rgba(255, 255, 255, 0.35)" : "0 2px 8px rgba(0, 0, 0, 0.15)"
                      : "none",
                  }}
                  title={`${d.dayLabel}: ${formatWithPreferred(d.amount)}`}
                />

                <span className="text-[9px] font-semibold text-[var(--text-tertiary)]">
                  {d.dayLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pt-1 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[10px] text-[var(--text-tertiary)]">
        <span>
          {aboveAvgDays > 0
            ? isIndonesian
              ? `${aboveAvgDays} dari 7 hari melampaui batas rerata harian.`
              : `${aboveAvgDays} of 7 days exceeded daily average allowance.`
            : isIndonesian
              ? "Seluruh 7 hari terkendali di bawah batas rerata harian."
              : "All 7 days maintained below daily average allowance."}
        </span>
        <span className="font-semibold text-[var(--text-secondary)]">
          {isIndonesian ? "Kendali:" : "Pacing:"}{" "}
          {Math.round(total7d / 7) <= dailyAverage
            ? isIndonesian ? "Terkendali" : "Controlled"
            : isIndonesian ? "Tinggi" : "Elevated"}
        </span>
      </div>
    </section>
  );
}
