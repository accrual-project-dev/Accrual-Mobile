import { useMemo } from "react";
import { Info, PieChart } from "lucide-react";
import type { WidgetSize } from "../../../lib/widgetLayoutTypes";
import { CompactShell } from "./CompactShell";
import { useTheme } from "../../../contexts/ThemeContext";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useCurrency } from "../../../contexts/CurrencyContext";

const SEGMENT_SHADES_DARK = [
  "rgba(255, 255, 255, 0.95)",
  "rgba(255, 255, 255, 0.68)",
  "rgba(255, 255, 255, 0.42)",
  "rgba(255, 255, 255, 0.24)",
  "rgba(255, 255, 255, 0.12)",
];

const SEGMENT_SHADES_LIGHT = [
  "rgba(9, 9, 11, 0.95)",
  "rgba(9, 9, 11, 0.70)",
  "rgba(9, 9, 11, 0.48)",
  "rgba(9, 9, 11, 0.30)",
  "rgba(9, 9, 11, 0.15)",
];

const FULL_RADIUS = 38;
const FULL_STROKE = 8.5;
const FULL_CIRC = 2 * Math.PI * FULL_RADIUS; // ~238.7

export function CategoryDonutCard({
  categories,
  totalExpense,
  size = "half",
  onOpenDetail,
}: {
  categories: { name: string; amount: number; pct: number; count?: number }[];
  totalExpense: number;
  size?: WidgetSize;
  onOpenDetail?: () => void;
}) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { formatWithPreferred } = useCurrency();
  const isIndonesian = language === "id";
  const isDark = theme === "dark";

  const segmentShades = isDark ? SEGMENT_SHADES_DARK : SEGMENT_SHADES_LIGHT;

  const donutSegments = useMemo(() => {
    const raw = categories.slice(0, 5);
    const dashes = raw.map((cat) => (Math.max(0, cat.pct) / 100) * FULL_CIRC);
    let offsetAcc = 0;
    const offsets: number[] = [];
    for (let i = 0; i < dashes.length; i++) {
      offsets.push(offsetAcc);
      offsetAcc += dashes[i];
    }
    return raw.map((cat, idx) => ({
      ...cat,
      strokeDash: dashes[idx],
      offset: offsets[idx],
      color: segmentShades[idx % segmentShades.length],
    }));
  }, [categories, segmentShades]);

  const topCat = categories[0] || {
    name: isIndonesian ? "Belum ada pengeluaran" : "No expenses",
    amount: 0,
    pct: 0,
  };

  const donutSvg = (
    <div className="relative flex items-center justify-center shrink-0">
      <svg width="68" height="68" className="rotate-[-90deg]">
        <circle
          cx="34"
          cy="34"
          r="26"
          fill="none"
          stroke={isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)"}
          strokeWidth="6"
        />
        <circle
          cx="34"
          cy="34"
          r="26"
          fill="none"
          stroke="var(--text-primary)"
          strokeWidth="6"
          strokeDasharray={`${(topCat.pct / 100) * 163.3} 163.3`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-[12px] font-semibold text-[var(--text-primary)]">
          {topCat.pct.toFixed(0)}%
        </span>
      </div>
    </div>
  );

  if (size === "half") {
    return (
      <CompactShell title={isIndonesian ? "Kategori" : "Categories"} onOpenDetail={onOpenDetail}>
        <div className="flex-1 flex items-center justify-center py-0.5">{donutSvg}</div>
        <div className="flex justify-between items-center text-[10px] text-[var(--text-tertiary)] pt-1 border-t border-black/5 dark:border-white/5 shrink-0">
          <span className="truncate max-w-[70px]">{topCat.name}</span>
          <span className="font-semibold text-[var(--text-primary)] amount">
            {formatWithPreferred(topCat.amount)}
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
            <PieChart size={14} className="text-[var(--text-primary)]" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)] leading-tight">
              {isIndonesian ? "Alokasi Pengeluaran" : "Expense Allocation Donut"}
            </h3>
            <p className="text-[10px] text-[var(--text-tertiary)]">
              {isIndonesian ? "Distribusi arus keluar per sektor pengeluaran" : "Sector-by-sector outflow distribution"}
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
            Total: {formatWithPreferred(totalExpense)}
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

      <div className="flex items-center gap-5 pt-1">
        {/* Multi-Segment Full Donut */}
        <div className="relative flex items-center justify-center shrink-0">
          <svg
            width={(FULL_RADIUS + FULL_STROKE) * 2}
            height={(FULL_RADIUS + FULL_STROKE) * 2}
            className="rotate-[-90deg]"
          >
            <circle
              cx={FULL_RADIUS + FULL_STROKE}
              cy={FULL_RADIUS + FULL_STROKE}
              r={FULL_RADIUS}
              fill="none"
              stroke={isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)"}
              strokeWidth={FULL_STROKE}
            />
            {donutSegments.map((seg, idx) => (
              <circle
                key={idx}
                cx={FULL_RADIUS + FULL_STROKE}
                cy={FULL_RADIUS + FULL_STROKE}
                r={FULL_RADIUS}
                fill="none"
                stroke={seg.color}
                strokeWidth={FULL_STROKE}
                strokeDasharray={`${seg.strokeDash} ${FULL_CIRC - seg.strokeDash}`}
                strokeDashoffset={-seg.offset}
                strokeLinecap="round"
                style={{ transition: "all 0.6s ease-in-out" }}
              />
            ))}
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-[11px] font-semibold amount text-[var(--text-primary)] leading-tight">
              {categories.length}
            </span>
            <span className="text-[8px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
              {isIndonesian ? "Sektor" : "Sectors"}
            </span>
          </div>
        </div>

        {/* Detailed Category Rows with Progress Bars */}
        <div className="flex-1 space-y-2">
          {categories.slice(0, 4).map((c, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between items-center text-[11px]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: segmentShades[i % segmentShades.length] }}
                  />
                  <span className="text-[var(--text-primary)] font-medium truncate max-w-[110px]">
                    {c.name}
                  </span>
                  {c.count && (
                    <span className="text-[9px] text-[var(--text-tertiary)] font-medium">
                      ({c.count} {isIndonesian ? "trx" : "tx"})
                    </span>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className="font-semibold amount text-[var(--text-primary)]">
                    {formatWithPreferred(c.amount)}
                  </span>
                  <span className="text-[10px] text-[var(--text-tertiary)] ml-1 font-medium">
                    {c.pct.toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="w-full h-1 rounded-full overflow-hidden bg-black/[0.06] dark:bg-white/10">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, Math.max(2, c.pct))}%`,
                    background: segmentShades[i % segmentShades.length],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-1 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[10px] text-[var(--text-tertiary)]">
        <span>
          {isIndonesian
            ? `${topCat.name} adalah kategori pengeluaran terbesar (${topCat.pct.toFixed(0)}% dari total).`
            : `${topCat.name} is your largest expense category (${topCat.pct.toFixed(0)}% of total).`}
        </span>
        <span className="font-semibold text-[var(--text-secondary)]">
          {isIndonesian ? `${categories.length} Kategori Aktif` : `${categories.length} Active Categories`}
        </span>
      </div>
    </section>
  );
}
