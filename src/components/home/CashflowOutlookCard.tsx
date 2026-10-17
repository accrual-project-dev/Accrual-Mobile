import { useMemo, useState } from "react";
import {
  ChevronRight,
  CalendarRange,
} from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import type { CashflowFloorResult } from "../../hooks/useFinancialIntelligence";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import { triggerHaptic } from "../../lib/haptics";
import { useTheme } from "../../contexts/ThemeContext";

interface CashflowOutlookCardProps {
  defaultForecast: CashflowFloorResult;
  getCashflowHorizon: (days?: number) => CashflowFloorResult;
  hideBalance?: boolean;
}

const HORIZONS = [7, 14, 30] as const;

export function CashflowOutlookCard({
  defaultForecast,
  getCashflowHorizon,
  hideBalance = false,
}: CashflowOutlookCardProps) {
  const { language } = useLanguage();
  const { formatWithPreferred, currencyMeta } = useCurrency();
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const isIndonesian = language === "id";

  const [selectedHorizon, setSelectedHorizon] =
    useState<(typeof HORIZONS)[number]>(14);
  const [detailOpen, setDetailOpen] = useState(false);

  const forecast = useMemo(() => {
    return selectedHorizon === 14
      ? defaultForecast
      : getCashflowHorizon(selectedHorizon);
  }, [defaultForecast, getCashflowHorizon, selectedHorizon]);

  const eventDays = useMemo(() => {
    return forecast.dailyPoints.filter(
      (point) => point.knownInflow > 0 || point.knownOutflow > 0,
    );
  }, [forecast]);

  // Compute SVG Sparkline Path for Cashflow Trajectory
  const sparklineData = useMemo(() => {
    const pts = forecast.dailyPoints;
    if (!pts || pts.length < 2) return null;

    const balances = pts.map((p) => p.projectedBalance);
    const min = Math.min(...balances);
    const max = Math.max(...balances);
    const range = max - min || 1;

    const width = 320;
    const height = 72;
    const paddingY = 10;
    const usableHeight = height - paddingY * 2;

    const coords = pts.map((p, i) => {
      const x = (i / (pts.length - 1)) * width;
      const y = height - paddingY - ((p.projectedBalance - min) / range) * usableHeight;
      return { x, y, point: p };
    });

    // Smooth cubic Bézier spline curve
    let linePath = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[Math.max(0, i - 1)];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[Math.min(coords.length - 1, i + 2)];

      const tension = 0.2;
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;

      linePath += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

    const lowestCoord = coords.find(
      (c) => c.point.date === forecast.lowestBalanceDate,
    ) || coords[0];

    return { linePath, areaPath, lowestCoord, width, height };
  }, [forecast]);

  const mask = (val: string) =>
    hideBalance ? `${currencyMeta?.symbol || "Rp"} ••••••••` : val;

  return (
    <>
      <section
        className="p-5 rounded-[24px] glass-surface select-none space-y-4"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--glass-border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {/* ── 1. Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: "var(--glass-fill)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-primary)",
              }}
            >
              <CalendarRange size={16} strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h3 className="text-[13px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                {isIndonesian ? "Proyeksi Titik Terendah Kas" : "Cashflow Runway & Floor"}
              </h3>
              <p className="text-[11px] truncate" style={{ color: "var(--text-tertiary)" }}>
                {isIndonesian
                  ? `Simulasi likuiditas ${selectedHorizon} hari ke depan`
                  : `${selectedHorizon}-day liquidity runway pacing`}
              </p>
            </div>
          </div>

          {/* Horizon Selector Chips */}
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-white/[0.04] border border-[var(--glass-border)] shrink-0">
            {HORIZONS.map((days) => {
              const active = selectedHorizon === days;
              return (
                <button
                  key={days}
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setSelectedHorizon(days);
                  }}
                  className="px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer"
                  style={{
                    background: active ? "var(--text-primary)" : "transparent",
                    color: active ? "var(--bg-base)" : "var(--text-tertiary)",
                  }}
                >
                  {days}d
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 2. Visual Balance Trajectory Sparkline Chart ────────────────────── */}
        {sparklineData && (
          <div
            className="p-3.5 rounded-2xl space-y-2 border"
            style={{
              background: "var(--glass-fill)",
              borderColor: "var(--glass-border)",
            }}
          >
            <div className="flex items-center justify-between text-[11px]">
              <span style={{ color: "var(--text-tertiary)" }}>
                {isIndonesian
                  ? `Lintasan Saldo (${selectedHorizon} Hari ke Depan)`
                  : `Projected Balance Track (${selectedHorizon} Days)`}
              </span>
              <span className="tabular-nums font-semibold" style={{ color: "var(--text-primary)" }}>
                {mask(formatWithPreferred(forecast.currentBalance))}
              </span>
            </div>

            <div className="relative w-full overflow-hidden pt-1">
              <svg
                viewBox={`0 0 ${sparklineData.width} ${sparklineData.height}`}
                className="w-full h-[72px] overflow-visible"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="outlookGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop
                      offset="0%"
                      stopColor={isDark ? "rgba(255,255,255,0.22)" : "rgba(24,24,27,0.16)"}
                    />
                    <stop
                      offset="75%"
                      stopColor={isDark ? "rgba(255,255,255,0.04)" : "rgba(24,24,27,0.03)"}
                    />
                    <stop offset="100%" stopColor="transparent" />
                  </linearGradient>
                </defs>

                {/* Horizontal reference baseline dashed line for lowest floor */}
                <line
                  x1="0"
                  y1={sparklineData.lowestCoord.y}
                  x2={sparklineData.width}
                  y2={sparklineData.lowestCoord.y}
                  stroke={isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />

                <path d={sparklineData.areaPath} fill="url(#outlookGrad)" />
                <path
                  d={sparklineData.linePath}
                  fill="none"
                  stroke={isDark ? "#FFFFFF" : "#18181B"}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Lowest Floor Halo & Dot Highlight (Monochrome) */}
                <circle
                  cx={sparklineData.lowestCoord.x}
                  cy={sparklineData.lowestCoord.y}
                  r="7"
                  fill={isDark ? "#ffffff" : "#18181b"}
                  opacity="0.18"
                />
                <circle
                  cx={sparklineData.lowestCoord.x}
                  cy={sparklineData.lowestCoord.y}
                  r="3.5"
                  fill={isDark ? "#ffffff" : "#18181b"}
                  stroke={isDark ? "#09090c" : "#ffffff"}
                  strokeWidth="1.5"
                />
              </svg>
            </div>

            <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)] pt-1">
              <span>{isIndonesian ? "Hari Ini" : "Today"}</span>
              <span className="font-semibold flex items-center gap-1" style={{ color: "var(--text-primary)" }}>
                <span
                  className="w-1.5 h-1.5 rounded-full inline-block"
                  style={{ background: isDark ? "#ffffff" : "#18181b" }}
                />
                {isIndonesian
                  ? `Titik Terendah: Tgl ${forecast.lowestBalanceDate ? forecast.lowestBalanceDate.slice(-2) : ""}`
                  : `Lowest Floor: Day ${forecast.lowestBalanceDate ? forecast.lowestBalanceDate.slice(-2) : ""}`}
              </span>
              <span>+{selectedHorizon}d</span>
            </div>
          </div>
        )}

        {/* ── 3. Key Metrics: Projected Low vs Net Change ─────────────────────── */}
        <div className="grid grid-cols-2 gap-2">
          <div
            className="p-3 rounded-2xl border"
            style={{
              background: "var(--glass-fill)",
              borderColor: "var(--glass-border)",
            }}
          >
            <p
              className="text-[9.5px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? "Titik Terendah (Floor)" : "Projected Low"}
            </p>
            <p
              className="amount text-[14px] font-bold tabular-nums mt-1"
              style={{ color: "var(--text-primary)" }}
            >
              {mask(formatWithPreferred(forecast.lowestBalance))}
            </p>
            <p className="text-[10px] mt-1" style={{ color: "var(--text-secondary)" }}>
              {forecast.daysUntilLowest === 0
                ? isIndonesian
                  ? "Hari ini"
                  : "Today"
                : `${forecast.daysUntilLowest} ${isIndonesian ? "hari lagi" : "days away"}`}
            </p>
          </div>

          <div
            className="p-3 rounded-2xl border"
            style={{
              background: "var(--glass-fill)",
              borderColor: "var(--glass-border)",
            }}
          >
            <p
              className="text-[9.5px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian ? "Perubahan Bersih" : "Net Trajectory"}
            </p>
            <p
              className="amount text-[14px] font-bold tabular-nums mt-1"
              style={{ color: "var(--text-primary)" }}
            >
              {mask(
                `${forecast.netProjectedChange >= 0 ? "+" : ""}${formatWithPreferred(
                  forecast.netProjectedChange,
                )}`,
              )}
            </p>
            <p className="text-[10px] mt-1" style={{ color: "var(--text-secondary)" }}>
              {eventDays.length}{" "}
              {isIndonesian ? "agenda arus kas terjadwal" : "scheduled events"}
            </p>
          </div>
        </div>

        {/* ── 4. Upcoming Key Commitments (Clean & Compact) ──────────────────── */}
        {eventDays.length > 0 ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-0.5">
              <span
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Agenda Arus Kas Terdekat" : "Upcoming Cash Events"}
              </span>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setDetailOpen(true);
                }}
                className="text-[10px] font-semibold text-[var(--text-primary)] hover:underline cursor-pointer flex items-center gap-0.5"
              >
                <span>{isIndonesian ? "Semua" : "View All"}</span>
                <ChevronRight size={11} />
              </button>
            </div>

            <div className="space-y-1">
              {eventDays.slice(0, 2).map((point) => (
                <div
                  key={point.date}
                  className="p-2.5 rounded-xl flex items-center justify-between border text-[11px]"
                  style={{
                    background: "var(--glass-fill)",
                    borderColor: "var(--glass-border)",
                  }}
                >
                  <div className="min-w-0 pr-2">
                    <span className="font-semibold text-[var(--text-primary)] truncate block">
                      {point.dayLabel}
                    </span>
                    <span className="text-[9.5px] text-[var(--text-tertiary)] truncate block">
                      {point.knownOutflowItems
                        .map((item) => item.title)
                        .concat(point.knownInflowItems.map((item) => item.title))
                        .join(", ") ||
                        (isIndonesian ? "Agenda terjadwal" : "Scheduled")}
                    </span>
                  </div>

                  <div className="text-right shrink-0">
                    {point.knownOutflow > 0 && (
                      <span className="tabular-nums font-bold text-[var(--text-primary)] block">
                        -{mask(formatWithPreferred(point.knownOutflow))}
                      </span>
                    )}
                    {point.knownInflow > 0 && (
                      <span className="tabular-nums font-bold text-[var(--text-primary)] block">
                        +{mask(formatWithPreferred(point.knownInflow))}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div
            className="p-3 rounded-xl text-center border text-[11px]"
            style={{
              background: "var(--glass-fill)",
              borderColor: "var(--glass-border)",
              color: "var(--text-tertiary)",
            }}
          >
            {isIndonesian
              ? "Tidak ada agenda tagihan atau penarikan besar dalam horizon ini."
              : "No major bills or cash withdrawals scheduled in this horizon."}
          </div>
        )}
      </section>

      {/* ── Drill Down Detail BottomSheet ──────────────────────────────────── */}
      <BottomSheet isOpen={detailOpen} onClose={() => setDetailOpen(false)}>
        <div className="p-5 space-y-4 select-none pb-12">
          <div>
            <h3
              className="font-bold text-[16px]"
              style={{ color: "var(--text-primary)" }}
            >
              {isIndonesian ? "Detail Prospek Arus Kas" : "Cashflow Outlook Details"}
            </h3>
            <p
              className="text-[11px] mt-0.5"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian
                ? `Simulasi lintasan kas harian selama ${selectedHorizon} hari ke depan`
                : `Daily cash projection breakdown over the next ${selectedHorizon} days`}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div
              className="p-3 rounded-2xl border"
              style={{
                background: "var(--glass-fill)",
                borderColor: "var(--glass-border)",
              }}
            >
              <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                {isIndonesian ? "Awal" : "Start"}
              </p>
              <p className="amount text-[12px] font-bold tabular-nums mt-1 text-[var(--text-primary)]">
                {mask(formatWithPreferred(forecast.currentBalance))}
              </p>
            </div>
            <div
              className="p-3 rounded-2xl border"
              style={{
                background: "var(--glass-fill)",
                borderColor: "var(--glass-border)",
              }}
            >
              <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                {isIndonesian ? "Terendah" : "Low"}
              </p>
              <p className="amount text-[12px] font-bold tabular-nums mt-1 text-[var(--text-primary)]">
                {mask(formatWithPreferred(forecast.lowestBalance))}
              </p>
            </div>
            <div
              className="p-3 rounded-2xl border"
              style={{
                background: "var(--glass-fill)",
                borderColor: "var(--glass-border)",
              }}
            >
              <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                {isIndonesian ? "Perubahan" : "Net Delta"}
              </p>
              <p className="amount text-[12px] font-bold tabular-nums mt-1 text-[var(--text-primary)]">
                {mask(
                  `${forecast.netProjectedChange >= 0 ? "+" : ""}${formatWithPreferred(
                    forecast.netProjectedChange,
                  )}`,
                )}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            {forecast.dailyPoints.map((point) => (
              <div
                key={point.date}
                className="p-3 rounded-2xl border flex items-center justify-between text-[11.5px]"
                style={{
                  background:
                    point.date === forecast.lowestBalanceDate
                      ? isDark
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(0,0,0,0.06)"
                      : "var(--glass-fill)",
                  borderColor:
                    point.date === forecast.lowestBalanceDate
                      ? "var(--text-primary)"
                      : "var(--glass-border)",
                }}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[var(--text-primary)]">
                      {point.dayLabel}
                    </span>
                    {point.date === forecast.lowestBalanceDate && (
                      <span className="text-[8.5px] font-bold uppercase px-1.5 py-0.2 rounded bg-white/[0.08] dark:bg-white/[0.08] text-[var(--text-primary)] border border-white/10">
                        {isIndonesian ? "Titik Terendah" : "Lowest"}
                      </span>
                    )}
                  </div>
                  <p className="text-[9.5px] text-[var(--text-tertiary)] mt-0.5">
                    {point.knownOutflowItems
                      .map((item) => item.title)
                      .concat(point.knownInflowItems.map((item) => item.title))
                      .join(" · ") ||
                      (isIndonesian ? "Aktivitas normal" : "Normal pacing")}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-bold tabular-nums text-[var(--text-primary)] block">
                    {mask(formatWithPreferred(point.projectedBalance))}
                  </span>
                  {point.netDailyCashflow !== 0 && (
                    <span
                      className="text-[9.5px] tabular-nums block text-[var(--text-secondary)]"
                    >
                      {mask(
                        `${point.netDailyCashflow > 0 ? "+" : ""}${formatWithPreferred(
                          point.netDailyCashflow,
                        )}`,
                      )}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
