import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  motion,
  AnimatePresence,
  type PanInfo,
  useDragControls,
} from "framer-motion";
import { X, CalendarDays } from "lucide-react";
import { getDaysInMonth } from "date-fns";
import type { Transaction } from "../../lib/types";
import { cn } from "../../lib/utils";
import { triggerHaptic } from "../../lib/haptics";
import { useTheme } from "../../contexts/ThemeContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import { usePrivacy } from "../../contexts/PrivacyContext";

interface MonthForecastSheetProps {
  isOpen: boolean;
  onClose: () => void;
  transactions?: Transaction[];
  budgetTarget?: number;
  dailyAverage?: number;
  projectedMonthEnd?: number;
  totalExpense?: number;
  totalIncome?: number;
  actionInsight?: any;
  referenceDate?: Date;
}

export function MonthForecastSheet({
  isOpen,
  onClose,
  transactions = [],
  dailyAverage,
  projectedMonthEnd,
  totalExpense = 0,
  actionInsight: _actionInsight,
  referenceDate = new Date(),
}: MonthForecastSheetProps) {
  const navigate = useNavigate();
  const dragControls = useDragControls();
  const { theme } = useTheme();
  const { isIndonesian } = useLanguage();
  const { formatWithPreferred, currencyMeta } = useCurrency();
  const { isStealthMode } = usePrivacy();
  const isDark = theme !== "light";

  const formatMoney = (amount: number) => {
    return isStealthMode ? `${currencyMeta?.symbol || "Rp"} ••••••••` : formatWithPreferred(amount);
  };
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const chartRef = useRef<SVGSVGElement | null>(null);

  const now = referenceDate;
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const totalDays = getDaysInMonth(now);
  const daysElapsed = Math.min(now.getDate(), totalDays);
  const monthKey = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;

  // Calculate daily spend and cumulative actuals
  const { actualCumulative, computedTotalExpense } = useMemo(() => {
    const map = new Map<number, number>();
    let sumExpense = 0;

    transactions.forEach((t) => {
      if (t.type !== "expense" || !t.occurred_on) return;
      if (!t.occurred_on.startsWith(monthKey)) return;

      const isCorrection =
        t.note?.includes("[Correction]") ||
        t.note?.includes("Saldo Awal") ||
        t.note?.includes("Opening Balance");
      if (isCorrection) return;

      const amt = Number(t.amount || 0);
      sumExpense += amt;
      const day = parseInt(t.occurred_on.slice(8, 10), 10);
      if (!isNaN(day) && day >= 1 && day <= totalDays) {
        map.set(day, (map.get(day) || 0) + amt);
      }
    });

    const cumMap = new Map<number, number>();
    let running = 0;
    for (let d = 1; d <= daysElapsed; d++) {
      running += map.get(d) || 0;
      cumMap.set(d, running);
    }

    return {
      dailySpendMap: map,
      actualCumulative: cumMap,
      computedTotalExpense: sumExpense,
    };
  }, [transactions, monthKey, daysElapsed, totalDays]);

  const effectiveTotalExpense =
    totalExpense > 0 ? totalExpense : computedTotalExpense;

  const effectiveDailyAvg = useMemo(() => {
    if (typeof dailyAverage === "number" && dailyAverage > 0) {
      return dailyAverage;
    }
    return effectiveTotalExpense / Math.max(1, daysElapsed);
  }, [dailyAverage, effectiveTotalExpense, daysElapsed]);

  const effectiveProjectedTotal = useMemo(() => {
    if (typeof projectedMonthEnd === "number" && projectedMonthEnd > 0) {
      return projectedMonthEnd;
    }
    return Math.round(effectiveDailyAvg * totalDays);
  }, [projectedMonthEnd, effectiveDailyAvg, totalDays]);

  // Forecast points for remaining days
  const forecastCumulative = useMemo(() => {
    const map = new Map<number, number>();
    const anchor = actualCumulative.get(daysElapsed) || effectiveTotalExpense;
    map.set(daysElapsed, anchor);

    for (let d = daysElapsed + 1; d <= totalDays; d++) {
      const forecasted = anchor + effectiveDailyAvg * (d - daysElapsed);
      map.set(d, Math.round(forecasted));
    }
    return map;
  }, [
    actualCumulative,
    daysElapsed,
    totalDays,
    effectiveTotalExpense,
    effectiveDailyAvg,
  ]);

  // Chart dimensions (pure floating layout without card box)
  const svgWidth = 320;
  const svgHeight = 160;
  const padLeft = 34;
  const padRight = 12;
  const padTop = 16;
  const padBottom = 22;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  const maxVal =
    Math.max(effectiveProjectedTotal, effectiveTotalExpense, 1) * 1.08;

  const getX = useCallback(
    (d: number) => padLeft + ((d - 1) / Math.max(1, totalDays - 1)) * plotWidth,
    [padLeft, totalDays, plotWidth],
  );

  const getY = useCallback(
    (v: number) => padTop + plotHeight - (Math.max(0, v) / maxVal) * plotHeight,
    [padTop, plotHeight, maxVal],
  );

  // Solid Actual Path
  const actualPath = useMemo(() => {
    if (daysElapsed < 1) return "";
    let dStr = `M ${getX(1)} ${getY(actualCumulative.get(1) || 0)}`;
    for (let d = 2; d <= daysElapsed; d++) {
      const x = getX(d);
      const y = getY(actualCumulative.get(d) || 0);
      dStr += ` L ${x} ${y}`;
    }
    return dStr;
  }, [daysElapsed, actualCumulative, getX, getY]);

  // Area Fill under Solid Actual Path
  const actualAreaPath = useMemo(() => {
    if (!actualPath || daysElapsed < 1) return "";
    const xLast = getX(daysElapsed);
    const xFirst = getX(1);
    const yBase = getY(0);
    return `${actualPath} L ${xLast} ${yBase} L ${xFirst} ${yBase} Z`;
  }, [actualPath, daysElapsed, getX, getY]);

  // Dashed Forecast Path (from daysElapsed to totalDays)
  const forecastPath = useMemo(() => {
    if (daysElapsed >= totalDays) return "";
    const xStart = getX(daysElapsed);
    const yStart = getY(
      forecastCumulative.get(daysElapsed) || effectiveTotalExpense,
    );
    const xEnd = getX(totalDays);
    const yEnd = getY(
      forecastCumulative.get(totalDays) || effectiveProjectedTotal,
    );
    return `M ${xStart} ${yStart} L ${xEnd} ${yEnd}`;
  }, [
    daysElapsed,
    totalDays,
    forecastCumulative,
    effectiveTotalExpense,
    effectiveProjectedTotal,
    getX,
    getY,
  ]);

  // Pointer interactions for scrubber
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!chartRef.current) return;
    const rect = chartRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * svgWidth;
    const boundedX = Math.max(padLeft, Math.min(padLeft + plotWidth, relX));
    const dayFraction = (boundedX - padLeft) / plotWidth;
    const day = Math.round(1 + dayFraction * (totalDays - 1));

    if (day !== hoveredDay) {
      setHoveredDay(day);
      triggerHaptic("light");
    }
  };

  const handlePointerLeave = () => {
    setHoveredDay(null);
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.y > 80 || info.velocity.y > 350) {
      triggerHaptic("light");
      onClose();
    }
  };

  // Active inspected day
  const activeInspectDay = hoveredDay !== null ? hoveredDay : null;
  const isHoverActual =
    activeInspectDay !== null && activeInspectDay <= daysElapsed;
  const displayHeroAmount =
    activeInspectDay !== null
      ? isHoverActual
        ? actualCumulative.get(activeInspectDay) || 0
        : forecastCumulative.get(activeInspectDay) || 0
      : effectiveProjectedTotal;

  // Axis scale labels
  const yLabelTop =
    Math.round(maxVal / 1000000) > 0
      ? `${(maxVal / 1000000).toFixed(1)}M`
      : `${Math.round(maxVal / 1000)}K`;
  const yLabelMid =
    Math.round(maxVal / 2000000) > 0
      ? `${(maxVal / 2000000).toFixed(1)}M`
      : `${Math.round(maxVal / 2000)}K`;

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Ambient Dark Backdrop with Soft Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={onClose}
            className="fixed inset-0 z-[998] bg-black/65 backdrop-blur-md"
          />

          {/* Minimalist Apple Liquid Glass Bottom Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 34 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.75 }}
            dragSnapToOrigin
            onDragEnd={handleDragEnd}
            className={cn(
              "fixed bottom-0 left-0 right-0 z-[999] flex flex-col select-none overflow-hidden rounded-t-[36px] transition-colors",
              isDark ? "text-white" : "text-[#09090b]",
            )}
            style={{
              background: isDark
                ? "linear-gradient(180deg, rgba(26, 26, 32, 0.88) 0%, rgba(14, 14, 18, 0.94) 100%)"
                : "linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(246, 247, 250, 0.95) 100%)",
              backdropFilter: "blur(40px) saturate(190%)",
              WebkitBackdropFilter: "blur(40px) saturate(190%)",
              borderTop: isDark
                ? "1px solid rgba(255, 255, 255, 0.16)"
                : "1px solid rgba(255, 255, 255, 0.9)",
              boxShadow: isDark
                ? "0 -24px 60px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.22)"
                : "0 -20px 50px rgba(20, 25, 40, 0.08), inset 0 1.5px 0 #ffffff",
              maxHeight: "92dvh",
              paddingBottom:
                "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 32px)",
              fontFamily: "'Urbanist', sans-serif",
            }}
          >
            {/* Top Grab Handle Area */}
            <div
              className="flex justify-center pt-3 pb-1 shrink-0 cursor-grab active:cursor-grabbing w-full touch-none"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div
                className="w-10 h-1 rounded-full transition-opacity opacity-30 hover:opacity-60"
                style={{
                  background: isDark ? "#ffffff" : "#000000",
                }}
              />
            </div>

            {/* Inner Content Container */}
            <div className="w-full max-w-md mx-auto px-6 flex flex-col overflow-y-auto no-scrollbar">
              {/* Modal Header Row with Circular Glass Close Button */}
              <div className="relative flex items-center justify-center py-1">
                <h2
                  className="text-[14.5px] font-semibold tracking-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  {isIndonesian ? "Prakiraan Akhir Bulan" : "Month Forecast"}
                </h2>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    onClose();
                  }}
                  className="absolute right-0 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer"
                  style={{
                    background: isDark
                      ? "rgba(255, 255, 255, 0.06)"
                      : "rgba(0, 0, 0, 0.04)",
                    border: isDark
                      ? "1px solid rgba(255, 255, 255, 0.12)"
                      : "1px solid rgba(0, 0, 0, 0.06)",
                    boxShadow: isDark
                      ? "inset 0 1px 0 rgba(255, 255, 255, 0.15)"
                      : "inset 0 1px 0 #ffffff",
                    color: "var(--text-secondary)",
                  }}
                  title={isIndonesian ? "Tutup" : "Close"}
                  aria-label={isIndonesian ? "Tutup" : "Close"}
                >
                  <X size={14} strokeWidth={2.2} />
                </button>
              </div>

              {/* Hero Forecast Number & Elapsed Counter */}
              <div className="text-center pt-3 pb-1">
                <h1
                  className="text-4xl sm:text-[42px] font-bold amount tracking-tight leading-tight tabular-nums"
                  style={{ color: "var(--text-primary)" }}
                >
                  {formatMoney(displayHeroAmount)}
                </h1>

                <p
                  className="text-[12px] font-medium mt-1"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {activeInspectDay !== null ? (
                    <span>
                      {isIndonesian
                        ? `Hari ke-${activeInspectDay} dari ${totalDays} `
                        : `Day ${activeInspectDay} of ${totalDays} `}
                      {isHoverActual
                        ? isIndonesian
                          ? "(Aktual)"
                          : "(Actual)"
                        : isIndonesian
                          ? "(Prakiraan)"
                          : "(Forecast)"}
                    </span>
                  ) : (
                    <span>
                      {isIndonesian
                        ? `${daysElapsed} dari ${totalDays} hari`
                        : `${daysElapsed} of ${totalDays} days`}
                    </span>
                  )}
                </p>

                <p
                  className="text-[12px] max-w-[280px] mx-auto mt-2 leading-relaxed font-normal"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian
                    ? "Jika laju pengeluaran stabil pada ritme ini, berikut estimasi total akhir bulan."
                    : "If you keep spending at the same pace, here is what the full month will look like."}
                </p>
              </div>

              {/* Floating Minimalist Dual-Curve Chart (Original Pure Floating Layout) */}
              <div className="w-full pt-3 pb-2 touch-none">
                <svg
                  ref={chartRef}
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="w-full h-auto overflow-visible cursor-crosshair select-none"
                  onPointerDown={handlePointerMove}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerLeave}
                  onPointerLeave={handlePointerLeave}
                >
                  <defs>
                    {/* Liquid Glass Monochromatic Luminous Gradient */}
                    <linearGradient
                      id="spentGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor={isDark ? "#ffffff" : "#18181b"}
                        stopOpacity={isDark ? 0.22 : 0.09}
                      />
                      <stop
                        offset="100%"
                        stopColor={isDark ? "#ffffff" : "#18181b"}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>

                  {/* Baseline at bottom */}
                  <line
                    x1={padLeft}
                    y1={padTop + plotHeight}
                    x2={padLeft + plotWidth}
                    y2={padTop + plotHeight}
                    stroke={
                      isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"
                    }
                    strokeWidth="1"
                  />

                  {/* Y-axis tick labels on left */}
                  <text
                    x={padLeft - 6}
                    y={padTop + 4}
                    textAnchor="end"
                    fill={isDark ? "rgba(255,255,255,0.4)" : "#71717a"}
                    fontSize="8.5"
                    fontFamily="monospace"
                  >
                    {yLabelTop}
                  </text>
                  <text
                    x={padLeft - 6}
                    y={padTop + plotHeight / 2 + 3}
                    textAnchor="end"
                    fill={isDark ? "rgba(255,255,255,0.4)" : "#71717a"}
                    fontSize="8.5"
                    fontFamily="monospace"
                  >
                    {yLabelMid}
                  </text>
                  <text
                    x={padLeft - 6}
                    y={padTop + plotHeight}
                    textAnchor="end"
                    fill={isDark ? "rgba(255,255,255,0.4)" : "#71717a"}
                    fontSize="8.5"
                    fontFamily="monospace"
                  >
                    0
                  </text>

                  {/* Area fill under solid curve */}
                  {actualAreaPath && (
                    <path d={actualAreaPath} fill="url(#spentGradient)" />
                  )}

                  {/* Dashed Forecast Path (Future trajectory) */}
                  {forecastPath && (
                    <path
                      d={forecastPath}
                      fill="none"
                      stroke={isDark ? "rgba(255,255,255,0.45)" : "#71717a"}
                      strokeWidth="1.75"
                      strokeDasharray="4 4"
                      strokeLinecap="round"
                    />
                  )}

                  {/* Solid Actual Spend Curve with Subtle Luminous Rim */}
                  {actualPath && (
                    <path
                      d={actualPath}
                      fill="none"
                      stroke={isDark ? "#ffffff" : "#18181b"}
                      strokeWidth="2.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Terminal marker dot on today */}
                  {daysElapsed >= 1 && (
                    <g>
                      <circle
                        cx={getX(daysElapsed)}
                        cy={getY(
                          actualCumulative.get(daysElapsed) ||
                            effectiveTotalExpense,
                        )}
                        r="6"
                        fill={
                          isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.08)"
                        }
                      />
                      <circle
                        cx={getX(daysElapsed)}
                        cy={getY(
                          actualCumulative.get(daysElapsed) ||
                            effectiveTotalExpense,
                        )}
                        r="3.5"
                        fill={isDark ? "#ffffff" : "#18181b"}
                        stroke={isDark ? "#121216" : "#ffffff"}
                        strokeWidth="1.5"
                      />
                    </g>
                  )}

                  {/* Interactive Scrubber Indicator */}
                  {hoveredDay !== null && (
                    <g>
                      <line
                        x1={getX(hoveredDay)}
                        y1={padTop}
                        x2={getX(hoveredDay)}
                        y2={padTop + plotHeight}
                        stroke={isDark ? "#ffffff" : "#18181b"}
                        strokeWidth="1"
                        strokeDasharray="2 2"
                        opacity="0.8"
                      />
                      <circle
                        cx={getX(hoveredDay)}
                        cy={getY(
                          hoveredDay <= daysElapsed
                            ? actualCumulative.get(hoveredDay) || 0
                            : forecastCumulative.get(hoveredDay) || 0,
                        )}
                        r="4"
                        fill={isDark ? "#ffffff" : "#18181b"}
                        stroke={isDark ? "#000000" : "#ffffff"}
                        strokeWidth="1.5"
                      />
                    </g>
                  )}

                  {/* X-axis tick labels at bottom */}
                  <text
                    x={padLeft}
                    y={svgHeight - 6}
                    fill="var(--text-tertiary)"
                    fontSize="9"
                    fontFamily="'Urbanist', sans-serif"
                    fontWeight="600"
                  >
                    1
                  </text>
                  <text
                    x={padLeft + plotWidth}
                    y={svgHeight - 6}
                    textAnchor="end"
                    fill="var(--text-tertiary)"
                    fontSize="9"
                    fontFamily="'Urbanist', sans-serif"
                    fontWeight="600"
                  >
                    {totalDays}
                  </text>
                </svg>

                {/* Minimalist Centered Legend */}
                <div
                  className="flex items-center justify-center gap-6 mt-1 text-[11px] font-medium"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-[2px] rounded-full"
                      style={{ background: "var(--text-primary)" }}
                    />
                    <span>{isIndonesian ? "Terpakai" : "Spent"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-[2px] rounded-full border-t border-dashed"
                      style={{
                        borderTopWidth: "2px",
                        borderColor: "var(--text-tertiary)",
                      }}
                    />
                    <span>{isIndonesian ? "Prakiraan" : "Forecast"}</span>
                  </div>
                </div>
              </div>

              {/* Polished Liquid Glass Metric Cards (Side-by-Side Original Layout) */}
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div
                  className="p-3.5 rounded-2xl flex flex-col justify-between transition-all"
                  style={{
                    background: isDark
                      ? "linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%)"
                      : "linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.5) 100%)",
                    backdropFilter: "blur(24px)",
                    WebkitBackdropFilter: "blur(24px)",
                    border: isDark
                      ? "1px solid rgba(255, 255, 255, 0.12)"
                      : "1px solid rgba(255, 255, 255, 0.85)",
                    boxShadow: isDark
                      ? "inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 4px 16px rgba(0, 0, 0, 0.25)"
                      : "inset 0 1.5px 0 #ffffff, 0 4px 14px rgba(20, 25, 40, 0.03)",
                  }}
                >
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {isIndonesian ? "Terpakai sejauh ini" : "Spent so far"}
                  </span>
                  <p
                    className="text-[17px] font-semibold amount mt-1 tabular-nums truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {formatMoney(effectiveTotalExpense)}
                  </p>
                </div>

                <div
                  className="p-3.5 rounded-2xl flex flex-col justify-between transition-all"
                  style={{
                    background: isDark
                      ? "linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%)"
                      : "linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0.5) 100%)",
                    backdropFilter: "blur(24px)",
                    WebkitBackdropFilter: "blur(24px)",
                    border: isDark
                      ? "1px solid rgba(255, 255, 255, 0.12)"
                      : "1px solid rgba(255, 255, 255, 0.85)",
                    boxShadow: isDark
                      ? "inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 4px 16px rgba(0, 0, 0, 0.25)"
                      : "inset 0 1.5px 0 #ffffff, 0 4px 14px rgba(20, 25, 40, 0.03)",
                  }}
                >
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {isIndonesian ? "Rata-rata harian" : "Daily average"}
                  </span>
                  <p
                    className="text-[17px] font-semibold amount mt-1 tabular-nums truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {formatMoney(Math.round(effectiveDailyAvg))}
                  </p>
                </div>
              </div>

              {/* Polished Tactile Liquid Glass Action Button */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  onClose();
                  navigate("/calendar");
                }}
                className="w-full mt-3 py-3 rounded-2xl text-[12px] font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer select-none"
                style={{
                  background: isDark
                    ? "linear-gradient(135deg, rgba(255, 255, 255, 0.09) 0%, rgba(255, 255, 255, 0.03) 100%)"
                    : "linear-gradient(135deg, rgba(255, 255, 255, 0.88) 0%, rgba(255, 255, 255, 0.58) 100%)",
                  backdropFilter: "blur(24px)",
                  WebkitBackdropFilter: "blur(24px)",
                  border: isDark
                    ? "1px solid rgba(255, 255, 255, 0.18)"
                    : "1px solid rgba(255, 255, 255, 0.95)",
                  boxShadow: isDark
                    ? "inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 8px 24px rgba(0, 0, 0, 0.35)"
                    : "inset 0 1.5px 0 #ffffff, 0 6px 20px rgba(20, 25, 40, 0.04)",
                  color: "var(--text-primary)",
                }}
                title={
                  isIndonesian
                    ? "Lihat Kalender & Runway Harian"
                    : "View Calendar & Daily Runway"
                }
              >
                <CalendarDays size={14} strokeWidth={1.8} />
                <span>
                  {isIndonesian
                    ? "Lihat Kalender & Runway Harian"
                    : "View Calendar & Daily Runway"}
                </span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
