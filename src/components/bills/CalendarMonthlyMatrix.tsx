import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import {
  format,
  isToday,
  isSameDay,
  type Locale,
} from "date-fns";
import { triggerHaptic } from "../../lib/haptics";
import type { MonthRunwayTelemetry } from "../../lib/calendarForecasting";

interface CalendarMonthlyMatrixProps {
  currentDate: Date;
  selectedDay: Date | null;
  onSelectDay: (day: Date) => void;
  days: Date[];
  startPad: number;
  slideDirection: number;
  isCurrentMonthView: boolean;
  onPrevMonth: (e?: React.MouseEvent) => void;
  onNextMonth: (e?: React.MouseEvent) => void;
  onResetToToday: () => void;
  viewMode: "activity" | "runway";
  runwayTelemetry: MonthRunwayTelemetry;
  isDark: boolean;
  isIndonesian: boolean;
  dateLocale?: Locale;
  displayCompact: (val: number) => string;
  t: (key: string, fallback: string) => string;
}

export function CalendarMonthlyMatrix({
  currentDate,
  selectedDay,
  onSelectDay,
  days,
  startPad,
  slideDirection,
  isCurrentMonthView,
  onPrevMonth,
  onNextMonth,
  onResetToToday,
  viewMode,
  runwayTelemetry,
  isDark,
  isIndonesian,
  dateLocale,
  displayCompact,
  t,
}: CalendarMonthlyMatrixProps) {
  const WEEKS = isIndonesian
    ? ["MIN", "SEN", "SEL", "RAB", "KAM", "JUM", "SAB"]
    : ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  return (
    <>
      {/* Main Calendar Card with Touch Swipe Gestures */}
      <motion.div
        className="glass-surface p-5 rounded-[24px] relative"
        style={{ border: "1px solid var(--glass-border)" }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 28 }}
      >
        {/* Month Navigation Bar */}
        <div className="flex items-center justify-between mb-5 px-1 relative z-10">
          <button
            type="button"
            onClick={(e) => onPrevMonth(e)}
            className="w-9 h-9 flex items-center justify-center rounded-full glass-surface active:scale-95 transition-transform cursor-pointer select-none touch-manipulation relative z-10"
            style={{ color: "var(--text-primary)" }}
            aria-label={isIndonesian ? "Bulan Sebelumnya" : "Previous Month"}
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex items-center gap-2">
            <span
              className="font-semibold text-[15px] tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {format(currentDate, "MMMM yyyy", { locale: dateLocale })}
            </span>
            {!isCurrentMonthView && (
              <button
                type="button"
                onClick={onResetToToday}
                className="px-2 py-0.5 rounded-full text-[10px] font-semibold glass-surface active:scale-95 transition-all flex items-center gap-1 cursor-pointer select-none touch-manipulation"
                style={{
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-secondary)",
                }}
              >
                <RotateCcw size={10} />
                {t("common.today", isIndonesian ? "Hari Ini" : "Today")}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => onNextMonth(e)}
            className="w-9 h-9 flex items-center justify-center rounded-full glass-surface active:scale-95 transition-transform cursor-pointer select-none touch-manipulation relative z-10"
            style={{ color: "var(--text-primary)" }}
            aria-label={isIndonesian ? "Bulan Berikutnya" : "Next Month"}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Swipeable Calendar Grid Container */}
        <motion.div
          key={currentDate.toISOString().slice(0, 7)}
          initial={{ opacity: 0, x: slideDirection * 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -slideDirection * 30 }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, info) => {
            if (info.offset.x > 50) {
              onPrevMonth();
            } else if (info.offset.x < -50) {
              onNextMonth();
            }
          }}
          className="touch-pan-y"
        >
          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-y-3 gap-x-1 text-center">
            {WEEKS.map((w) => (
              <div
                key={w}
                className="text-[11px] font-semibold mb-1 uppercase tracking-wider"
                style={{ color: "var(--text-tertiary)" }}
              >
                {w}
              </div>
            ))}

            {/* Leading padding for month alignment */}
            {Array.from({ length: startPad }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}

            {/* Days Matrix */}
            {days.map((d) => {
              const dStr = format(d, "yyyy-MM-dd");
              const forecast = runwayTelemetry.days.find(
                (df) => df.date === dStr,
              );
              const isSel = selectedDay && isSameDay(d, selectedDay);
              const isT = isToday(d);

              const hasUnpaidBills = (forecast?.scheduledBills || []).some(
                (b) => !b.isPaid,
              );

              const hasData =
                (forecast?.actualInflow ?? 0) > 0 ||
                (forecast?.actualOutflow ?? 0) > 0 ||
                (forecast?.scheduledBills.length ?? 0) > 0;

              let bg = "transparent";
              let textColor = "var(--text-tertiary)";
              let border = "1px solid transparent";
              let shadow = "none";
              let isBold = false;

              if (isT) {
                bg = isDark ? "#FFFFFF" : "#18181B";
                textColor = isDark ? "#09090C" : "#FFFFFF";
                shadow = isDark
                  ? "0 2px 10px rgba(255,255,255,0.25)"
                  : "0 2px 10px rgba(0,0,0,0.18)";
                isBold = true;
              } else if (isSel) {
                bg = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
                border = isDark
                  ? "1px solid rgba(255,255,255,0.3)"
                  : "1px solid rgba(0,0,0,0.2)";
                textColor = "var(--text-primary)";
                isBold = true;
              } else if (hasData) {
                textColor = "var(--text-primary)";
              } else {
                textColor = "var(--text-tertiary)";
              }

              let subFigure: string | null = null;
              let subFigureColor = isT
                ? isDark
                  ? "text-zinc-900"
                  : "text-white"
                : isSel
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-tertiary)]";

              if (viewMode === "activity") {
                if (forecast) {
                  if (
                    forecast.actualInflow > 0 &&
                    forecast.actualOutflow === 0
                  ) {
                    subFigure = `+${displayCompact(forecast.actualInflow)}`;
                    if (!isT && !isSel)
                      subFigureColor =
                        "text-[var(--text-primary)] font-semibold";
                  } else if (
                    forecast.actualOutflow > 0 &&
                    forecast.actualInflow === 0
                  ) {
                    subFigure = `-${displayCompact(forecast.actualOutflow)}`;
                    if (!isT && !isSel)
                      subFigureColor =
                        "text-[var(--text-secondary)] font-medium";
                  } else if (
                    forecast.actualInflow > 0 &&
                    forecast.actualOutflow > 0
                  ) {
                    if (forecast.netActualCashflow >= 0) {
                      subFigure = `+${displayCompact(forecast.netActualCashflow)}`;
                      if (!isT && !isSel)
                        subFigureColor =
                          "text-[var(--text-primary)] font-semibold";
                    } else {
                      subFigure = `-${displayCompact(Math.abs(forecast.netActualCashflow))}`;
                      if (!isT && !isSel)
                        subFigureColor =
                          "text-[var(--text-secondary)] font-medium";
                    }
                  } else if (forecast.isNoSpendDay) {
                    subFigure = null;
                  } else if (forecast.billsTotal > 0 && forecast.isFuture) {
                    subFigure = `-${displayCompact(forecast.billsTotal)}`;
                    if (!isT && !isSel)
                      subFigureColor = "text-[var(--text-secondary)]";
                  } else if (
                    forecast.expectedInflowsTotal > 0 &&
                    forecast.isFuture
                  ) {
                    subFigure = `+${displayCompact(forecast.expectedInflowsTotal)}`;
                    if (!isT && !isSel)
                      subFigureColor =
                        "text-[var(--text-primary)] font-semibold";
                  }
                }
              } else {
                // Runway mode
                if (forecast?.isFuture || forecast?.isToday) {
                  subFigure = displayCompact(forecast?.projectedBalance ?? 0);
                  if (!isT && !isSel) {
                    subFigureColor = forecast?.isLowestDip
                      ? "text-[var(--text-primary)] font-bold"
                      : "text-[var(--text-secondary)] font-medium";
                  }
                } else if (forecast?.isNoSpendDay) {
                  subFigure = "0";
                  if (!isT && !isSel)
                    subFigureColor = "text-[var(--text-tertiary)] opacity-60";
                } else if (forecast?.actualOutflow) {
                  subFigure = `-${displayCompact(forecast.actualOutflow)}`;
                  if (!isT && !isSel)
                    subFigureColor = "text-[var(--text-tertiary)]";
                }
              }

              return (
                <button
                  key={d.toISOString()}
                  onClick={() => {
                    onSelectDay(d);
                    triggerHaptic("light");
                  }}
                  className="flex flex-col items-center justify-center rounded-2xl py-1 transition-all active:scale-95 cursor-pointer relative min-h-[46px] overflow-hidden"
                  style={{
                    background: bg,
                    border,
                    boxShadow: shadow,
                  }}
                >
                  {/* Day Number */}
                  <span
                    className={`text-[13px] leading-tight ${
                      isBold ? "font-bold" : "font-medium"
                    }`}
                    style={{ color: textColor }}
                  >
                    {format(d, "d")}
                  </span>

                  {/* Figure Under Date */}
                  {subFigure !== null ? (
                    <span
                      className={`text-[9px] tracking-tight truncate leading-none mt-0.5 max-w-[92%] ${subFigureColor}`}
                    >
                      {subFigure}
                    </span>
                  ) : (
                    <span className="text-[9px] leading-none mt-0.5 opacity-0 select-none">
                      -
                    </span>
                  )}

                  {/* Special Indicator Badges (STRICT MONOCHROME) */}
                  {forecast?.isPayday && (
                    <span
                      className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
                      style={{
                        background: isT
                          ? isDark
                            ? "#09090C"
                            : "#FFFFFF"
                          : "var(--text-primary)",
                        boxShadow: isDark
                          ? "0 0 4px rgba(255,255,255,0.45)"
                          : "0 0 4px rgba(0,0,0,0.25)",
                      }}
                      title={
                        isIndonesian ? "Pemasukan Gaji" : "Expected Payday"
                      }
                    />
                  )}

                  {hasUnpaidBills && !isT && (
                    <span
                      className={`absolute top-1 ${forecast?.isPayday ? "left-1" : "right-1"} w-1.5 h-1.5 rounded-full`}
                      style={{
                        border: isDark
                          ? "1.5px solid rgba(255,255,255,0.7)"
                          : "1.5px solid rgba(0,0,0,0.6)",
                        background: "transparent",
                      }}
                      title={
                        isIndonesian
                          ? "Tagihan Belum Bayar"
                          : "Unpaid Bill Due"
                      }
                    />
                  )}

                  {forecast?.isLowestDip && viewMode === "runway" && !isT && (
                    <span
                      className="absolute bottom-0.5 w-1 h-1 rounded-full"
                      style={{
                        background: "var(--text-primary)",
                        opacity: 0.8,
                      }}
                      title={
                        isIndonesian
                          ? "Titik Terendah Likuiditas"
                          : "Runway Dip Floor"
                      }
                    />
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>
      </motion.div>

      {/* Monochrome Apple Luxury Calendar Legend */}
      <div
        className="glass-surface p-3.5 rounded-2xl border border-[var(--glass-border)]"
        style={{
          background: "var(--bg-elevated)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-tertiary)" }}
          >
            {t(
              "calendar.legendTitle",
              isIndonesian ? "Keterangan Kalender" : "Calendar Legend",
            )}
          </span>
          <span
            className="text-[10px] font-medium"
            style={{ color: "var(--text-tertiary)" }}
          >
            {viewMode === "activity"
              ? isIndonesian
                ? "Mode Aktivitas"
                : "Activity Mode"
              : isIndonesian
                ? "Mode Ketahanan Kas"
                : "Runway Mode"}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px]">
          {/* 1. Today */}
          <div className="flex items-center gap-2">
            <span
              className="w-5 h-5 rounded-lg flex items-center justify-center text-[9px] font-bold shrink-0"
              style={{
                background: isDark ? "#FFFFFF" : "#18181B",
                color: isDark ? "#09090C" : "#FFFFFF",
                boxShadow: isDark
                  ? "0 1px 4px rgba(255,255,255,0.2)"
                  : "0 1px 4px rgba(0,0,0,0.15)",
              }}
            >
              {format(new Date(), "d")}
            </span>
            <span
              className="truncate"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("calendar.legendToday", isIndonesian ? "Hari Ini" : "Today")}
            </span>
          </div>

          {/* 2. Figures / Activity */}
          <div className="flex items-center gap-2">
            <span
              className="px-1.5 h-5 rounded-lg flex items-center justify-center text-[9px] font-semibold shrink-0"
              style={{
                background: "var(--glass-fill)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-primary)",
              }}
            >
              {viewMode === "runway" ? "15M" : "-50k"}
            </span>
            <span
              className="truncate"
              style={{ color: "var(--text-secondary)" }}
            >
              {viewMode === "runway"
                ? isIndonesian
                  ? "Saldo Proyeksi"
                  : "Projected Balance"
                : t(
                    "calendar.legendActivity",
                    isIndonesian ? "Mutasi Harian" : "Cashflow Activity",
                  )}
            </span>
          </div>

          {/* 3. Payday Inflow */}
          <div className="flex items-center gap-2">
            <div
              className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: "var(--glass-fill)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  background: "var(--text-primary)",
                  boxShadow: isDark
                    ? "0 0 4px rgba(255,255,255,0.45)"
                    : "0 0 4px rgba(0,0,0,0.25)",
                }}
              />
            </div>
            <span
              className="truncate"
              style={{ color: "var(--text-secondary)" }}
            >
              {t(
                "calendar.legendPayday",
                isIndonesian ? "Jadwal Gajian" : "Payday Inflow",
              )}
            </span>
          </div>

          {/* 4. Scheduled Bill */}
          <div className="flex items-center gap-2">
            <div
              className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: "var(--glass-fill)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  border: isDark
                    ? "1.5px solid rgba(255,255,255,0.7)"
                    : "1.5px solid rgba(0,0,0,0.6)",
                  background: "transparent",
                }}
              />
            </div>
            <span
              className="truncate"
              style={{ color: "var(--text-secondary)" }}
            >
              {t(
                "calendar.legendBill",
                isIndonesian ? "Tagihan Jatuh Tempo" : "Scheduled Bill",
              )}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
