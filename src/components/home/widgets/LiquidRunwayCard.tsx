import { Info, ShieldCheck } from "lucide-react";
import type { WidgetSize } from "../../../lib/widgetLayoutTypes";
import { CompactShell } from "./CompactShell";
import { FinancialGlossaryTooltip } from "../../common/FinancialGlossaryTooltip";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useCurrency } from "../../../contexts/CurrencyContext";

export function LiquidRunwayCard({
  runwayMonths,
  liquidAssets,
  monthlyBurn,
  size = "half",
  onOpenDetail,
}: {
  runwayMonths: number;
  liquidAssets: number;
  monthlyBurn: number;
  size?: WidgetSize;
  onOpenDetail?: () => void;
}) {
  const { language } = useLanguage();
  const { formatWithPreferred } = useCurrency();
  const isIndonesian = language === "id";

  const status =
    runwayMonths >= 12
      ? isIndonesian ? "Cadangan Kuat" : "Fortress Reserve"
      : runwayMonths >= 6
        ? isIndonesian ? "Buffer Ideal" : "Ideal Buffer"
        : runwayMonths >= 3
          ? isIndonesian ? "Jaring Pengaman" : "Safety Net"
          : isIndonesian ? "Kritis" : "Critical";

  // CFP 3-Tier Emergency Fund Benchmarks (3, 6, 12 Months)
  const maxBenchmarkMonths = 12;
  const overallCoveragePct = Math.min(
    100,
    Math.round((runwayMonths / maxBenchmarkMonths) * 100),
  );

  const nextTierInfo = (() => {
    if (runwayMonths < 3) {
      const deficit = Math.max(0, 3 * monthlyBurn - liquidAssets);
      return {
        label: isIndonesian ? "Tier 1: Jaring Pengaman (3 Bln)" : "Tier 1: Safety Net (3 Mos)",
        deficit,
        desc: isIndonesian
          ? `Perlu ${formatWithPreferred(deficit)} lagi untuk mencapai jaring pengaman darurat 3 bulan.`
          : `Need ${formatWithPreferred(deficit)} more to reach the 3-month emergency safety net.`,
      };
    }
    if (runwayMonths < 6) {
      const deficit = Math.max(0, 6 * monthlyBurn - liquidAssets);
      return {
        label: isIndonesian ? "Tier 2: Buffer Ideal (6 Bln)" : "Tier 2: Ideal Buffer (6 Mos)",
        deficit,
        desc: isIndonesian
          ? `Perlu ${formatWithPreferred(deficit)} lagi untuk mencapai standar buffer 6 bulan.`
          : `Need ${formatWithPreferred(deficit)} more to reach the standard 6-month buffer.`,
      };
    }
    if (runwayMonths < 12) {
      const deficit = Math.max(0, 12 * monthlyBurn - liquidAssets);
      return {
        label: isIndonesian ? "Tier 3: Cadangan Kuat (12 Bln)" : "Tier 3: Fortress Reserve (12 Mos)",
        deficit,
        desc: isIndonesian
          ? `Perlu ${formatWithPreferred(deficit)} lagi untuk cadangan kuat 1 tahun penuh.`
          : `Need ${formatWithPreferred(deficit)} more for a full 1-year fortress reserve.`,
      };
    }
    return {
      label: isIndonesian ? "Cadangan Kuat Penuh (≥12 Bln)" : "Full Fortress Reserve (≥12 Mos)",
      deficit: 0,
      desc: isIndonesian
        ? "Ketahanan kas melampaui 12 bulan pengeluaran. Likuiditas darurat optimal."
        : "Cash runway exceeds 12 months of expenses. Emergency liquidity is optimal.",
    };
  })();

  if (size === "half") {
    return (
      <div onClick={onOpenDetail} className="cursor-pointer">
        <CompactShell title={isIndonesian ? "Ketahanan Dana" : "Cashflow Runway"} onOpenDetail={onOpenDetail}>
          <div className="flex-1 flex flex-col justify-center py-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-[var(--text-tertiary)]">
                {isIndonesian ? "Horizon Cadangan" : "Reserve Horizon"}
              </span>
              <span
                className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-md truncate max-w-[90px]"
                style={{
                  background: "var(--glass-fill)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                {status}
              </span>
            </div>
            <p className="text-[18px] font-semibold amount text-[var(--text-primary)] leading-tight mt-0.5">
              {runwayMonths >= 99 ? "∞" : runwayMonths.toFixed(1)}{" "}
              <span className="text-[11px] font-semibold text-[var(--text-tertiary)]">
                {isIndonesian ? "Bln" : "Mos"}
              </span>
            </p>
          </div>

          <div className="flex justify-between items-center text-[10px] text-[var(--text-tertiary)] pt-1 border-t border-black/5 dark:border-white/5 shrink-0">
            <span>{isIndonesian ? "Laju Pengeluaran" : "Monthly Burn Rate"}</span>
            <span className="font-semibold text-[var(--text-primary)] amount truncate max-w-[90px]">
              {formatWithPreferred(monthlyBurn)}{isIndonesian ? "/bln" : "/m"}
            </span>
          </div>
        </CompactShell>
      </div>
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
            <ShieldCheck size={14} className="text-[var(--text-primary)]" />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <h3 className="text-[13px] font-semibold text-[var(--text-primary)] leading-tight">
                {isIndonesian ? "Cadangan Likuid & Ketahanan Darurat" : "Liquid Reserve & Emergency Runway"}
              </h3>
              <FinancialGlossaryTooltip term="solvency_runway" />
            </div>
            <p className="text-[10px] text-[var(--text-tertiary)]">
              {isIndonesian
                ? "Ketahanan kas darurat berbasis rata-rata pengeluaran bulanan"
                : "Emergency cash runway based on monthly average expenditure"}
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
            {status} ({runwayMonths.toFixed(1)} {isIndonesian ? "Bln" : "Mos"})
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

      <div className="grid grid-cols-3 gap-2">
        <div
          className="p-2.5 rounded-xl text-center"
          style={{ background: "var(--glass-fill)" }}
        >
          <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
            {isIndonesian ? "Ketahanan Likuid" : "Liquidity Runway"}
          </span>
          <p className="text-[16px] font-semibold amount text-[var(--text-primary)] mt-0.5">
            {runwayMonths.toFixed(1)} {isIndonesian ? "Bln" : "Mos"}
          </p>
        </div>
        <div
          className="p-2.5 rounded-xl text-center"
          style={{ background: "var(--glass-fill)" }}
        >
          <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
            {isIndonesian ? "Aset Likuid" : "Liquid Assets"}
          </span>
          <p className="text-[13px] font-semibold amount text-[var(--text-primary)] mt-0.5 truncate">
            {formatWithPreferred(liquidAssets)}
          </p>
        </div>
        <div
          className="p-2.5 rounded-xl text-center"
          style={{ background: "var(--glass-fill)" }}
        >
          <span className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] block">
            {isIndonesian ? "Beban Bulanan" : "Monthly Burn"}
          </span>
          <p className="text-[13px] font-semibold amount text-[var(--text-primary)] mt-0.5 truncate">
            {formatWithPreferred(monthlyBurn)}{isIndonesian ? "/bln" : "/m"}
          </p>
        </div>
      </div>

      {/* CFP 3-Tier Emergency Fund Progress Bar */}
      <div className="pt-1 space-y-1.5">
        <div className="flex justify-between text-[10px] text-[var(--text-tertiary)]">
          <span>{isIndonesian ? "Tolok Ukur Dana Darurat (Standar CFP)" : "Emergency Fund Benchmark (CFP Standard)"}</span>
          <span className="font-semibold text-[var(--text-primary)]">
            {nextTierInfo.label}
          </span>
        </div>

        {/* Multi-milestone Progress Bar (Scale to 12 Mos: 25%=3m, 50%=6m, 100%=12m) */}
        <div className="relative">
          <div className="w-full h-2 rounded-full overflow-hidden bg-black/[0.06] dark:bg-white/10">
            <div
              className="h-full rounded-full bg-[var(--text-primary)] transition-all duration-700"
              style={{ width: `${overallCoveragePct}%` }}
            />
          </div>

          {/* Marker pins for 3 Mo (25%) and 6 Mo (50%) */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-black/40 dark:bg-white/40"
            style={{ left: "25%" }}
            title="Tier 1: 3 Months"
          />
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-black/40 dark:bg-white/40"
            style={{ left: "50%" }}
            title="Tier 2: 6 Months"
          />
        </div>

        {/* Milestone Labels */}
        <div className="flex justify-between text-[9px] text-[var(--text-tertiary)]">
          <span>{isIndonesian ? "0 Bln" : "0 Mos"}</span>
          <span className="text-center">{isIndonesian ? "3 Bln (Min)" : "3 Mos (Min)"}</span>
          <span className="text-center">{isIndonesian ? "6 Bln (Ideal)" : "6 Mos (Ideal)"}</span>
          <span>{isIndonesian ? "12 Bln (Kuat)" : "12 Mos (Fortress)"}</span>
        </div>
      </div>

      <div className="pt-1 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[10px] text-[var(--text-tertiary)]">
        <span className="line-clamp-1 flex-1 pr-2">
          {nextTierInfo.desc}
        </span>
        <span className="font-semibold text-[var(--text-secondary)] shrink-0 amount">
          {isIndonesian ? "Cadangan: " : "Reserve: "}{formatWithPreferred(liquidAssets)}
        </span>
      </div>
    </section>
  );
}
