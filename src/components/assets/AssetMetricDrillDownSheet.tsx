import { BottomSheet } from "../ui/BottomSheet";
import { triggerHaptic } from "../../lib/haptics";
import { useCurrency } from "../../contexts/CurrencyContext";

export interface MetricDrillDownItem {
  label: string;
  sublabel?: string;
  valueText?: string;
  amount?: number;
  detail?: string;
  onClick?: () => void;
}

export interface MetricDrillDownData {
  title: string;
  badge: string;
  icon?: string;
  amount: number;
  narrative: string;
  items?: MetricDrillDownItem[];
  ctaLabel?: string;
  onCta?: () => void;
}

interface AssetMetricDrillDownSheetProps {
  data: MetricDrillDownData | null;
  onClose: () => void;
  isStealthMode: boolean;
  isIndonesian: boolean;
}

export function AssetMetricDrillDownSheet({
  data,
  onClose,
  isStealthMode,
  isIndonesian,
}: AssetMetricDrillDownSheetProps) {
  const { formatWithPreferred, currencyMeta } = useCurrency();

  return (
    <BottomSheet
      isOpen={Boolean(data)}
      onClose={onClose}
      title={data?.title || ""}
    >
      <div
        className="p-5 space-y-4 select-none"
        style={{
          paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 20px), 28px)",
        }}
      >
        {/* Header Metric Box */}
        <div
          className="p-4 rounded-2xl border border-[var(--glass-border)] space-y-1.5"
          style={{
            background: "var(--bg-elevated)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
              {isIndonesian
                ? "Nilai Terkonsolidasi"
                : "Consolidated Valuation"}
            </span>
            <span className="text-[9.5px]  px-2 py-0.5 rounded-full bg-[var(--glass-fill)] border border-[var(--glass-border)] text-[var(--text-secondary)] font-semibold">
              {data?.badge}
            </span>
          </div>
          <p className=" text-2xl font-light text-[var(--text-primary)]">
            {isStealthMode
              ? `${currencyMeta.symbol} ••••••••`
              : formatWithPreferred(data?.amount || 0)}
          </p>
        </div>

        {/* Contextual Narrative */}
        <div
          className="p-3.5 rounded-2xl border border-[var(--glass-border)] text-[11.5px] text-[var(--text-secondary)] leading-relaxed"
          style={{ background: "var(--glass-fill)" }}
        >
          {data?.narrative}
        </div>

        {/* Breakdown Items List */}
        {data?.items && data.items.length > 0 && (
          <div className="space-y-2">
            <span className="text-[10.5px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider block px-0.5">
              {isIndonesian ? "Komponen Pembentuk" : "Constituent Items"}
            </span>
            <div className="space-y-1.5">
              {data.items.map((it, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    if (it.onClick) {
                      triggerHaptic("light");
                      it.onClick();
                    }
                  }}
                  className={`p-3 rounded-2xl border border-[var(--glass-border)] flex items-center justify-between transition-all ${
                    it.onClick
                      ? "cursor-pointer hover:bg-[var(--glass-fill-strong)] active:scale-[0.99]"
                      : ""
                  }`}
                  style={{ background: "var(--glass-fill)" }}
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-[12.5px] font-bold text-[var(--text-primary)] truncate">
                      {it.label}
                    </p>
                    {it.sublabel && (
                      <p className="text-[10.5px] text-[var(--text-tertiary)] truncate mt-0.5">
                        {it.sublabel}
                      </p>
                    )}
                  </div>
                  <div className="text-right  shrink-0">
                    <p className="text-[12.5px] font-bold text-[var(--text-primary)]">
                      {isStealthMode
                        ? `${currencyMeta.symbol} ••••••••`
                        : it.valueText || formatWithPreferred(it.amount || 0)}
                    </p>
                    {it.detail && (
                      <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                        {it.detail}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA Action Button */}
        {data?.ctaLabel && data.onCta && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic("medium");
              data.onCta!();
            }}
            className="w-full py-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-fill)] hover:bg-[var(--glass-fill-strong)] text-[var(--text-primary)] text-[12px] font-semibold tracking-wide active:scale-[0.99] transition-all cursor-pointer"
          >
            {data.ctaLabel}
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
