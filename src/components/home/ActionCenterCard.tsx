import { useState } from "react";
import {
  AlertCircle,
  TrendingUp,
  ShieldAlert,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import type { ActionCenterInsight } from "../../lib/financialMath";
import type { Transaction } from "../../lib/types";
import { triggerHaptic } from "../../lib/haptics";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import { MonthForecastSheet } from "./MonthForecastSheet";

interface ActionCenterCardProps {
  insight: ActionCenterInsight;
  onOpenCategoryDetail?: (categoryId: string) => void;
  transactions?: Transaction[];
  budgetTarget?: number;
  dailyAverage?: number;
  projectedMonthEnd?: number;
  totalExpense?: number;
  totalIncome?: number;
}

export function ActionCenterCard({
  insight,
  onOpenCategoryDetail: _onOpenCategoryDetail,
  transactions = [],
  budgetTarget = 0,
  dailyAverage,
  projectedMonthEnd,
  totalExpense = 0,
  totalIncome = 0,
}: ActionCenterCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const { isIndonesian } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme !== "light";

  const cardBg = isDark
    ? "linear-gradient(160deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.015) 100%)"
    : "linear-gradient(160deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 247, 250, 0.90) 100%)";

  const cardBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.08)"
    : "1px solid rgba(0, 0, 0, 0.06)";

  const cardShadow = isDark
    ? "0 18px 44px -10px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.12)"
    : "0 10px 30px -8px rgba(31, 36, 48, 0.06), inset 0 1px 0 #ffffff";

  const getIcon = () => {
    switch (insight.type) {
      case "projected_overrun":
      case "budget_risk":
        return (
          <ShieldAlert size={14} style={{ color: "var(--text-primary)" }} />
        );
      case "spending_pace":
        return (
          <TrendingUp size={14} style={{ color: "var(--text-primary)" }} />
        );
      case "category_spike":
        return (
          <AlertCircle size={14} style={{ color: "var(--text-primary)" }} />
        );
      case "safety_buffer":
        return (
          <AlertCircle size={14} style={{ color: "var(--text-primary)" }} />
        );
      default:
        return (
          <CheckCircle2 size={14} style={{ color: "var(--text-primary)" }} />
        );
    }
  };

  return (
    <>
      <section
        role="button"
        tabIndex={0}
        onClick={() => {
          setDetailOpen(true);
          triggerHaptic("light");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setDetailOpen(true);
            triggerHaptic("light");
          }
        }}
        className="p-4 rounded-[24px] relative overflow-hidden active:scale-[0.99] transition-all cursor-pointer select-none mb-3 outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        style={{
          background: cardBg,
          border: cardBorder,
          boxShadow: cardShadow,
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
        }}
      >
        {/* Specular Rim Light Reflection */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[12%] right-[12%] top-[1px] h-[1.5px] rounded-full"
          style={{
            background: isDark
              ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), rgba(255,255,255,0.45), rgba(255,255,255,0.25), transparent)"
              : "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), rgba(255,255,255,1), rgba(255,255,255,0.8), transparent)",
          }}
        />

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
                border: cardBorder,
                color: "var(--text-primary)",
              }}
            >
              {getIcon()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                  {isIndonesian ? "Perlu Tindakan" : "Action Required"}
                </span>
                {insight.badge && (
                  <>
                    <span className="text-[10px] text-[var(--text-tertiary)]">·</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                      {insight.badge}
                    </span>
                  </>
                )}
              </div>
              <h3
                className="text-[13px] font-bold leading-tight truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {insight.title}
              </h3>
              <p
                className="text-[11px] font-medium mt-0.5 leading-tight truncate"
                style={{ color: "var(--text-secondary)" }}
              >
                {insight.subtitle}
              </p>
            </div>
          </div>

          <ChevronRight size={14} style={{ color: "var(--text-tertiary)" }} className="shrink-0" />
        </div>
      </section>

      {/* Interactive Month Forecast & Trajectory Sheet (Elevated Financial Summary) */}
      <MonthForecastSheet
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        transactions={transactions}
        budgetTarget={budgetTarget}
        dailyAverage={dailyAverage}
        projectedMonthEnd={projectedMonthEnd}
        totalExpense={totalExpense}
        totalIncome={totalIncome}
        actionInsight={insight}
      />
    </>
  );
}
