import { Info, Calendar } from "lucide-react";
import type { WidgetSize } from "../../../lib/widgetLayoutTypes";
import { CompactShell } from "./CompactShell";
import { useTheme } from "../../../contexts/ThemeContext";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useCurrency } from "../../../contexts/CurrencyContext";

export function MiniHeatmapCard({
  daysWithSpend,
  activeDaysCount,
  totalMonthSpend = 0,
  dailyAverage = 0,
  size = "half",
  onOpenDetail,
}: {
  daysWithSpend: {
    day: number;
    date?: Date;
    hasSpend: boolean;
    amount?: number;
    intensity: number;
    isToday?: boolean;
    dayOfWeek?: number;
  }[];
  activeDaysCount: number;
  totalMonthSpend?: number;
  dailyAverage?: number;
  size?: WidgetSize;
  onOpenDetail?: () => void;
}) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { formatWithPreferred } = useCurrency();
  const isIndonesian = language === "id";
  const isDark = theme === "dark";

  const dots = daysWithSpend.slice(0, 28);
  const totalDays = daysWithSpend.length;
  const zeroSpendDays = Math.max(0, totalDays - activeDaysCount);
  const activeFrequency =
    totalDays > 0 ? Math.round((activeDaysCount / totalDays) * 100) : 0;
  const avgOnActiveDays =
    activeDaysCount > 0 ? Math.round(totalMonthSpend / activeDaysCount) : 0;
  const effectiveDailyAvg =
    dailyAverage > 0 ? dailyAverage : Math.round(totalMonthSpend / Math.max(1, totalDays));
  const peakDay = daysWithSpend.reduce(
    (max, d) => ((d.amount || 0) > (max.amount || 0) ? d : max),
    daysWithSpend[0] || { day: 1, amount: 0 },
  );

  const halfGrid = (
    <div className="grid grid-cols-7 gap-1.5 py-0.5 w-full max-w-[130px] mx-auto">
      {dots.map((d, i) => (
        <div
          key={i}
          className="w-2.5 h-2.5 rounded-full mx-auto transition-all"
          style={{
            background:
              d.intensity > 0.6
                ? isDark ? "#FFFFFF" : "#09090b"
                : d.intensity > 0.2
                  ? isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)"
                  : d.hasSpend
                    ? isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.18)"
                    : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
          }}
          title={isIndonesian ? `Hari ke-${d.day}: ${d.hasSpend ? `Aktif (${formatWithPreferred(d.amount || 0)})` : "Tenang"}` : `Day ${d.day}: ${d.hasSpend ? `Active (${formatWithPreferred(d.amount || 0)})` : "Quiet"}`}
        />
      ))}
    </div>
  );

  if (size === "half") {
    return (
      <CompactShell title={isIndonesian ? "Matriks Aktivitas" : "Activity Matrix"} onOpenDetail={onOpenDetail}>
        <div className="flex-1 flex items-center justify-center py-0.5">
          {halfGrid}
        </div>
        <div className="flex justify-between items-center text-[10px] text-[var(--text-tertiary)] pt-1 border-t border-black/5 dark:border-white/5 shrink-0">
          <span>{isIndonesian ? "Hari Aktif" : "Active Days"}</span>
          <span className="font-semibold text-[var(--text-primary)]">
            {activeDaysCount} {isIndonesian ? "dari" : "of"} {totalDays}{isIndonesian ? " hr" : "d"}
          </span>
        </div>
      </CompactShell>
    );
  }

  // Full Month Weekday Labels
  const weekDays = isIndonesian
    ? ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <section
      className="glass-surface p-4 rounded-[22px] select-none space-y-3"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--glass-border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "var(--glass-fill)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <Calendar size={14} className="text-[var(--text-primary)]" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)] leading-tight">
              {isIndonesian ? "Matriks Aktivitas Bulanan" : "Monthly Activity Matrix"}
            </h3>
            <p className="text-[10px] text-[var(--text-tertiary)]">
              {isIndonesian ? "Frekuensi transaksi harian & intensitas pengeluaran" : "Daily transaction frequency & spending density"}
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
            {activeDaysCount} {isIndonesian ? "Hari Aktif" : "Active Days"} ({activeFrequency}%)
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

      {/* 4-Column Key Metrics Bento */}
      <div className="grid grid-cols-4 gap-2">
        <div
          className="p-2 rounded-xl text-center"
          style={{ background: "var(--glass-fill)" }}
        >
          <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
            {isIndonesian ? "Total Pengeluaran" : "Total Outflow"}
          </span>
          <span className="text-[12px] font-semibold amount text-[var(--text-primary)] block mt-0.5">
            {formatWithPreferred(totalMonthSpend)}
          </span>
        </div>
        <div
          className="p-2 rounded-xl text-center"
          style={{ background: "var(--glass-fill)" }}
        >
          <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
            {isIndonesian ? "Laju Harian" : "Run Rate/d"}
          </span>
          <span className="text-[12px] font-semibold amount text-[var(--text-primary)] block mt-0.5">
            {formatWithPreferred(effectiveDailyAvg)}
          </span>
        </div>
        <div
          className="p-2 rounded-xl text-center"
          style={{ background: "var(--glass-fill)" }}
        >
          <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
            {isIndonesian ? "Rerata Hari Aktif" : "Active Day Avg"}
          </span>
          <span className="text-[12px] font-semibold amount text-[var(--text-primary)] block mt-0.5">
            {formatWithPreferred(avgOnActiveDays)}
          </span>
        </div>
        <div
          className="p-2 rounded-xl text-center"
          style={{ background: "var(--glass-fill)" }}
        >
          <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
            {isIndonesian ? "Pengeluaran Puncak" : "Peak Outlay"}
          </span>
          <span className="text-[12px] font-semibold amount text-[var(--text-primary)] block mt-0.5">
            {peakDay.amount ? formatWithPreferred(peakDay.amount) : formatWithPreferred(0)}
          </span>
        </div>
      </div>

      {/* Full Month Calendar Matrix with Weekday Headers and Numbers */}
      <div className="pt-1">
        {/* Weekday Header */}
        <div className="grid grid-cols-7 gap-1.5 pb-1 text-center">
          {weekDays.map((wd, i) => (
            <span
              key={i}
              className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]"
            >
              {wd}
            </span>
          ))}
        </div>

        {/* Calendar Days Matrix */}
        <div className="grid grid-cols-7 gap-1.5">
          {daysWithSpend.map((d, i) => {
            const hasSpend = Boolean(d.hasSpend && d.amount && d.amount > 0);
            return (
              <div
                key={i}
                className={`flex flex-col items-center justify-between py-1.5 px-0.5 rounded-lg border transition-all cursor-pointer ${
                  d.isToday
                    ? "ring-1 ring-black/40 border-black/25 dark:ring-white/50 dark:border-white/30"
                    : "border-black/5 dark:border-white/5"
                }`}
                style={{
                  background: hasSpend
                    ? isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.03)"
                    : isDark ? "rgba(255, 255, 255, 0.01)" : "rgba(0, 0, 0, 0.01)",
                  minHeight: "44px",
                }}
                title={
                  isIndonesian
                    ? `Hari ke-${d.day}: ${hasSpend ? formatWithPreferred(d.amount || 0) : "Tidak ada transaksi"}`
                    : `Day ${d.day}: ${hasSpend ? formatWithPreferred(d.amount || 0) : "No spend recorded"}`
                }
              >
                {/* Day Number */}
                <span
                  className={`text-[9px] font-medium leading-none ${
                    d.isToday
                      ? "font-semibold text-[var(--text-primary)] underline"
                      : "text-[var(--text-tertiary)]"
                  }`}
                >
                  {d.day}
                </span>

                {/* Dot with Intensity */}
                <div
                  className="w-2 h-2 rounded-full my-0.5 transition-all"
                  style={{
                    background:
                      d.intensity > 0.6
                        ? isDark ? "#FFFFFF" : "#09090b"
                        : d.intensity > 0.25
                          ? isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.5)"
                          : hasSpend
                            ? isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)"
                            : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                    boxShadow:
                      d.intensity > 0.6
                        ? isDark ? "0 0 6px rgba(255, 255, 255, 0.4)" : "0 1px 3px rgba(0, 0, 0, 0.2)"
                        : "none",
                  }}
                />

                {/* Amount or Quiet Indicator */}
                <span
                  className={`text-[7.5px] font-medium leading-none truncate max-w-full px-0.5 ${
                    hasSpend
                      ? "text-[var(--text-secondary)] font-semibold"
                      : "text-[var(--text-tertiary)] opacity-30"
                  }`}
                >
                  {hasSpend
                    ? d.amount && d.amount >= 1000
                      ? `${Math.round(d.amount / 1000)}k`
                      : `${d.amount}`
                    : "·"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend & Analytical Insight Footer */}
      <div className="pt-2 border-t border-black/5 dark:border-white/5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[var(--text-tertiary)]">
        <div className="flex items-center gap-2">
          <span>{isIndonesian ? "Keterangan:" : "Legend:"}</span>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-black/10 dark:bg-white/10" />
            <span className="text-[9px]">0</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-black/30 dark:bg-white/30" />
            <span className="text-[9px]">&lt;50k</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-black/65 dark:bg-white/65" />
            <span className="text-[9px]">{isIndonesian ? "Sedang" : "Mid"}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-black dark:bg-white shadow-sm" />
            <span className="text-[9px] font-semibold text-[var(--text-primary)]">
              {isIndonesian ? "Puncak" : "Peak"}
            </span>
          </div>
        </div>

        <span className="font-medium text-[var(--text-secondary)]">
          {isIndonesian
            ? `${zeroSpendDays} hari bebas pengeluaran tercatat bulan ini`
            : `${zeroSpendDays} zero-spend days recorded this month`}
        </span>
      </div>
    </section>
  );
}
