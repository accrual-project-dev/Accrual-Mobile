// ======================================================================
// TROUVAILLE PORTFOLIO INTELLIGENCE DECK
// Consolidated from Statistics to AssetsPage:
// 1. Unrealized Performance (Floating Yield & ROI)
// 2. Risk & Volatility Exposure Profile (Defensive vs Volatile Tiers)
// 3. Wealth Intelligence & Tactical Insights
// Strictly compliant with GEMINI.md: Monochrome Apple Luxury Theme
// ======================================================================

import { useState, useMemo } from "react";
import {
  TrendingUp,
  ShieldCheck,
  Zap,
  Scale,
  ArrowUpRight,
} from "lucide-react";
import { triggerHaptic } from "../../lib/haptics";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import { usePrivacy } from "../../contexts/PrivacyContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import { useAuth } from "../../contexts/AuthContext";
import {
  getSavedUsdtPref,
  calculateHoldingValuation,
} from "../../lib/marketPriceService";
import type { InvestmentHolding, Wallet } from "../../lib/types";
import { useWalletBalances } from "../../hooks/useWalletBalances";

interface PortfolioIntelligenceDeckProps {
  holdings: InvestmentHolding[];
  wallets: Wallet[];
  netWorth: number;
}

export function PortfolioIntelligenceDeck({
  holdings = [],
  wallets = [],
  netWorth: _netWorth = 0,
}: PortfolioIntelligenceDeckProps) {
  const { isIndonesian } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const { isStealthMode: hideBalance } = usePrivacy();
  const { formatWithPreferred } = useCurrency();
  const { user } = useAuth();
  const [activeTelemetryTab, setActiveTelemetryTab] = useState<"performance" | "risk">("performance");

  // 1. USDT & Recorded Wallet Balances
  const usdtPref = getSavedUsdtPref(user?.id);
  const usdtHolding = useMemo(
    () => holdings.find((h) => h.symbol?.toUpperCase() === "USDT"),
    [holdings],
  );
  const { balancesById } = useWalletBalances();

  const isCryptoOrInvWallet = (w: Wallet) => {
    const lower = (w.name || "").toLowerCase();
    return (
      w.classification === "investment" ||
      lower.includes("crypto") ||
      lower.includes("usdt") ||
      lower.includes("tether") ||
      lower.includes("binance") ||
      lower.includes("tokocrypto") ||
      lower.includes("bybit") ||
      lower.includes("indodax") ||
      lower.includes("pintu")
    );
  };

  const recordedCryptoBalance = useMemo(() => {
    return wallets
      .filter(isCryptoOrInvWallet)
      .reduce(
        (sum, w) => sum + Math.max(0, balancesById[w.id] ?? Number(w.balance || 0)),
        0,
      );
  }, [wallets, balancesById]);

  const usdtUnits = usdtHolding?.units || usdtPref.units || 0;
  const usdtRate = usdtHolding?.current_price || usdtPref.rate || 16300;
  const usdtCostBasis =
    usdtHolding?.avg_buy_price && usdtUnits > 0
      ? Math.round(usdtUnits * usdtHolding.avg_buy_price)
      : usdtPref.costBasis && usdtPref.costBasis > 0
        ? usdtPref.costBasis
        : recordedCryptoBalance > 0
          ? recordedCryptoBalance
          : 0;
  const usdtMarketValue =
    usdtUnits > 0 ? Math.round(usdtUnits * usdtRate) : recordedCryptoBalance;
  const usdtFloatingPnL = usdtMarketValue - usdtCostBasis;

  // 2. Other Holdings Valuations
  const otherValuations = useMemo(() => {
    return holdings
      .filter((h) => h.symbol?.toUpperCase() !== "USDT")
      .map((h) => {
        const val = calculateHoldingValuation(h);
        return {
          ...h,
          costBasis: val.costBasis,
          marketValue: val.marketValue,
          floatingPnL: val.floatingPnL,
        };
      });
  }, [holdings]);

  const totalOtherCostBasis = otherValuations.reduce((sum, h) => sum + h.costBasis, 0);
  const totalOtherMarketValue = otherValuations.reduce((sum, h) => sum + h.marketValue, 0);
  const totalOtherFloatingPnL = otherValuations.reduce((sum, h) => sum + h.floatingPnL, 0);

  // Total Invested Capital & Floating P&L
  const totalInvestedCostBasis = usdtCostBasis + totalOtherCostBasis;
  const totalMarketValuation = usdtMarketValue + totalOtherMarketValue;
  const totalFloatingPnL = usdtFloatingPnL + totalOtherFloatingPnL;
  const totalFloatingPct =
    totalInvestedCostBasis > 0 ? (totalFloatingPnL / totalInvestedCostBasis) * 100 : 0;

  // 3. Risk & Volatility Tiers
  // Tier 1: Defensive Liquid (Pure operating Cash, Bank, e-Money — excluding Crypto/USDT)
  const defensiveLiquid = useMemo(() => {
    return wallets
      .filter(
        (w) =>
          w.classification !== "credit" &&
          w.classification !== "loan" &&
          !isCryptoOrInvWallet(w),
      )
      .reduce(
        (sum, w) => sum + Math.max(0, balancesById[w.id] ?? Number(w.balance || 0)),
        0,
      );
  }, [wallets, balancesById]);

  // Tier 2: Stable / Fixed Income (Gold, Property, Fixed Assets)
  const stableFixed = otherValuations
    .filter((h) => h.asset_type === "fixed_asset" || h.asset_type === "gold")
    .reduce((sum, h) => sum + h.marketValue, 0);

  // Tier 3: Growth / Volatile (Equities, Crypto, USDT)
  const growthVolatile =
    usdtMarketValue +
    otherValuations
      .filter((h) => h.asset_type === "crypto" || h.asset_type === "stock")
      .reduce((sum, h) => sum + h.marketValue, 0);

  const grossPortfolioSum = Math.max(1, defensiveLiquid + stableFixed + growthVolatile);
  const defensiveShare = (defensiveLiquid / grossPortfolioSum) * 100;
  const stableShare = (stableFixed / grossPortfolioSum) * 100;
  const volatileShare = (growthVolatile / grossPortfolioSum) * 100;

  // Risk Profile Badge
  const riskProfile =
    volatileShare > 50
      ? { label: isIndonesian ? "Agresif" : "Aggressive", desc: isIndonesian ? "Fokus pada pertumbuhan tinggi & volatilitas" : "High growth & volatility bias" }
      : volatileShare > 25
        ? { label: isIndonesian ? "Moderat" : "Moderate", desc: isIndonesian ? "Keseimbangan seimbang antara stabilitas & pertumbuhan" : "Balanced growth with risk buffer" }
        : { label: isIndonesian ? "Defensif" : "Defensive", desc: isIndonesian ? "Didominasi modal likuid & lindung nilai modal" : "Capital preservation focus" };

  const cardBg = isDark
    ? "linear-gradient(160deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.015) 100%)"
    : "linear-gradient(160deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 247, 250, 0.90) 100%)";

  const cardBorder = isDark
    ? "1px solid rgba(255, 255, 255, 0.08)"
    : "1px solid rgba(0, 0, 0, 0.06)";

  const cardShadow = isDark
    ? "0 18px 44px -10px rgba(0, 0, 0, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.12)"
    : "0 10px 30px -8px rgba(31, 36, 48, 0.06), inset 0 1px 0 #ffffff";

  return (
    <section className="space-y-4 select-none">
      {/* ── Unified Portfolio Performance & Risk Profile (Segmented) ── */}
      <div
        className="p-5 rounded-[26px] space-y-4 relative overflow-hidden"
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

        {/* Header with Segmented Switcher (Zero Text Cutoff) */}
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
                border: cardBorder,
                color: "var(--text-primary)",
              }}
            >
              {activeTelemetryTab === "performance" ? (
                <TrendingUp size={15} strokeWidth={1.75} />
              ) : (
                <Scale size={15} strokeWidth={1.75} />
              )}
            </div>
            <div className="min-w-0">
              <h2
                className="text-[13px] font-semibold text-[var(--text-primary)] leading-tight whitespace-nowrap"
              >
                {isIndonesian ? "Performa & Risiko" : "Performance & Risk"}
              </h2>
              <p className="text-[11px] text-[var(--text-tertiary)] leading-tight mt-0.5 whitespace-nowrap">
                {activeTelemetryTab === "performance"
                  ? (isIndonesian
                      ? "Hasil modal mengambang"
                      : "Floating capital yield")
                  : (isIndonesian
                      ? "Alokasi jenjang risiko"
                      : "Risk tier allocation")}
              </p>
            </div>
          </div>

          {/* Segmented Switcher Pill (Apple Luxury Minimal) */}
          <div
            className="flex items-center p-1 rounded-2xl shrink-0"
            style={{
              background: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.035)",
              border: cardBorder,
            }}
          >
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setActiveTelemetryTab("performance");
              }}
              className="px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all duration-200 cursor-pointer"
              style={
                activeTelemetryTab === "performance"
                  ? {
                      background: isDark ? "#FFFFFF" : "#18181B",
                      color: isDark ? "#0A0A0B" : "#FFFFFF",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                    }
                  : {
                      background: "transparent",
                      color: "var(--text-secondary)",
                    }
              }
            >
              {isIndonesian ? "Performa" : "Performance"}
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setActiveTelemetryTab("risk");
              }}
              className="px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all duration-200 cursor-pointer"
              style={
                activeTelemetryTab === "risk"
                  ? {
                      background: isDark ? "#FFFFFF" : "#18181B",
                      color: isDark ? "#0A0A0B" : "#FFFFFF",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                    }
                  : {
                      background: "transparent",
                      color: "var(--text-secondary)",
                    }
              }
            >
              {isIndonesian ? "Risiko" : "Risk"}
            </button>
          </div>
        </div>

        {/* Dynamic Tab 1: Unrealized Performance */}
        {activeTelemetryTab === "performance" && (
          <div className="space-y-3.5 animate-fade-in">
            {/* Top Sub-Header Strip with ROI Badge (Strictly Monochrome - No Green/Red) */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium" style={{ color: "var(--text-tertiary)" }}>
                {isIndonesian ? "Efisiensi Hasil Mengambang" : "Floating Yield Efficiency"}
              </span>

              <div
                className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1"
                style={{
                  background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
                  border: cardBorder,
                  color: "var(--text-primary)",
                }}
              >
                <ArrowUpRight
                  size={12}
                  className={totalFloatingPnL < 0 ? "rotate-90 text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"}
                />
                <span>
                  {totalFloatingPct >= 0 ? "+" : ""}
                  {totalFloatingPct.toFixed(1)}% ROI
                </span>
              </div>
            </div>

            {/* 2-Column Metric Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              <div
                className="p-3.5 rounded-2xl space-y-1"
                style={{
                  background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.025)",
                  border: cardBorder,
                }}
              >
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider block"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Floating P&amp;L
                </span>
                <p
                  className="text-[17px] font-semibold amount tracking-tight leading-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  {hideBalance
                    ? "••••"
                    : `${totalFloatingPnL >= 0 ? "+" : ""}${formatWithPreferred(totalFloatingPnL)}`}
                </p>
                <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                  {isIndonesian ? "Keuntungan modal bersih" : "Net floating return"}
                </p>
              </div>

              <div
                className="p-3.5 rounded-2xl space-y-1"
                style={{
                  background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.025)",
                  border: cardBorder,
                }}
              >
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider block"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isIndonesian ? "Nilai Pasar Portofolio" : "Market Valuation"}
                </span>
                <p
                  className="text-[17px] font-semibold amount tracking-tight leading-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  {hideBalance ? "••••" : formatWithPreferred(totalMarketValuation)}
                </p>
                <p className="text-[10px] truncate" style={{ color: "var(--text-secondary)" }}>
                  {isIndonesian ? "Modal Pokok:" : "Cost Basis:"}{" "}
                  {hideBalance ? "••••" : formatWithPreferred(totalInvestedCostBasis)}
                </p>
              </div>
            </div>

            {/* Capital Expansion Ratio Bar */}
            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center justify-between text-[11px]">
                <span style={{ color: "var(--text-tertiary)" }}>
                  {isIndonesian ? "Rasio Ekspansi Modal" : "Capital Expansion Ratio"}
                </span>
                <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  {(1 + Math.max(0, totalFloatingPct) / 100).toFixed(2)}x
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/[0.08] dark:bg-white/[0.08] overflow-hidden flex">
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (100 / Math.max(100, 100 + totalFloatingPct)) * 100)}%`,
                    background: isDark ? "rgba(255,255,255,0.4)" : "rgba(24,24,27,0.4)",
                  }}
                  title="Cost Basis"
                />
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (Math.max(0, totalFloatingPct) / Math.max(100, 100 + totalFloatingPct)) * 100)}%`,
                    background: isDark ? "#FFFFFF" : "#18181B",
                    boxShadow: isDark && totalFloatingPnL > 0 ? "0 0 8px rgba(255,255,255,0.4)" : undefined,
                  }}
                  title="Floating Gain"
                />
              </div>
              <div className="flex justify-between text-[9px] pt-0.5" style={{ color: "var(--text-tertiary)" }}>
                <span>{isIndonesian ? "Modal Pokok (100%)" : "Invested Cost (100%)"}</span>
                <span>
                  {isIndonesian ? "Pertumbuhan" : "Gain"} ({totalFloatingPct >= 0 ? "+" : ""}
                  {totalFloatingPct.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Tab 2: Risk & Volatility Profile */}
        {activeTelemetryTab === "risk" && (
          <div className="space-y-3.5 animate-fade-in">
            {/* Top Sub-Header Strip with Risk Profile Badge */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium" style={{ color: "var(--text-tertiary)" }}>
                {isIndonesian ? "Kategori Toleransi Risiko" : "Risk Tolerance Stance"}
              </span>

              <div
                className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                style={{
                  background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
                  border: cardBorder,
                  color: "var(--text-primary)",
                }}
              >
                {riskProfile.label}
              </div>
            </div>

            {/* 3-Segment Proportional Bar (Apple Battery / Health Style) */}
            <div className="space-y-1.5">
              <div className="w-full h-3 rounded-full bg-white/[0.08] dark:bg-white/[0.08] overflow-hidden flex gap-0.5 p-0.5">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${defensiveShare}%`,
                    background: isDark ? "#FFFFFF" : "#18181B",
                  }}
                  title={`Defensif: ${defensiveShare.toFixed(1)}%`}
                />
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${stableShare}%`,
                    background: isDark ? "rgba(255,255,255,0.45)" : "rgba(24,24,27,0.45)",
                  }}
                  title={`Stabil: ${stableShare.toFixed(1)}%`}
                />
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${volatileShare}%`,
                    background: isDark ? "rgba(255,255,255,0.2)" : "rgba(24,24,27,0.2)",
                  }}
                  title={`Volatil: ${volatileShare.toFixed(1)}%`}
                />
              </div>
            </div>

            {/* 3-Tier Metric Breakdown */}
            <div className="grid grid-cols-3 gap-2">
              {/* Tier 1: Defensive Liquid */}
              <div
                className="p-3 rounded-xl space-y-1"
                style={{
                  background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.025)",
                  border: cardBorder,
                }}
              >
                <div className="flex items-center gap-1">
                  <ShieldCheck size={11} style={{ color: "var(--text-secondary)" }} />
                  <span className="text-[10px] font-semibold truncate" style={{ color: "var(--text-tertiary)" }}>
                    {isIndonesian ? "Defensif" : "Defensive"}
                  </span>
                </div>
                <p className="text-[13px] font-semibold amount" style={{ color: "var(--text-primary)" }}>
                  {hideBalance ? "••••" : formatWithPreferred(defensiveLiquid)}
                </p>
                <p className="text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>
                  {defensiveShare.toFixed(1)}%
                </p>
              </div>

              {/* Tier 2: Stable / Fixed Assets */}
              <div
                className="p-3 rounded-xl space-y-1"
                style={{
                  background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.025)",
                  border: cardBorder,
                }}
              >
                <div className="flex items-center gap-1">
                  <Scale size={11} style={{ color: "var(--text-secondary)" }} />
                  <span className="text-[10px] font-semibold truncate" style={{ color: "var(--text-tertiary)" }}>
                    {isIndonesian ? "Stabil" : "Stable"}
                  </span>
                </div>
                <p className="text-[13px] font-semibold amount" style={{ color: "var(--text-primary)" }}>
                  {hideBalance ? "••••" : formatWithPreferred(stableFixed)}
                </p>
                <p className="text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>
                  {stableShare.toFixed(1)}%
                </p>
              </div>

              {/* Tier 3: Growth / Volatile */}
              <div
                className="p-3 rounded-xl space-y-1"
                style={{
                  background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.025)",
                  border: cardBorder,
                }}
              >
                <div className="flex items-center gap-1">
                  <Zap size={11} style={{ color: "var(--text-secondary)" }} />
                  <span className="text-[10px] font-semibold truncate" style={{ color: "var(--text-tertiary)" }}>
                    {isIndonesian ? "Pertumbuhan" : "Growth"}
                  </span>
                </div>
                <p className="text-[13px] font-semibold amount" style={{ color: "var(--text-primary)" }}>
                  {hideBalance ? "••••" : formatWithPreferred(growthVolatile)}
                </p>
                <p className="text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>
                  {volatileShare.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Sticky Mini Telemetry Footer (Monochrome, 1 Line) */}
        <div
          className="pt-2.5 flex items-center justify-between text-[10.5px]"
          style={{
            borderTop: isDark
              ? "1px solid rgba(255, 255, 255, 0.06)"
              : "1px solid rgba(0, 0, 0, 0.05)",
            color: "var(--text-tertiary)",
          }}
        >
          <span>
            {isIndonesian ? "Profil:" : "Stance:"}{" "}
            <strong className="font-semibold" style={{ color: "var(--text-primary)" }}>
              {riskProfile.label} ({volatileShare.toFixed(1)}% {isIndonesian ? "Pertumbuhan" : "Growth"})
            </strong>
          </span>
          <span>
            {isIndonesian ? "Ekspansi:" : "Expansion:"}{" "}
            <strong className="font-semibold" style={{ color: "var(--text-primary)" }}>
              {(1 + Math.max(0, totalFloatingPct) / 100).toFixed(2)}x
            </strong>
          </span>
        </div>
      </div>
    </section>
  );
}
