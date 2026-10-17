import { useState } from "react";
import { ChevronRight, Droplets, ShieldCheck } from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { triggerHaptic } from "../../lib/haptics";
import type { LiquidityHorizonResult } from "../../hooks/useFinancialIntelligence";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useCurrency } from "../../contexts/CurrencyContext";

interface LiquidityHorizonCardProps {
  liquidityHorizon: LiquidityHorizonResult;
  hideBalance?: boolean;
}

export function LiquidityHorizonCard({
  liquidityHorizon,
  hideBalance = false,
}: LiquidityHorizonCardProps) {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const { formatWithPreferred, currencyMeta } = useCurrency();
  const isDark = theme !== "light";
  const isIndonesian = language === "id";

  const formatMoney = (amount: number) => {
    return hideBalance ? `${currencyMeta?.symbol || "Rp"} ••••••••` : formatWithPreferred(amount);
  };

  const [detailOpen, setDetailOpen] = useState(false);

  const localizedTier = (tier: string) => {
    if (!isIndonesian) return tier;
    switch (tier.toLowerCase()) {
      case "fortress":
        return "Cadangan Kuat";
      case "comfortable":
        return "Aman & Nyaman";
      case "watch":
        return "Perlu Pemantauan";
      case "critical":
        return "Kritis";
      case "low":
        return "Rendah";
      case "moderate":
        return "Moderat";
      case "healthy":
        return "Sehat";
      case "strong":
        return "Kuat";
      case "exceptional":
        return "Sangat Tangguh";
      default:
        return tier;
    }
  };

  // ── Liquid Glass Tactile Materials (Sama Persis dengan WealthHistoryTrajectoryCard) ──
  const cardBg = isDark
    ? "linear-gradient(160deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.015) 100%)"
    : "linear-gradient(160deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 247, 250, 0.90) 100%)";

  const cardBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.08)"
    : "1px solid rgba(0, 0, 0, 0.06)";

  const controlBg = isDark
    ? "linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.035) 100%)"
    : "linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(246, 247, 250, 0.72) 100%)";

  const controlBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.09)"
    : "1px solid rgba(0, 0, 0, 0.065)";

  const controlShadow = isDark
    ? "inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 2px 6px rgba(0, 0, 0, 0.22)"
    : "inset 0 1px 0 #ffffff, 0 1px 3px rgba(30, 35, 50, 0.035)";

  const hairlineDivider = isDark
    ? "rgba(255, 255, 255, 0.07)"
    : "rgba(0, 0, 0, 0.05)";

  return (
    <>
      <section
        onClick={() => {
          triggerHaptic("light");
          setDetailOpen(true);
        }}
        className="relative overflow-hidden p-4 sm:p-5 rounded-[28px] cursor-pointer active:scale-[0.985] transition-all mb-3 select-none"
        style={{
          background: cardBg,
          border: cardBorder,
          boxShadow: isDark
            ? "0 18px 44px -10px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.12)"
            : "0 10px 30px -8px rgba(31, 36, 48, 0.06), inset 0 1px 0 #ffffff",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
        }}
      >
        {/* Specular Rim Light (Pantulan Cahaya Tepi Kaca Atas) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[12%] right-[12%] top-[1px] h-[1.5px] rounded-full"
          style={{
            background: isDark
              ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), rgba(255,255,255,0.45), rgba(255,255,255,0.25), transparent)"
              : "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), rgba(255,255,255,1), rgba(255,255,255,0.8), transparent)",
          }}
        />

        {/* ── 1. Header Bar: Squircle Icon & Status Label ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: controlBg,
                border: controlBorder,
                boxShadow: controlShadow,
                color: "var(--text-primary)",
              }}
            >
              <Droplets size={13.5} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <span
                className="text-[9.5px] font-semibold uppercase tracking-[0.12em] block"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "Horizon Likuiditas" : "Liquidity Horizon"}
              </span>
              <p
                className="text-[12.5px] font-bold tracking-tight truncate leading-tight mt-0.5"
                style={{ color: "var(--text-primary)" }}
              >
                {liquidityHorizon.status === "sufficient"
                  ? localizedTier(liquidityHorizon.resilienceTier)
                  : isIndonesian
                    ? "Menunggu Garis Dasar"
                    : "Awaiting Baseline"}
              </p>
            </div>
          </div>

          <div
            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: controlBg,
              border: controlBorder,
              color: "var(--text-tertiary)",
            }}
          >
            <ChevronRight size={13} strokeWidth={2} />
          </div>
        </div>

        {/* ── 2. Hero Big Metric & Horizon Details ── */}
        {liquidityHorizon.status === "sufficient" ? (
          <>
            <div className="flex items-baseline gap-2 mt-3">
              <span
                className="amount text-[28px] sm:text-[32px] font-bold tracking-tight leading-none tabular-nums"
                style={{ color: "var(--text-primary)" }}
              >
                {hideBalance
                  ? "•••"
                  : `${liquidityHorizon.totalCoverageMonths.toFixed(1)} ${isIndonesian ? "bln" : "mo"}`}
              </span>
              <span
                className="text-[11px] font-medium"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian ? "cakupan total" : "total coverage"}
              </span>
            </div>

            <p
              className="text-[11px] font-normal mt-1 leading-snug"
              style={{ color: "var(--text-secondary)" }}
            >
              {hideBalance
                ? "•••"
                : isIndonesian
                  ? `Cakupan komitmen rutin: ${liquidityHorizon.committedCoverageMonths.toFixed(1)} bulan biaya hidup`
                  : `${liquidityHorizon.committedCoverageMonths.toFixed(1)} months committed outflow coverage`}
            </p>

            {/* ── 3. Bottom Telemetry Grid (Unboxed, Pure Typography) ── */}
            <div
              className="grid grid-cols-2 gap-3 mt-3 pt-2.5 border-t text-left"
              style={{ borderColor: hairlineDivider }}
            >
              <div>
                <span
                  className="text-[8.5px] font-semibold uppercase tracking-wider block truncate"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian ? "Aset Likuid" : "Liquid Assets"}
                </span>
                <p
                  className="amount text-[12px] font-semibold mt-0.5 tabular-nums truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {formatMoney(liquidityHorizon.liquidAssets)}
                </p>
              </div>

              <div className="text-right">
                <span
                  className="text-[8.5px] font-semibold uppercase tracking-wider block truncate"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian ? "Pengeluaran Tipikal" : "Typical Outflow"}
                </span>
                <p
                  className="amount text-[12px] font-semibold mt-0.5 tabular-nums truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {formatMoney(liquidityHorizon.typicalMonthlyOutflow)}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="mt-3">
            <p
              className="amount text-[20px] font-bold tabular-nums"
              style={{ color: "var(--text-primary)" }}
            >
              {formatMoney(liquidityHorizon.liquidAssets)}
            </p>
            <p
              className="text-[11px] leading-relaxed mt-1"
              style={{ color: "var(--text-secondary)" }}
            >
              {liquidityHorizon.explanation}
            </p>
          </div>
        )}
      </section>

      {/* ── Modal Detail Inset Glass ── */}
      <BottomSheet isOpen={detailOpen} onClose={() => setDetailOpen(false)}>
        <div className="px-5 pb-8 space-y-3.5 max-w-lg mx-auto select-none">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: controlBg,
                border: controlBorder,
                boxShadow: controlShadow,
                color: "var(--text-primary)",
              }}
            >
              <ShieldCheck size={16} strokeWidth={2} />
            </div>
            <div>
              <h3
                className="text-[15px] font-bold tracking-tight leading-tight"
                style={{ color: "var(--text-primary)" }}
              >
                {isIndonesian ? "Horizon Likuiditas" : "Liquidity Horizon"}
              </h3>
              <p
                className="text-[10.5px] font-medium mt-0.5"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isIndonesian
                  ? "Cakupan pengeluaran total vs rutin/komitmen"
                  : "Total vs committed outflow coverage"}
              </p>
            </div>
          </div>

          {/* 4-Bento Summary Cells */}
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                label: isIndonesian ? "Aset Likuid" : "Liquid Assets",
                value: formatMoney(liquidityHorizon.liquidAssets),
                isAmount: true,
              },
              {
                label: isIndonesian ? "Tingkat Ketahanan" : "Resilience Tier",
                value:
                  liquidityHorizon.status === "sufficient"
                    ? localizedTier(liquidityHorizon.resilienceTier)
                    : "N/A",
                isAmount: false,
              },
              {
                label: isIndonesian ? "Pengeluaran Tipikal" : "Typical Outflow",
                value: formatMoney(liquidityHorizon.typicalMonthlyOutflow),
                isAmount: true,
              },
              {
                label: isIndonesian ? "Pengeluaran Rutin" : "Committed Outflow",
                value: formatMoney(liquidityHorizon.typicalCommittedOutflow),
                isAmount: true,
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-2xl"
                style={{
                  background: controlBg,
                  border: controlBorder,
                  boxShadow: controlShadow,
                }}
              >
                <span
                  className="text-[8.5px] font-bold uppercase tracking-wider block"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {item.label}
                </span>
                <p
                  className={`${item.isAmount ? "amount font-bold text-[13.5px]" : "font-semibold text-[13px]"} mt-0.5 tabular-nums truncate`}
                  style={{ color: "var(--text-primary)" }}
                >
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {/* Big Horizon Statement Box */}
          <div
            className="p-3.5 rounded-2xl"
            style={{
              background: controlBg,
              border: controlBorder,
              boxShadow: controlShadow,
            }}
          >
            <div className="flex justify-between items-baseline gap-3">
              <div>
                <span
                  className="text-[8.5px] font-bold uppercase tracking-wider block"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian ? "Horizon Cakupan Total" : "Total Horizon"}
                </span>
                <p
                  className="amount text-[20px] font-bold mt-0.5 tabular-nums"
                  style={{ color: "var(--text-primary)" }}
                >
                  {liquidityHorizon.status === "sufficient" && !hideBalance
                    ? `${liquidityHorizon.totalCoverageMonths.toFixed(1)} ${isIndonesian ? "bulan" : "months"}`
                    : hideBalance
                      ? "••••"
                      : isIndonesian
                        ? "Belum siap"
                        : "Not ready"}
                </p>
              </div>

              <div className="text-right">
                <span
                  className="text-[8.5px] font-bold uppercase tracking-wider block"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian ? "Komitmen" : "Committed"}
                </span>
                <p
                  className="amount text-[14px] font-semibold mt-0.5 tabular-nums"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {liquidityHorizon.status === "sufficient" && !hideBalance
                    ? `${liquidityHorizon.committedCoverageMonths.toFixed(1)} ${isIndonesian ? "bulan" : "months"}`
                    : hideBalance
                      ? "••••"
                      : isIndonesian
                        ? "Belum siap"
                        : "Not ready"}
                </p>
              </div>
            </div>

            <p
              className="text-[11px] leading-relaxed mt-2 pt-2 border-t"
              style={{
                borderColor: hairlineDivider,
                color: "var(--text-secondary)",
              }}
            >
              {liquidityHorizon.explanation}
            </p>
          </div>

          {/* Liquid Account Breakdown Inset List */}
          <div className="space-y-1.5 pt-1">
            <span
              className="text-[9.5px] font-bold uppercase tracking-wider px-1 block"
              style={{ color: "var(--text-tertiary)" }}
            >
              {isIndonesian
                ? "Rincian Akun Likuid"
                : "Liquid Account Breakdown"}
            </span>

            {liquidityHorizon.liquidAccounts.length > 0 ? (
              liquidityHorizon.liquidAccounts.map((account) => (
                <div
                  key={account.name}
                  className="flex items-center justify-between p-2.5 px-3 rounded-2xl"
                  style={{
                    background: controlBg,
                    border: controlBorder,
                    boxShadow: controlShadow,
                  }}
                >
                  <div className="min-w-0 pr-2">
                    <p
                      className="text-[12px] font-semibold truncate leading-tight"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {account.name}
                    </p>
                    <p
                      className="text-[9.5px] font-medium leading-none mt-0.5 truncate"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {isIndonesian
                        ? "Termasuk dalam cakupan likuid"
                        : "Included in liquid coverage"}
                    </p>
                  </div>
                  <span
                    className="amount text-[12.5px] font-bold tabular-nums shrink-0"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {formatMoney(account.balance)}
                  </span>
                </div>
              ))
            ) : (
              <div
                className="p-3.5 rounded-2xl text-center text-[11px]"
                style={{
                  background: controlBg,
                  border: controlBorder,
                  color: "var(--text-tertiary)",
                }}
              >
                {isIndonesian
                  ? "Belum ada rincian akun likuid tersedia."
                  : "No liquid account breakdown available yet."}
              </div>
            )}
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
