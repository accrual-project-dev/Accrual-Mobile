import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, TrendingUp, ChevronRight } from "lucide-react";
import { useCurrency } from "../../contexts/CurrencyContext";
import { usePrivacy } from "../../contexts/PrivacyContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import {
  getSavedHoldings,
  getSavedUsdtPref,
  calculateHoldingValuation,
} from "../../lib/marketPriceService";
import { triggerHaptic } from "../../lib/haptics";

export function InvestmentPulseCard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isStealthMode } = usePrivacy();
  const { isIndonesian } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const { formatWithPreferred, currencyMeta } = useCurrency();

  const { totalValue, totalPnL, pnlPct, hasHoldings } = useMemo(() => {
    const holdings = getSavedHoldings(user?.id);
    const usdtPref = getSavedUsdtPref(user?.id);

    let valSum = 0;
    let costSum = 0;

    // USDT holding value if configured (avoid double counting if USDT is also in holdings)
    const hasUsdtInHoldings = holdings.some((h) => h.symbol?.toUpperCase() === "USDT");
    if (usdtPref.units > 0 && !hasUsdtInHoldings) {
      const usdtVal = usdtPref.units * (usdtPref.rate > 0 ? usdtPref.rate : 16300);
      valSum += usdtVal;
      costSum += usdtPref.costBasis > 0 ? usdtPref.costBasis : usdtVal;
    }

    // Other holdings
    holdings.forEach((h) => {
      const val = calculateHoldingValuation(h);
      valSum += val.marketValue;
      costSum += val.costBasis;
    });

    const pnl = valSum - costSum;
    const pct = costSum > 0 ? (pnl / costSum) * 100 : 0;
    const hasAny = valSum > 0 || holdings.length > 0 || usdtPref.units > 0;

    return {
      totalValue: valSum,
      totalPnL: pnl,
      pnlPct: pct,
      hasHoldings: hasAny,
    };
  }, [user?.id]);

  const handleNavigateToAssets = () => {
    triggerHaptic("light");
    navigate("/assets");
  };

  return (
    <section
      className="p-4 rounded-3xl glass-surface border border-[var(--glass-border)] transition-all cursor-pointer active:scale-[0.99] space-y-2.5 relative overflow-hidden"
      style={{
        background: "var(--bg-elevated)",
        boxShadow: "var(--shadow-card)",
      }}
      onClick={handleNavigateToAssets}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "var(--glass-fill)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <TrendingUp size={14} className="text-[var(--text-primary)]" />
          </div>
          <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            {isIndonesian ? "Denyut Investasi" : "Investment Pulse"}
          </span>
        </div>

        <div className="flex items-center gap-1 text-[11.5px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
          <span>{isIndonesian ? "Lihat Aset" : "View Assets"}</span>
          <ChevronRight size={13} strokeWidth={2} />
        </div>
      </div>

      {hasHoldings ? (
        /* Has Assets Telemetry */
        <div className="flex items-end justify-between gap-3 pt-0.5">
          <div className="space-y-0.5 min-w-0">
            <span className="text-[10px] text-[var(--text-tertiary)] font-medium block">
              {isIndonesian ? "Total Nilai Portofolio" : "Total Portfolio Valuation"}
            </span>
            <p className="text-[24px] sm:text-[26px] font-light tracking-tight leading-none text-[var(--text-primary)] amount truncate">
              {isStealthMode ? `${currencyMeta?.symbol || "Rp"} ••••••••` : formatWithPreferred(totalValue)}
            </p>
          </div>

          {/* Delta Line */}
          <div
            className="flex items-center gap-1 text-[11.5px] font-semibold shrink-0 pb-0.5"
            style={{
              color: isDark
                ? totalPnL >= 0 ? "#FFFFFF" : "#A1A1AA"
                : totalPnL >= 0 ? "#121214" : "#71717A",
            }}
          >
            <ArrowUpRight
              size={13}
              className={totalPnL < 0 ? "rotate-90" : ""}
            />
            <span>
              {isStealthMode
                ? "••••"
                : `${totalPnL >= 0 ? "+" : ""}${formatWithPreferred(totalPnL)}`}
            </span>
            <span className="opacity-80">
              ({isStealthMode ? "••••" : `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%`})
            </span>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="py-2 flex items-center justify-between gap-3">
          <p className="text-[12px] text-[var(--text-tertiary)] font-medium leading-tight">
            {isIndonesian
              ? "Belum ada aset investasi terdaftar. Pantau saham, crypto & emas."
              : "No investment assets recorded yet. Track stocks, crypto & gold."}
          </p>
          <span className="text-[11px] font-semibold text-[var(--text-primary)] shrink-0 underline underline-offset-2">
            {isIndonesian ? "Mulai Catat →" : "Track Assets →"}
          </span>
        </div>
      )}
    </section>
  );
}
