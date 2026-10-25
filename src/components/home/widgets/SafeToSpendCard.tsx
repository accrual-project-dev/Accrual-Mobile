import { useMemo } from "react";
import { Wallet } from "lucide-react";
import type { WidgetSize } from "../../../lib/widgetLayoutTypes";
import { CompactShell } from "./CompactShell";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useCurrency } from "../../../contexts/CurrencyContext";

interface SafeToSpendCardProps {
  spent: number;
  budget: number;
  size?: WidgetSize;
  onOpenDetail?: () => void;
}

export function SafeToSpendCard({
  spent,
  budget,
  size = "half",
  onOpenDetail,
}: SafeToSpendCardProps) {
  const { isIndonesian } = useLanguage();
  const { formatWithPreferred } = useCurrency();

  const { leftToSpend, spentPercent, safeDaily, daysLeft } = useMemo(() => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = Math.max(1, daysInMonth - now.getDate());
    const activeBudget = budget > 0 ? budget : Math.max(5000000, spent > 0 ? spent * 1.3 : 10000000);
    const left = Math.max(0, activeBudget - spent);
    const daily = Math.round(left / daysRemaining);
    const pct = Math.min(100, Math.round((spent / activeBudget) * 100));

    return {
      leftToSpend: left,
      spentPercent: pct,
      safeDaily: daily,
      daysLeft: daysRemaining,
    };
  }, [spent, budget]);

  // Semicircle Arc Progress (180 to 360 degrees)
  const radius = 30;
  const circumference = Math.PI * radius; // Half circle perimeter
  const strokeDashoffset = circumference - (circumference * spentPercent) / 100;

  if (size === "half") {
    return (
      <div onClick={onOpenDetail} className="cursor-pointer h-full">
        <CompactShell
          title={isIndonesian ? "Aman Belanja" : "Safe to Spend"}
          onOpenDetail={onOpenDetail}
        >
          <div className="flex-1 flex flex-col justify-between py-1">
            {/* Top Row: Gauge + Left to spend */}
            <div className="flex items-center gap-3">
              {/* Semicircle Gauge */}
              <div className="relative w-16 h-9 shrink-0 flex items-end justify-center">
                <svg className="w-16 h-9 overflow-visible" viewBox="0 0 68 36">
                  {/* Track Arc */}
                  <path
                    d="M 4 34 A 30 30 0 0 1 64 34"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    strokeLinecap="round"
                    className="text-white/10 dark:text-white/10"
                  />
                  {/* Progress Arc */}
                  <path
                    d="M 4 34 A 30 30 0 0 1 64 34"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className="text-[var(--text-primary)] transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-end pb-0.5">
                  <span className="text-[10px] font-bold text-[var(--text-primary)] leading-none font-mono">
                    {spentPercent}%
                  </span>
                  <span className="text-[7px] text-[var(--text-tertiary)] leading-none mt-0.5">
                    {isIndonesian ? "Pakai" : "Spent"}
                  </span>
                </div>
              </div>

              {/* Sisa Anggaran */}
              <div className="min-w-0">
                <span className="text-[8.5px] uppercase tracking-wider font-semibold text-[var(--text-tertiary)] block truncate">
                  {isIndonesian ? "Sisa Anggaran" : "Left to Spend"}
                </span>
                <span className="text-[13.5px] font-bold text-[var(--text-primary)] truncate block leading-tight font-mono">
                  {formatWithPreferred(leftToSpend)}
                </span>
              </div>
            </div>

            {/* Bottom Row: Daily Safe Capsule + Days Left */}
            <div className="flex items-center gap-1.5 pt-1.5 border-t border-black/5 dark:border-white/5">
              <div
                className="flex-1 px-2 py-1 rounded-lg flex items-center justify-between min-w-0"
                style={{
                  background: "var(--glass-fill)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                <span className="text-[8px] text-[var(--text-tertiary)] truncate">
                  {isIndonesian ? "Aman/hr:" : "Safe/d:"}
                </span>
                <span className="text-[9.5px] font-bold text-[var(--text-primary)] font-mono truncate ml-1">
                  {formatWithPreferred(safeDaily)}
                </span>
              </div>

              <div
                className="px-2 py-1 rounded-lg flex items-center gap-1 shrink-0"
                style={{
                  background: "var(--glass-fill)",
                  border: "1px solid var(--glass-border)",
                }}
              >
                <span className="text-[8px] text-[var(--text-tertiary)]">
                  {isIndonesian ? "Sisa:" : "Days:"}
                </span>
                <span className="text-[9.5px] font-bold text-[var(--text-primary)] font-mono">
                  {daysLeft}
                </span>
              </div>
            </div>
          </div>
        </CompactShell>
      </div>
    );
  }

  // Full / Expanded Size View (Foto 3 Style)
  return (
    <section
      onClick={onOpenDetail}
      className="glass-surface p-4 rounded-[22px] select-none space-y-3 cursor-pointer"
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
            <Wallet size={14} className="text-[var(--text-primary)]" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)] leading-tight">
              {isIndonesian ? "Aman Dibelanjakan" : "Safe to Spend"}
            </h3>
            <p className="text-[10px] text-[var(--text-tertiary)]">
              {isIndonesian
                ? "Batas pengeluaran harian agar tetap sesuai anggaran"
                : "How much you can spend per day to stay on budget"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 items-center">
        {/* Left: Gauge Arc */}
        <div className="relative w-28 h-16 mx-auto flex items-end justify-center">
          <svg className="w-28 h-16 overflow-visible" viewBox="0 0 100 52">
            <path
              d="M 6 50 A 44 44 0 0 1 94 50"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              className="text-white/10 dark:text-white/10"
            />
            <path
              d="M 6 50 A 44 44 0 0 1 94 50"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={Math.PI * 44}
              strokeDashoffset={Math.PI * 44 - (Math.PI * 44 * spentPercent) / 100}
              className="text-[var(--text-primary)] transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
            <span className="text-[16px] font-bold text-[var(--text-primary)] leading-none font-mono">
              {spentPercent}%
            </span>
            <span className="text-[9px] text-[var(--text-tertiary)] leading-none mt-0.5">
              {isIndonesian ? "Terpakai" : "Spent"}
            </span>
          </div>
        </div>

        {/* Right: Left to spend info */}
        <div className="space-y-1">
          <span className="text-[9.5px] uppercase font-semibold text-[var(--text-tertiary)] block">
            {isIndonesian ? "Sisa Anggaran" : "Left to Spend"}
          </span>
          <span className="text-[20px] font-bold text-[var(--text-primary)] font-mono block leading-tight">
            {formatWithPreferred(leftToSpend)}
          </span>
          <span className="text-[10px] text-[var(--text-tertiary)] font-mono block">
            {isIndonesian ? "dari" : "of"} {formatWithPreferred(budget > 0 ? budget : spent + leftToSpend)}
          </span>
        </div>
      </div>

      {/* Bottom Pills */}
      <div className="flex items-center gap-2 pt-1">
        <div
          className="flex-1 p-2.5 rounded-xl flex items-center justify-between"
          style={{
            background: "var(--glass-fill)",
            border: "1px solid var(--glass-border)",
          }}
        >
          <div>
            <span className="text-[8.5px] text-[var(--text-tertiary)] block">
              {isIndonesian ? "Aman dibelanjakan" : "Safe to spend"}
            </span>
            <span className="text-[13px] font-bold text-[var(--text-primary)] font-mono">
              {formatWithPreferred(safeDaily)}{isIndonesian ? "/hari" : "/day"}
            </span>
          </div>
        </div>

        <div
          className="p-2.5 rounded-xl text-center min-w-[72px]"
          style={{
            background: "var(--glass-fill)",
            border: "1px solid var(--glass-border)",
          }}
        >
          <span className="text-[8.5px] text-[var(--text-tertiary)] block">
            {isIndonesian ? "Sisa hari" : "Days left"}
          </span>
          <span className="text-[14px] font-bold text-[var(--text-primary)] font-mono">
            {daysLeft}
          </span>
        </div>
      </div>
    </section>
  );
}
