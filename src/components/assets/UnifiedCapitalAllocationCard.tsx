import { useMemo, useState } from "react";
import { Layers } from "lucide-react";
import { RingChart, Ring, RingCenter } from "../ui/RingChart";
import { triggerHaptic } from "../../lib/haptics";

export interface UnifiedCapitalAllocationCardProps {
  liquidAssetsTotal: number;
  growthAssetsTotal: number;
  fixedAssetsTotal: number;
  liabilitiesTotal: number;
  totalGrossAssets: number;
  netWorth: number;
  solvencyScore: number;
  debtToAssetRatio: number;
  liquidPct: number;
  growthPct: number;
  fixedPct: number;
  capitalDeployment: number;
  isStealthMode: boolean;
  isIndonesian: boolean;
  isDark: boolean;
  onOpenLiquidDetail: () => void;
  onOpenGrowthDetail: () => void;
  onOpenFixedDetail: () => void;
  onOpenDebtDetail: () => void;
  onOpenConsolidatedDrawer?: () => void;
}

function formatAxisNumber(val: number, isIndonesian: boolean): string {
  if (val === 0) return "Rp 0";
  if (Math.abs(val) >= 1_000_000_000) {
    const b = val / 1_000_000_000;
    return `Rp ${b % 1 === 0 ? b.toFixed(0) : b.toFixed(1)} ${isIndonesian ? "M" : "B"}`;
  }
  if (Math.abs(val) >= 1_000_000) {
    const m = val / 1_000_000;
    return `Rp ${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)} ${isIndonesian ? "jt" : "M"}`;
  }
  if (Math.abs(val) >= 1_000) {
    const k = val / 1_000;
    return `Rp ${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)} ${isIndonesian ? "rb" : "k"}`;
  }
  return `Rp ${val.toLocaleString()}`;
}

export function UnifiedCapitalAllocationCard({
  liquidAssetsTotal,
  growthAssetsTotal,
  fixedAssetsTotal,
  liabilitiesTotal,
  totalGrossAssets,
  netWorth: _netWorth,
  solvencyScore,
  debtToAssetRatio,
  liquidPct,
  growthPct,
  fixedPct,
  capitalDeployment: _capitalDeployment,
  isStealthMode,
  isIndonesian,
  isDark,
  onOpenLiquidDetail,
  onOpenGrowthDetail,
  onOpenFixedDetail,
  onOpenDebtDetail,
  onOpenConsolidatedDrawer: _onOpenConsolidatedDrawer,
}: UnifiedCapitalAllocationCardProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Dataset for the 4 pillars formatted for RingChart
  const ringData = useMemo(() => {
    const baselineMax = Math.max(totalGrossAssets, liabilitiesTotal, 1);

    return [
      {
        key: "liquid",
        label: isIndonesian ? "Aset Lancar" : "Liquid Assets",
        fullName: isIndonesian ? "Kas & Aset Lancar" : "Cash & Liquid Assets",
        value: liquidAssetsTotal,
        maxValue: baselineMax,
        amount: liquidAssetsTotal,
        percentage: Number(liquidPct.toFixed(1)),
        desc: isIndonesian
          ? "Kas tunai, saldo rekening & cadangan stablecoin"
          : "Cash on hand, bank balances & stablecoins",
        color: isDark ? "#FFFFFF" : "#18181b",
        onClick: onOpenLiquidDetail,
      },
      {
        key: "growth",
        label: isIndonesian ? "Investasi" : "Investments",
        fullName: isIndonesian
          ? "Investasi & Portofolio Efek"
          : "Market Securities & Funds",
        value: growthAssetsTotal,
        maxValue: baselineMax,
        amount: growthAssetsTotal,
        percentage: Number(growthPct.toFixed(1)),
        desc: isIndonesian
          ? "Saham, reksa dana, obligasi & aset kripto"
          : "Public equities, funds, bonds & crypto",
        color: isDark ? "rgba(255, 255, 255, 0.70)" : "#52525b",
        onClick: onOpenGrowthDetail,
      },
      {
        key: "fixed",
        label: isIndonesian ? "Aset Riil" : "Real Assets",
        fullName: isIndonesian
          ? "Aset Riil & Berwujud"
          : "Real & Tangible Assets",
        value: fixedAssetsTotal,
        maxValue: baselineMax,
        amount: fixedAssetsTotal,
        percentage: Number(fixedPct.toFixed(1)),
        desc: isIndonesian
          ? "Emas batangan fisik, properti, tanah & barang berharga"
          : "Physical gold bullion, real estate & physical assets",
        color: isDark ? "rgba(255, 255, 255, 0.42)" : "#71717a",
        onClick: onOpenFixedDetail,
      },
      {
        key: "debt",
        label: isIndonesian ? "Liabilitas" : "Liabilities",
        fullName: isIndonesian
          ? "Liabilitas & Kewajiban"
          : "Liabilities & Debt Obligations",
        value: liabilitiesTotal,
        maxValue: baselineMax,
        amount: liabilitiesTotal,
        percentage: Number(debtToAssetRatio.toFixed(1)),
        desc: isIndonesian
          ? "Kartu kredit, paylater, pinjaman & kewajiban jatuh tempo"
          : "Credit cards, loans, paylater & obligations",
        color: isDark ? "rgba(255, 255, 255, 0.48)" : "#71717a",
        onClick: onOpenDebtDetail,
      },
    ];
  }, [
    liquidAssetsTotal,
    growthAssetsTotal,
    fixedAssetsTotal,
    liabilitiesTotal,
    totalGrossAssets,
    liquidPct,
    growthPct,
    fixedPct,
    debtToAssetRatio,
    isIndonesian,
    isDark,
    onOpenLiquidDetail,
    onOpenGrowthDetail,
    onOpenFixedDetail,
    onOpenDebtDetail,
  ]);

  // Liquid Glass Tactile Materials
  const cardBg = isDark
    ? "linear-gradient(160deg, rgba(255, 255, 255, 0.075) 0%, rgba(255, 255, 255, 0.025) 100%)"
    : "linear-gradient(160deg, rgba(255, 255, 255, 0.96) 0%, rgba(246, 247, 250, 0.88) 100%)";

  const cardBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.09)"
    : "1px solid rgba(0, 0, 0, 0.065)";

  const cardShadow = isDark
    ? "0 16px 36px -10px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.12)"
    : "0 8px 24px -6px rgba(31, 36, 48, 0.06), inset 0 1px 0 #ffffff";

  return (
    <div
      className="p-3.5 sm:p-4 rounded-[26px] relative overflow-hidden transition-all select-none space-y-2.5"
      style={{
        background: cardBg,
        border: cardBorder,
        boxShadow: cardShadow,
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
      }}
    >
      {/* Specular Rim Light */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[12%] right-[12%] top-[1px] h-[1.5px] rounded-full"
        style={{
          background: isDark
            ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), rgba(255,255,255,0.45), rgba(255,255,255,0.25), transparent)"
            : "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), rgba(255,255,255,1), rgba(255,255,255,0.8), transparent)",
        }}
      />

      {/* ── 1. Compact Header Bar ────────────────── */}
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: isDark
              ? "rgba(255, 255, 255, 0.06)"
              : "rgba(0, 0, 0, 0.04)",
            border: cardBorder,
            color: "var(--text-primary)",
          }}
        >
          <Layers size={13.5} strokeWidth={1.8} />
        </div>
        <div>
          <h3 className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)] leading-tight">
            {isIndonesian ? "Struktur Neraca" : "Balance Sheet"}
          </h3>
          <p className="text-[10.5px] text-[var(--text-tertiary)] leading-none mt-0.5">
            {isIndonesian
              ? "Komposisi aset & liabilitas"
              : "Asset & liability composition"}
          </p>
        </div>
      </div>

      {/* ── 2. Two-Column Compact Layout (Ring vs Legend) ────────── */}
      <div className="flex items-center justify-between gap-2.5 sm:gap-3.5 pt-0.5">
        {/* Left Column: Ring Gauge */}
        <div className="w-[115px] sm:w-[122px] shrink-0 flex items-center justify-center relative">
          <RingChart
            data={ringData}
            endAngle={(3 * Math.PI) / 2}
            size={114}
            strokeWidth={5}
            ringGap={2.8}
            startAngle={Math.PI / 2}
            hoveredIndex={hoveredIndex}
            onHoverChange={setHoveredIndex}
          >
            {ringData.map((item, index) => (
              <Ring index={index} key={item.label} />
            ))}
            <RingCenter defaultLabel={`${Math.round(solvencyScore)}%`}>
              {({ isHovered }) => (
                <div className="flex flex-col items-center justify-center text-center">
                  <span className="text-[17px] sm:text-[18px] font-bold text-[var(--text-primary)] tabular-nums tracking-tight leading-none amount">
                    {isHovered && hoveredIndex !== null
                      ? `${ringData[hoveredIndex]?.percentage}%`
                      : `${Math.round(solvencyScore)}%`}
                  </span>
                  <span className="text-[8px] sm:text-[8.5px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold mt-0.5 truncate max-w-[70px]">
                    {isHovered && hoveredIndex !== null
                      ? ringData[hoveredIndex]?.label
                      : isIndonesian
                        ? "Solvensi"
                        : "Solvency"}
                  </span>
                </div>
              )}
            </RingCenter>
          </RingChart>
        </div>

        {/* Right Column: Financial Legend Rows */}
        <div className="flex-1 min-w-0 flex flex-col justify-center space-y-1">
          {ringData.map((item, index) => {
            const isHovered = hoveredIndex === index;
            const isFaded = hoveredIndex !== null && !isHovered;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  item.onClick();
                }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`w-full py-1 px-2.5 rounded-xl transition-all text-left cursor-pointer group flex items-center justify-between active:scale-[0.985] ${
                  isFaded ? "opacity-35" : "opacity-100"
                }`}
                style={{
                  background: isHovered
                    ? isDark
                      ? "rgba(255, 255, 255, 0.08)"
                      : "rgba(0, 0, 0, 0.05)"
                    : isDark
                      ? "rgba(255, 255, 255, 0.025)"
                      : "rgba(0, 0, 0, 0.02)",
                  border: isHovered
                    ? isDark
                      ? "1px solid rgba(255, 255, 255, 0.16)"
                      : "1px solid rgba(0, 0, 0, 0.09)"
                    : isDark
                      ? "1px solid rgba(255, 255, 255, 0.04)"
                      : "1px solid rgba(0, 0, 0, 0.03)",
                  boxShadow:
                    isHovered && isDark
                      ? "0 2px 8px rgba(0, 0, 0, 0.3)"
                      : "none",
                }}
                title={item.fullName}
              >
                {/* Dot & Nama Kategori */}
                <div className="flex items-center gap-1.5 min-w-0 pr-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0 transition-transform group-hover:scale-125"
                    style={{ background: item.color }}
                  />
                  <span className="text-[11px] font-semibold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors truncate leading-tight">
                    {item.label}
                  </span>
                </div>

                {/* Persentase & Nominal Nilai */}
                <div className="flex items-center gap-1.5 shrink-0 text-right">
                  <span className="text-[9px] font-mono font-medium text-[var(--text-tertiary)] tabular-nums">
                    {item.percentage}%
                  </span>
                  <span className="text-[11px] font-bold text-[var(--text-primary)] tabular-nums leading-none">
                    {isStealthMode
                      ? "••••"
                      : formatAxisNumber(item.amount, isIndonesian)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
