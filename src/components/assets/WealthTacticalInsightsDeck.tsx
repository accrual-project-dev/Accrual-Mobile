// ======================================================================
// TROUVAILLE WEALTH TACTICAL INSIGHTS DECK
// Fiduciary actionable intelligence:
// 1. Emergency Runway Health
// 2. Concentration & Single-Asset Risk
// 3. Debt & Leverage Solvency
// 4. Floating Return & Harvesting Dynamics
// 5. Allocation & Risk Stance Profile
// 6. Currency & Foreign Exchange Resilience
// Strictly compliant with GEMINI.md: Monochrome Apple Luxury Theme
// ======================================================================

import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { useCurrency } from "../../contexts/CurrencyContext";
import {
  getSavedUsdtPref,
  calculateHoldingValuation,
} from "../../lib/marketPriceService";
import type { InvestmentHolding, Wallet } from "../../lib/types";
import { useWalletBalances } from "../../hooks/useWalletBalances";

interface WealthTacticalInsightsDeckProps {
  holdings: InvestmentHolding[];
  wallets: Wallet[];
  netWorth: number;
  totalLiabilities?: number;
  monthlyBurnRate?: number;
}

export function WealthTacticalInsightsDeck({
  holdings = [],
  wallets = [],
  netWorth: _netWorth = 0,
  totalLiabilities = 0,
  monthlyBurnRate = 0,
}: WealthTacticalInsightsDeckProps) {
  const { isIndonesian } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const { user } = useAuth();
  const { preferredCurrency, formatWithPreferred } = useCurrency();
  const formatCurrency = (val: number, _curr?: string) => formatWithPreferred(val);

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

  // Total Invested Capital & Floating P&L
  const totalInvestedCostBasis = usdtCostBasis + totalOtherCostBasis;
  const totalMarketValuation = usdtMarketValue + totalOtherMarketValue;
  const totalFloatingPnL = totalMarketValuation - totalInvestedCostBasis;
  const totalFloatingPct =
    totalInvestedCostBasis > 0
      ? (totalFloatingPnL / totalInvestedCostBasis) * 100
      : 0;

  // 3. Tiered Asset Breakdown for Tactical Engine
  const liquidCashOnly = useMemo(() => {
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

  const defensiveLiquid = liquidCashOnly + (usdtUnits > 0 ? usdtMarketValue : 0);

  const stableFixed = useMemo(() => {
    return holdings
      .filter(
        (h) =>
          h.asset_type === "gold" ||
          h.asset_type === "fixed_asset" ||
          h.asset_type === "bond",
      )
      .reduce((sum, h) => sum + calculateHoldingValuation(h).marketValue, 0);
  }, [holdings]);

  const growthVolatile = useMemo(() => {
    return holdings
      .filter(
        (h) =>
          (h.asset_type === "crypto" && h.symbol?.toUpperCase() !== "USDT") ||
          h.asset_type === "stock" ||
          h.asset_type === "mutual_fund",
      )
      .reduce((sum, h) => sum + calculateHoldingValuation(h).marketValue, 0);
  }, [holdings]);

  const grossPortfolioSum = defensiveLiquid + stableFixed + growthVolatile;

  const defensiveShare =
    grossPortfolioSum > 0 ? (defensiveLiquid / grossPortfolioSum) * 100 : 0;
  const stableShare =
    grossPortfolioSum > 0 ? (stableFixed / grossPortfolioSum) * 100 : 0;
  const volatileShare =
    grossPortfolioSum > 0 ? (growthVolatile / grossPortfolioSum) * 100 : 0;

  // Emergency Runway in Months
  const emergencyRunwayMonths =
    monthlyBurnRate > 0 ? liquidCashOnly / monthlyBurnRate : 0;

  // Leverage Ratio
  const leverageRatio =
    grossPortfolioSum > 0 ? (totalLiabilities / grossPortfolioSum) * 100 : 0;

  // Currency Diversification (USDT Share)
  const usdtShare =
    grossPortfolioSum > 0 ? (usdtMarketValue / grossPortfolioSum) * 100 : 0;

  // Concentration: Find Largest Single Holding
  const largestAsset = useMemo(() => {
    let top: { name: string; symbol: string; value: number } | null = null;
    if (usdtMarketValue > 0) {
      top = { name: "Tether USD", symbol: "USDT", value: usdtMarketValue };
    }
    for (const h of otherValuations) {
      if (!top || h.marketValue > top.value) {
        top = { name: h.name, symbol: h.symbol, value: h.marketValue };
      }
    }
    return top;
  }, [usdtMarketValue, otherValuations]);

  const largestAssetShare =
    largestAsset && grossPortfolioSum > 0
      ? (largestAsset.value / grossPortfolioSum) * 100
      : 0;

  // 4. Tactical Wealth Intelligence Pool
  const tacticalInsights = useMemo(() => {
    interface InsightCard {
      id: string;
      tag: string;
      title: string;
      description: string;
      priority: number;
    }
    const pool: InsightCard[] = [];

    // --- SPECIAL CASE: ZERO GROSS PORTFOLIO ---
    if (grossPortfolioSum <= 0) {
      pool.push({
        id: "portfolio_foundation",
        tag: isIndonesian ? "Fondasi Modal" : "Capital Foundation",
        title: isIndonesian ? "Inisialisasi Portofolio Kekayaan" : "Portfolio Asset Initialization",
        description: isIndonesian
          ? "Mulai dengan mencatat dompet kas operasional atau kepemilikan aset Anda untuk mengaktifkan telemetri alokasi multi-musim, rasio bantalan likuiditas, dan manajemen solvabilitas otomatis."
          : "Begin by recording your core liquid wallets or asset holdings to activate multi-asset telemetry, emergency liquidity ratios, and automated solvency management.",
        priority: 100,
      });
      return pool;
    }

    // --- CONDITION 1: LIQUIDITY & EMERGENCY RUNWAY ---
    if (liquidCashOnly <= 0 && (growthVolatile + stableFixed) > 0) {
      pool.push({
        id: "runway_no_cash",
        tag: isIndonesian ? "Alokasi Kas" : "Liquidity Allocation",
        title: isIndonesian ? "Rekonsiliasi Saldo Kas Operasional" : "Operational Cash Reconciliation",
        description: isIndonesian
          ? "Portofolio mencatat posisi investasi aktif namun belum memiliki dompet kas likuid. Hubungkan rekening kas operasional harian Anda agar ketahanan dana darurat dapat diukur akurat."
          : "Your portfolio holds active investments but no liquid cash wallet is recorded. Record your daily operational cash to establish your emergency liquidity runway.",
        priority: 95,
      });
    } else if (monthlyBurnRate <= 0) {
      pool.push({
        id: "runway_uncalibrated",
        tag: isIndonesian ? "Bantalan Kas" : "Cash Buffer",
        title: isIndonesian ? "Cadangan Kas Siaga Terdeteksi" : "Standby Cash Reserve Detected",
        description: isIndonesian
          ? `Tersedia cadangan kas likuid ${formatCurrency(liquidCashOnly, preferredCurrency)}. Mulai catat transaksi pengeluaran rutin Anda untuk mengaktifkan kalkulasi durasi bertahan hidup (runway) yang presisi.`
          : `Active liquid cash reserves stand at ${formatCurrency(liquidCashOnly, preferredCurrency)}. Begin logging routine expenses to unlock precise survival runway and burn-rate calculations.`,
        priority: 70,
      });
    } else if (emergencyRunwayMonths < 3) {
      const targetBuffer = monthlyBurnRate * 3;
      pool.push({
        id: "runway_critical",
        tag: isIndonesian ? "Pertahanan Kas" : "Liquidity Defense",
        title: isIndonesian ? "Penguatan Bantalan Kas Operasional" : "Operational Cash Reinforcement",
        description: isIndonesian
          ? `Cadangan kas defensif (${formatCurrency(liquidCashOnly, preferredCurrency)}) menopang ${emergencyRunwayMonths.toFixed(1)} bulan pengeluaran. Sebelum menambah aset berisiko tinggi, prioritaskan akumulasi dana darurat hingga mencapai ambang aman 3–6 bulan (${formatCurrency(targetBuffer, preferredCurrency)}).`
          : `Liquid cash (${formatCurrency(liquidCashOnly, preferredCurrency)}) covers ${emergencyRunwayMonths.toFixed(1)} months of burn. Prioritize building emergency reserves toward the 3–6 month benchmark (${formatCurrency(targetBuffer, preferredCurrency)}) before expanding volatile asset exposures.`,
        priority: 92,
      });
    } else if (emergencyRunwayMonths > 12) {
      pool.push({
        id: "runway_extended",
        tag: isIndonesian ? "Efisiensi Modal" : "Capital Efficiency",
        title: isIndonesian ? "Surplus Kas & Mitigasi Inflasi" : "Excess Liquidity & Inflation Optimization",
        description: isIndonesian
          ? `Cadangan kas likuid mencapai ${emergencyRunwayMonths.toFixed(0)} bulan pengeluaran rutin. Karena batas aman likuiditas telah terpenuhi, surplus kas mengendap dapat dialokasikan bertahap ke instrumen berimbal hasil stabil (seperti emas atau obligasi) guna mencegah penurunan daya beli riil.`
          : `Liquid cash covers ${emergencyRunwayMonths.toFixed(0)} months of burn. With baseline safety thresholds exceeded, excess idle cash can be systematically deployed into stable compounding assets to prevent purchasing power erosion.`,
        priority: 65,
      });
    } else {
      pool.push({
        id: "runway_optimal",
        tag: isIndonesian ? "Ketahanan Modal" : "Capital Resilience",
        title: isIndonesian ? "Bantalan Likuiditas di Zona Sehat" : "Healthy Liquidity Buffer Zone",
        description: isIndonesian
          ? `Cadangan kas defensif (${emergencyRunwayMonths.toFixed(1)} bulan biaya hidup) memberikan ketenangan dan fleksibilitas bagi portofolio Anda tanpa risiko penjualan paksa saat pasar mengalami koreksi.`
          : `Defensive cash reserves (${emergencyRunwayMonths.toFixed(1)} months of expenses) provide resilient shock absorption for your portfolio without forced asset liquidations during market pullbacks.`,
        priority: 60,
      });
    }

    // --- CONDITION 2: CONCENTRATION & SINGLE-ASSET RISK ---
    if (largestAsset && largestAssetShare >= 40 && grossPortfolioSum > 0) {
      pool.push({
        id: "concentration_risk",
        tag: isIndonesian ? "Konsentrasi Aset" : "Portfolio Concentration",
        title: isIndonesian ? `Dominasi Aset Tunggal pada ${largestAsset.name}` : `Concentrated Exposure in ${largestAsset.name}`,
        description: isIndonesian
          ? `Instrumen ${largestAsset.name} menguasai ${largestAssetShare.toFixed(1)}% dari total kekayaan portofolio (${formatCurrency(largestAsset.value, preferredCurrency)}). Dominasi asimetris ini memperbesar sensitivitas terhadap volatilitas instrumen tunggal; pertimbangkan diversifikasi bertahap.`
          : `${largestAsset.name} accounts for ${largestAssetShare.toFixed(1)}% of your total portfolio (${formatCurrency(largestAsset.value, preferredCurrency)}). This heavy weighting creates asymmetric dependency; consider trimming or diversifying into uncorrelated asset classes.`,
        priority: 88,
      });
    }

    // --- CONDITION 3: DEBT & LEVERAGE SOLVENCY ---
    if (leverageRatio >= 35) {
      pool.push({
        id: "leverage_warning",
        tag: isIndonesian ? "Peringatan Liabilitas" : "Leverage Caution",
        title: isIndonesian ? "Rasio Liabilitas Melampaui 35% Portofolio" : "Elevated Debt-to-Asset Ratio",
        description: isIndonesian
          ? `Total kewajiban utang (${formatCurrency(totalLiabilities, preferredCurrency)}) menyerap ${leverageRatio.toFixed(1)}% dari total aset kotor (di atas ambang aman konservatif 35%). Prioritaskan percepatan amortisasi pokok utang sebelum memperbesar posisi spekulatif.`
          : `Liabilities (${formatCurrency(totalLiabilities, preferredCurrency)}) represent ${leverageRatio.toFixed(1)}% of gross asset valuation (above the conservative 35% ceiling). Prioritize debt amortization to relieve monthly cashflow drag before taking on higher-beta risks.`,
        priority: 90,
      });
    } else if (totalLiabilities === 0) {
      pool.push({
        id: "debt_free",
        tag: isIndonesian ? "Struktur Neraca" : "Balance Sheet Health",
        title: isIndonesian ? "Solvabilitas Ekuitas 100% Bebas Utang" : "Unencumbered Balance Sheet",
        description: isIndonesian
          ? "Neraca portofolio beroperasi dengan nol liabilitas utang, memastikan seluruh arus kas masuk terakumulasi utuh ke nilai kekayaan bersih tanpa tergerus beban bunga pinjaman."
          : "Your balance sheet carries zero liabilities, ensuring 100% equity retention and zero recurring interest payments dragging on your monthly capital accumulation.",
        priority: 50,
      });
    } else {
      pool.push({
        id: "leverage_prudent",
        tag: isIndonesian ? "Solvabilitas" : "Solvency",
        title: isIndonesian ? "Struktur Leverage Terkendali & Pruden" : "Conservative Leverage Health",
        description: isIndonesian
          ? `Rasio utang terhadap aset tercatat ${leverageRatio.toFixed(1)}%, berada nyaman di bawah batas aman 35% sehingga kapasitas pembayaran kewajiban tetap terjaga prima.`
          : `Liabilities stand at ${leverageRatio.toFixed(1)}% of gross asset value, comfortably within healthy benchmark thresholds (<35%) and preserving long-term solvency.`,
        priority: 52,
      });
    }

    // --- CONDITION 4: PERFORMANCE & FLOATING RETURN DYNAMICS ---
    if (totalFloatingPct >= 20 && totalFloatingPnL > 1000000) {
      pool.push({
        id: "pnl_harvest",
        tag: isIndonesian ? "Realisasi Modal" : "Profit Harvesting",
        title: isIndonesian ? `Peluang Penguncian Profit (+${totalFloatingPct.toFixed(1)}%)` : `Profit Harvesting Window (+${totalFloatingPct.toFixed(1)}%)`,
        description: isIndonesian
          ? `Keuntungan modal mengambang portofolio mencapai +${formatCurrency(totalFloatingPnL, preferredCurrency)}. Pertimbangkan penguncian sebagian profit siklikal ke kas defensif atau emas fisik guna memproteksi nilai kekayaan bersih.`
          : `Floating returns stand at +${totalFloatingPct.toFixed(1)}% (+${formatCurrency(totalFloatingPnL, preferredCurrency)}). Consider systematically harvesting a portion of cyclical gains into defensive vaults or gold to lock in baseline net worth.`,
        priority: 84,
      });
    } else if (totalFloatingPct <= -12) {
      pool.push({
        id: "pnl_drawdown",
        tag: isIndonesian ? "Evaluasi Diskon" : "Drawdown Valuation",
        title: isIndonesian ? `Manajemen Penurunan Modal (${totalFloatingPct.toFixed(1)}%)` : `Drawdown Valuation Management (${totalFloatingPct.toFixed(1)}%)`,
        description: isIndonesian
          ? `Portofolio mencatat kontraksi mengambang ${formatCurrency(totalFloatingPnL, preferredCurrency)}. Hindari pelepasan aset secara panik; telaah kembali tesis dasar untuk mempertimbangkan cicil akumulasi (DCA) pada harga diskon.`
          : `Portfolio reflects an unrealized contraction of ${formatCurrency(totalFloatingPnL, preferredCurrency)} (${totalFloatingPct.toFixed(1)}%). Avoid panic liquidations; evaluate whether core fundamentals justify selective dollar-cost averaging at discount valuations.`,
        priority: 82,
      });
    }

    // --- CONDITION 5: ALLOCATION & RISK STANCE PROFILE ---
    if (volatileShare >= 65) {
      pool.push({
        id: "stance_aggressive",
        tag: isIndonesian ? "Profil Risiko" : "Risk Profile",
        title: isIndonesian ? "Alokasi Pertumbuhan Agresif Ber-Beta Tinggi" : "High Growth & Beta Stance",
        description: isIndonesian
          ? `Aset bertumbuh volatil (saham & kripto) mendominasi ${volatileShare.toFixed(1)}% dari total portofolio. Posisi ini memaksimalkan akselerasi modal di siklus bull run, namun siapkan aturan stop-loss atau rebalancing sistematis.`
          : `Growth and volatile assets comprise ${volatileShare.toFixed(1)}% of your capital. While maximizing upside in market expansions, establish disciplined rebalancing triggers to withstand cyclical retracements.`,
        priority: 78,
      });
    } else if (defensiveShare >= 65 && totalInvestedCostBasis > 0) {
      pool.push({
        id: "stance_defensive_drag",
        tag: isIndonesian ? "Efisiensi Modal" : "Capital Efficiency",
        title: isIndonesian ? "Potensi Hambatan Kas Defensif (Cash Drag)" : "Defensive Cash Drag & Inflation Risk",
        description: isIndonesian
          ? `Cadangan kas likuid mencapai ${defensiveShare.toFixed(1)}% dari portofolio. Walau risiko pasar minim, porsi kas mengendap yang terlalu besar rentan tergerus inflasi riil. Eksplorasi penempatan bertahap pada aset berimbal hasil stabil.`
          : `Liquid cash constitutes ${defensiveShare.toFixed(1)}% of your portfolio. While downside risk is zero, excessive uninvested cash risks real purchasing power erosion against inflation. Consider laddering into low-volatility yield instruments.`,
        priority: 76,
      });
    } else if (
      defensiveShare >= 15 &&
      defensiveShare <= 45 &&
      stableShare >= 10 &&
      volatileShare >= 25 &&
      volatileShare <= 55
    ) {
      pool.push({
        id: "stance_balanced",
        tag: isIndonesian ? "Arsitektur Modal" : "Portfolio Health",
        title: isIndonesian ? "Keseimbangan Institusional Multi-Musim" : "All-Weather Institutional Balance",
        description: isIndonesian
          ? `Alokasi modal Anda mencerminkan arsitektur institusional yang prima (${defensiveShare.toFixed(0)}% Defensif, ${stableShare.toFixed(0)}% Stabil, ${volatileShare.toFixed(0)}% Pertumbuhan), memberikan peredam kejut tanpa mengorbankan kecepatan imbal hasil.`
          : `Your capital split exhibits an exemplary all-weather balance (${defensiveShare.toFixed(0)}% Defensive, ${stableShare.toFixed(0)}% Stable, ${volatileShare.toFixed(0)}% Growth), offering robust shock absorption while sustaining steady compounding.`,
        priority: 72,
      });
    }

    // --- CONDITION 6: CURRENCY & GLOBAL HEDGING ---
    if (usdtShare >= 8) {
      pool.push({
        id: "fx_hedged",
        tag: isIndonesian ? "Ketahanan Makro" : "Macro Hedge",
        title: isIndonesian ? "Bantalan Valuta Global & Lindung Nilai Kurs" : "Currency Hedge & Foreign Resilience",
        description: isIndonesian
          ? `Instrumen valuta global & USDT mewakili ${usdtShare.toFixed(1)}% dari total aset Anda. Porsi ini menjadi bantalan lindung nilai alami terhadap pelemahan nilai tukar domestik dan inflasi makro.`
          : `Global currency & USDT instruments represent ${usdtShare.toFixed(1)}% of your portfolio, acting as a natural currency hedge against domestic exchange rate depreciation.`,
        priority: 68,
      });
    } else if (usdtShare === 0 && grossPortfolioSum > 10000000 && growthVolatile > 0) {
      pool.push({
        id: "fx_domestic_only",
        tag: isIndonesian ? "Eksposur Kurs" : "FX Exposure",
        title: isIndonesian ? "Konsentrasi Penuh pada Mata Uang Domestik" : "100% Domestic Currency Exposure",
        description: isIndonesian
          ? `Seluruh aset portofolio terikat pada mata uang domestik. Mempertimbangkan porsi 5–15% pada aset berdenominasi global atau emas fisik dapat menambah ketahanan terhadap pergeseran makroekonomi.`
          : `100% of your portfolio is denominated in domestic currency. Introducing a modest 5–15% allocation in global stablecoins or physical gold can enhance macroeconomic resilience.`,
        priority: 64,
      });
    }

    // Sort by priority descending and take top 3
    return pool.sort((a, b) => b.priority - a.priority).slice(0, 3);
  }, [
    isIndonesian,
    preferredCurrency,
    liquidCashOnly,
    emergencyRunwayMonths,
    monthlyBurnRate,
    largestAsset,
    largestAssetShare,
    grossPortfolioSum,
    leverageRatio,
    totalLiabilities,
    totalFloatingPct,
    totalFloatingPnL,
    defensiveShare,
    stableShare,
    volatileShare,
    totalInvestedCostBasis,
    usdtShare,
    growthVolatile,
  ]);

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
    <section className="select-none">
      {/* ── Wealth Intelligence & Actionable Insights Card (Pinned at Bottom) ── */}
      <div
        className="p-4 sm:p-5 rounded-[24px] space-y-3 relative overflow-hidden select-none"
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

        <div className="flex items-center gap-2">
          <Sparkles size={15} strokeWidth={1.75} style={{ color: "var(--text-tertiary)" }} />
          <h3
            className="text-[12px] font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {isIndonesian ? "Wawasan Taktis Kekayaan" : "Wealth Tactical Insights"}
          </h3>
        </div>

        <div className="space-y-2.5 text-[11px] leading-relaxed">
          {tacticalInsights.map((insight) => (
            <div key={insight.id} className="flex items-start gap-2.5">
              <span
                className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                style={{ background: isDark ? "#FFFFFF" : "#09090C" }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider"
                    style={{
                      background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
                      border: cardBorder,
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {insight.tag}
                  </span>
                  <strong
                    className="text-[11.5px] font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {insight.title}:
                  </strong>
                </div>
                <p style={{ color: "var(--text-secondary)" }}>
                  {insight.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
