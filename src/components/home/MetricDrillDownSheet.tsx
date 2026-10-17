import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { useLanguage } from "../../contexts/LanguageContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import { usePrivacy } from "../../contexts/PrivacyContext";
import type { CategoryMoMShift } from "../../lib/financialMath";

interface MetricDrillDownSheetProps {
  isOpen: boolean;
  onClose: () => void;
  type: "expense" | "income" | "budget_risk" | "snapshot" | null;
  data: {
    totalCurrent: number;
    totalPrevious: number;
    delta: number;
    pctChange: number;
    topContributors?: CategoryMoMShift[];
    budget?: number;
    consumedPct?: number;
    timePct?: number;
    budgetRisk?: string;
    budgetRiskReason?: string;
    title?: string;
    subtitle?: string;
    badge?: string;
    ctaLabel?: string;
    displayValue?: string;
    hideGrid?: boolean;
    items?: {
      label: string;
      amount?: number;
      valueText?: string;
      pct?: number;
      detail?: string;
    }[];
    onCta?: () => void;
  } | null;
}

export function MetricDrillDownSheet({
  isOpen,
  onClose,
  type,
  data,
}: MetricDrillDownSheetProps) {
  const navigate = useNavigate();
  const { isIndonesian } = useLanguage();
  const { formatWithPreferred, currencyMeta } = useCurrency();
  const { isStealthMode } = usePrivacy();

  const formatMoney = (amount: number) => {
    return isStealthMode ? `${currencyMeta?.symbol || "Rp"} ••••••••` : formatWithPreferred(amount);
  };

  if (!type || !data) return null;

  const isBudgetRisk = type === "budget_risk";
  const isSnapshot = type === "snapshot";
  const isExpense = type === "expense";

  const getRiskLabel = (risk?: string) => {
    if (!risk) return isIndonesian ? "AMAN" : "SAFE";
    if (isIndonesian) {
      if (risk === "SAFE") return "AMAN";
      if (risk === "WATCH") return "PERHATIAN";
      if (risk === "AT RISK") return "BERISIKO";
    }
    return risk;
  };

  const defaultTitle = isBudgetRisk
    ? (isIndonesian ? "Penjelasan Risiko Anggaran" : "Budget Risk Explanation")
    : isSnapshot
      ? data.title || (isIndonesian ? "Ringkasan Periode Berjalan" : "Current Period Snapshot")
      : isExpense
        ? (isIndonesian ? "Faktor Perubahan Pengeluaran" : "Why Outflow Changed")
        : (isIndonesian ? "Faktor Perubahan Pemasukan" : "Why Inflow Changed");

  const title = data.title && isSnapshot ? data.title : defaultTitle;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
      <div className="px-5 space-y-4 pb-6 select-none">
        {isBudgetRisk ? (
          <>
            <div
              className="p-4 rounded-2xl flex items-center justify-between"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "var(--glass-fill)" }}
                >
                  {data.budgetRisk === "AT RISK" ? (
                    <ShieldAlert size={20} style={{ color: "var(--text-primary)" }} />
                  ) : data.budgetRisk === "WATCH" ? (
                    <AlertTriangle size={20} style={{ color: "var(--text-primary)" }} />
                  ) : (
                    <ShieldCheck size={20} style={{ color: "var(--text-primary)" }} />
                  )}
                </div>
                <div>
                  <h4
                    className="font-semibold text-[15px]"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Status: {getRiskLabel(data.budgetRisk)}
                  </h4>
                  <p
                    className="text-[11px]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {data.consumedPct?.toFixed(0)}% {isIndonesian ? "anggaran terpakai vs" : "budget consumed vs"}{" "}
                    {data.timePct?.toFixed(0)}% {isIndonesian ? "waktu berlalu" : "time elapsed"}
                  </p>
                </div>
              </div>
            </div>

            <p
              className="text-[13px] leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              {data.budgetRiskReason}
            </p>

            <div className="grid grid-cols-2 gap-2">
              <div
                className="p-3 rounded-xl"
                style={{ background: "var(--glass-fill)" }}
              >
                <p
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian ? "Anggaran Bulanan" : "Monthly Budget"}
                </p>
                <p
                  className="amount text-[14px] font-semibold mt-0.5"
                  style={{ color: "var(--text-primary)" }}
                >
                  {formatMoney(data.budget || 0)}
                </p>
              </div>
              <div
                className="p-3 rounded-xl"
                style={{ background: "var(--glass-fill)" }}
              >
                <p
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian ? "Pengeluaran Berjalan" : "Current Spending"}
                </p>
                <p
                  className="amount text-[14px] font-semibold mt-0.5"
                  style={{ color: "var(--text-primary)" }}
                >
                  {formatMoney(data.totalCurrent)}
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate("/settings");
                }}
                className="w-full py-3.5 rounded-2xl text-[13px] font-semibold flex items-center justify-center gap-2 active:scale-98 transition-transform"
                style={{
                  background: "var(--accent)",
                  color: "var(--accent-ink)",
                }}
              >
                <span>{isIndonesian ? "Sesuaikan Batas Anggaran" : "Adjust Budget Limit"}</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </>
        ) : isSnapshot ? (
          <>
            <div
              className="p-4 rounded-2xl"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p
                    className="text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {data.badge || (isIndonesian ? "Periode Berjalan" : "Current Period")}
                  </p>
                  <h4
                    className="amount font-semibold text-[18px] mt-1"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {data.displayValue
                      ? data.displayValue
                      : data.delta > 0 && !data.title?.toLowerCase().includes("outflow") && !data.title?.toLowerCase().includes("expense") && !data.title?.toLowerCase().includes("spending")
                        ? `+${formatMoney(data.totalCurrent)}`
                        : formatMoney(data.totalCurrent)}
                  </h4>
                </div>
                <span
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={{
                    background: "var(--glass-fill)",
                    color: "var(--text-primary)",
                  }}
                >
                  {data.badge || (data.delta > 0 ? "SURPLUS" : data.delta < 0 ? (isIndonesian ? "DEFISIT" : "DEFICIT") : (isIndonesian ? "RINGKASAN" : "SUMMARY"))}
                </span>
              </div>
              {data.subtitle && (
                <p
                  className="text-[12px] leading-relaxed mt-3"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {data.subtitle}
                </p>
              )}
            </div>

            {/* Itemized Categories or Breakdown if provided */}
            {data.items && data.items.length > 0 && (
              <div
                className="p-3.5 rounded-2xl space-y-2.5"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider pb-1 border-b border-black/5 dark:border-white/5">
                  <span>{isIndonesian ? "Rincian Kategori" : "Category Breakdown"}</span>
                  <span>{isIndonesian ? "Nominal & Porsi" : "Amount & Share"}</span>
                </div>
                {data.items.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="font-medium text-[var(--text-primary)] truncate max-w-[170px]">
                        {item.label}
                      </span>
                      <div className="text-right">
                        <span className="font-semibold amount text-[var(--text-primary)]">
                          {item.valueText || (item.amount !== undefined ? formatMoney(item.amount) : "")}
                        </span>
                        {item.pct !== undefined && (
                          <span className="text-[10px] text-[var(--text-tertiary)] ml-1.5 font-medium">
                            ({item.pct.toFixed(0)}%)
                          </span>
                        )}
                      </div>
                    </div>
                    {item.pct !== undefined && (
                      <div className="w-full h-1 rounded-full overflow-hidden bg-black/[0.06] dark:bg-white/10">
                        <div
                          className="h-full rounded-full bg-[var(--text-primary)] transition-all"
                          style={{ width: `${Math.min(100, Math.max(0, item.pct))}%` }}
                        />
                      </div>
                    )}
                    {item.detail && (
                      <p className="text-[10px] text-[var(--text-tertiary)] leading-tight">
                        {item.detail}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!data.hideGrid && (!data.items || data.items.length === 0) && (
              <div className="grid grid-cols-2 gap-2">
                <div
                  className="p-3 rounded-xl"
                  style={{ background: "var(--glass-fill)" }}
                >
                  <p
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {isIndonesian ? "Total Saat Ini" : "Current Total"}
                  </p>
                  <p
                    className="amount text-[14px] font-semibold mt-0.5"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {formatMoney(data.totalCurrent)}
                  </p>
                </div>
                <div
                  className="p-3 rounded-xl"
                  style={{ background: "var(--glass-fill)" }}
                >
                  <p
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {isIndonesian ? "Perubahan Acuan" : "Reference Change"}
                  </p>
                  <p
                    className="amount text-[14px] font-semibold mt-0.5"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {data.delta >= 0 ? "+" : ""}
                    {formatMoney(data.delta)}
                  </p>
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (data.onCta) {
                    data.onCta();
                  } else {
                    navigate("/statistics");
                  }
                }}
                className="w-full py-3.5 rounded-2xl text-[13px] font-semibold flex items-center justify-center gap-2 active:scale-98 transition-transform cursor-pointer"
                style={{
                  background: "var(--text-primary)",
                  color: "var(--bg-base)",
                }}
              >
                <span>{data.ctaLabel || (isIndonesian ? "Lihat Analisis Lengkap" : "View Full Analytics Breakdown")}</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </>
        ) : (
          <>
            <div
              className="p-4 rounded-2xl flex items-center justify-between"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <div>
                <h4
                  className="font-semibold text-[15px]"
                  style={{ color: "var(--text-primary)" }}
                >
                  {data.delta >= 0 ? "+" : ""}
                  {formatMoney(data.delta)}
                </h4>
                <p
                  className="text-[11px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {data.delta >= 0 ? (isIndonesian ? "Meningkat" : "Increased") : (isIndonesian ? "Menurun" : "Decreased")} {isIndonesian ? "vs bulan sebelumnya" : "vs previous month"}
                </p>
              </div>
              <span
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                style={{
                  background: "var(--glass-fill)",
                  color: "var(--text-primary)",
                }}
              >
                {data.delta >= 0 ? "↑" : "↓"} {Math.abs(data.pctChange)}% MoM
              </span>
            </div>

            {data.topContributors && data.topContributors.length > 0 && (
              <div className="space-y-2 pt-1 border-t border-[var(--glass-border)]">
                <p
                  className="text-[11px] font-bold uppercase tracking-wider px-0.5"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian ? "Kontributor Kategori Teratas" : "Top Category Contributors"}
                </p>
                <div className="space-y-1.5">
                  {data.topContributors.map((c, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl flex items-center justify-between"
                      style={{ background: "var(--glass-fill)" }}
                    >
                      <span
                        className="font-bold text-[12px]"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {c.name}
                      </span>
                      <div className="text-right">
                        <span
                          className="amount font-semibold text-[13px]"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {c.deltaAmount >= 0 ? "+" : ""}
                          {formatMoney(c.deltaAmount)}
                        </span>
                        <span
                          className="text-[10px] ml-1 font-bold"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          ({c.deltaAmount >= 0 ? "↑" : "↓"} {c.pctChange}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate("/statistics");
                }}
                className="w-full py-3.5 rounded-2xl text-[13px] font-semibold flex items-center justify-center gap-2 active:scale-98 transition-transform"
                style={{
                  background: "var(--accent)",
                  color: "var(--accent-ink)",
                }}
              >
                <span>{isIndonesian ? "Lihat Analisis Lengkap" : "View Full Analytics Breakdown"}</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
